// Energtech — ler a fatura de energia (foto da câmera, foto da galeria ou PDF) e preencher a proposta.
// A leitura é feita no servidor (função ler-fatura). Campo que não foi lido fica vazio: nada é inventado.
// O vendedor confere e corrige tudo antes de usar. Ao salvar o orçamento, o arquivo vai para a pasta privada
// "documentos" do cliente e aparece na ficha do CRM como "Fatura de energia" (só a equipe logada abre).
// (carregado pelo index.html depois de js/app.js)

let faturaLida = null;   // dados da última fatura aplicada (vão para o orçamento salvo, em dados.fatura)
let _faturaTela = null;  // dados da última leitura, mostrados para conferência
let _arquivoLido = null;    // arquivo da última leitura (em memória)
let _arquivoFatura = null;  // arquivo da fatura aplicada: guardado no cliente quando o orçamento é salvo

const FORNECIMENTO_TXT = { monofasico: 'Monofásico', bifasico: 'Bifásico', trifasico: 'Trifásico' };
const MESES_ORDEM = m => { const [mm, aa] = String(m).split('/'); return +aa * 12 + +mm; };

function arquivoParaBase64(blob) {
  return new Promise((ok, erro) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(',')[1]); fr.onerror = () => erro(new Error('não foi possível ler o arquivo')); fr.readAsDataURL(blob); });
}
function statusFatura(t, tipo) {
  const el = document.getElementById('fat-status'); if (!el) return;
  el.textContent = t || '';
  el.style.color = tipo === 'erro' ? 'var(--vermelho)' : tipo === 'ok' ? 'var(--verde)' : 'var(--muted)';
}

async function lerFatura(input) {
  const arq = input.files && input.files[0]; input.value = '';
  if (!arq) return;
  document.getElementById('fat-result').innerHTML = '';
  if (!sb || !perfil || !perfil.vendedor) { statusFatura('Entre com seu login de vendedor para ler faturas.', 'erro'); return; }
  if (!navigator.onLine) { statusFatura('Sem internet: a leitura da fatura precisa de conexão. Preencha os dados à mão.', 'erro'); return; }
  const ehPdf = arq.type === 'application/pdf' || /\.pdf$/i.test(arq.name);
  if (!ehPdf && !/^image\//.test(arq.type)) { statusFatura('Formato não aceito. Envie uma foto ou um PDF.', 'erro'); return; }
  if (ehPdf && arq.size > 9 * 1024 * 1024) { statusFatura('PDF maior que 9 MB. Envie uma foto da fatura.', 'erro'); return; }
  const botoes = document.querySelectorAll('#fatura-card .fat-btn');
  botoes.forEach(b => b.classList.add('desativado'));
  try {
    statusFatura('⏳ Preparando o arquivo…');
    const blob = ehPdf ? arq : await reduzirImagem(arq, 2000);   // foto: reduz no aparelho (mais rápido de enviar)
    const arquivo = await arquivoParaBase64(blob);
    _arquivoLido = { blob, ext: ehPdf ? 'pdf' : 'jpg', nome: arq.name || (ehPdf ? 'fatura.pdf' : 'fatura.jpg') };
    statusFatura('⏳ Lendo a fatura… (leva alguns segundos)');
    const { data, error } = await sb.functions.invoke('ler-fatura', { body: { arquivo, tipo: ehPdf ? 'application/pdf' : 'image/jpeg' } });
    let resp = data;
    if (error) {   // a função devolve a mensagem de erro no corpo da resposta
      try { resp = error.context && typeof error.context.json === 'function' ? await error.context.json() : null; } catch (e) { resp = null; }
      if (!resp) throw new Error(/fetch|network/i.test(error.message || '') ? 'sem conexão com o servidor' : (error.message || 'falha na leitura'));
    }
    if (!resp || !resp.ok) { statusFatura('⚠ ' + ((resp && resp.erro) || 'Não foi possível ler a fatura.') + ' Preencha os dados à mão.', 'erro'); return; }
    mostrarFatura(resp.dados);
  } catch (e) {
    console.error(e);
    statusFatura('⚠ Não foi possível ler a fatura (' + (e.message || e) + '). Preencha os dados à mão.', 'erro');
  } finally {
    botoes.forEach(b => b.classList.remove('desativado'));
  }
}

// média do consumo: só com os meses lidos (os 12 mais recentes)
function mediaConsumo(d) {
  const h = (d.historico || []).slice().sort((a, b) => MESES_ORDEM(b.mes) - MESES_ORDEM(a.mes)).slice(0, 12);
  if (h.length) return { media: Math.round(h.reduce((s, x) => s + x.kwh, 0) / h.length), meses: h.length };
  if (d.consumo_mes_kwh != null) return { media: Math.round(d.consumo_mes_kwh), meses: 1 };
  return { media: null, meses: 0 };
}

function mostrarFatura(d) {
  _faturaTela = d;
  const { media, meses } = mediaConsumo(d);
  const tipo = propostaTipo || (typeof abaAtual !== 'undefined' && abaAtual) || 'importado';
  const tarifa = +(tipo === 'importado' ? valorCampo('imp-tarifa') : valorCampo('input-tarifa')) || 0.89;
  const contaEst = media != null ? Math.round(media * tarifa) : null;
  const vazios = [], avisos = [];
  const v = x => x == null ? '' : escHtml(String(x));
  const mascarado = !!(d.cpf_cnpj && d.cpf_cnpj.includes('*'));
  const campo = (id, rot, val, larg) => {
    if ((val == null || val === '') && !(id === 'fat-cpf' && mascarado)) vazios.push(rot);   // CPF mascarado já tem aviso próprio
    return `<div class="fat-campo${larg ? ' fat-largo' : ''}"><label for="${id}">${rot}</label><input id="${id}" class="proposta-input${val == null || val === '' ? ' fat-vazio' : ''}" value="${v(val)}" placeholder="não lido — preencha se souber"></div>`;
  };
  if (d.legibilidade !== 'boa') avisos.push('Leitura ' + (d.legibilidade === 'parcial' ? 'parcial' : 'ruim') + ': confira todos os campos com a fatura.');
  if (d.cpf_cnpj && d.cpf_cnpj.includes('*')) avisos.push('O CPF/CNPJ aparece mascarado na fatura — peça o documento ao cliente (não vai para a proposta assim).');
  if (meses && meses < 12) avisos.push('Média calculada com ' + meses + (meses === 1 ? ' mês' : ' meses') + ' de consumo lidos (o ideal são 12).');
  if (!meses) avisos.push('Não foi possível ler o consumo: informe a média à mão.');
  if (d.classificacao && /^\s*A\s*\d/i.test(d.classificacao)) avisos.push('Fatura do grupo A (média tensão): a proposta precisa de análise de demanda — fale com o engenheiro.');
  if (d.tem_geracao_propria) avisos.push('A fatura mostra geração própria/créditos: o consumo da fatura pode estar menor que o real.');
  if (d.observacoes) avisos.push('Observação da leitura: ' + escHtml(d.observacoes));
  const hist = (d.historico || []).slice().sort((a, b) => MESES_ORDEM(a.mes) - MESES_ORDEM(b.mes));
  // nome na proposta: se já há um nome (ex.: cliente do CRM) diferente do titular, a proposta fica no nome dessa pessoa
  const normNome = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
  const nomeAtual = (document.getElementById('prop-nome') || {}).value ? document.getElementById('prop-nome').value.trim() : '';
  const outro = !!nomeAtual && !!d.titular && normNome(nomeAtual) !== normNome(d.titular);
  document.getElementById('fat-result').innerHTML = `
    <div class="fat-grade">
      ${campo('fat-titular', 'Titular da fatura (UC)', d.titular, true)}
      <div class="fat-largo" style="font-size:14px">
        <div style="font-size:12px;color:var(--muted);margin-bottom:3px">Nome na proposta</div>
        <label style="display:flex;gap:8px;align-items:center;margin:4px 0;cursor:pointer"><input type="radio" name="fat-nome-op" value="titular" ${outro ? '' : 'checked'}> Titular da fatura</label>
        <label style="display:flex;gap:8px;align-items:center;margin:4px 0;cursor:pointer"><input type="radio" name="fat-nome-op" value="outro" ${outro ? 'checked' : ''}> Outra pessoa (quem está negociando, ex.: quem chamou pelo anúncio)</label>
        <input id="fat-nome-outro" class="proposta-input" style="width:100%;box-sizing:border-box" value="${v(nomeAtual)}" placeholder="Nome de quem está negociando" oninput="document.querySelector('input[name=fat-nome-op][value=outro]').checked = true">
      </div>
      ${campo('fat-cpf', 'CPF / CNPJ', d.cpf_cnpj && !d.cpf_cnpj.includes('*') ? d.cpf_cnpj : null)}
      ${campo('fat-uc', 'Unidade consumidora (UC)', d.uc)}
      ${campo('fat-endereco', 'Endereço da instalação', d.endereco, true)}
      ${campo('fat-cidade', 'Cidade / UF', d.cidade ? d.cidade + (d.uf ? ' / ' + d.uf : '') : null)}
      ${campo('fat-cep', 'CEP', d.cep)}
      ${campo('fat-conc', 'Concessionária', d.concessionaria)}
      ${campo('fat-media', 'Consumo médio (kWh/mês)', media)}
      ${campo('fat-conta', 'Conta média estimada (R$/mês)', contaEst)}
    </div>
    <div class="regiao-aviso" style="margin-top:6px">
      ${[d.classificacao, d.fornecimento ? FORNECIMENTO_TXT[d.fornecimento] : '', d.mes_referencia ? 'ref. ' + d.mes_referencia : '',
         d.consumo_mes_kwh != null ? 'consumo do mês ' + d.consumo_mes_kwh.toLocaleString('pt-BR') + ' kWh' : '',
         d.valor_total != null ? 'valor desta fatura ' + fmt(d.valor_total) : ''].filter(Boolean).map(escHtml).join(' · ')}
      ${contaEst != null ? '<br>Conta média estimada = consumo médio × tarifa ' + fmt(tarifa) + '/kWh (a fatura do mês pode ter multa, juros ou iluminação pública).' : ''}
      ${hist.length ? '<br>Consumo lido: ' + hist.map(h => escHtml(h.mes.slice(0, 2) + '/' + h.mes.slice(5)) + ' <b>' + h.kwh.toLocaleString('pt-BR') + '</b>').join(' · ') : ''}
    </div>
    ${avisos.length || vazios.length ? `<div class="fat-avisos">${avisos.map(a => '⚠ ' + a).join('<br>')}${vazios.length ? (avisos.length ? '<br>' : '') + 'Não lido: ' + vazios.map(escHtml).join(', ') + '.' : ''}</div>` : ''}
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">
      <button class="campo-btn" style="width:auto;margin:0;padding:10px 18px;font-size:16px" onclick="aplicarFatura()">✅ Usar dados do cliente</button>
      <button class="link-mini" onclick="descartarFatura()">Descartar</button>
    </div>`;
  // editar a média refaz a conta estimada (média × tarifa); editar a conta vale como está
  const elMedia = document.getElementById('fat-media'), elConta = document.getElementById('fat-conta');
  if (elMedia) elMedia.addEventListener('input', () => { const m = Math.round(+String(elMedia.value).replace(/\./g, '').replace(',', '.') || 0); if (m > 0 && elConta) elConta.value = Math.round(m * tarifa); aplicarConsumoFatura(); });
  if (elConta) elConta.addEventListener('input', aplicarConsumoFatura);
  aplicarConsumoFatura();   // consumo e conta já vão para a Proposta rápida e o kit é sugerido na hora
  statusFatura((vazios.length ? 'Leitura concluída. Consumo aplicado e kit sugerido abaixo. Confira os campos e complete o que faltou.' : 'Leitura concluída. Consumo aplicado e kit sugerido abaixo. Confira os dados do cliente.') + ' Depois clique em "Usar dados do cliente".', 'ok');
}

// consumo médio e conta estimada: vão direto para a proposta e para a Proposta rápida, e o kit é sugerido
// (só números de cálculo, o vendedor ajusta à vontade). Se já há kit escolhido, a sugestão aparece sem trocá-lo.
function aplicarConsumoFatura() {
  const v = id => (document.getElementById(id) || {}).value ? document.getElementById(id).value.trim() : '';
  const media = Math.round(+String(v('fat-media')).replace(/\./g, '').replace(',', '.') || 0);
  const conta = lerReais(v('fat-conta'));
  if (media > 0) { document.getElementById('prop-consumo').value = media; const cc = document.getElementById('campo-consumo'); if (cc) cc.value = media; }
  if (conta > 0) sincronizarConta(String(Math.round(conta)), null);
  if (!(media > 0 || conta > 0)) return;
  if (typeof sugerirKit === 'function') sugerirKit();
  if (propostaItem) calcularProducao();
}

function descartarFatura() { _faturaTela = null; document.getElementById('fat-result').innerHTML = ''; statusFatura(''); }

// leva os dados conferidos para a proposta:
// - nome na proposta: titular da fatura ou outra pessoa (quem está negociando), conforme a escolha;
// - titular da UC fica guardado à parte (homologação, contrato, financiamento);
// - dados da instalação (UC, endereço, CEP, cidade, concessionária) vêm da fatura;
// - CPF só entra se não estiver mascarado e se a proposta for no nome do titular.
function aplicarFatura() {
  if (!_faturaTela) return;
  const val = id => (document.getElementById(id) || {}).value ? document.getElementById(id).value.trim() : '';
  const por = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v; };
  const op = (document.querySelector('input[name="fat-nome-op"]:checked') || {}).value || 'titular';
  const titular = val('fat-titular');
  const nomeProp = op === 'outro' ? val('fat-nome-outro') : titular;
  if (op === 'outro' && !nomeProp) { statusFatura('⚠ Informe o nome de quem está negociando (ou escolha "Titular da fatura").', 'erro'); return; }
  por('prop-nome', nomeProp);
  const tit = document.getElementById('prop-titular-uc'); if (tit) tit.value = val('fat-titular');
  const cpf = document.getElementById('prop-cpf');
  if (cpf && op === 'titular' && val('fat-cpf') && !val('fat-cpf').includes('*') && !cpf.value.trim()) cpf.value = val('fat-cpf');
  por('prop-uc', val('fat-uc'));
  por('prop-endereco', val('fat-endereco'));
  por('prop-cep', val('fat-cep'));
  por('prop-concessionaria', val('fat-conc'));
  const cid = document.getElementById('prop-cidade');
  if (cid && val('fat-cidade') && cid.value.trim() !== val('fat-cidade')) { cid.value = val('fat-cidade'); if (typeof regiaoPelaCidade === 'function') regiaoPelaCidade(); }
  aplicarConsumoFatura();
  const media = Math.round(+String(val('fat-media')).replace(/\./g, '').replace(',', '.') || 0);
  const { meses } = mediaConsumo(_faturaTela);
  const d = _faturaTela;
  _arquivoFatura = _arquivoLido ? { ..._arquivoLido } : null;
  faturaLida = {
    concessionaria: val('fat-conc') || d.concessionaria, classificacao: d.classificacao, fornecimento: d.fornecimento,
    mes_referencia: d.mes_referencia, consumo_mes_kwh: d.consumo_mes_kwh, valor_total: d.valor_total,
    historico: d.historico, media_kwh: media || null, meses_media: meses, tem_geracao_propria: d.tem_geracao_propria,
    titular: val('fat-titular') || null,
    lida_em: new Date().toISOString(),
    nome_proposta: val('prop-nome') || '',   // só vai para o orçamento deste cliente
  };
  if (typeof validarProposta === 'function') validarProposta();
  if (typeof avisoCpf === 'function') avisoCpf();
  document.getElementById('fat-result').innerHTML = '';
  statusFatura('✅ Dados da fatura aplicados' + (media > 0 ? ' (consumo médio ' + media.toLocaleString('pt-BR') + ' kWh/mês)' : '') + (op === 'outro' ? ' · proposta em nome de ' + nomeProp + ', titular da UC: ' + titular : '') + (propostaItem ? '.' : '. Agora escolha o kit: "✅ Usar este kit" na sugestão abaixo ou a tabela.'), 'ok');
}

// ── guardar o arquivo da fatura no cliente (pasta privada "documentos", a mesma da ficha do CRM) ──
// Envia uma vez por cliente: salvar o orçamento de novo não duplica o arquivo.
async function guardarArquivoFatura(leadId) {
  const a = _arquivoFatura;
  if (!a || !sb || !leadId) return null;
  if (a.doc && a.leadId === leadId) return { doc: a.doc, novo: false };
  try {
    const path = 'lead-' + leadId + '/fatura-' + Date.now() + '.' + a.ext;
    const { error } = await sb.storage.from('documentos').upload(path, a.blob, { contentType: a.ext === 'pdf' ? 'application/pdf' : 'image/jpeg', upsert: false });
    if (error) throw error;
    a.leadId = leadId;
    a.doc = { id: String(Date.now()), tipo: 'fatura', nome: a.nome, path, em: new Date().toISOString(), autor: perfil.email };
    return { doc: a.doc, novo: true };
  } catch (e) { console.error('Fatura (arquivo):', e); return null; }
}
// tenta 3 vezes (no celular a conexão às vezes falha bem nessa hora); não duplica se a fatura já estiver na ficha
async function anexarFaturaAoLead(leadId, r) {
  if (!r || !r.novo) return true;
  let erro = null;
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      const { data: l, error: eL } = await sb.from('leads').select('documentos').eq('id', leadId).maybeSingle();
      if (eL) throw eL;
      const docs = Array.isArray(l && l.documentos) ? l.documentos : [];
      if (docs.some(x => x && x.path === r.doc.path)) return true;
      const { error } = await sb.from('leads').update({ documentos: [...docs, r.doc] }).eq('id', leadId);
      if (error) throw error;
      return true;
    } catch (e) {
      erro = e;
      console.error('Fatura (ficha do cliente), tentativa ' + tentativa + ':', e);
      await new Promise(ok => setTimeout(ok, 1200 * tentativa));
    }
  }
  statusFatura('⚠ A fatura foi enviada, mas não entrou na ficha do cliente: ' + ((erro && erro.message) || 'falha de conexão') + '. Anexe pela ficha do CRM.', 'erro');
  return false;
}
