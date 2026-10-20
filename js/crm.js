// Energtech — CRM: funil, ficha do cliente, histórico
// (carregado pelo crm.html depois de js/comum.js)

const ETAPAS = [
  ['novo', 'Lead novo'], ['atendimento', 'Em atendimento'], ['qualificado', 'Qualificado'], ['proposta', 'Proposta enviada'],
  ['negociacao', 'Negociação'], ['ganho', 'Ganho'], ['perdido', 'Perdido'],
];
const NOME_ETAPA = Object.fromEntries(ETAPAS);
const ORIGENS = { datacrazy:'Anúncio / DataCrazy', indicacao:'Indicação', whatsapp:'WhatsApp direto', telefone:'Telefone', loja:'Loja / visita', campo:'Prospecção em campo', outro:'Outro' };

const COLUNAS_LEAD = 'id, nome, telefone, email, cidade, etapa, etapa_em, responsavel_email, proximo_contato, motivo_perda, origem, recebido_em, cpf_cnpj, endereco, cep, uc, concessionaria';
let perfil = null, leads = [], orcs = [], equipe = [], filtroFollow = false, mostrarAntigos = false, arrastando = null, fichaId = null, perdaId = null;

const $ = id => document.getElementById(id);
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtR0 = v => (+v || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL', maximumFractionDigits:0 });
const fmtR = v => (+v || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
const fmtDH = iso => iso ? new Date(iso).toLocaleDateString('pt-BR') + ' ' + new Date(iso).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }) : '';
const dias = iso => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
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
  await carregar();
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
async function sair() { await sb.auth.signOut(); perfil = null; await iniciar(); }

async function carregar() {
  $('kanban').innerHTML = '<div class="muted">Carregando…</div>';
  const [l, o, v] = await Promise.all([
    sb.from('leads').select(COLUNAS_LEAD).order('recebido_em', { ascending:false }).limit(2000),
    sb.from('orcamentos').select('id, lead_id, sistema, kwp, valor_final, tipo, vendedor_email, criado_em').order('criado_em', { ascending:false }).limit(5000),
    sb.from('vendedores').select('email, nome, papel'),
  ]);
  if (l.error) { mostrar('aviso', '⚠ Erro ao carregar os leads: ' + esc(l.error.message) + '<br>Se o CRM acabou de ser instalado, confira se o script 07 foi aplicado no Supabase.'); return; }
  leads = l.data || []; orcs = o.data || []; equipe = (v.data || []).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  const sel = $('f-resp'), atual = sel.value;
  sel.innerHTML = '<option value="">Todos os responsáveis</option><option value="__eu">Só os meus</option><option value="__sem">Sem responsável</option>' +
    equipe.filter(e => e.papel !== 'engenheiro').map(e => `<option value="${esc(e.email)}">${esc(e.nome || e.email)}</option>`).join('');
  sel.value = atual || '';
  render();
  if (fichaId) abrirFicha(fichaId, true);
}

function ultimaProposta(leadId) { return orcs.find(o => o.lead_id === leadId) || null; }

function filtrados() {
  const q = $('f-busca').value.trim().toLowerCase(), qd = q.replace(/\D/g, '');
  const resp = $('f-resp').value;
  return leads.filter(l => {
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
  const abertos = leads.filter(l => !['ganho', 'perdido'].includes(l.etapa));
  const ganhosMes = leads.filter(l => l.etapa === 'ganho' && new Date(l.etapa_em) >= mes);
  const somaGanhos = ganhosMes.reduce((s, l) => s + (+(ultimaProposta(l.id) || {}).valor_final || 0), 0);
  const propMes = orcs.filter(o => new Date(o.criado_em) >= mes).length;
  const follow = leads.filter(l => ['hoje', 'atraso'].includes(situacaoFollow(l))).length;
  const perdidosMes = leads.filter(l => l.etapa === 'perdido' && new Date(l.etapa_em) >= mes).length;
  $('resumo').innerHTML = [
    [abertos.length, 'negócios em aberto'],
    [leads.filter(l => l.etapa === 'novo').length, 'leads novos aguardando'],
    [propMes, 'propostas no mês'],
    [ganhosMes.length + ' · ' + fmtR0(somaGanhos), 'ganhos no mês'],
    [perdidosMes, 'perdidos no mês'],
  ].map(([v, t]) => `<div class="kpi"><div class="kpi-val">${v}</div><div class="kpi-lbl">${t}</div></div>`).join('');
  $('chip-follow').textContent = '⏰ Follow-up para hoje (' + follow + ')';
  $('chip-follow').classList.toggle('ativo', filtroFollow);
  $('chip-follow').classList.toggle('alerta', !filtroFollow && follow > 0);
  $('chip-antigos').classList.toggle('ativo', mostrarAntigos);

  $('kanban').innerHTML = ETAPAS.map(([id, nome]) => {
    const itens = lista.filter(l => l.etapa === id).sort((a, b) => {
      const fa = a.proximo_contato ? new Date(a.proximo_contato).getTime() : Infinity, fb = b.proximo_contato ? new Date(b.proximo_contato).getTime() : Infinity;
      return fa - fb || new Date(b.etapa_em) - new Date(a.etapa_em);
    });
    const soma = itens.reduce((s, l) => s + (+(ultimaProposta(l.id) || {}).valor_final || 0), 0);
    return `<div class="coluna col-${id}" data-etapa="${id}" ondragover="sobreColuna(event,this)" ondragleave="this.classList.remove('sobre')" ondrop="soltar(event,this)">
      <div class="col-topo"><div class="col-nome">${nome}<span class="qtd">${itens.length}</span></div><div class="col-soma">${soma ? fmtR0(soma) + ' em propostas' : '&nbsp;'}</div></div>
      <div class="col-lista">${itens.map(cardLead).join('') || '<div class="vazio">—</div>'}</div></div>`;
  }).join('');
}

function cardLead(l) {
  const p = ultimaProposta(l.id), f = situacaoFollow(l), d = dias(l.etapa_em);
  const tags = [];
  if (f === 'atraso') tags.push(`<span class="tag atraso">⏰ atrasado ${new Date(l.proximo_contato).toLocaleDateString('pt-BR')}</span>`);
  if (f === 'hoje') tags.push(`<span class="tag hoje">⏰ hoje ${new Date(l.proximo_contato).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })}</span>`);
  if (f === 'futuro') tags.push(`<span class="tag">⏰ ${new Date(l.proximo_contato).toLocaleDateString('pt-BR')}</span>`);
  if (l.responsavel_email) tags.push(`<span class="tag resp">${esc(nomeDe(l.responsavel_email).split(' ')[0])}</span>`);
  if (l.etapa === 'perdido' && l.motivo_perda) tags.push(`<span class="tag">${esc(l.motivo_perda)}</span>`);
  return `<div class="lead" draggable="true" data-id="${l.id}" ondragstart="iniciarArrasto(event,${l.id})" ondragend="this.classList.remove('arrastando')" onclick="abrirFicha(${l.id})">
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
  if (etapa === 'ganho' && !confirm('Marcar "' + (l.nome || 'cliente') + '" como GANHO? 🎉')) { render(); if (fichaId === id) abrirFicha(id, true); return; }
  const mud = { etapa, atualizado_em: new Date().toISOString(), ...(extra || {}) };
  if (!l.responsavel_email) mud.responsavel_email = perfil.email;
  if (etapa === 'ganho' || etapa === 'perdido') mud.proximo_contato = null;
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
    </div>
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
    ${props.length ? props.map(p => `<div class="prop prop-click" onclick="verProposta(${p.id})"><span>Nº ${String(p.id).padStart(5, '0')} · ${esc(p.sistema || '')} · ${String(p.kwp).replace('.', ',')} kWp<br><span class="muted">${fmtDH(p.criado_em)} · ${esc(nomeDe(p.vendedor_email))}</span></span><b style="color:var(--amarelo)">${fmtR(p.valor_final)} ▾</b></div><div class="prop-det" id="pdet-${p.id}"></div>`).join('')
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

document.addEventListener('keydown', e => { if (e.key === 'Escape') { if ($('ov-perda').classList.contains('visivel')) fecharPerda(); else if ($('ov-novo').classList.contains('visivel')) fecharNovoLead(); else if ($('ov-contrato').classList.contains('visivel')) fecharContrato(); else fecharFicha(); } });