// Energtech — app: offline, modo simples, Supabase, usuário logado
// (arquivo carregado pelo index.html; a ordem dos <script> importa)

// ── APP / OFFLINE ───────────────────────────────────────────────────────────
function lerLocal(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
function gravarLocal(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function marcarOffline(off) { const el = document.getElementById('offline-aviso'); if (el) el.style.display = off ? 'block' : 'none'; }
function ehFalhaDeRede(err) { const m = String((err && (err.message || err.details)) || err || ''); return /fetch|network|Failed|Load failed|NetworkError/i.test(m) && !/permission|policy|violates/i.test(m); }
function guardarNaFila(registro, leadId) {
  const fila = lerLocal('etg_fila') || [];
  fila.push({ registro, leadId, quando: new Date().toISOString() });
  gravarLocal('etg_fila', fila);
  ultimoOrcamentoId = null;
  statusProposta('📴 Sem internet: orçamento guardado no aparelho. Ele será enviado sozinho quando a conexão voltar. O PDF e o WhatsApp já podem ser usados.', 'aviso');
  mostrarFila();
}
function mostrarFila() {
  const el = document.getElementById('fila-aviso'); if (!el) return;
  const n = (lerLocal('etg_fila') || []).length;
  el.style.display = n ? 'block' : 'none';
  el.textContent = n ? `⏳ ${n} orçamento(s) guardado(s) no aparelho, aguardando internet para enviar.` : '';
}
let _enviandoFila = false;
async function enviarFila() {
  mostrarFila();
  const fila = lerLocal('etg_fila') || [];
  if (!fila.length || _enviandoFila || !sb || !navigator.onLine || !perfil || !perfil.vendedor) return;
  _enviandoFila = true;
  const resta = [];
  for (const f of fila) {
    const { error } = await sb.from('orcamentos').insert(f.registro);
    if (error) { console.error('Fila:', error); resta.push(f); continue; }
    if (f.leadId) await sb.from('leads').update({ status:'orcamento_criado', atualizado_em: new Date().toISOString() }).eq('id', f.leadId);
  }
  gravarLocal('etg_fila', resta);
  _enviandoFila = false;
  mostrarFila();
  if (fila.length > resta.length) statusProposta(`✅ ${fila.length - resta.length} orçamento(s) guardado(s) no aparelho foram enviados.`, 'ok');
}
window.addEventListener('online', () => { marcarOffline(false); enviarFila(); });
window.addEventListener('offline', () => marcarOffline(true));
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW:', e)));
}

// ── MODO SIMPLES (vendedor de campo) ────────────────────────────────────────
function aplicarModo() {
  const pref = lerLocal('etg_modo');
  const simples = pref ? pref === 'simples' : !!(perfil && perfil.papel === 'campo');
  document.body.classList.toggle('modo-campo', simples);
}
function alternarModo() {
  const simples = !document.body.classList.contains('modo-campo');
  gravarLocal('etg_modo', simples ? 'simples' : 'completo');
  aplicarModo(); renderUsuario();
}
let _sugestao = null;
function sugerirKit() {
  const tipo = abaAtual || 'importado';
  const lista = tipo === 'importado' ? IMPORTADO : NACIONAL;
  const tarifa = +(tipo === 'importado' ? valorCampo('imp-tarifa') : valorCampo('input-tarifa')) || 0.89;
  const taxa = +valorCampo('imp-taxa-conc') || 50;
  const conta = +valorCampo('campo-conta') || 0, meta = +valorCampo('campo-meta') || 0;
  let consumo = +valorCampo('campo-consumo') || 0;
  const base = Math.max(conta, meta);
  if (meta > conta && consumo && conta) consumo = consumo * meta / conta;
  if (!consumo && base) consumo = Math.max(0, base - taxa) / tarifa;
  const box = document.getElementById('campo-sug');
  if (!consumo) { box.innerHTML = '<div class="linha">Informe a conta de luz ou o consumo.</div>'; box.classList.add('visivel'); return; }
  const ori = valorCampo('campo-orient') || 'norte';
  const ger = it => Math.round(it.kwp * fatorRegiao() * FATOR_ORIENTACAO[ori]);
  const ordem = lista.map((it, idx) => ({ it, idx })).filter(x => x.it.kwp > 0).sort((a, b) => a.it.kwp - b.it.kwp);
  if (!ordem.length) return;
  let pos = ordem.findIndex(x => ger(x.it) >= consumo);
  const falta = pos < 0;
  if (falta) pos = ordem.length - 1;
  _sugestao = { tipo, ordem, pos, consumo, ori, conta, meta, ger, falta };
  if (meta > conta) { const m = document.getElementById('prop-conta-meta'); if (m) m.value = meta; }
  if (+valorCampo('campo-consumo')) document.getElementById('prop-consumo').value = valorCampo('campo-consumo');
  document.getElementById('prop-orientacao').value = ori;
  mostrarSugestao();
}
function mostrarSugestao() {
  const s = _sugestao; if (!s) return;
  const { it } = s.ordem[s.pos];
  const adicional = +document.getElementById('slider-adicional').value, descPct = +document.getElementById('slider-desconto').value;
  const c = calcLinha(it, adicional, descPct);
  const g = s.ger(it), sobra = g - s.consumo;
  const box = document.getElementById('campo-sug');
  box.innerHTML = `
    <div class="linha">${s.falta && s.pos === s.ordem.length - 1 ? '⚠ Nenhum kit da tabela cobre todo o consumo — este é o maior.' : 'Kit sugerido (' + (s.tipo === 'importado' ? 'importado' : 'nacional') + '):'}</div>
    <div class="nome">${escHtml(it.nome)} · ${String(it.kwp).replace('.', ',')} kWp</div>
    <div class="linha">${it.mod} módulos · inversor ${escHtml(it.inv)}</div>
    <div class="linha">Gera ~${g.toLocaleString('pt-BR')} kWh/mês · cliente precisa ~${Math.round(s.consumo).toLocaleString('pt-BR')} kWh/mês ${sobra >= 0 ? '(sobra ' + Math.round(sobra).toLocaleString('pt-BR') + ')' : '(faltam ' + Math.round(-sobra).toLocaleString('pt-BR') + ')'}</div>
    <div class="valor">${fmt(c.valorFinal)}</div>
    <div class="campo-nav">
      <button onclick="trocarSugestao(-1)" ${s.pos === 0 ? 'disabled' : ''}>◀ Menor</button>
      <button class="usar" onclick="usarSugestao()">✅ Usar este kit</button>
      <button onclick="trocarSugestao(1)" ${s.pos === s.ordem.length - 1 ? 'disabled' : ''}>Maior ▶</button>
    </div>`;
  box.classList.add('visivel');
}
function trocarAbaPorNome(aba) {
  const btns = document.querySelectorAll('.tab-btn');
  trocarAba(aba, btns[aba === 'nacional' ? 1 : 0]);
}
function trocarSugestao(d) { if (!_sugestao) return; _sugestao.pos = Math.max(0, Math.min(_sugestao.ordem.length - 1, _sugestao.pos + d)); mostrarSugestao(); }
function usarSugestao() {
  const s = _sugestao; if (!s) return;
  const { it, idx } = s.ordem[s.pos];
  selecionarLinha(s.tipo, idx, it);
  document.getElementById('prop-orientacao').value = s.ori;
  if (s.conta) sincronizarConta(String(s.conta), 'campo-conta');
  calcularProducao();
}

// conta de luz: um valor só para a análise de investimento e para a proposta
function sincronizarConta(v, origem) {
  ['imp-conta-atual', 'prop-conta', 'campo-conta'].forEach(id => { if (id !== origem) { const el = document.getElementById(id); if (el && el.value !== v) el.value = v; } });
  if (origem !== 'imp-conta-atual' && typeof atualizarDashImp === 'function') atualizarDashImp();
}
function podeCompartilharPDF() {
  try {
    return !!(navigator.canShare && navigator.canShare({ files:[new File([''], 'teste.pdf', { type:'application/pdf' })] }));
  } catch (e) { return false; }
}

// ── SUPABASE (dados salvos online) ──────────────────────────────────────────
// A chave abaixo é a "publishable" (pública por natureza). Quem pode gravar é
// controlado no banco: só e-mails cadastrados na tabela "admins".

let adminLogado = false;
let ultimoSalvo = {};   // cópia do que está no banco, para só gravar o que mudou

function clonar(o) { return JSON.parse(JSON.stringify(o)); }
// texto estável (chaves em ordem) para comparar o local com o banco
function chave(o) {
  if (Array.isArray(o)) return '[' + o.map(chave).join(',') + ']';
  if (o && typeof o === 'object') return '{' + Object.keys(o).sort().map(k => JSON.stringify(k) + ':' + chave(o[k])).join(',') + '}';
  return JSON.stringify(o);
}

function mostrarInfo(texto, alerta) {
  const el = document.getElementById('info-atualizacao');
  if (!el) return;
  el.textContent = texto;
  el.classList.toggle('alerta', !!alerta);
}

function fmtDataHora(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' às ' +
         d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
}

function aplicarDados(linhas) {
  let maisRecente = null;
  linhas.forEach(l => {
    if (l.id === 'importado' && Array.isArray(l.dados)) IMPORTADO = clonar(l.dados);
    if (l.id === 'nacional'  && Array.isArray(l.dados)) NACIONAL  = clonar(l.dados);
    if (l.id === 'cfg' && l.dados) {
      const c = l.dados;
      ['desconto_livre','desconto_max','split_adicional','split_desconto_extra']
        .forEach(k => { if (typeof c[k] === 'number') CFG[k] = c[k]; });
      if (Array.isArray(c.regioes) && c.regioes.length) REGIOES = clonar(c.regioes);
      if (c.proposta && typeof c.proposta === 'object') PROPOSTA_CFG = { ...JSON.parse(JSON.stringify(PROPOSTA_PADRAO)), ...c.proposta }; preencherSelectsPagamento();
      if (typeof c.adicional_max === 'number')
        document.getElementById('slider-adicional').max = c.adicional_max;
    }
    ultimoSalvo[l.id] = chave(l.dados);
    if (!maisRecente || l.atualizado_em > maisRecente) maisRecente = l.atualizado_em;
  });
  linhaFoco = null;
  document.getElementById('resumo-bar').style.display = 'none';
  document.getElementById('dash-economia').classList.remove('visivel');
  document.getElementById('dash-importado').classList.remove('visivel');
  renderSeletorRegiao();
  atualizar();
  if (maisRecente) mostrarInfo('Preços atualizados em ' + fmtDataHora(maisRecente));
}

async function carregarDoSupabase() {
  if (!sb) {
    const salvo = lerLocal('etg_config');
    if (salvo && salvo.length) { aplicarDados(salvo); mostrarInfo('📴 Sem internet — usando os preços salvos no aparelho', true); marcarOffline(true); }
    else mostrarInfo('⚠ Sem conexão com o servidor — exibindo tabela de reserva', true);
    return false;
  }
  const { data: ses } = await sb.auth.getSession();
  if (!ses || !ses.session) {
    IMPORTADO = []; NACIONAL = []; atualizar();
    mostrarInfo('🔒 Entre com seu login para ver a tabela de preços', true);
    return false;
  }
  const { data, error } = await sb.from('config').select('id, dados, atualizado_em');
  if (error || !data || !data.length) {
    console.error('Supabase:', error);
    const salvo = lerLocal('etg_config');
    if (salvo && salvo.length) {
      aplicarDados(salvo);
      mostrarInfo('📴 Sem internet — usando os preços salvos no aparelho', true);
      marcarOffline(true);
      return false;
    }
    mostrarInfo('⚠ Sem conexão com o servidor — exibindo tabela de reserva', true);
    return false;
  }
  aplicarDados(data);
  gravarLocal('etg_config', data);
  marcarOffline(false);
  return true;
}

// ── USUÁRIO LOGADO (vendedor/admin) ─────────────────────────────────────────
let perfil = null;          // { email, admin, vendedor, nome } ou null
let modoLogin = 'usuario';  // 'usuario' | 'admin'
let leadsCache = [];
let leadSelecionado = null;
let propostaTipo = null;

async function carregarPerfil() {
  perfil = null;
  if (sb) {
    const { data: s } = await sb.auth.getSession();
    if (s && s.session) {
      const { data, error } = await sb.rpc('meu_perfil');
      const salvo = lerLocal('etg_perfil');
      if (!error && data) { perfil = data; gravarLocal('etg_perfil', data); }
      else if (salvo && salvo.email === s.session.user.email) perfil = salvo;
      else perfil = { email: s.session.user.email, admin:false, vendedor:false, nome: s.session.user.email };
    }
  }
  adminLogado = !!(perfil && perfil.admin);
  document.body.classList.toggle('eh-admin', adminLogado);
  if (adminLogado) await carregarCustos(); else { custos = {}; custosSalvos = {}; }
  aplicarModo();
  renderUsuario();
  const pedidoPdf = +new URLSearchParams(location.search).get('pdf');
  if (pedidoPdf && perfil && perfil.vendedor && !window._pdfFeito) { window._pdfFeito = true; await _precosCarregados; reimprimirProposta(pedidoPdf); }
  if (perfil && perfil.vendedor) carregarLeads(); else limparLeads();
  atualizarBlocoLead();
  enviarFila();
}

function renderUsuario() {
  const el = document.getElementById('usuario-bar');
  if (!el) return;
  if (perfil) {
    const papel = perfil.papel || (perfil.admin ? 'admin' : (perfil.vendedor ? 'vendedor' : 'sem acesso'));
    const crm = perfil.admin || perfil.papel === 'interno';
    const modoLink = document.body.classList.contains('modo-campo') ? '🖥 Modo completo' : '📱 Modo simples';
    el.innerHTML = `👤 ${escHtml(perfil.nome || perfil.email)} <span class="usuario-papel">(${papel})</span> · <a href="#" onclick="alternarModo();return false">${modoLink}</a> · ${crm ? '<a href="crm.html">📋 CRM</a> · ' : ''}${perfil.vendedor ? '<a href="painel.html">📊 Orçamentos</a> · ' : ''}<a href="#" onclick="abrirTrocarSenha();return false">Trocar senha</a> · <a href="#" onclick="sairAdmin();return false">Sair</a>`;
  } else {
    el.innerHTML = `<a href="#" onclick="abrirLogin();return false">🔑 Entrar (vendedores)</a>`;
  }
}

function escHtml(t) {
  return String(t ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// telefone: guarda só dígitos com 55; mostra (49) 99999-9999
function telDigitos(t) {
  let d = String(t || '').replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) d = '55' + d;
  return d;
}
function telBonito(t) {
  let d = String(t || '').replace(/\D/g, '');
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return t || '';
}

function limparLeads() {
  leadsCache = []; leadSelecionado = null;
  const sel = document.getElementById('prop-lead');
  if (sel) sel.innerHTML = '<option value="">— Digitar dados manualmente —</option>';
}

async function carregarLeads(manual) {
  if (!sb || !perfil || !perfil.vendedor) return;
  const sel = document.getElementById('prop-lead');
  const btn = document.getElementById('btn-leads-reload');
  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
  const { data, error } = await sb.from('leads')
    .select('id, nome, telefone, email, cidade, status, recebido_em, cpf_cnpj, endereco, cep, uc, concessionaria')
    .order('recebido_em', { ascending:false }).limit(300);
  if (btn) { btn.disabled = false; btn.textContent = '🔄'; }
  let lista = data;
  if (error) {
    console.error('Supabase leads:', error);
    lista = lerLocal('etg_leads');
    if (!lista) { avisoLead('⚠ Não foi possível carregar os clientes do DataCrazy.', true); return; }
    avisoLead('📴 Sem internet — lista de clientes salva no aparelho.', true);
  } else gravarLocal('etg_leads', data);
  leadsCache = lista || [];
  const atual = leadSelecionado;
  sel.innerHTML = '<option value="">— Digitar dados manualmente —</option>' + leadsCache.map(l => {
    const tel = telBonito(l.telefone);
    const tag = l.status === 'orcamento_criado' ? ' · ✓ já orçado' : '';
    return `<option value="${l.id}">${escHtml(l.nome || 'Sem nome')}${tel ? ' · ' + escHtml(tel) : ''}${tag}</option>`;
  }).join('');
  if (atual && leadsCache.some(l => l.id === atual)) sel.value = atual;
  if (manual) avisoLead(`${leadsCache.length} cliente(s) carregado(s).`, false);
  // vindo do CRM (crm.html → "Nova proposta"): já seleciona o cliente
  const doCrm = +new URLSearchParams(location.search).get('lead');
  if (doCrm && !leadSelecionado && leadsCache.some(l => l.id === doCrm)) {
    sel.value = doCrm; selecionarLead();
    avisoLead('Cliente do CRM selecionado. Agora escolha o kit na tabela.', false);
    const fx = document.getElementById('aviso-crm');
    if (fx) { fx.textContent = '📋 Proposta para ' + (leadsCache.find(l => l.id === doCrm).nome || 'cliente do CRM') + ' — escolha o kit na tabela abaixo.'; fx.style.display = ''; }
  }
}

function avisoLead(txt, erro) {
  const el = document.getElementById('proposta-lead-aviso');
  if (!el) return;
  el.textContent = txt;
  el.classList.toggle('erro', !!erro);
}

function atualizarBlocoLead() {
  const linha = document.getElementById('proposta-lead-linha');
  if (!linha) return;
  if (perfil && perfil.vendedor) {
    linha.style.display = '';
    avisoLead('Escolha um cliente qualificado no DataCrazy ou preencha manualmente.', false);
  } else {
    linha.style.display = 'none';
    avisoLead(perfil ? 'Seu usuário ainda não está cadastrado como vendedor. Fale com o administrador.'
                     : 'Entre com seu login (no topo da página) para escolher clientes do DataCrazy e salvar o orçamento.', true);
  }
}

function selecionarLead() {
  const id = +document.getElementById('prop-lead').value || null;
  leadSelecionado = id;
  if (!id) return;
  const l = leadsCache.find(x => x.id === id);
  if (!l) return;
  document.getElementById('prop-nome').value     = l.nome || '';
  document.getElementById('prop-email').value    = l.email || '';
  document.getElementById('prop-telefone').value = telBonito(l.telefone);
  if (l.cidade) { document.getElementById('prop-cidade').value = l.cidade; regiaoPelaCidade(); }
  const pre = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  pre('prop-cpf', l.cpf_cnpj); pre('prop-endereco', l.endereco); pre('prop-cep', l.cep); pre('prop-uc', l.uc); pre('prop-concessionaria', l.concessionaria);
  avisoCpf();
  validarProposta();
  calcularProducao();
}

// dados do cliente digitados na proposta (vão para o PDF, para o orçamento salvo e para a ficha no CRM)
function dadosClienteTela() {
  const v = id => (document.getElementById(id) || {}).value ? document.getElementById(id).value.trim() : '';
  return { nome: v('prop-nome'), cpf: v('prop-cpf'), telefone: v('prop-telefone'), email: v('prop-email'), cidade: v('prop-cidade'),
           endereco: v('prop-endereco'), cep: v('prop-cep'), uc: v('prop-uc'), concessionaria: v('prop-concessionaria') };
}
// CPF não bloqueia nada, mas avisa quando a proposta é para financiamento (kit nacional / kit e mão de obra separados)
function avisoCpf() {
  const el = document.getElementById('prop-cpf-aviso'); if (!el) return;
  const financia = propostaTipo === 'nacional' || (typeof modoSeparado === 'function' && modoSeparado());
  const cpf = document.getElementById('prop-cpf');
  el.textContent = financia && cpf && !cpf.value.trim() ? '⚠ Falta o CPF/CNPJ (exigido para financiamento)' : '';
}

function statusProposta(txt, tipo) {
  const el = document.getElementById('proposta-status');
  if (!el) return;
  el.textContent = txt;
  el.className = 'proposta-status' + (tipo ? ' ' + tipo : '');
}

async function salvarOrcamento() {
  if (!perfil || !perfil.vendedor || !sb) {
    statusProposta('⚠ Orçamento NÃO foi salvo no sistema — entre com seu login de vendedor para salvar.', 'aviso');
    return;
  }
  const orientacao = document.getElementById('prop-orientacao').value;
  const estrutura  = document.getElementById('prop-estrutura').value;
  const producaoMensal = Math.round(propostaItem.kwp * fatorRegiao() * FATOR_ORIENTACAO[orientacao]);
  const tipo = propostaTipo || (linhaFoco && linhaFoco.startsWith('importado') ? 'importado' : 'nacional');
  const registro = {
    lead_id:      leadSelecionado,
    cliente_nome: document.getElementById('prop-nome').value.trim() || 'Cliente',
    telefone:     telDigitos(document.getElementById('prop-telefone').value) || null,
    email:        document.getElementById('prop-email').value.trim() || null,
    cidade:       document.getElementById('prop-cidade').value.trim() || null,
    tipo,
    sistema:      propostaItem.nome,
    kwp:          propostaItem.kwp,
    valor_final:  Math.round(propostaCalc.valorFinal * 100) / 100,
    vendedor_email: perfil.email,
    dados: {
      orientacao, estrutura, producao_mensal_kwh: producaoMensal,
      itens: document.getElementById('prop-itens').value.split('\n').map(t => t.trim()).filter(Boolean),
      servico_desc: document.getElementById('prop-servico').value.trim(),
      modo_valor: (document.querySelector('input[name="modo-valor"]:checked') || {}).value || 'global',
      fornecedor: (fornecedorSel() || {}).nome || null,
      fornecedor_id: (fornecedorSel() || {}).id || null,
      conta_pagamento: contaSel().rotulo || null,
      conta_id: contaSel().id || null,
      tarifa: +(tipo === 'importado' ? valorCampo('imp-tarifa') : valorCampo('input-tarifa')) || 0.89,
      taxa: +valorCampo('imp-taxa-conc') || 50,
      valor_kit: (document.querySelector('input[name="modo-valor"]:checked') || {}).value === 'separado' ? (+document.getElementById('prop-valor-kit').value || null) : null,
      conta_atual: +document.getElementById('prop-conta').value || null,
      conta_meta: +document.getElementById('prop-conta-meta').value || null,
      consumo_kwh: +document.getElementById('prop-consumo').value || null,
      cpf_cnpj: document.getElementById('prop-cpf').value.trim() || null,
      cliente: dadosClienteTela(),
      regiao: { id: regiaoSel().id, nome: regiaoSel().nome, uf: regiaoSel().uf, fator: fatorRegiao() },
      adicional: +document.getElementById('slider-adicional').value,
      desconto_pct: +document.getElementById('slider-desconto').value,
      kit: clonar(propostaItem), calculo: clonar(propostaCalc)
    }
  };
  statusProposta('⏳ Salvando orçamento…', '');
  if (!navigator.onLine) { guardarNaFila(registro, leadSelecionado); return; }
  const { data, error } = await sb.from('orcamentos').insert(registro).select('id').single();
  if (error && ehFalhaDeRede(error)) { guardarNaFila(registro, leadSelecionado); return; }
  if (error) {
    console.error('Supabase orçamento:', error);
    statusProposta('⚠ Erro ao salvar o orçamento: ' + (error.message || 'tente novamente.'), 'aviso');
    return;
  }
  if (leadSelecionado) {
    // devolve à ficha do cliente o que foi preenchido na proposta (só campos com valor; não apaga nada)
    const c = dadosClienteTela(), mud = { status:'orcamento_criado', atualizado_em: new Date().toISOString() };
    [['cpf_cnpj', c.cpf], ['endereco', c.endereco], ['cep', c.cep], ['uc', c.uc], ['concessionaria', c.concessionaria], ['email', c.email]].forEach(([k, v]) => { if (v) mud[k] = v; });
    if (c.telefone) mud.telefone = telDigitos(c.telefone);
    await sb.from('leads').update(mud).eq('id', leadSelecionado);
    const l = leadsCache.find(x => x.id === leadSelecionado); if (l) l.status = 'orcamento_criado';
    carregarLeads();
  }
  ultimoOrcamentoId = data.id;
  statusProposta(`✅ Orçamento nº ${data.id} salvo — ${fmt(registro.valor_final)}`, 'ok');
}

