// Energtech — ler a fatura de energia (foto da câmera, foto da galeria ou PDF) e preencher a proposta.
// A leitura é feita no servidor (função ler-fatura). Campo que não foi lido fica vazio: nada é inventado.
// O vendedor confere e corrige tudo antes de usar. O arquivo não é guardado.
// (carregado pelo index.html depois de js/app.js)

let faturaLida = null;   // dados da última fatura aplicada (vão para o orçamento salvo, em dados.fatura)
let _faturaTela = null;  // dados da última leitura, mostrados para conferência

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
  document.getElementById('fat-result').innerHTML = `
    <div class="fat-grade">
      ${campo('fat-titular', 'Titular', d.titular, true)}
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
      <button class="campo-btn" style="width:auto;margin:0;padding:10px 18px;font-size:16px" onclick="aplicarFatura()">✅ Usar estes dados na proposta</button>
      <button class="link-mini" onclick="descartarFatura()">Descartar</button>
    </div>`;
  statusFatura(vazios.length ? 'Leitura concluída. Confira os campos e complete o que faltou.' : 'Leitura concluída. Confira os dados antes de usar.', 'ok');
}

function descartarFatura() { _faturaTela = null; document.getElementById('fat-result').innerHTML = ''; statusFatura(''); }

// leva os dados conferidos para a proposta. Campos já preenchidos (ex.: cliente vindo do CRM) não são trocados,
// exceto consumo e conta, que vêm da fatura.
function aplicarFatura() {
  if (!_faturaTela) return;
  const val = id => (document.getElementById(id) || {}).value ? document.getElementById(id).value.trim() : '';
  const preencher = (id, v) => { const el = document.getElementById(id); if (el && v && !el.value.trim()) el.value = v; };
  preencher('prop-nome', val('fat-titular'));
  if (!val('fat-cpf').includes('*')) preencher('prop-cpf', val('fat-cpf'));
  preencher('prop-uc', val('fat-uc'));
  preencher('prop-endereco', val('fat-endereco'));
  preencher('prop-cep', val('fat-cep'));
  preencher('prop-concessionaria', val('fat-conc'));
  const cid = document.getElementById('prop-cidade');
  if (cid && val('fat-cidade') && !cid.value.trim()) { cid.value = val('fat-cidade'); if (typeof regiaoPelaCidade === 'function') regiaoPelaCidade(); }
  const media = Math.round(+String(val('fat-media')).replace(/\./g, '').replace(',', '.') || 0);
  const conta = lerReais(val('fat-conta'));
  if (media > 0) { document.getElementById('prop-consumo').value = media; const cc = document.getElementById('campo-consumo'); if (cc) cc.value = media; }
  if (conta > 0) sincronizarConta(String(Math.round(conta)), null);
  const { meses } = mediaConsumo(_faturaTela);
  const d = _faturaTela;
  faturaLida = {
    concessionaria: val('fat-conc') || d.concessionaria, classificacao: d.classificacao, fornecimento: d.fornecimento,
    mes_referencia: d.mes_referencia, consumo_mes_kwh: d.consumo_mes_kwh, valor_total: d.valor_total,
    historico: d.historico, media_kwh: media || null, meses_media: meses, tem_geracao_propria: d.tem_geracao_propria,
    lida_em: new Date().toISOString(),
    nome_proposta: val('prop-nome') || '',   // só vai para o orçamento deste cliente
  };
  if (typeof validarProposta === 'function') validarProposta();
  if (typeof avisoCpf === 'function') avisoCpf();
  if (propostaItem) calcularProducao();
  document.getElementById('fat-result').innerHTML = '';
  statusFatura('✅ Dados da fatura aplicados' + (media > 0 ? ' (consumo médio ' + media.toLocaleString('pt-BR') + ' kWh/mês)' : '') + (propostaItem ? '.' : '. Agora escolha o kit — use "⚡ Sugerir kit" ou a tabela.'), 'ok');
  if (!propostaItem && media > 0 && typeof sugerirKit === 'function') sugerirKit();
}
