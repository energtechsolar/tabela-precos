// Energtech — CRM: funil, ficha do cliente, histórico
// (carregado pelo crm.html depois de js/comum.js)

// etapas do funil: padrão abaixo; o admin pode renomear, criar, reordenar e excluir (fica salvo em config "crm").
// "Ganho" e "Perdido" são fixas (só o nome muda): o sistema depende delas para vendas, documentos e painel.
const ETAPAS_PADRAO = [
  ['novo', 'Lead novo'], ['atendimento', 'Em atendimento'], ['qualificado', 'Qualificado'], ['proposta', 'Proposta enviada'],
  ['negociacao', 'Negociação'], ['ganho', 'Ganho'], ['perdido', 'Perdido'],
];
const ETAPAS_FIXAS = ['ganho', 'perdido'];
let ETAPAS = ETAPAS_PADRAO.map(e => e.slice());
function aplicarEtapas(lista) {
  if (!Array.isArray(lista) || !lista.length) return;
  const ok = lista.filter(e => e && e.id && e.nome).map(e => [String(e.id), String(e.nome)]);
  ETAPAS_FIXAS.forEach(id => { if (!ok.some(e => e[0] === id)) ok.push(ETAPAS_PADRAO.find(e => e[0] === id).slice()); });
  ETAPAS = ok.filter(e => !ETAPAS_FIXAS.includes(e[0])).concat(ETAPAS_FIXAS.map(id => ok.find(e => e[0] === id)));
}
const ORIGENS = { meta:'Anúncio Meta (direto)', datacrazy:'Anúncio / DataCrazy', indicacao:'Indicação', whatsapp:'WhatsApp direto', telefone:'Telefone', loja:'Loja / visita', campo:'Prospecção em campo', outro:'Outro' };

// respostas do formulário do anúncio (leads que chegaram direto do Meta), menos nome/telefone/e-mail que já estão na ficha
function blocoFormulario(l) {
  const f = l.form_meta || l.form_meta2;
  if (!f || typeof f !== 'object') return '';
  const jaNaFicha = ['full_name', 'first_name', 'last_name', 'phone_number', 'email'];
  const itens = Object.entries(f).filter(([k, v]) => v && !jaNaFicha.includes(k));
  if (!itens.length) return '';
  return `<h3>Respostas do formulário do anúncio</h3><div class="grade">${itens.map(([k, v]) =>
    `<div class="largo"><label>${esc(String(k).replace(/_/g, ' ').replace(/\?$/, ''))}</label><div>${esc(v)}</div></div>`).join('')}</div>`;
}
const COLUNAS_LEAD = 'id, nome, telefone, email, cidade, etapa, etapa_em, responsavel_email, proximo_contato, motivo_perda, origem, recebido_em, cpf_cnpj, endereco, cep, uc, concessionaria, forma_pagamento, arquivado, orcamento_ganho_id, documentos, form_meta:dados_brutos->campos, form_meta2:dados_brutos->meta->campos';
let perfil = null, leads = [], orcs = [], equipe = [], filtroFollow = false, mostrarAntigos = false, verArquivados = false, arrastando = null, fichaId = null, perdaId = null, ganhoId = null;
// documentos do negócio ganho (pasta privada "documentos"; nenhum é obrigatório, a ficha mostra o que falta)
const DOCS_GANHO = [
  ['cnh', 'CNH / RG do titular', 'arquivo'], ['fatura', 'Fatura de energia', 'arquivo'], ['localizacao', 'Localização da instalação', 'local'],
  ['disjuntor', 'Foto do disjuntor', 'arquivo', true], ['padrao', 'Foto do padrão de entrada', 'arquivo', true], ['transformador', 'Foto ou localização do transformador', 'arquivo', true],
];
const FORMAS_PAG = ['À vista', 'Entrada + parcelas', 'FINAME (BNDES)', 'Financiamento Caixa', 'Financiamento bancário', 'Cartão de crédito'];

const $ = id => document.getElementById(id);
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtR0 = v => (+v || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL', maximumFractionDigits:0 });
const fmtR = v => (+v || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
const fmtDH = iso => iso ? new Date(iso).toLocaleDateString('pt-BR') + ' ' + new Date(iso).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }) : '';
const dias = iso => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
const nomeDe = email => (equipe.find(e => e.email === email) || {}).nome || (email ? email.split('@')[0] : '');
function telBonito(t) {
  let d = String(t || '').replace(/\D/g, '');
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return t || '';
}
function telWa(t) { let d = String(t || '').replace(/\D/g, ''); if (d.length === 10 || d.length === 11) d = '55' + d; return d; }
// data/hora local <-> input datetime-local
const paraInput = iso => { if (!iso) return ''; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const fimDeHoje = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; };
function situacaoFollow(l) {
  if (!l.proximo_contato || l.etapa === 'ganho' || l.etapa === 'perdido') return null;
  const t = new Date(l.proximo_contato);
  if (t < new Date(new Date().setHours(0,0,0,0))) return 'atraso';
  if (t <= fimDeHoje()) return 'hoje';
  return 'futuro';
}

function mostrar(qual, texto) {
  $('login').style.display = qual === 'login' ? '' : 'none';
  $('aviso').style.display = qual === 'aviso' ? '' : 'none';
  $('conteudo').style.display = qual === 'conteudo' ? 'block' : 'none';
  if (texto) $('aviso-txt').innerHTML = texto;
}
function renderHeader() {
  let h = '<a href="./">📄 Precificador</a>';
  if (perfil && (perfil.admin || perfil.papel === 'interno')) h += ' · <a href="painel.html">📊 Orçamentos</a>';
  if (perfil) h += ` · 👤 ${esc(perfil.nome || perfil.email)} <span class="papel">(${esc(perfil.papel || (perfil.admin ? 'admin' : 'vendedor'))})</span> · <a href="#" onclick="sair();return false">Sair</a>`;
  $('header-links').innerHTML = h;
}

async function iniciar() {
  if (!sb) { mostrar('aviso', '⚠ Sem conexão com o servidor. Verifique a internet e recarregue a página.'); return; }
  const { data } = await sb.auth.getSession();
  if (!data || !data.session) { perfil = null; renderHeader(); mostrar('login'); setTimeout(() => $('login-email').focus(), 50); return; }
  const r = await sb.rpc('meu_perfil');
  perfil = r.data || { email: data.session.user.email };
  renderHeader();
  if (!perfil.vendedor) { mostrar('aviso', 'Seu usuário (' + esc(perfil.email) + ') ainda não tem acesso ao CRM. Fale com o administrador.'); return; }
  mostrar('conteudo');
  $('btn-modelo-contrato').style.display = perfil.admin ? '' : 'none';
  $('btn-etapas').style.display = perfil.admin ? '' : 'none';
  await carregar();
  iniciarAvisos();
}
async function entrar() {
  const email = $('login-email').value.trim(), senha = $('login-senha').value;
  $('login-erro').textContent = '';
  if (!email || !senha) { $('login-erro').textContent = 'Preencha e-mail e senha.'; return; }
  $('login-btn').disabled = true; $('login-btn').textContent = 'Entrando…';
  const { error } = await sb.auth.signInWithPassword({ email, password: senha });
  $('login-btn').disabled = false; $('login-btn').textContent = 'Entrar';
  if (error) { $('login-erro').textContent = 'E-mail ou senha incorretos.'; $('login-senha').value = ''; return; }
  await iniciar();
}
async function sair() { pararAvisos(); await sb.auth.signOut(); perfil = null; await iniciar(); }

async function carregar() {
  $('kanban').innerHTML = '<div class="muted">Carregando…</div>';
  const [l, o, v, cfgCrm] = await Promise.all([
    sb.from('leads').select(COLUNAS_LEAD).order('recebido_em', { ascending:false }).limit(2000),
    sb.from('orcamentos').select('id, lead_id, sistema, kwp, valor_final, tipo, vendedor_email, criado_em, revisao_de:dados->>revisao_de').order('criado_em', { ascending:false }).limit(5000),
    sb.from('vendedores').select('email, nome, papel'),
    sb.from('config').select('dados').eq('id', 'crm').maybeSingle(),
  ]);
  if (cfgCrm && cfgCrm.data && cfgCrm.data.dados) aplicarEtapas(cfgCrm.data.dados.etapas);
  if (l.error) { mostrar('aviso', '⚠ Erro ao carregar os leads: ' + esc(l.error.message) + '<br>Se o CRM acabou de ser instalado, confira se o script 07 foi aplicado no Supabase.'); return; }
  leads = l.data || []; orcs = o.data || []; equipe = (v.data || []).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  const sel = $('f-resp'), atual = sel.value;
  sel.innerHTML = '<option value="">Todos os responsáveis</option><option value="__eu">Só os meus</option><option value="__sem">Sem responsável</option>' +
    equipe.filter(e => e.papel !== 'engenheiro').map(e => `<option value="${esc(e.email)}">${esc(e.nome || e.email)}</option>`).join('');
  sel.value = atual || '';
  render();
  if (fichaId) abrirFicha(fichaId, true);
  const doLink = +new URLSearchParams(location.search).get('lead');
  if (doLink && !fichaId && leads.some(l => l.id === doLink)) { const l = leads.find(x => x.id === doLink); if (l.arquivado) { verArquivados = true; render(); } abrirFicha(doLink); }
}

function ultimaProposta(leadId) { return orcs.find(o => o.lead_id === leadId) || null; }
// revisões: a proposta original fica no histórico como "substituída" pela revisão mais nova
const revisoesDe = id => orcs.filter(o => +o.revisao_de === id);
const substituida = id => orcs.some(o => +o.revisao_de === id);
// proposta que fechou o negócio (ganhos antigos sem marcação usam a última proposta)
function propostaDoLead(l) { return (l.orcamento_ganho_id && orcs.find(o => o.id === l.orcamento_ganho_id)) || ultimaProposta(l.id); }

function filtrados() {
  const q = $('f-busca').value.trim().toLowerCase(), qd = q.replace(/\D/g, '');
  const resp = $('f-resp').value;
  return leads.filter(l => {
    if (!!l.arquivado !== verArquivados) return false;
    if (q) {
      const txt = ((l.nome || '') + ' ' + (l.cidade || '') + ' ' + (l.email || '')).toLowerCase();
      if (!txt.includes(q) && !(qd.length >= 4 && String(l.telefone || '').includes(qd))) return false;
    }
    if (resp === '__eu' && l.responsavel_email !== perfil.email) return false;
    if (resp === '__sem' && l.responsavel_email) return false;
    if (resp && !resp.startsWith('__') && l.responsavel_email !== resp) return false;
    if (filtroFollow && !['hoje', 'atraso'].includes(situacaoFollow(l))) return false;
    if (!mostrarAntigos && (l.etapa === 'ganho' || l.etapa === 'perdido') && dias(l.etapa_em) > 30) return false;
    return true;
  });
}

function render() {
  const lista = filtrados();
  // resumo
  const mes = new Date(); mes.setDate(1); mes.setHours(0,0,0,0);
  const ativos = leads.filter(l => !l.arquivado);
  const abertos = ativos.filter(l => !['ganho', 'perdido'].includes(l.etapa));
  const ganhosMes = leads.filter(l => l.etapa === 'ganho' && new Date(l.etapa_em) >= mes);
  const somaGanhos = ganhosMes.reduce((s, l) => s + (+(propostaDoLead(l) || {}).valor_final || 0), 0);
  const propMes = orcs.filter(o => new Date(o.criado_em) >= mes && !substituida(o.id)).length;
  const follow = ativos.filter(l => ['hoje', 'atraso'].includes(situacaoFollow(l))).length;
  const perdidosMes = leads.filter(l => l.etapa === 'perdido' && new Date(l.etapa_em) >= mes).length;
  $('resumo').innerHTML = [
    [abertos.length, 'negócios em aberto'],
    [ativos.filter(l => l.etapa === 'novo').length, 'leads novos aguardando'],
    [propMes, 'propostas no mês'],
    [ganhosMes.length + ' · ' + fmtR0(somaGanhos), 'ganhos no mês'],
    [perdidosMes, 'perdidos no mês'],
  ].map(([v, t]) => `<div class="kpi"><div class="kpi-val">${v}</div><div class="kpi-lbl">${t}</div></div>`).join('');
  $('chip-follow').textContent = '⏰ Follow-up para hoje (' + follow + ')';
  $('chip-follow').classList.toggle('ativo', filtroFollow);
  $('chip-follow').classList.toggle('alerta', !filtroFollow && follow > 0);
  $('chip-antigos').classList.toggle('ativo', mostrarAntigos);
  const nArq = leads.filter(l => l.arquivado).length;
  $('chip-arquivados').textContent = verArquivados ? '← Voltar ao funil' : '🗄 Arquivados (' + nArq + ')';
  $('chip-arquivados').classList.toggle('ativo', verArquivados);

  const conhecidas = new Set(ETAPAS.map(e => e[0]));
  $('kanban').innerHTML = ETAPAS.map(([id, nome], iCol) => {
    // lead numa etapa que não existe mais aparece na primeira coluna (nunca some)
    const itens = lista.filter(l => l.etapa === id || (iCol === 0 && !conhecidas.has(l.etapa))).sort((a, b) => {
      const fa = a.proximo_contato ? new Date(a.proximo_contato).getTime() : Infinity, fb = b.proximo_contato ? new Date(b.proximo_contato).getTime() : Infinity;
      return fa - fb || new Date(b.etapa_em) - new Date(a.etapa_em);
    });
    const soma = itens.reduce((s, l) => s + (+(propostaDoLead(l) || {}).valor_final || 0), 0);
    return `<div class="coluna col-${id}" data-etapa="${id}" ondragover="sobreColuna(event,this)" ondragleave="this.classList.remove('sobre')" ondrop="soltar(event,this)">
      <div class="col-topo"><div class="col-nome">${nome}<span class="qtd">${itens.length}</span></div><div class="col-soma">${soma ? fmtR0(soma) + ' em propostas' : '&nbsp;'}</div></div>
      <div class="col-lista">${itens.map(cardLead).join('') || '<div class="vazio">—</div>'}</div></div>`;
  }).join('');
}

function cardLead(l) {
  const p = propostaDoLead(l), f = situacaoFollow(l), d = dias(l.etapa_em);
  const tags = [];
  if (f === 'atraso') tags.push(`<span class="tag atraso">⏰ atrasado ${new Date(l.proximo_contato).toLocaleDateString('pt-BR')}</span>`);
  if (f === 'hoje') tags.push(`<span class="tag hoje">⏰ hoje ${new Date(l.proximo_contato).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })}</span>`);
  if (f === 'futuro') tags.push(`<span class="tag">⏰ ${new Date(l.proximo_contato).toLocaleDateString('pt-BR')}</span>`);
  if (l.responsavel_email) tags.push(`<span class="tag resp">${esc(nomeDe(l.responsavel_email).split(' ')[0])}</span>`);
  if (l.etapa === 'perdido' && l.motivo_perda) tags.push(`<span class="tag">${esc(l.motivo_perda)}</span>`);
  if (l.etapa === 'ganho') { const dc = docsStatus(l); tags.push(`<span class="tag ${dc.falta ? 'hoje' : 'resp'}">📎 ${dc.ok}/${dc.total} docs</span>`); }
  if (l.arquivado) tags.push('<span class="tag">🗄 arquivado</span>');
  if (recem.has(l.id)) tags.unshift('<span class="tag chegou">🔔 chegou agora</span>');
  return `<div class="lead${recem.has(l.id) ? ' recem' : ''}" draggable="true" data-id="${l.id}" ondragstart="iniciarArrasto(event,${l.id})" ondragend="this.classList.remove('arrastando')" onclick="abrirFicha(${l.id})">
    <div class="lead-nome">${esc(l.nome || 'Sem nome')}</div>
    <div class="lead-linha"><span>${esc(telBonito(l.telefone))}</span><span>${esc(l.cidade || '')}</span></div>
    ${p ? `<div class="lead-linha"><span>${esc(p.sistema || '')} · ${String(p.kwp).replace('.', ',')} kWp</span><span class="lead-valor">${fmtR0(p.valor_final)}</span></div>` : ''}
    <div class="lead-tags">${tags.join('')}<span class="tag" title="Dias nesta etapa">${d === 0 ? 'hoje' : d + 'd'}</span></div>
  </div>`;
}

// ── arrastar entre colunas ──
function iniciarArrasto(e, id) { arrastando = id; e.dataTransfer.effectAllowed = 'move'; e.currentTarget.classList.add('arrastando'); }
function sobreColuna(e, col) { if (arrastando) { e.preventDefault(); col.classList.add('sobre'); } }
function soltar(e, col) { e.preventDefault(); col.classList.remove('sobre'); const id = arrastando; arrastando = null; if (id) mudarEtapa(id, col.dataset.etapa); }

async function mudarEtapa(id, etapa, extra) {
  const l = leads.find(x => x.id === id);
  if (!l || (l.etapa === etapa && !extra)) return;
  if (etapa === 'perdido' && !(extra && extra.motivo_perda)) { abrirPerda(id); return; }
  if (etapa === 'ganho' && !(extra && extra.ganhoOk)) { abrirGanho(id); return; }
  if (extra) delete extra.ganhoOk;
  const mud = { etapa, atualizado_em: new Date().toISOString(), ...(extra || {}) };
  if (!l.responsavel_email) mud.responsavel_email = perfil.email;
  if (etapa === 'ganho' || etapa === 'perdido') mud.proximo_contato = null;
  if (l.etapa === 'ganho' && etapa !== 'ganho') mud.orcamento_ganho_id = null;   // saiu de ganho: desfaz a proposta fechada
  const ant = { ...l };
  Object.assign(l, mud, { etapa_em: new Date().toISOString() });
  render();
  const { error } = await sb.from('leads').update(mud).eq('id', id);
  if (error) { Object.assign(l, ant); render(); alert('Não foi possível mudar a etapa: ' + error.message); return; }
  if (fichaId === id) abrirFicha(id, true);
}

// ── perda ──
function abrirPerda(id) { perdaId = id; $('perda-obs').value = ''; $('ov-perda').classList.add('visivel'); }
function fecharPerda() { perdaId = null; $('ov-perda').classList.remove('visivel'); render(); if (fichaId) abrirFicha(fichaId, true); }
async function confirmarPerda() {
  const id = perdaId, motivo = $('perda-motivo').value, obs = $('perda-obs').value.trim();
  $('ov-perda').classList.remove('visivel'); perdaId = null;
  await mudarEtapa(id, 'perdido', { motivo_perda: motivo });
  if (obs) await sb.from('lead_eventos').insert({ lead_id: id, texto: 'Motivo da perda: ' + obs });
  if (fichaId === id) abrirFicha(id, true);
}

// ── ficha do cliente ──
async function abrirFicha(id, recarregar) {
  const l = leads.find(x => x.id === id);
  if (!l) return;
  fichaId = id;
  if (recem.delete(id)) { atualizarTitulo(); render(); }
  const props = orcs.filter(o => o.lead_id === id);
  const opResp = '<option value="">— Sem responsável —</option>' + equipe.filter(e => e.papel !== 'engenheiro').map(e => `<option value="${esc(e.email)}" ${e.email === l.responsavel_email ? 'selected' : ''}>${esc(e.nome || e.email)}</option>`).join('');
  const opEtapa = ETAPAS.map(([k, n]) => `<option value="${k}" ${k === l.etapa ? 'selected' : ''}>${n}</option>`).join('');
  const opOrig = Object.entries(ORIGENS).map(([k, n]) => `<option value="${k}" ${k === (l.origem || 'datacrazy') ? 'selected' : ''}>${n}</option>`).join('');
  const wa = telWa(l.telefone);
  $('ficha').innerHTML = `
    <div class="ficha-topo">
      <div><h2>${esc(l.nome || 'Sem nome')}</h2><div class="muted">Recebido em ${fmtDH(l.recebido_em)} · ${esc(ORIGENS[l.origem] || l.origem || '')}</div></div>
      <button class="fechar" onclick="fecharFicha()">×</button>
    </div>
    <div class="acoes">
      ${wa ? `<a class="btn btn-verde" href="https://wa.me/${wa}" target="_blank" rel="noopener">💬 WhatsApp</a>` : ''}
      <a class="btn" href="./?lead=${id}">📄 Nova proposta</a>
      ${l.etapa !== 'ganho' ? `<button class="btn btn-verde" onclick="mudarEtapa(${id},'ganho')">🏆 Ganho</button>` : ''}
      ${l.etapa !== 'perdido' ? `<button class="btn btn-verm" onclick="mudarEtapa(${id},'perdido')">✕ Perdido</button>` : ''}
      <button class="btn btn-sec" onclick="$('contrato-titulo').textContent='📝 Contrato'; abrirContrato(${id})">📝 Contrato</button>
      <button class="btn btn-sec" onclick="arquivarLead(${id}, ${!l.arquivado})">${l.arquivado ? '↩ Desarquivar' : '🗄 Arquivar'}</button>
      ${perfil && perfil.admin ? `<button class="btn btn-sec" style="color:var(--vermelho)" onclick="excluirLead(${id})">🗑 Excluir</button>` : ''}
    </div>
    ${l.etapa === 'ganho' ? blocoGanho(l) : ''}
    ${blocoFormulario(l)}
    <h3>Negócio</h3>
    <div class="grade">
      <div><label>Etapa</label><select class="select" id="fx-etapa" onchange="mudarEtapa(${id}, this.value)">${opEtapa}</select></div>
      <div><label>Responsável</label><select class="select" id="fx-resp">${opResp}</select></div>
      <div><label>Próximo contato</label><input class="input" type="datetime-local" id="fx-prox" value="${paraInput(l.proximo_contato)}"></div>
      <div><label>Origem</label><select class="select" id="fx-origem">${opOrig}</select></div>
      ${l.etapa === 'perdido' ? `<div class="largo muted">Motivo da perda: <b>${esc(l.motivo_perda || '—')}</b></div>` : ''}
    </div>
    <h3>Dados do cliente</h3>
    <div class="grade">${camposCliente('fx', l)}</div>
    <div class="acoes"><button class="btn" onclick="salvarFicha(${id})">💾 Salvar</button><span class="status-msg" id="fx-msg"></span></div>
    <h3>Propostas (${props.length})</h3>
    ${props.length ? props.map(p => { const sub = revisoesDe(p.id)[0];
      return `<div class="prop prop-click" onclick="verProposta(${p.id})" style="${sub ? 'opacity:.6' : ''}"><span>Nº ${String(p.id).padStart(5, '0')} · ${esc(p.sistema || '')} · ${String(p.kwp).replace('.', ',')} kWp${p.revisao_de ? ' <span class="tag resp">↻ revisão da Nº ' + String(p.revisao_de).padStart(5, '0') + '</span>' : ''}${sub ? ' <span class="tag">substituída pela Nº ' + String(sub.id).padStart(5, '0') + '</span>' : ''}<br><span class="muted">${fmtDH(p.criado_em)} · ${esc(nomeDe(p.vendedor_email))}</span></span><span style="text-align:right"><b style="color:var(--amarelo)">${fmtR(p.valor_final)} ▾</b><br><a class="btn btn-sec" style="padding:3px 9px;font-size:12px;margin-top:4px" href="./?revisar=${p.id}" onclick="event.stopPropagation()">✏ Revisar</a></span></div><div class="prop-det" id="pdet-${p.id}"></div>`; }).join('')
      : '<div class="muted">Nenhuma proposta ainda. Use "Nova proposta".</div>'}
    <h3>Contratos</h3>
    <div id="fx-contratos"><div class="muted">Carregando…</div></div>
    <h3>Histórico e anotações</h3>
    <textarea class="input" id="fx-nota" rows="3" placeholder="Ex.: Ligou, pediu para retornar depois do dia 10. Quer financiar pela Caixa."></textarea>
    <div class="acoes"><button class="btn btn-sec" onclick="anotar(${id})">+ Adicionar anotação</button></div>
    <div id="fx-eventos" style="margin-top:12px"><div class="muted">Carregando…</div></div>`;
  $('ov-ficha').classList.add('visivel');
  sb.from('leads').select('contratos').eq('id', id).maybeSingle().then(({ data: lc }) => {
    const box = $('fx-contratos'); if (!box || fichaId !== id) return;
    const lista = (lc && Array.isArray(lc.contratos)) ? lc.contratos.slice().reverse() : [];
    box.innerHTML = lista.length ? lista.map((c, i) => `<div class="prop"><span>Contrato · proposta Nº ${String(c.orcamento_id).padStart(5, '0')} · ${esc((c.conc || {}).sigla || '')}<br><span class="muted">${fmtDH(c.em)} · ${esc(nomeDe(c.autor))} · ${fmtR((c.d || {}).valor)}</span></span><button class="btn btn-sec" onclick="baixarContrato(${id}, ${lista.length - 1 - i})">⬇ PDF</button></div>`).join('')
      : '<div class="muted">Nenhum contrato gerado. Use o botão "📝 Contrato".</div>';
  });
  const { data, error } = await sb.from('lead_eventos').select('tipo, texto, autor_email, criado_em').eq('lead_id', id).order('criado_em', { ascending:false }).limit(200);
  if (fichaId !== id) return;
  $('fx-eventos').innerHTML = error ? '<div class="muted">Não foi possível carregar o histórico.</div>'
    : (data.length ? data.map(e => `<div class="evento ${e.tipo}"><div class="quando">${fmtDH(e.criado_em)} · ${esc(nomeDe(e.autor_email) || 'sistema')}</div>${esc(e.texto)}</div>`).join('') : '<div class="muted">Sem registros ainda.</div>');
}
function fecharFicha() { fichaId = null; $('ov-ficha').classList.remove('visivel'); }

async function salvarFicha(id) {
  const l = leads.find(x => x.id === id);
  const prox = $('fx-prox').value;
  const mud = {
    ...lerCamposCliente('fx'),
    responsavel_email: $('fx-resp').value || null,
    origem: $('fx-origem').value,
    proximo_contato: prox ? new Date(prox).toISOString() : null,
    atualizado_em: new Date().toISOString(),
  };
  const { error } = await sb.from('leads').update(mud).eq('id', id);
  const msg = $('fx-msg');
  if (error) { msg.textContent = '⚠ ' + error.message; msg.classList.add('erro'); return; }
  Object.assign(l, mud);
  msg.classList.remove('erro'); msg.textContent = '✅ Salvo';
  render();
}

async function anotar(id) {
  const txt = $('fx-nota').value.trim();
  if (!txt) return;
  const { error } = await sb.from('lead_eventos').insert({ lead_id: id, texto: txt });
  if (error) { alert('Não foi possível salvar a anotação: ' + error.message); return; }
  abrirFicha(id, true);
}

// campos de cliente (mesmos na ficha e no novo lead) — nenhum é obrigatório
function camposCliente(pre, l) {
  l = l || {};
  const c = (id, rot, val, extra, largo) => `<div${largo ? ' class="largo"' : ''}><label>${rot}</label><input class="input" id="${pre}-${id}" value="${esc(val || '')}" ${extra || ''}></div>`;
  return c('nome', 'Nome / Razão social', l.nome, '', true)
    + c('cpf', 'CPF / CNPJ', l.cpf_cnpj, 'placeholder="000.000.000-00"')
    + c('tel', 'Telefone / WhatsApp', telBonito(l.telefone), 'inputmode="tel" placeholder="(49) 99999-9999"')
    + c('email', 'E-mail', l.email, 'type="email"', true)
    + c('end', 'Endereço da instalação (rua, nº, complemento, bairro)', l.endereco, '', true)
    + c('cep', 'CEP', l.cep, 'inputmode="numeric" placeholder="00000-000"')
    + c('cidade', 'Município / UF', l.cidade, 'placeholder="Chapecó / SC"')
    + c('uc', 'Unidade consumidora (UC)', l.uc, 'inputmode="numeric"')
    + c('conc', 'Concessionária', l.concessionaria, 'list="lista-conc" placeholder="Celesc, Copel…"');
}
function lerCamposCliente(pre) {
  const v = id => ($(pre + '-' + id).value || '').trim() || null;
  let tel = ($(pre + '-tel').value || '').replace(/\D/g, '') || null;
  if (tel && (tel.length === 10 || tel.length === 11)) tel = '55' + tel;
  return { nome: v('nome'), cpf_cnpj: v('cpf'), telefone: tel, email: v('email'), endereco: v('end'), cep: v('cep'),
           cidade: v('cidade'), uc: v('uc'), concessionaria: v('conc') };
}

function novoLead() {
  const opResp = '<option value="">— Sem responsável —</option>' + equipe.filter(e => e.papel !== 'engenheiro').map(e => `<option value="${esc(e.email)}" ${e.email === perfil.email ? 'selected' : ''}>${esc(e.nome || e.email)}</option>`).join('');
  const opOrig = Object.entries(ORIGENS).map(([k, n]) => `<option value="${k}" ${k === 'indicacao' ? 'selected' : ''}>${n}</option>`).join('');
  $('novo-corpo').innerHTML = `
    <div class="grade">${camposCliente('nl', {})}
      <div><label>Origem</label><select class="select" id="nl-origem">${opOrig}</select></div>
      <div><label>Responsável</label><select class="select" id="nl-resp">${opResp}</select></div>
      <div class="largo"><label>Observação (vai para o histórico)</label><textarea class="input" id="nl-obs" rows="3" placeholder="Ex.: indicação do João, conta de R$ 450, quer financiar."></textarea></div>
    </div>
    <div class="acoes"><button class="btn" id="nl-btn" onclick="salvarNovoLead()">💾 Criar lead</button><button class="btn btn-sec" onclick="fecharNovoLead()">Cancelar</button><span class="status-msg" id="nl-msg"></span></div>`;
  $('ov-novo').classList.add('visivel');
  setTimeout(() => $('nl-nome').focus(), 50);
}
function fecharNovoLead() { $('ov-novo').classList.remove('visivel'); }
async function salvarNovoLead() {
  const reg = { ...lerCamposCliente('nl'), etapa: 'novo', status: 'novo', origem: $('nl-origem').value, responsavel_email: $('nl-resp').value || null };
  if (!reg.nome) reg.nome = reg.telefone ? 'Lead ' + telBonito(reg.telefone) : 'Lead sem nome';
  const obs = $('nl-obs').value.trim();
  $('nl-btn').disabled = true;
  const { data, error } = await sb.from('leads').insert(reg).select(COLUNAS_LEAD).single();
  $('nl-btn').disabled = false;
  if (error) { $('nl-msg').textContent = '⚠ Não foi possível criar: ' + error.message; $('nl-msg').classList.add('erro'); return; }
  if (obs) await sb.from('lead_eventos').insert({ lead_id: data.id, texto: obs });
  fecharNovoLead();
  leads.unshift(data); render(); abrirFicha(data.id);
}

// ── negócio ganho ──
function abrirGanho(id) {
  const l = leads.find(x => x.id === id); if (!l) return;
  ganhoId = id;
  const props = orcs.filter(o => o.lead_id === id);
  $('ganho-nome').textContent = l.nome || 'Cliente';
  $('ganho-prop').innerHTML = props.length
    ? props.map((p, i) => `<option value="${p.id}" ${i === 0 ? 'selected' : ''}>Nº ${String(p.id).padStart(5, '0')} · ${esc(p.sistema || '')} · ${String(p.kwp).replace('.', ',')} kWp · ${fmtR(p.valor_final)} · ${new Date(p.criado_em).toLocaleDateString('pt-BR')}</option>`).join('')
    : '<option value="">— Nenhuma proposta salva para este cliente —</option>';
  $('ganho-pag').value = l.forma_pagamento || '';
  $('ganho-lista-pag').innerHTML = FORMAS_PAG.map(t => `<option value="${esc(t)}">`).join('');
  $('ov-ganho').classList.add('visivel');
}
function fecharGanho() { ganhoId = null; $('ov-ganho').classList.remove('visivel'); render(); if (fichaId) abrirFicha(fichaId, true); }
async function confirmarGanho() {
  const id = ganhoId; if (!id) return;
  const prop = +$('ganho-prop').value || null, pag = $('ganho-pag').value.trim() || null;
  $('ov-ganho').classList.remove('visivel'); ganhoId = null;
  const l = leads.find(x => x.id === id);
  if (l && l.etapa === 'ganho') {   // só trocando a proposta ou a forma de pagamento (mantém a data do ganho)
    const mud = { orcamento_ganho_id: prop, forma_pagamento: pag, atualizado_em: new Date().toISOString() };
    const { error } = await sb.from('leads').update(mud).eq('id', id);
    if (error) { alert('Não foi possível salvar: ' + error.message); return; }
    Object.assign(l, mud); render(); abrirFicha(id, true); return;
  }
  await mudarEtapa(id, 'ganho', { ganhoOk: true, orcamento_ganho_id: prop, forma_pagamento: pag });
  const p = orcs.find(o => o.id === prop);
  await sb.from('lead_eventos').insert({ lead_id: id, texto: '🏆 Negócio ganho' + (p ? ' · proposta Nº ' + String(p.id).padStart(5, '0') + ' · ' + fmtR(p.valor_final) : '') + (pag ? ' · ' + pag : '') });
  abrirFicha(id, true);
}
function docsStatus(l) {
  const docs = Array.isArray(l.documentos) ? l.documentos : [];
  const tem = k => docs.some(d => d.tipo === k);
  const base = DOCS_GANHO.filter(d => !d[3]);
  const ok = base.filter(d => tem(d[0])).length + (l.email ? 1 : 0);
  return { ok, total: base.length + 1, falta: ok < base.length + 1, tem, docs };
}
function blocoGanho(l) {
  const p = propostaDoLead(l), st = docsStatus(l);
  const linhaDoc = ([k, rot, tipo, extra]) => {
    const itens = st.docs.filter(d => d.tipo === k);
    const lista = itens.map(d => `<div class="muted" style="margin-left:22px">${d.valor ? `<a href="https://www.google.com/maps?q=${encodeURIComponent(d.valor)}" target="_blank" rel="noopener">📍 ${esc(d.valor)}</a>` : `<a href="#" onclick="verDoc('${esc(d.path)}');return false">📄 ${esc(d.nome || 'arquivo')}</a>`} · ${fmtDH(d.em)} · ${esc(nomeDe(d.autor))}${perfil && perfil.admin ? ` · <a href="#" style="color:var(--vermelho)" onclick="apagarDoc(${l.id}, '${esc(d.id)}');return false">apagar</a>` : ''}</div>`).join('');
    const botao = tipo === 'local'
      ? `<button class="btn btn-sec" style="padding:4px 10px;font-size:13px" onclick="salvarLocalizacao(${l.id})">📍 Marcar</button>`
      : `<label class="btn btn-sec" style="padding:4px 10px;font-size:13px;cursor:pointer">📷 Enviar<input type="file" accept="image/*,application/pdf" style="display:none" onchange="enviarDoc(${l.id}, '${k}', this)"></label>`;
    return `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--borda)"><span>${itens.length ? '✅' : (extra ? '▫️' : '⬜')} ${rot}${extra ? ' <span class="muted">(se a concessionária exigir)</span>' : ''}</span>${botao}</div>${lista}`;
  };
  return `<h3>🏆 Negócio ganho</h3>
    <div class="grade">
      <div class="largo muted">Proposta fechada: <b style="color:var(--amarelo)">${p ? 'Nº ' + String(p.id).padStart(5, '0') + ' · ' + esc(p.sistema || '') + ' · ' + fmtR(p.valor_final) : '—'}</b>${l.forma_pagamento ? ' · ' + esc(l.forma_pagamento) : ''} · <a href="#" onclick="abrirGanho(${l.id});return false">alterar</a></div>
    </div>
    <div style="margin-top:8px"><b>Documentos</b> <span class="muted">(${st.ok} de ${st.total})</span></div>
    <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--borda)"><span>${l.email ? '✅' : '⬜'} E-mail do cliente</span><span class="muted">${esc(l.email || 'preencha em Dados do cliente')}</span></div>
    ${DOCS_GANHO.map(linhaDoc).join('')}
    <div class="status-msg" id="doc-msg"></div>
    <div class="acoes"><button class="btn btn-verde" onclick="avisarEngenharia(${l.id})">📣 Avisar engenharia (WhatsApp)</button></div>`;
}
// fotos ficam menores antes de subir (máx. 2000 px); PDF vai como está
function reduzirFoto(arq) {
  return new Promise(ok => {
    if (!/^image\/(jpeg|png|webp)$/.test(arq.type)) return ok(arq);
    const img = new Image();
    img.onload = () => {
      const e = Math.min(1, 2000 / Math.max(img.width, img.height));
      const cv = document.createElement('canvas'); cv.width = Math.round(img.width * e); cv.height = Math.round(img.height * e);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      cv.toBlob(b => ok(b || arq), 'image/jpeg', 0.85); URL.revokeObjectURL(img.src);
    };
    img.onerror = () => ok(arq);
    img.src = URL.createObjectURL(arq);
  });
}
async function gravarDocs(id, docs) {
  const { error } = await sb.from('leads').update({ documentos: docs, atualizado_em: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
  const l = leads.find(x => x.id === id); if (l) l.documentos = docs;
  render();
}
async function enviarDoc(id, tipo, input) {
  const arq = input.files && input.files[0]; input.value = '';
  if (!arq) return;
  const msg = $('doc-msg'); msg.classList.remove('erro'); msg.textContent = '⏳ Enviando…';
  try {
    const blob = await reduzirFoto(arq);
    const ext = blob.type === 'application/pdf' ? 'pdf' : (blob.type === 'image/jpeg' ? 'jpg' : (arq.name.split('.').pop() || 'bin').toLowerCase());
    const path = 'lead-' + id + '/' + tipo + '-' + Date.now() + '.' + ext;
    const { error } = await sb.storage.from('documentos').upload(path, blob, { contentType: blob.type || arq.type, upsert: false });
    if (error) throw error;
    const l = leads.find(x => x.id === id);
    const docs = [...(l.documentos || []), { id: String(Date.now()), tipo, nome: arq.name, path, em: new Date().toISOString(), autor: perfil.email }];
    await gravarDocs(id, docs);
    abrirFicha(id, true);
  } catch (e) { msg.textContent = '⚠ Não foi possível enviar: ' + (e.message || e); msg.classList.add('erro'); }
}
async function verDoc(path) {
  const { data, error } = await sb.storage.from('documentos').createSignedUrl(path, 300);
  if (error || !data) { alert('Não foi possível abrir o documento: ' + (error ? error.message : '')); return; }
  window.open(data.signedUrl, '_blank', 'noopener');
}
async function apagarDoc(id, docId) {
  const l = leads.find(x => x.id === id); if (!l || !confirm('Apagar este documento?')) return;
  const d = (l.documentos || []).find(x => x.id === docId);
  if (d && d.path) await sb.storage.from('documentos').remove([d.path]);
  try { await gravarDocs(id, (l.documentos || []).filter(x => x.id !== docId)); abrirFicha(id, true); } catch (e) { alert('Erro: ' + e.message); }
}
function salvarLocalizacao(id) {
  const gravar = async valor => {
    if (!valor) return;
    const l = leads.find(x => x.id === id);
    try { await gravarDocs(id, [...(l.documentos || []), { id: String(Date.now()), tipo: 'localizacao', valor: valor.trim(), em: new Date().toISOString(), autor: perfil.email }]); abrirFicha(id, true); }
    catch (e) { alert('Erro: ' + e.message); }
  };
  const manual = () => gravar(prompt('Cole o link do Google Maps ou as coordenadas (ex.: -26.7261, -52.7206):'));
  if (!navigator.geolocation || !confirm('Usar a localização atual deste aparelho?\n(Escolha "Cancelar" para colar um link ou coordenadas)')) return manual();
  navigator.geolocation.getCurrentPosition(p => gravar(p.coords.latitude.toFixed(6) + ', ' + p.coords.longitude.toFixed(6)), () => manual(), { enableHighAccuracy: true, timeout: 15000 });
}
function avisarEngenharia(id) {
  const l = leads.find(x => x.id === id); if (!l) return;
  const p = propostaDoLead(l), st = docsStatus(l);
  const loc = st.docs.find(d => d.tipo === 'localizacao');
  const falta = DOCS_GANHO.filter(d => !d[3] && !st.tem(d[0])).map(d => d[1]).concat(l.email ? [] : ['E-mail']);
  const linhas = [
    '🏆 *Negócio ganho — Energtech*',
    '👤 ' + (l.nome || 'Cliente') + (l.cidade ? ' · ' + l.cidade : ''),
    p ? '🔋 ' + (p.sistema || '') + ' · ' + String(p.kwp).replace('.', ',') + ' kWp · ' + fmtR(p.valor_final) + ' (proposta Nº ' + String(p.id).padStart(5, '0') + ')' : '',
    l.forma_pagamento ? '💳 ' + l.forma_pagamento : '',
    l.uc ? '⚡ UC ' + l.uc + (l.concessionaria ? ' · ' + l.concessionaria : '') : (l.concessionaria ? '⚡ ' + l.concessionaria : ''),
    l.endereco ? '🏠 ' + l.endereco : '',
    loc ? '📍 https://www.google.com/maps?q=' + encodeURIComponent(loc.valor) : '',
    '📎 Documentos: ' + st.ok + ' de ' + st.total + (falta.length ? ' (faltam: ' + falta.join(', ') + ')' : ' ✅'),
    '🔗 Ficha: ' + location.origin + location.pathname + '?lead=' + id,
  ].filter(Boolean);
  window.open('https://wa.me/?text=' + encodeURIComponent(linhas.join('\n')), '_blank', 'noopener');
}

// ── etapas do funil (admin) ──
let etapasEdit = [];
function abrirEtapas() { etapasEdit = ETAPAS.map(([id, nome]) => ({ id, nome })); $('etapas-msg').textContent = ''; renderEtapas(); $('ov-etapas').classList.add('visivel'); }
function fecharEtapas() { $('ov-etapas').classList.remove('visivel'); }
function renderEtapas() {
  const qtd = id => leads.filter(l => l.etapa === id).length;
  const moveis = etapasEdit.filter(e => !ETAPAS_FIXAS.includes(e.id));
  const bt = 'class="btn btn-sec" style="padding:6px 9px"';
  $('etapas-lista').innerHTML = etapasEdit.map((e, i) => {
    const fixa = ETAPAS_FIXAS.includes(e.id), im = moveis.indexOf(e);
    return `<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">
      <input class="input" value="${esc(e.nome)}" oninput="etapasEdit[${i}].nome=this.value" style="flex:1">
      <span class="muted" style="min-width:62px;text-align:right">${qtd(e.id)} lead(s)</span>
      ${fixa ? '<span class="muted" style="width:104px;text-align:center" title="Etapa usada pelo sistema: só o nome pode mudar">fixa</span>'
        : `<button ${bt} ${im === 0 ? 'disabled' : ''} onclick="moverEtapa(${i},-1)">▲</button><button ${bt} ${im === moveis.length - 1 ? 'disabled' : ''} onclick="moverEtapa(${i},1)">▼</button><button class="btn btn-sec" style="padding:6px 9px;color:var(--vermelho)" ${moveis.length < 2 ? 'disabled' : ''} onclick="removerEtapa(${i})">🗑</button>`}
    </div>`;
  }).join('');
}
function moverEtapa(i, d) {
  const j = i + d;
  if (j < 0 || j >= etapasEdit.length || ETAPAS_FIXAS.includes(etapasEdit[j].id)) return;
  [etapasEdit[i], etapasEdit[j]] = [etapasEdit[j], etapasEdit[i]]; renderEtapas();
}
function novaEtapa() {
  const pos = etapasEdit.findIndex(e => ETAPAS_FIXAS.includes(e.id));
  etapasEdit.splice(pos < 0 ? etapasEdit.length : pos, 0, { id: 'e' + Date.now().toString(36), nome: 'Nova etapa' });
  renderEtapas();
  const ins = $('etapas-lista').querySelectorAll('input'); const alvo = ins[pos < 0 ? ins.length - 1 : pos]; if (alvo) { alvo.focus(); alvo.select(); }
}
function removerEtapa(i) { etapasEdit.splice(i, 1); renderEtapas(); }
async function salvarEtapas() {
  const lista = etapasEdit.map(e => ({ id: e.id, nome: String(e.nome || '').trim() }));
  const msg = $('etapas-msg'); msg.classList.add('erro');
  if (lista.some(e => !e.nome)) { msg.textContent = 'Dê um nome a todas as etapas.'; return; }
  const ids = new Set(lista.map(e => e.id));
  const removidas = ETAPAS.map(e => e[0]).filter(id => !ids.has(id));
  const afetados = leads.filter(l => removidas.includes(l.etapa));
  const destino = lista[0];
  if (afetados.length && !confirm(afetados.length + ' lead(s) estão nas etapas excluídas e vão para "' + destino.nome + '". Continuar?')) return;
  const { error } = await sb.from('config').upsert({ id: 'crm', dados: { etapas: lista } }, { onConflict: 'id' });
  if (error) { msg.textContent = '⚠ Não foi possível salvar: ' + error.message; return; }
  if (afetados.length) {
    const agora = new Date().toISOString();
    const r = await sb.from('leads').update({ etapa: destino.id, etapa_em: agora, atualizado_em: agora }).in('etapa', removidas);
    if (r.error) { msg.textContent = '⚠ Etapas salvas, mas não foi possível mover os leads: ' + r.error.message; return; }
    afetados.forEach(l => { l.etapa = destino.id; l.etapa_em = agora; });
  }
  aplicarEtapas(lista); fecharEtapas(); render();
}

// ── arquivar / excluir ──
async function arquivarLead(id, arquivar) {
  const l = leads.find(x => x.id === id); if (!l) return;
  const { error } = await sb.from('leads').update({ arquivado: arquivar, atualizado_em: new Date().toISOString() }).eq('id', id);
  if (error) { alert('Não foi possível ' + (arquivar ? 'arquivar' : 'desarquivar') + ': ' + error.message); return; }
  l.arquivado = arquivar;
  await sb.from('lead_eventos').insert({ lead_id: id, texto: arquivar ? '🗄 Lead arquivado' : '↩ Lead desarquivado' });
  if (arquivar) fecharFicha(); else abrirFicha(id, true);
  render();
}
async function excluirLead(id) {
  const l = leads.find(x => x.id === id); if (!l || !perfil || !perfil.admin) return;
  const props = orcs.filter(o => o.lead_id === id);
  if (!confirm('EXCLUIR DE VEZ "' + (l.nome || 'Sem nome') + '"?\n\nApaga o lead, o histórico, os documentos' + (props.length ? ' e ' + props.length + ' proposta(s) salva(s)' : '') + '. Não dá para desfazer.\n\nPara só tirar da tela, use "Arquivar".')) return;
  const docs = (l.documentos || []).filter(d => d.path).map(d => d.path);
  if (docs.length) await sb.storage.from('documentos').remove(docs);
  if (props.length) {
    const r = await sb.from('orcamentos').delete().in('id', props.map(p => p.id));
    if (r.error) { alert('Não foi possível excluir as propostas: ' + r.error.message); return; }
  }
  const { error } = await sb.from('leads').delete().eq('id', id);
  if (error) { alert('Não foi possível excluir: ' + error.message); return; }
  leads = leads.filter(x => x.id !== id); orcs = orcs.filter(o => o.lead_id !== id);
  fecharFicha(); render();
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') { if ($('ov-etapas').classList.contains('visivel')) fecharEtapas(); else if ($('ov-ganho').classList.contains('visivel')) fecharGanho(); else if ($('ov-perda').classList.contains('visivel')) fecharPerda(); else if ($('ov-novo').classList.contains('visivel')) fecharNovoLead(); else if ($('ov-contrato').classList.contains('visivel')) fecharContrato(); else fecharFicha(); } });
// ── aviso de lead novo (admin e vendas internas) ──
// Confere a cada 1 minuto se entrou lead novo (Meta direto, DataCrazy ou cadastrado por outra pessoa).
// Avisa com som, destaque no card, contador no título da aba e notificação do sistema (se autorizada).
// Funciona enquanto o CRM estiver aberto (mesmo em segundo plano ou minimizado).
const recem = new Set(), TITULO_PAG = document.title;
let _timerAvisos = null, _checandoLeads = false, _audio = null, _desdeAvisos = '';
const recebeAvisos = () => !!perfil && (perfil.admin || perfil.papel === 'interno');
const temNotificacao = () => 'Notification' in window;

function atualizarTitulo() { document.title = recem.size ? '(' + recem.size + ') 🔔 ' + TITULO_PAG : TITULO_PAG; }
function maiorRecebido() { return leads.reduce((m, l) => (l.recebido_em && l.recebido_em > m ? l.recebido_em : m), ''); }
function mostrarChipAvisos() {
  const c = $('chip-avisos'); if (!c) return;
  c.style.display = recebeAvisos() && temNotificacao() && Notification.permission === 'default' ? '' : 'none';
}
function prepararSom() {
  try {
    _audio = _audio || new (window.AudioContext || window.webkitAudioContext)();
    if (_audio.state === 'suspended') _audio.resume();
  } catch (_) { /* sem áudio */ }
}
function tocarAviso() {
  try {
    prepararSom(); if (!_audio) return;
    const t = _audio.currentTime;
    [880, 1175].forEach((f, i) => {
      const o = _audio.createOscillator(), g = _audio.createGain(), t0 = t + i * 0.18;
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
      o.connect(g); g.connect(_audio.destination); o.start(t0); o.stop(t0 + 0.17);
    });
  } catch (_) { /* sem áudio */ }
}
function toastLead(l) {
  const box = $('toast-lead'); if (!box) return;
  const d = document.createElement('div');
  d.innerHTML = `<b>🔔 Lead novo</b> · ${esc(ORIGENS[l.origem] || l.origem || '')}<br>${esc(l.nome || 'Sem nome')}${l.cidade ? ' · ' + esc(l.cidade) : ''}${l.telefone ? ' · ' + esc(telBonito(l.telefone)) : ''}`;
  d.onclick = () => { d.remove(); abrirFicha(l.id); };
  box.appendChild(d);
  setTimeout(() => d.remove(), 30000);
}
async function notificarSistema(l) {
  if (!temNotificacao() || Notification.permission !== 'granted') return;
  const titulo = '🔔 Lead novo: ' + (l.nome || 'sem nome');
  const opc = {
    body: [telBonito(l.telefone), l.cidade, ORIGENS[l.origem] || l.origem].filter(Boolean).join(' · '),
    icon: 'icone-192.png', badge: 'icone-192.png', tag: 'lead-' + l.id, data: { url: 'crm.html?lead=' + l.id },
  };
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg) { await reg.showNotification(titulo, opc); return; }
  } catch (_) { /* tenta o modo simples */ }
  try { const n = new Notification(titulo, opc); n.onclick = () => { window.focus(); abrirFicha(l.id); n.close(); }; } catch (_) { /* navegador sem suporte */ }
}
async function checarLeadsNovos() {
  if (_checandoLeads || !recebeAvisos() || !sb) return;
  _checandoLeads = true;
  try {
    const desde = [maiorRecebido(), _desdeAvisos].sort().pop();
    const { data, error } = await sb.from('leads').select(COLUNAS_LEAD).gt('recebido_em', desde).order('recebido_em', { ascending: true }).limit(50);
    if (error || !data || !data.length) return;
    const novos = data.filter(l => !leads.some(x => x.id === l.id));
    if (!novos.length) return;
    leads = novos.slice().reverse().concat(leads);
    const avisar = novos.filter(l => !l.arquivado);
    avisar.forEach(l => { recem.add(l.id); toastLead(l); notificarSistema(l); });
    if (avisar.length) tocarAviso();
    atualizarTitulo(); render();
  } catch (e) { console.warn('Avisos:', e); } finally { _checandoLeads = false; }
}
function iniciarAvisos() {
  pararAvisos();
  mostrarChipAvisos();
  if (!recebeAvisos()) return;
  _desdeAvisos = new Date(Date.now() - 60000).toISOString();
  _timerAvisos = setInterval(checarLeadsNovos, 60000);
}
function pararAvisos() { if (_timerAvisos) clearInterval(_timerAvisos); _timerAvisos = null; recem.clear(); atualizarTitulo(); }
async function ativarAvisos() {
  prepararSom();
  if (!temNotificacao()) return;
  const r = await Notification.requestPermission();
  mostrarChipAvisos();
  if (r === 'granted') notificarSistema({ id: 0, nome: 'teste — os avisos estão ativos', origem: '', cidade: 'Energtech' });
  else if (r === 'denied') alert('As notificações foram bloqueadas neste navegador. O CRM continua avisando com som e destaque enquanto estiver aberto. Para liberar depois, clique no cadeado ao lado do endereço do site.');
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checarLeadsNovos(); });
document.addEventListener('pointerdown', prepararSom, { once: true });
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => null);
