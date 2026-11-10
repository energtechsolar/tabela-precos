// Energtech — CRM: ler a fatura de energia direto no "+ Novo lead" (atalho).
// Usa a mesma função do servidor do precificador (ler-fatura). Nada é inventado: campo não lido fica como está.
// Preenche os campos do formulário para conferência; ao criar o lead, o arquivo vai para a pasta privada
// "documentos" do cliente (aparece na ficha como "Fatura de energia") e o consumo lido vai para o histórico.
// (carregado pelo crm.html depois de js/crm.js; envolve novoLead e salvarNovoLead sem mudar o crm.js)

let _fatNovo = null;   // { blob, ext, nome, dados, media, meses, zerados }
// média de consumo: os 12 meses mais recentes do histórico, sem os meses zerados (imóvel sem uso, ligação nova)
const _ordMes = m => { const [mm, aa] = String(m).split('/'); return (+aa < 100 ? 2000 + +aa : +aa) * 12 + +mm; };
function mediaFaturaLida(d) {
  const ult = (d.historico || []).slice().sort((a, b) => _ordMes(b.mes) - _ordMes(a.mes)).slice(0, 12);
  const com = ult.filter(x => +x.kwh > 0), zerados = ult.length - com.length;
  if (com.length) return { media: Math.round(com.reduce((s, x) => s + +x.kwh, 0) / com.length), meses: com.length, zerados };
  if (+d.consumo_mes_kwh > 0) return { media: Math.round(d.consumo_mes_kwh), meses: 1, zerados };
  return { media: null, meses: 0, zerados };
}

function _fatReduzir(arq, max) {
  return new Promise((ok, erro) => {
    const img = new Image(), url = URL.createObjectURL(arq);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      c.toBlob(b => b ? ok(b) : erro(new Error('imagem inválida')), 'image/jpeg', 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); erro(new Error('imagem inválida')); };
    img.src = url;
  });
}
const _fatB64 = blob => new Promise((ok, erro) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(',')[1]); fr.onerror = () => erro(new Error('não foi possível ler o arquivo')); fr.readAsDataURL(blob); });
function _fatStatus(t, tipo) { const el = document.getElementById('nl-fat-status'); if (!el) return; el.innerHTML = t || ''; el.style.color = tipo === 'erro' ? 'var(--vermelho)' : tipo === 'ok' ? 'var(--verde)' : 'var(--muted)'; }

async function lerFaturaNovoLead(input) {
  let arq = input.files && input.files[0]; input.value = '';
  if (!arq) return;
  if (typeof paraJpeg === 'function' && typeof ehHeic === 'function' && ehHeic(arq)) {   // foto do iPhone (HEIC) → JPEG
    try { _fatStatus('⏳ Convertendo a foto do iPhone…'); arq = await paraJpeg(arq); }
    catch (e) { _fatStatus('⚠ ' + esc(e.message || e) + '. Preencha à mão.', 'erro'); return; }
  }
  const ehPdf = arq.type === 'application/pdf' || /\.pdf$/i.test(arq.name);
  if (!ehPdf && !/^image\//.test(arq.type)) { _fatStatus('⚠ Formato não aceito. Envie uma foto ou um PDF.', 'erro'); return; }
  if (ehPdf && arq.size > 9 * 1024 * 1024) { _fatStatus('⚠ PDF maior que 9 MB. Envie uma foto da fatura.', 'erro'); return; }
  try {
    _fatStatus('⏳ Lendo a fatura… (leva alguns segundos)');
    const blob = ehPdf ? arq : await _fatReduzir(arq, 2000);
    const { data, error } = await sb.functions.invoke('ler-fatura', { body: { arquivo: await _fatB64(blob), tipo: ehPdf ? 'application/pdf' : 'image/jpeg' } });
    let resp = data;
    if (error) { try { resp = error.context && typeof error.context.json === 'function' ? await error.context.json() : null; } catch (e) { resp = null; } }
    if (!resp || !resp.ok) { _fatStatus('⚠ ' + esc((resp && resp.erro) || (error && error.message) || 'Não foi possível ler a fatura.') + ' Preencha à mão.', 'erro'); return; }
    const d = resp.dados || {};
    const { media, meses, zerados } = mediaFaturaLida(d);
    _fatNovo = { blob, ext: ehPdf ? 'pdf' : 'jpg', nome: arq.name || (ehPdf ? 'fatura.pdf' : 'fatura.jpg'), dados: d, media, meses, zerados };
    // só preenche: o que já foi digitado no campo não é apagado; o nome do lead só vem do titular se estiver vazio
    const por = (id, v) => { const el = document.getElementById('nl-' + id); if (el && v && !el.value.trim()) el.value = v; };
    por('nome', d.titular);
    if (d.cpf_cnpj && !d.cpf_cnpj.includes('*')) por('cpf', d.cpf_cnpj);
    por('titular', d.titular); por('uc', d.uc); por('end', d.endereco); por('cep', d.cep);
    por('cidade', d.cidade ? d.cidade + (d.uf ? ' / ' + d.uf : '') : null); por('conc', d.concessionaria);
    const obs = document.getElementById('nl-obs');
    const linha = 'Fatura lida: ' + [d.concessionaria, d.classificacao, media ? 'consumo médio ' + media + ' kWh/mês (' + meses + (meses === 1 ? ' mês' : ' meses') + (zerados ? ', sem ' + zerados + ' zerado(s)' : '') + ')' : '', d.valor_total != null ? 'última fatura ' + fmtR(d.valor_total) : ''].filter(Boolean).join(' · ') + '.';
    if (obs && !obs.value.includes('Fatura lida:')) obs.value = (obs.value.trim() ? obs.value.trim() + '\n' : '') + linha;
    const avisos = [];
    if (d.cpf_cnpj && d.cpf_cnpj.includes('*')) avisos.push('CPF/CNPJ mascarado na fatura: peça o documento ao cliente');
    if (d.legibilidade && d.legibilidade !== 'boa') avisos.push('leitura ' + (d.legibilidade === 'parcial' ? 'parcial' : 'ruim') + ': confira os campos');
    if (d.classificacao && /^\s*A\s*\d/i.test(d.classificacao)) avisos.push('grupo A (média tensão): precisa de análise de demanda');
    if (d.tem_geracao_propria) avisos.push('a fatura já mostra geração própria/créditos');
    if (zerados) avisos.push(zerados + (zerados === 1 ? ' mês sem consumo ficou' : ' meses sem consumo ficaram') + ' fora da média');
    _fatStatus('✅ Fatura lida' + (media ? ': consumo médio <b>' + media + ' kWh/mês</b>' : '') + '. Confira os campos abaixo; ao criar o lead, a fatura fica guardada na ficha.'
      + (avisos.length ? '<br><span style="color:var(--amarelo)">⚠ ' + esc(avisos.join(' · ')) + '</span>' : ''), 'ok');
  } catch (e) {
    console.error('Fatura (novo lead):', e);
    _fatStatus('⚠ Não foi possível ler a fatura (' + esc(e.message || e) + '). Preencha à mão.', 'erro');
  }
}

// guarda o arquivo na pasta do cliente e coloca na ficha (lista "documentos" do lead)
async function _fatGuardar(leadId) {
  const a = _fatNovo; _fatNovo = null;
  if (!a || !leadId) return;
  try {
    const path = 'lead-' + leadId + '/fatura-' + Date.now() + '.' + a.ext;
    const up = await sb.storage.from('documentos').upload(path, a.blob, { contentType: a.ext === 'pdf' ? 'application/pdf' : 'image/jpeg', upsert: false });
    if (up.error) throw up.error;
    const d = a.dados || {}, meses = a.meses || (a.media ? 1 : 0);
    // resumo da leitura no documento: a Nova proposta (precificador) usa o consumo médio
    const doc = { id: String(Date.now()), tipo: 'fatura', nome: a.nome, path, em: new Date().toISOString(), autor: perfil.email,
      dados: a.media ? { media_kwh: a.media, meses, valor_total: d.valor_total ?? null, concessionaria: d.concessionaria || null, classificacao: d.classificacao || null, lida_em: new Date().toISOString() } : undefined };
    const l = leads.find(x => x.id === leadId);
    const docs = Array.isArray(l && l.documentos) ? l.documentos : [];
    const { error } = await sb.from('leads').update({ documentos: [...docs, doc] }).eq('id', leadId);
    if (error) throw error;
    if (l) l.documentos = [...docs, doc];
    if (typeof fichaId !== 'undefined' && fichaId === leadId && typeof abrirFicha === 'function') abrirFicha(leadId, true);
  } catch (e) {
    console.error('Fatura (arquivo do novo lead):', e);
    alert('O lead foi criado, mas a fatura não foi guardada na ficha (' + (e.message || e) + '). Anexe pela ficha do cliente.');
  }
}

(function () {
  if (typeof novoLead !== 'function' || typeof salvarNovoLead !== 'function') return;
  const _novo = novoLead, _salvar = salvarNovoLead;
  novoLead = function () {
    _fatNovo = null;
    _novo.apply(this, arguments);
    const corpo = document.getElementById('novo-corpo'); if (!corpo) return;
    const bloco = document.createElement('div');
    bloco.style.cssText = 'background:var(--card2);border:1px dashed var(--amarelo);border-radius:10px;padding:10px 12px;margin-bottom:12px';
    bloco.innerHTML = `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <b style="color:var(--amarelo)">📄 Tem a fatura de energia?</b>
        <label class="btn" style="cursor:pointer">📷 Foto / PDF da fatura<input type="file" accept="image/*,application/pdf" style="display:none" onchange="lerFaturaNovoLead(this)"></label>
        <span class="muted">Preenche titular, UC, endereço, cidade, CEP e consumo. Você confere antes de criar.</span></div>
      <div id="nl-fat-status" class="muted" style="margin-top:6px;font-size:13px"></div>`;
    corpo.insertBefore(bloco, corpo.firstChild);
  };
  salvarNovoLead = async function () {
    const antes = new Set(leads.map(l => l.id));
    await _salvar.apply(this, arguments);
    const novo = leads.find(l => !antes.has(l.id));
    if (novo && _fatNovo) await _fatGuardar(novo.id);
  };
})();
