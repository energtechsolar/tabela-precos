// Energtech — Quadro de Projetos (engenharia)
// Documentação → Projeto em elaboração → Protocolado → Aprovado/Instalação → Vistoria solicitada → Conectado
// Prazos da distribuidora em DIAS ÚTEIS (fim de semana + feriado nacional, do estado e do município da obra).
// ⚠ amarelo faltando poucos dias úteis; 🔴 vermelho quando vence. O projeto nasce sozinho quando o lead vira "Ganho" (gatilho no banco).
// (carregado pelo crm.html depois de js/crm.js)

const ETAPAS_PROJ = [
  ['documentacao', 'Documentação'], ['elaboracao', 'Projeto em elaboração'], ['protocolado', 'Protocolado'],
  ['aprovado', 'Aprovado / Instalação'], ['vistoria', 'Vistoria solicitada'], ['conectado', 'Conectado'],
];
let projetos = [], feriados = [], bancoPend = [], modoProjetos = false, projFichaId = null, arrastandoProj = null, filtroPrazos = false, verCancelados = false;
const podeVerProjetos = () => !!perfil && (perfil.admin || ['interno', 'engenheiro'].includes(perfil.papel));
const podeEditarProjetos = () => !!perfil && (perfil.admin || perfil.papel === 'engenheiro');
const nomeEtapaProj = id => id === 'cancelado' ? 'Cancelado' : ((ETAPAS_PROJ.find(e => e[0] === id) || [id, id])[1]);
// prazos (dias úteis) — podem ir para config "crm" → projetos: { protocolo, vistoria, aviso }
function prazosProj() {
  const c = (CRM_CFG && CRM_CFG.projetos) || {};
  return { protocolo: +c.protocolo || 15, vistoria: +c.vistoria || 15, aviso: c.aviso === undefined ? 3 : Math.max(0, +c.aviso || 0) };
}

// ── datas e dias úteis ──
const isoLocal = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const deIso = s => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
const fmtD = s => s ? deIso(s).toLocaleDateString('pt-BR') : '';
const fmtDia = d => d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
const ufDaCidade = c => ((String(c || '').match(/[\/\-,]\s*([A-Za-z]{2})\s*$/) || [])[1] || 'SC').toUpperCase();
const munDaCidade = c => String(c || '').split('/')[0].split(' - ')[0].trim().toLowerCase();
function diaUtil(d, cidade) {
  const w = d.getDay(); if (w === 0 || w === 6) return false;
  const iso = isoLocal(d), uf = ufDaCidade(cidade), mun = munDaCidade(cidade);
  return !feriados.some(f => f.data === iso && (f.abrangencia === 'nacional' || f.abrangencia === uf
    || (f.abrangencia === 'municipal' && String(f.cidade || '').trim().toLowerCase() === mun)));
}
function somarUteis(inicioIso, n, cidade) {
  const d = deIso(inicioIso); let c = 0;
  while (c < n) { d.setDate(d.getDate() + 1); if (diaUtil(d, cidade)) c++; }
  return d;
}
function uteisEntre(a, b, cidade) {   // dias úteis em (a, b]
  let c = 0; const d = new Date(a);
  while (d < b) { d.setDate(d.getDate() + 1); if (diaUtil(d, cidade)) c++; }
  return c;
}
const leadDoProj = p => leads.find(l => l.id === p.lead_id) || null;
// prazo em andamento do projeto (só nas etapas que dependem da distribuidora)
function prazoDe(p) {
  const l = leadDoProj(p), cidade = l && l.cidade, cfg = prazosProj();
  let base, n, rot;
  if (p.etapa === 'protocolado' && p.protocolo_data) { base = p.protocolo_data; n = cfg.protocolo; rot = 'aprovação do protocolo'; }
  else if (p.etapa === 'vistoria' && p.vistoria_data) { base = p.vistoria_data; n = cfg.vistoria; rot = 'vistoria'; }
  else return null;
  const fim = somarUteis(base, n, cidade), hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const restam = hoje <= fim ? uteisEntre(hoje, fim, cidade) : -uteisEntre(fim, hoje, cidade);
  const nivel = hoje > fim ? 'vermelho' : (restam <= cfg.aviso ? 'amarelo' : 'ok');
  const curto = nivel === 'vermelho' ? '🔴 venceu ' + fim.toLocaleDateString('pt-BR')
    : nivel === 'amarelo' ? (restam === 0 ? '⚠ vence hoje' : '⚠ ' + restam + (restam === 1 ? ' dia útil' : ' dias úteis'))
    : '⏳ ' + restam + ' dias úteis';
  return { fim, restam, nivel, rot, n, base, curto };
}

// ── carregar / alternar tela ──
async function carregarProjetos() {
  if (!podeVerProjetos()) return;
  const [p, f, b] = await Promise.all([
    sb.from('projetos').select('*').order('etapa_em', { ascending: false }).limit(2000),
    sb.from('feriados').select('id, data, nome, abrangencia, cidade').order('data'),
    // admin: parcelas do banco ainda não recebidas (para lembrar de cobrar)
    perfil && perfil.admin ? sb.from('recebimentos').select('id, lead_id, valor, vencimento').eq('tipo', 'banco').is('recebido_em', null) : Promise.resolve({ data: [] }),
  ]);
  if (p.error) { $('kanban-proj').innerHTML = '<div class="muted">⚠ Erro ao carregar os projetos: ' + esc(p.error.message) + '</div>'; return; }
  projetos = p.data || []; feriados = f.data || []; bancoPend = (b && b.data) || [];
  renderProjetos();
  if (projFichaId && $('ov-ficha').classList.contains('visivel')) abrirProjeto(projFichaId);
}
async function iniciarProjetos() {
  const pode = podeVerProjetos();
  $('btn-projetos').style.display = pode ? '' : 'none';
  if (!pode) { alternarModo(false); return; }
  $('btn-feriados').style.display = podeEditarProjetos() ? '' : 'none';
  await carregarProjetos();
  const q = new URLSearchParams(location.search), doLink = +q.get('projeto');
  if (perfil.papel === 'engenheiro' || doLink || q.get('aba') === 'projetos') alternarModo(true);
  if (doLink && projetos.some(p => p.id === doLink)) abrirProjeto(doLink);
}
function alternarModo(proj) {
  modoProjetos = !!proj && podeVerProjetos();
  $('funil-area').style.display = modoProjetos ? 'none' : '';
  $('projetos-area').style.display = modoProjetos ? '' : 'none';
  const h1 = document.querySelector('.header-title h1'); if (h1) h1.textContent = modoProjetos ? 'CRM — Projetos (engenharia)' : 'CRM — Funil de Vendas';
  if (modoProjetos) renderProjetos();
}

// ── quadro ──
function renderProjetos() {
  if (!$('kanban-proj')) return;
  const q = ($('p-busca').value || '').trim().toLowerCase();
  const ativos = projetos.filter(p => p.etapa !== 'cancelado');
  const comPrazo = ativos.map(p => [p, prazoDe(p)]);
  const amarelos = comPrazo.filter(([, z]) => z && z.nivel === 'amarelo').length, vermelhos = comPrazo.filter(([, z]) => z && z.nivel === 'vermelho').length;
  const mes = new Date(); mes.setDate(1); mes.setHours(0, 0, 0, 0);
  $('proj-resumo').innerHTML = [
    [ativos.filter(p => p.etapa !== 'conectado').length, 'projetos em andamento'],
    [ativos.filter(p => p.etapa === 'protocolado').length, 'aguardando aprovação'],
    [ativos.filter(p => p.etapa === 'vistoria').length, 'aguardando vistoria'],
    [amarelos + ' · ' + vermelhos, '⚠ vencendo · 🔴 vencidos'],
    [ativos.filter(p => p.etapa === 'conectado' && p.conectado_data && deIso(p.conectado_data) >= mes).length, 'conectados no mês'],
    [ativos.filter(p => (p.instalacao_data || p.etapa === 'conectado') && !p.nf_enviada_em).length, '🧾 obras sem NF enviada'],
  ].map(([v, t]) => `<div class="kpi"><div class="kpi-val">${v}</div><div class="kpi-lbl">${t}</div></div>`).join('');
  const nPrazos = amarelos + vermelhos;
  $('chip-prazos').textContent = '⚠ Prazos (' + nPrazos + ')' + (filtroPrazos ? ' ✕' : '');
  $('chip-prazos').classList.toggle('ativo', filtroPrazos);
  $('chip-prazos').classList.toggle('amarelo', !filtroPrazos && nPrazos > 0);
  const nCanc = projetos.length - ativos.length;
  $('chip-cancelados').textContent = verCancelados ? '← Voltar ao quadro' : 'Cancelados (' + nCanc + ')';
  $('chip-cancelados').classList.toggle('ativo', verCancelados);

  const lista = projetos.filter(p => {
    if ((p.etapa === 'cancelado') !== verCancelados) return false;
    if (filtroPrazos) { const z = prazoDe(p); if (!z || z.nivel === 'ok') return false; }
    if (q) { const l = leadDoProj(p) || {}; if (!((l.nome || '') + ' ' + (l.cidade || '') + ' ' + (p.protocolo_numero || '')).toLowerCase().includes(q)) return false; }
    return true;
  });
  const cols = verCancelados ? [['cancelado', 'Cancelados']] : ETAPAS_PROJ;
  $('kanban-proj').innerHTML = cols.map(([id, nome]) => {
    const itens = lista.filter(p => p.etapa === id).sort((a, b) => {
      const za = prazoDe(a), zb = prazoDe(b);
      return (za ? za.fim.getTime() : Infinity) - (zb ? zb.fim.getTime() : Infinity) || new Date(a.etapa_em) - new Date(b.etapa_em);
    });
    return `<div class="coluna col-p-${id}" data-etapa="${id}" ondragover="if(arrastandoProj){event.preventDefault();this.classList.add('sobre')}" ondragleave="this.classList.remove('sobre')" ondrop="soltarProj(event,this)">
      <div class="col-topo"><div class="col-nome">${nome}<span class="qtd">${itens.length}</span></div><div class="col-soma">${id === 'protocolado' ? prazosProj().protocolo + ' dias úteis p/ aprovar' : id === 'vistoria' ? prazosProj().vistoria + ' dias úteis p/ vistoria' : '&nbsp;'}</div></div>
      <div class="col-lista">${itens.map(cardProjeto).join('') || '<div class="vazio">—</div>'}</div></div>`;
  }).join('');
  const sem = $('proj-sem-feriados'); if (sem) sem.style.display = feriados.some(f => f.data.slice(0, 4) === String(new Date().getFullYear() + 1)) ? 'none' : '';
}
function cardProjeto(p) {
  const l = leadDoProj(p) || { nome: 'Cliente #' + p.lead_id }, pr = l.id ? propostaDoLead(l) : null, z = prazoDe(p);
  const tags = [];
  if (z) tags.push(`<span class="tag ${z.nivel === 'vermelho' ? 'vermelho' : z.nivel === 'amarelo' ? 'alerta' : ''}" title="Prazo da ${esc(z.rot)}: ${z.fim.toLocaleDateString('pt-BR')}">${esc(z.curto)}</span>`);
  if (p.protocolo_numero) tags.push(`<span class="tag">📄 ${esc(p.protocolo_numero)}</span>`);
  if (p.etapa === 'protocolado' && !p.protocolo_data) tags.push('<span class="tag hoje">sem data do protocolo</span>');
  if (p.etapa === 'vistoria' && !p.vistoria_data) tags.push('<span class="tag hoje">sem data da vistoria</span>');
  if (p.instalacao_data) tags.push(`<span class="tag">🔧 instalado ${fmtD(p.instalacao_data)}</span>`);
  if (p.etapa === 'conectado' && p.conectado_data) tags.push(`<span class="tag resp">⚡ ${fmtD(p.conectado_data)}</span>`);
  if (p.nf_enviada_em && p.etapa === 'conectado') tags.push('<span class="tag resp">✅ obra concluída</span>');
  else if ((p.instalacao_data || p.etapa === 'conectado') && !p.nf_enviada_em) tags.push(`<span class="tag hoje" title="Obra só é concluída com a nota fiscal enviada ao cliente">🧾 ${p.nf_numero ? 'NF não enviada' : 'falta NF'}</span>`);
  if (p.responsavel_email) tags.push(`<span class="tag resp">${esc(nomeDe(p.responsavel_email).split(' ')[0])}</span>`);
  if (l.id) { const dc = docsStatus(l); if (dc.falta) tags.push(`<span class="tag hoje">📎 ${dc.ok}/${dc.total} docs</span>`); }
  const borda = z && z.nivel === 'vermelho' ? ' com-vermelho' : z && z.nivel === 'amarelo' ? ' com-alerta' : '';
  return `<div class="lead${borda}" draggable="${podeEditarProjetos()}" data-proj="${p.id}" ondragstart="arrastandoProj=${p.id};event.dataTransfer.effectAllowed='move';this.classList.add('arrastando')" ondragend="this.classList.remove('arrastando')" onclick="abrirProjeto(${p.id})">
    <div class="lead-nome">${esc(l.nome || 'Sem nome')}</div>
    <div class="lead-linha"><span>${esc(l.cidade || '')}</span><span>${esc(l.concessionaria || '')}</span></div>
    ${pr ? `<div class="lead-linha"><span>${esc(pr.sistema || '')} · ${String(pr.kwp).replace('.', ',')} kWp</span></div>` : ''}
    <div class="lead-tags">${tags.join('')}</div>
  </div>`;
}
function soltarProj(e, col) { e.preventDefault(); col.classList.remove('sobre'); const id = arrastandoProj; arrastandoProj = null; if (id) mudarEtapaProj(id, col.dataset.etapa); }

async function registrarProj(p, texto) { await sb.from('lead_eventos').insert({ lead_id: p.lead_id, texto: '🛠 ' + texto }); }
async function mudarEtapaProj(id, etapa) {
  const p = projetos.find(x => x.id === id);
  if (!p || p.etapa === etapa) return;
  if (!podeEditarProjetos()) { alert('Só a engenharia e o admin podem mudar a etapa do projeto.'); return; }
  const hoje = isoLocal(new Date()), agora = new Date().toISOString();
  const mud = { etapa, etapa_em: agora, atualizado_em: agora };
  if (etapa === 'protocolado' && !p.protocolo_data) mud.protocolo_data = hoje;
  if (etapa === 'vistoria' && !p.vistoria_data) mud.vistoria_data = hoje;
  if (etapa === 'conectado' && !p.conectado_data) mud.conectado_data = hoje;
  const ant = { ...p };
  Object.assign(p, mud); renderProjetos();
  const { error } = await sb.from('projetos').update(mud).eq('id', id);
  if (error) { Object.assign(p, ant); renderProjetos(); alert('Não foi possível mudar a etapa: ' + error.message); return; }
  const z = prazoDe(p);
  await registrarProj(p, 'Projeto: ' + nomeEtapaProj(ant.etapa) + ' → ' + nomeEtapaProj(etapa) + (z ? ' · prazo da ' + z.rot + ': ' + z.fim.toLocaleDateString('pt-BR') : ''));
  // protocolo e vistoria: abre a ficha para conferir a data e o número
  if (etapa === 'protocolado' || etapa === 'vistoria' || projFichaId === id) abrirProjeto(id);
}

// ── ficha do projeto ──
async function abrirProjeto(id) {
  const p = projetos.find(x => x.id === id); if (!p) return;
  const l = leadDoProj(p) || { nome: 'Cliente #' + p.lead_id, documentos: [] }, pr = l.id ? propostaDoLead(l) : null, z = prazoDe(p);
  projFichaId = id; fichaId = null;
  const ed = podeEditarProjetos(), dis = ed ? '' : 'disabled';
  const opEtapa = ETAPAS_PROJ.concat([['cancelado', 'Cancelado']]).map(([k, n]) => `<option value="${k}" ${k === p.etapa ? 'selected' : ''}>${n}</option>`).join('');
  const opResp = '<option value="">— Sem responsável —</option>' + equipe.filter(e => ['engenheiro', 'admin'].includes(e.papel)).map(e => `<option value="${esc(e.email)}" ${e.email === p.responsavel_email ? 'selected' : ''}>${esc(e.nome || e.email)}</option>`).join('');
  const st = l.id ? docsStatus(l) : { docs: [], ok: 0, total: 0 };
  const nfDocs = st.docs.filter(d => d.tipo === 'nf');
  const wa = telWa(l.telefone);
  const caixaPrazo = z ? `<div style="background:${z.nivel === 'vermelho' ? '#2a0f0f' : z.nivel === 'amarelo' ? '#2a230a' : '#151515'};border:1px solid ${z.nivel === 'vermelho' ? '#7f1d1d' : z.nivel === 'amarelo' ? '#a16207' : 'var(--borda)'};border-radius:10px;padding:10px 12px;margin-top:12px">
      <b>${z.nivel === 'vermelho' ? '🔴 Prazo vencido' : z.nivel === 'amarelo' ? '⚠ Prazo vencendo' : '⏳ Prazo em andamento'}</b> — ${esc(z.rot)}<br>
      <span class="muted">${z.n} dias úteis a partir de ${fmtD(z.base)} · vence em <b style="color:var(--texto)">${z.fim.toLocaleDateString('pt-BR')}</b> · ${z.nivel === 'vermelho' ? 'venceu há ' + Math.abs(z.restam) + ' dia(s) útil(eis)' : z.restam === 0 ? 'vence hoje' : 'faltam ' + z.restam + ' dia(s) útil(eis)'} · feriados de ${esc(ufDaCidade(l.cidade))}${l.cidade ? ' e de ' + esc(String(l.cidade).split('/')[0].trim()) : ''} considerados</span>
    </div>` : '';
  $('ficha').innerHTML = `
    <div class="ficha-topo">
      <div><h2>🛠 ${esc(l.nome || 'Sem nome')}</h2><div class="muted">${esc([l.cidade, l.concessionaria, l.uc ? 'UC ' + l.uc : ''].filter(Boolean).join(' · '))}</div></div>
      <button class="fechar" onclick="fecharFicha()">×</button>
    </div>
    <div class="acoes">
      ${l.id ? `<button class="btn btn-sec" onclick="fecharFicha(); abrirFicha(${l.id})">👤 Ficha do cliente</button>` : ''}
      ${wa ? `<a class="btn btn-verde" href="https://wa.me/${wa}" target="_blank" rel="noopener">💬 WhatsApp</a>` : ''}
      ${ed && p.etapa === 'protocolado' ? `<button class="btn btn-sec" onclick="reprotocolar(${p.id})">↻ Reprotocolar</button>` : ''}
    </div>
    ${caixaPrazo}
    <h3>Projeto</h3>
    <div class="grade">
      <div><label>Etapa</label><select class="select" id="pj-etapa" ${dis}>${opEtapa}</select></div>
      <div><label>Responsável</label><select class="select" id="pj-resp" ${dis}>${opResp}</select></div>
      <div><label>Nº do protocolo</label><input class="input" id="pj-num" value="${esc(p.protocolo_numero || '')}" ${dis}></div>
      <div><label>Data do protocolo</label><input class="input" type="date" id="pj-prot" value="${p.protocolo_data || ''}" ${dis}></div>
      <div><label>Data da solicitação de vistoria</label><input class="input" type="date" id="pj-vist" value="${p.vistoria_data || ''}" ${dis}></div>
      <div><label>Data da conexão</label><input class="input" type="date" id="pj-con" value="${p.conectado_data || ''}" ${dis}></div>
      <div class="largo"><label>Observações</label><textarea class="input" id="pj-obs" rows="3" ${dis} placeholder="Ex.: distribuidora pediu ajuste no diagrama unifilar.">${esc(p.obs || '')}</textarea></div>
    </div>
    <h3>🔧 Obra e nota fiscal</h3>
    <div class="grade">
      <div><label>Instalação concluída em</label><input class="input" type="date" id="pj-inst" value="${p.instalacao_data || ''}" ${dis}></div>
      <div style="display:flex;align-items:flex-end">${ed && !p.instalacao_data ? `<button class="btn btn-verde" style="width:100%" onclick="instalacaoConcluida(${p.id})">✅ Instalação concluída hoje</button>` : p.instalacao_data ? '<span class="muted">' + (perfil && perfil.admin ? 'A parcela do banco (financiamento) ganhou o vencimento sozinha, contado desta data (veja 💰 Recebimentos).' : 'O financeiro já foi avisado.') + '</span>' : ''}</div>
      <div><label>Nº da NFS-e de serviço</label><input class="input" id="pj-nf" value="${esc(p.nf_numero || '')}" ${dis} placeholder="Ex.: 123"></div>
      <div><label>NF enviada ao cliente em</label><input class="input" type="date" id="pj-nfenv" value="${p.nf_enviada_em || ''}" ${dis}></div>
      <div class="largo"><label>Chave de acesso da NFS-e</label><input class="input" id="pj-chave" value="${esc(p.nf_chave || '')}" ${dis} inputmode="numeric" placeholder="Os números da chave (está no PDF da nota)"></div>
      <div class="largo">${nfDocs.length ? nfDocs.map(d => `<a href="#" onclick="verDoc('${esc(d.path)}');return false">📄 ${esc(d.nome || 'NFS-e.pdf')}</a> <span class="muted">· ${fmtDH(d.em)}</span>`).join('<br>') : '<span class="muted">PDF da nota ainda não anexado.</span>'}
        ${ed && l.id ? `<label class="btn btn-sec" style="padding:4px 10px;font-size:13px;cursor:pointer;margin-left:6px">📎 Anexar PDF da NF<input type="file" accept="application/pdf,image/*" style="display:none" onchange="enviarNF(${p.id}, this)"></label>` : ''}
        ${ed && l.email && (p.nf_numero || nfDocs.length) ? `<a class="btn btn-sec" style="padding:4px 10px;font-size:13px;margin-left:6px" href="${mailNF(l, p)}" onclick="setTimeout(() => marcarNFEnviada(${p.id}), 800)">📧 E-mail ao cliente</a>` : ''}
      </div>
      ${p.etapa === 'conectado' ? `<div class="largo" style="background:#151515;border:1px solid var(--borda);border-radius:8px;padding:8px 10px">🧽 <b>Pós-venda:</b> próxima limpeza/revisão <b>${proxManut(p) ? proxManut(p).toLocaleDateString('pt-BR') : '— (informe a data da conexão)'}</b> <span class="muted">· a cada ${+p.manut_meses || 6} meses${p.manut_ultimo_contato ? ' · último contato ' + fmtD(p.manut_ultimo_contato) : ''}</span>
        <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">${l.telefone ? `<button class="btn btn-verde" style="padding:4px 10px;font-size:13px" onclick="waManut(${p.id})">💬 Mensagem de limpeza</button>` : ''}<button class="btn btn-sec" style="padding:4px 10px;font-size:13px" onclick="contatoManut(${p.id})">✔ Contato feito</button></div></div>` : ''}
      <div class="largo muted" style="font-size:12px">A obra só fica <b>concluída</b> com a NF enviada ao cliente. O PDF fica guardado aqui (o cliente pode pedir depois). No e-mail, anexe o PDF baixado acima.</div>
    </div>
    ${ed ? `<div class="acoes"><button class="btn" onclick="salvarProjeto(${p.id})">💾 Salvar</button><span class="status-msg" id="pj-msg"></span></div>` : '<p class="muted" style="margin-top:8px">Somente leitura: quem altera é a engenharia ou o admin.</p>'}
    <h3>Sistema</h3>
    <div class="muted">${pr ? 'Proposta Nº ' + String(pr.id).padStart(5, '0') + ' · ' + esc(pr.sistema || '') + ' · ' + String(pr.kwp).replace('.', ',') + ' kWp · ' + (pr.tipo === 'nacional' ? 'kit nacional' : 'kit importado') : 'Sem proposta vinculada.'}${l.forma_pagamento ? ' · ' + esc(l.forma_pagamento) : ''}</div>
    <h3>Documentos <span class="muted">(${st.ok} de ${st.total})</span></h3>
    ${st.docs.length ? st.docs.map(d => `<div class="muted" style="padding:3px 0">${d.valor ? `<a href="https://www.google.com/maps?q=${encodeURIComponent(d.valor)}" target="_blank" rel="noopener">📍 ${esc(d.valor)}</a>` : `<a href="#" onclick="verDoc('${esc(d.path)}');return false">📄 ${esc((DOCS_GANHO.find(x => x[0] === d.tipo) || [0, d.tipo])[1])} — ${esc(d.nome || 'arquivo')}</a>`}</div>`).join('') : '<div class="muted">Nenhum documento enviado ainda. Os documentos são enviados na ficha do cliente.</div>'}
    <h3>Histórico do projeto</h3>
    <div id="pj-eventos"><div class="muted">Carregando…</div></div>`;
  $('ov-ficha').classList.add('visivel');
  const { data, error } = await sb.from('lead_eventos').select('texto, autor_email, criado_em').eq('lead_id', p.lead_id).like('texto', '🛠%').order('criado_em', { ascending: false }).limit(100);
  if (projFichaId !== id || !$('pj-eventos')) return;
  $('pj-eventos').innerHTML = error ? '<div class="muted">Não foi possível carregar o histórico.</div>'
    : (data && data.length ? data.map(e => `<div class="evento nota"><div class="quando">${fmtDH(e.criado_em)} · ${esc(nomeDe(e.autor_email) || 'sistema')}</div>${esc(e.texto)}</div>`).join('') : '<div class="muted">Sem registros ainda.</div>');
}
async function salvarProjeto(id) {
  const p = projetos.find(x => x.id === id); if (!p) return;
  const v = k => ($(k).value || '').trim() || null;
  const mud = { etapa: $('pj-etapa').value, responsavel_email: v('pj-resp'), protocolo_numero: v('pj-num'), protocolo_data: v('pj-prot'),
                vistoria_data: v('pj-vist'), conectado_data: v('pj-con'), obs: v('pj-obs'), atualizado_em: new Date().toISOString(),
                instalacao_data: v('pj-inst'), nf_numero: v('pj-nf'), nf_chave: ($('pj-chave').value || '').replace(/\s+/g, '') || null, nf_enviada_em: v('pj-nfenv') };
  const hoje = isoLocal(new Date());
  if (mud.etapa === 'protocolado' && !mud.protocolo_data) mud.protocolo_data = hoje;
  if (mud.etapa === 'vistoria' && !mud.vistoria_data) mud.vistoria_data = hoje;
  if (mud.etapa === 'conectado' && !mud.conectado_data) mud.conectado_data = hoje;
  if (mud.etapa !== p.etapa) mud.etapa_em = mud.atualizado_em;
  const mudou = [];
  if (mud.etapa !== p.etapa) mudou.push(nomeEtapaProj(p.etapa) + ' → ' + nomeEtapaProj(mud.etapa));
  if (mud.protocolo_numero !== (p.protocolo_numero || null)) mudou.push('protocolo nº ' + (mud.protocolo_numero || '—'));
  if (mud.protocolo_data !== (p.protocolo_data || null)) mudou.push('data do protocolo ' + (fmtD(mud.protocolo_data) || '—'));
  if (mud.vistoria_data !== (p.vistoria_data || null)) mudou.push('vistoria solicitada em ' + (fmtD(mud.vistoria_data) || '—'));
  if (mud.conectado_data !== (p.conectado_data || null)) mudou.push('conectado em ' + (fmtD(mud.conectado_data) || '—'));
  if (mud.instalacao_data !== (p.instalacao_data || null)) mudou.push('instalação concluída em ' + (fmtD(mud.instalacao_data) || '—'));
  if (mud.nf_numero !== (p.nf_numero || null)) mudou.push('NFS-e nº ' + (mud.nf_numero || '—'));
  if (mud.nf_enviada_em !== (p.nf_enviada_em || null)) mudou.push('NF enviada ao cliente em ' + (fmtD(mud.nf_enviada_em) || '—'));
  const { error } = await sb.from('projetos').update(mud).eq('id', id);
  const msg = $('pj-msg');
  if (error) { msg.textContent = '⚠ ' + error.message; msg.classList.add('erro'); return; }
  Object.assign(p, mud);
  const z = prazoDe(p);
  if (mudou.length) await registrarProj(p, 'Projeto: ' + mudou.join(' · ') + (z ? ' · prazo da ' + z.rot + ': ' + z.fim.toLocaleDateString('pt-BR') : ''));
  renderProjetos(); await abrirProjeto(id);
  const m2 = $('pj-msg'); if (m2) { m2.classList.remove('erro'); m2.textContent = '✅ Salvo'; }
}
// ── pós-venda: limpeza e revisão a cada N meses (padrão 6) depois da conexão ou do último contato ──
function proxManut(p) {
  if (p.etapa !== 'conectado') return null;
  const base = p.manut_ultimo_contato || p.conectado_data; if (!base) return null;
  const d = deIso(base), dia = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + (+p.manut_meses || 6));
  d.setDate(Math.min(dia, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return d;
}
function msgManut(l, p) {
  const pn = String(l.nome || '').trim().split(' ')[0].toLowerCase(), nome = pn.charAt(0).toUpperCase() + pn.slice(1);
  const desde = p.manut_ultimo_contato ? 'a última revisão' : 'a instalação';
  return 'Olá, ' + nome + '! Aqui é da Energtech Engenharia Solar ☀️\n\nJá se passaram ' + (+p.manut_meses || 6) + ' meses desde ' + desde + ' do seu sistema de energia solar. '
    + 'Poeira e sujeira nos módulos reduzem a geração e a sua economia na conta de luz.\n\n'
    + 'Quer agendar uma limpeza e revisão? É só responder esta mensagem que combinamos o melhor dia.';
}
async function contatoManut(id, ev) {
  if (ev) ev.stopPropagation();
  const p = projetos.find(x => x.id === id); if (!p) return;
  const obs = prompt('Contato de limpeza/revisão feito. Observação (opcional, ex.: agendou para 15/11, não quis agora):', '');
  if (obs === null) return;
  const { error } = await sb.rpc('registrar_contato_manutencao', { p_projeto: id, p_obs: obs.trim() || null });
  if (error) { alert('Não foi possível registrar: ' + error.message); return; }
  p.manut_ultimo_contato = isoLocal(new Date());
  if ($('ov-agenda').classList.contains('visivel')) renderAgenda();
  if (projFichaId === id) abrirProjeto(id);
}
function waManut(id, ev) {
  if (ev) ev.stopPropagation();
  const p = projetos.find(x => x.id === id), l = p && leadDoProj(p); if (!l) return;
  const tel = telWa(l.telefone); if (!tel) { alert('O cliente não tem telefone na ficha.'); return; }
  window.open('https://wa.me/' + tel + '?text=' + encodeURIComponent(msgManut(l, p)), '_blank', 'noopener');
}

// ── instalação concluída e nota fiscal ──
async function instalacaoConcluida(id) {
  const p = projetos.find(x => x.id === id); if (!p) return;
  if (!confirm('Marcar a instalação como concluída hoje (' + new Date().toLocaleDateString('pt-BR') + ')?')) return;
  const mud = { instalacao_data: isoLocal(new Date()), atualizado_em: new Date().toISOString() };
  const { error } = await sb.from('projetos').update(mud).eq('id', id);
  if (error) { alert('Não foi possível salvar: ' + error.message); return; }
  Object.assign(p, mud);
  await registrarProj(p, 'Instalação concluída em ' + fmtD(mud.instalacao_data));
  await carregarProjetos(); abrirProjeto(id);
}
function mailNF(l, p) {
  const pn = String(l.nome || '').trim().split(' ')[0].toLowerCase();
  const corpo = 'Olá, ' + pn.charAt(0).toUpperCase() + pn.slice(1) + '!\n\nSegue em anexo a nota fiscal de serviço da instalação do seu sistema de energia solar.'
    + (p.nf_numero ? '\n\nNFS-e nº ' + p.nf_numero : '') + (p.nf_chave ? '\nChave de acesso: ' + p.nf_chave : '')
    + '\n\nGuarde este e-mail: a nota pode ser pedida para garantia e financiamento.\nQualquer dúvida, estamos à disposição.\n\nEnergtech Engenharia Solar';
  return 'mailto:' + encodeURIComponent(l.email) + '?subject=' + encodeURIComponent('Nota fiscal de serviço — Energtech Engenharia Solar') + '&body=' + encodeURIComponent(corpo);
}
async function marcarNFEnviada(id) {
  const p = projetos.find(x => x.id === id); if (!p || p.nf_enviada_em) return;
  if (!confirm('Você enviou o e-mail com a nota fiscal ao cliente? (OK marca a NF como enviada hoje)')) return;
  const mud = { nf_enviada_em: isoLocal(new Date()), atualizado_em: new Date().toISOString() };
  const { error } = await sb.from('projetos').update(mud).eq('id', id);
  if (error) { alert('Não foi possível salvar: ' + error.message); return; }
  Object.assign(p, mud);
  await registrarProj(p, 'NF de serviço' + (p.nf_numero ? ' nº ' + p.nf_numero : '') + ' enviada ao cliente');
  renderProjetos(); abrirProjeto(id);
}
async function enviarNF(id, input) {
  const p = projetos.find(x => x.id === id), arq = input.files && input.files[0]; input.value = '';
  if (!p || !arq) return;
  const l = leadDoProj(p); if (!l) return;
  const msg = $('pj-msg'); if (msg) { msg.classList.remove('erro'); msg.textContent = '⏳ Enviando a nota…'; }
  try {
    const blob = await reduzirFoto(arq);
    const ext = blob.type === 'application/pdf' ? 'pdf' : 'jpg';
    const path = 'lead-' + l.id + '/nf-' + Date.now() + '.' + ext;
    const { error } = await sb.storage.from('documentos').upload(path, blob, { contentType: blob.type || arq.type, upsert: false });
    if (error) throw error;
    const docs = [...(l.documentos || []), { id: String(Date.now()), tipo: 'nf', nome: arq.name, path, em: new Date().toISOString(), autor: perfil.email }];
    await gravarDocs(l.id, docs);
    await registrarProj(p, 'PDF da NF de serviço anexado');
    abrirProjeto(id);
  } catch (e) { const m = $('pj-msg'); if (m) { m.textContent = '⚠ Não foi possível enviar: ' + (e.message || e); m.classList.add('erro'); } }
}
async function reprotocolar(id) {
  const p = projetos.find(x => x.id === id); if (!p) return;
  const motivo = prompt('Motivo da reprovação / do novo protocolo:');
  if (motivo === null) return;
  const num = prompt('Número do novo protocolo (pode deixar em branco e preencher depois):', '');
  if (num === null) return;
  const agora = new Date().toISOString();
  const mud = { etapa: 'protocolado', protocolo_data: isoLocal(new Date()), protocolo_numero: num.trim() || p.protocolo_numero || null, etapa_em: agora, atualizado_em: agora };
  const { error } = await sb.from('projetos').update(mud).eq('id', id);
  if (error) { alert('Não foi possível reprotocolar: ' + error.message); return; }
  Object.assign(p, mud);
  const z = prazoDe(p);
  await registrarProj(p, 'Reprotocolado' + (mud.protocolo_numero ? ' (nº ' + mud.protocolo_numero + ')' : '') + '. Motivo: ' + (motivo.trim() || 'não informado') + (z ? ' · novo prazo: ' + z.fim.toLocaleDateString('pt-BR') : ''));
  renderProjetos(); abrirProjeto(id);
}

// ── na ficha do cliente (negócio ganho): situação do projeto ──
function linhaProjeto(l) {
  if (!podeVerProjetos()) return '';
  const p = projetos.find(x => x.lead_id === l.id);
  if (!p) return '<div class="muted" style="margin-bottom:6px">🛠 Projeto de engenharia: será criado ao salvar o ganho.</div>';
  const z = prazoDe(p);
  return `<div class="muted" style="margin-bottom:6px">🛠 Projeto de engenharia: <b style="color:var(--texto)">${esc(nomeEtapaProj(p.etapa))}</b>${z ? ' · ' + esc(z.curto) : ''} · <a href="#" onclick="fecharFicha(); alternarModo(true); abrirProjeto(${p.id}); return false">abrir projeto</a></div>`;
}

// ── na agenda do dia: prazos de projetos vencendo / vencidos ──
function agendaProjetos() {
  if (!podeVerProjetos()) return '';
  const lista = projetos.filter(p => p.etapa !== 'cancelado').map(p => [p, prazoDe(p)]).filter(([, z]) => z && z.nivel !== 'ok').sort((a, b) => a[1].fim - b[1].fim);
  const hoje = isoLocal(new Date()), em3 = isoLocal(new Date(Date.now() + 3 * 86400000));
  const cobrar = bancoPend.filter(r => r.vencimento && r.vencimento <= em3).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const semNF = projetos.filter(p => p.etapa !== 'cancelado' && (p.instalacao_data || p.etapa === 'conectado') && !p.nf_enviada_em);
  const nomeL = id => ((leads.find(x => x.id === id) || {}).nome) || 'Cliente #' + id;
  const blocoBanco = perfil && perfil.admin ? `<h3>💰 Cobrar o banco (parcela do financiamento) <span class="muted">(${cobrar.length})</span></h3>
    ${cobrar.length ? cobrar.map(r => `<div class="prop prop-click" onclick="fecharAgenda(); abrirFicha(${r.lead_id})"><span><b>${esc(nomeL(r.lead_id))}</b><br><span class="muted">liberação do banco · ${fmtR(r.valor)}</span></span><span class="muted" style="text-align:right;white-space:nowrap;${r.vencimento < hoje ? 'color:var(--vermelho)' : ''}">${r.vencimento < hoje ? 'atrasada desde' : 'prevista'}<br>${fmtD(r.vencimento)}</span></div>`).join('') : '<div class="muted" style="margin-bottom:6px">Nenhuma parcela do banco para cobrar agora. ✅</div>'}` : '';
  const blocoNF = `<h3>🧾 Obras sem NF enviada ao cliente <span class="muted">(${semNF.length})</span></h3>
    ${semNF.length ? semNF.map(p => `<div class="prop prop-click" onclick="fecharAgenda(); alternarModo(true); abrirProjeto(${p.id})"><span><b>${esc(nomeL(p.lead_id))}</b><br><span class="muted">${p.instalacao_data ? 'instalado em ' + fmtD(p.instalacao_data) : nomeEtapaProj(p.etapa)}${p.nf_numero ? ' · NF nº ' + esc(p.nf_numero) + ' ainda não enviada' : ''}</span></span><span class="muted">abrir</span></div>`).join('') : '<div class="muted" style="margin-bottom:6px">Todas as obras instaladas estão com a NF enviada. ✅</div>'}`;
  const em7 = new Date(Date.now() + 7 * 86400000); em7.setHours(23, 59, 59, 0);
  const hojeD = new Date(); hojeD.setHours(0, 0, 0, 0);
  const manut = projetos.filter(p => p.etapa === 'conectado').map(p => [p, proxManut(p)]).filter(([, d]) => d && d <= em7).sort((a, b) => a[1] - b[1]);
  const blocoManut = `<h3>🧽 Pós-venda: limpeza e revisão <span class="muted">(${manut.length})</span></h3>
    ${manut.length ? manut.map(([p, d]) => { const l = leadDoProj(p) || {};
      return `<div class="prop prop-click" onclick="fecharAgenda(); alternarModo(true); abrirProjeto(${p.id})"><span><b>${esc(l.nome || 'Cliente #' + p.lead_id)}</b><br><span class="muted">${esc(l.cidade || '')}${p.manut_ultimo_contato ? ' · último contato ' + fmtD(p.manut_ultimo_contato) : ' · conectado em ' + fmtD(p.conectado_data)}</span>
        <br><span style="display:inline-flex;gap:6px;margin-top:4px">${l.telefone ? `<button class="btn btn-verde" style="padding:3px 9px;font-size:12px" onclick="waManut(${p.id}, event)">💬 WhatsApp</button>` : ''}<button class="btn btn-sec" style="padding:3px 9px;font-size:12px" onclick="contatoManut(${p.id}, event)">✔ Contato feito</button></span></span>
        <span class="muted" style="text-align:right;white-space:nowrap;${d < hojeD ? 'color:var(--vermelho)' : ''}">${d < hojeD ? 'atrasado desde' : 'previsto'}<br>${d.toLocaleDateString('pt-BR')}</span></div>`; }).join('') : '<div class="muted" style="margin-bottom:6px">Nenhum cliente para contatar nesta semana. ✅</div>'}`;
  return blocoBanco + blocoNF + blocoManut + `<h3>🛠 Prazos de projetos <span class="muted">(${lista.length})</span></h3>
    ${lista.length ? lista.map(([p, z]) => { const l = leadDoProj(p) || {};
      return `<div class="prop prop-click" onclick="fecharAgenda(); alternarModo(true); abrirProjeto(${p.id})"><span><b>${esc(l.nome || 'Cliente #' + p.lead_id)}</b><br><span class="muted">${esc([l.cidade, nomeEtapaProj(p.etapa), p.protocolo_numero ? 'protocolo ' + p.protocolo_numero : ''].filter(Boolean).join(' · '))}</span></span><span class="muted" style="text-align:right;white-space:nowrap">${esc(z.curto)}<br>vence ${z.fim.toLocaleDateString('pt-BR')}</span></div>`; }).join('')
      : '<div class="muted" style="margin-bottom:6px">Nenhum prazo vencendo. ✅</div>'}`;
}

// ── feriados (engenharia e admin) ──
function abrirFeriados() { renderFeriados(); $('ov-feriados').classList.add('visivel'); }
function fecharFeriados() { $('ov-feriados').classList.remove('visivel'); }
function renderFeriados() {
  const ed = podeEditarProjetos(), ano = String(new Date().getFullYear());
  const lista = feriados.filter(f => f.data.slice(0, 4) >= ano).sort((a, b) => a.data.localeCompare(b.data));
  const ultimo = lista.length ? lista[lista.length - 1].data.slice(0, 4) : ano;
  $('feriados-corpo').innerHTML = `
    <p class="muted" style="margin-bottom:10px">Contam como dia não útil para os prazos: feriado nacional, do estado da obra (pela cidade do cliente, ex.: "Aratiba / RS") e do município. Cadastrados até <b>${ultimo}</b>${+ultimo <= +ano ? ' — <span style="color:var(--vermelho)">cadastre os do próximo ano</span>' : ''}.</p>
    ${ed ? `<div class="grade" style="margin-bottom:12px">
      <div><label>Data</label><input class="input" type="date" id="fe-data"></div>
      <div><label>Nome</label><input class="input" id="fe-nome" placeholder="Ex.: Aniversário de Quilombo"></div>
      <div><label>Vale para</label><select class="select" id="fe-abr" onchange="$('fe-cidade-box').style.display=this.value==='municipal'?'':'none'"><option value="municipal">Um município</option><option value="nacional">Brasil (nacional)</option><option value="SC">Santa Catarina</option><option value="RS">Rio Grande do Sul</option><option value="PR">Paraná</option></select></div>
      <div id="fe-cidade-box"><label>Município</label><input class="input" id="fe-cidade" placeholder="Ex.: Quilombo"></div>
    </div>
    <div class="acoes" style="margin-top:0;margin-bottom:12px"><button class="btn" onclick="addFeriado()">+ Adicionar feriado</button><span class="status-msg" id="fe-msg"></span></div>` : ''}
    ${lista.map(f => { const d = deIso(f.data), fds = d.getDay() === 0 || d.getDay() === 6;
      return `<div class="prop" style="${fds ? 'opacity:.55' : ''}"><span><b>${fmtDia(d)}</b>/${f.data.slice(0, 4)} · ${esc(f.nome)}<br><span class="muted">${f.abrangencia === 'municipal' ? esc(f.cidade) : f.abrangencia === 'nacional' ? 'Nacional' : esc(f.abrangencia)}${fds ? ' · cai no fim de semana' : ''}</span></span>${ed ? `<button class="btn btn-sec" style="padding:3px 9px;color:var(--vermelho)" onclick="delFeriado(${f.id})">🗑</button>` : ''}</div>`; }).join('') || '<div class="muted">Nenhum feriado cadastrado.</div>'}`;
}
async function addFeriado() {
  const data = $('fe-data').value, nome = ($('fe-nome').value || '').trim(), abr = $('fe-abr').value, cidade = ($('fe-cidade').value || '').trim();
  const msg = $('fe-msg'); msg.classList.add('erro');
  if (!data || !nome) { msg.textContent = 'Preencha a data e o nome.'; return; }
  if (abr === 'municipal' && !cidade) { msg.textContent = 'Informe o município.'; return; }
  const { data: novo, error } = await sb.from('feriados').insert({ data, nome, abrangencia: abr, cidade: abr === 'municipal' ? cidade : null }).select('id, data, nome, abrangencia, cidade').single();
  if (error) { msg.textContent = '⚠ ' + (/duplicate|unique/i.test(error.message) ? 'Esse feriado já está cadastrado.' : error.message); return; }
  feriados.push(novo); renderFeriados(); renderProjetos();
  const m2 = $('fe-msg'); if (m2) { m2.classList.remove('erro'); m2.textContent = '✅ Feriado adicionado'; }
}
async function delFeriado(id) {
  const f = feriados.find(x => x.id === id); if (!f || !confirm('Excluir o feriado "' + f.nome + '" (' + fmtD(f.data) + ')?')) return;
  const { error } = await sb.from('feriados').delete().eq('id', id);
  if (error) { alert('Não foi possível excluir: ' + error.message); return; }
  feriados = feriados.filter(x => x.id !== id); renderFeriados(); renderProjetos();
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('ov-feriados').classList.contains('visivel')) { e.stopImmediatePropagation(); fecharFeriados(); } }, true);
