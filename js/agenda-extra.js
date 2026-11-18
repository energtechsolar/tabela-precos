// Eider Sistemas / CRM — Agenda de instalações: complementos (carregado pelo js/comum.js depois do script da tela).
// ⛔ Não trabalhado: manhã, tarde ou dia sem trabalho, por pessoa, com motivo e comentário (não gera diária).
// 📑 Duplicar: copia a atividade para um ou mais dias escolhidos no calendário.
// ⚠ Não concluída: lança a diária de quem foi, a original fica no dia (com o motivo) e uma cópia vai para o novo dia
//    (função nao_concluir_programacao). "Desfazer" volta como estava e tira a cópia, se ela ainda não foi feita.
(function () {
  if (typeof render !== 'function' || typeof cardProg !== 'function' || typeof abrirProg !== 'function') return;
  const MOTIVOS = { chuva: '🌧 Chuva / tempo', sem_obra: '📭 Sem obra programada', folga: '🏖 Feriado / folga', falta: '🙋 Falta da pessoa' };
  const NT = x => !!x && x.tipo === 'nao_trabalhado';
  const per = p => PERIODOS[p] || p;
  const fr = p => p === 'dia' ? 1 : 0.5;
  const sobrepoe = (a, b) => a === 'dia' || b === 'dia' || a === b;
  const pessoasNT = () => EQ.filter(p => p.tipo !== 'indicador' && p.tipo !== 'vendedor');
  let DUP = null;

  const st = document.createElement('style');
  st.textContent = `
    .prog.nt { border-left:3px solid #6b7280; background:#1b1b1b; }
    .prog.nt b { color:#cbd5e1; }
    .prog.nao_concluida { border-left-color:var(--laranja); opacity:.85; }
    .cal { display:grid; grid-template-columns:repeat(7, 1fr); gap:4px; margin-top:8px; }
    .cal .cab { font-size:11px; color:var(--muted); text-align:center; }
    .cal button { background:var(--card2); border:1px solid var(--borda); color:var(--texto); border-radius:8px; padding:5px 2px; font-size:12px; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:1px; font-family:inherit; }
    .cal button small { font-size:10px; color:var(--muted); }
    .cal button.sel { border-color:var(--amarelo); background:#2a2205; color:#fff; }
    .cal button.este { border-style:dashed; }
    .cal button:disabled { opacity:.3; cursor:not-allowed; }
    .nt-mot { display:flex; flex-wrap:wrap; gap:6px; }
    .nt-mot label { display:flex; gap:5px; align-items:center; background:var(--card2); border:1px solid var(--borda); border-radius:8px; padding:6px 9px; font-size:13px; cursor:pointer; text-transform:none; letter-spacing:0; color:var(--texto); margin:0; }`;
  document.head.appendChild(st);

  // ── cards ──
  const _card = cardProg;
  cardProg = function (x) {
    if (NT(x)) return `<div class="prog nt" onclick="abrirNT(${x.id})" title="Período não trabalhado">
      <div>⛔ <b>Não trabalhado</b></div>
      <div class="muted" style="font-size:11px">${esc(per(x.periodo))}${x.motivo ? ' · ' + esc(MOTIVOS[x.motivo] || x.motivo) : ''}</div>
      ${x.obs ? `<div class="muted" style="font-size:11px">📝 ${esc(x.obs.length > 70 ? x.obs.slice(0, 70) + '…' : x.obs)}</div>` : ''}
      <div>${(x.equipe_ids || []).map(pid => `<span class="chip">${esc(primeiro(nomeP(pid)))}</span>`).join('') || '<span class="chip">ninguém</span>'}</div></div>`;
    let h = _card(x);
    if (x.status === 'nao_concluida') h = h.replace('</div>', '</div><div style="font-size:11px;color:var(--laranja)">⚠ não concluída' + (x.motivo ? ': ' + esc(x.motivo) : '') + ' · continua em outro dia</div>');
    else if (x.origem_id) h = h.replace('</div>', ' <span class="muted" title="Continuação de uma atividade não concluída">↪</span></div>');
    return h;
  };
  // botão ⛔ em cada dia
  const _render = render;
  render = function () {
    _render.apply(this, arguments);
    document.querySelectorAll('#semana .dia[data-dia]').forEach(d => {
      const sp = d.querySelector('.dia-topo > span:last-child'); if (!sp || sp.querySelector('.bt-nt')) return;
      const b = document.createElement('button');
      b.className = 'btn btn-sec btn-p bt-nt'; b.title = 'Manhã, tarde ou dia não trabalhado (chuva, sem obra, folga, falta)'; b.textContent = '⛔';
      b.onclick = ev => { ev.stopPropagation(); abrirNT(null, d.dataset.dia); };
      sp.insertBefore(document.createTextNode(' '), sp.firstChild); sp.insertBefore(b, sp.firstChild);
    });
  };

  // ── ⛔ não trabalhado ──
  // quem vem marcado: diaristas, comissionados e quem está escalado na semana
  function padraoNT() {
    const naSemana = new Set(PROG.filter(x => !NT(x)).flatMap(x => x.equipe_ids || []));
    return pessoasNT().filter(p => p.tipo === 'diarista' || p.tipo === 'comissionado' || naSemana.has(p.id)).map(p => p.id);
  }
  window.abrirNT = function (id, dia) {
    const x = id ? acharProg(id) : { data: dia || hojeISO(), periodo: 'dia', equipe_ids: padraoNT(), motivo: '', obs: '' };
    if (!x) return;
    progAberta = id || null;
    $('ficha-prog').innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
        <h2 style="font-family:'Barlow Condensed',sans-serif;color:var(--amarelo)">⛔ Não trabalhado</h2>
        <button class="fechar" onclick="fecharProg()">×</button></div>
      <p class="muted">Período sem trabalho para as pessoas marcadas. Não lança diária: fica registrado na agenda e no quadro do mês da tela Equipe.</p>
      <h3>Quando</h3>
      <div class="grade">
        <div><label>Data</label><input class="input" type="date" id="nt-data" value="${x.data}" onchange="avisoNT()"></div>
        <div><label>Período</label><select class="select" id="nt-periodo" onchange="avisoNT()">${Object.entries(PERIODOS).map(([k, n]) => `<option value="${k}" ${k === x.periodo ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      </div>
      <h3>Quem não trabalhou</h3>
      <div class="pessoas-sel">${pessoasNT().map(p => `<label><input type="checkbox" class="nt-pes" value="${p.id}" ${(x.equipe_ids || []).includes(p.id) ? 'checked' : ''} onchange="avisoNT()"> ${esc(p.nome)}</label>`).join('')}</div>
      <div class="status-msg erro" id="nt-aviso"></div>
      <h3>Motivo</h3>
      <div class="nt-mot">${Object.entries(MOTIVOS).map(([k, n]) => `<label><input type="radio" name="nt-motivo" value="${k}" ${x.motivo === k ? 'checked' : ''}> ${n}</label>`).join('')}</div>
      <h3>Comentário</h3>
      <textarea class="input" id="nt-obs" rows="3" placeholder="Ex.: choveu a manhã toda; kit do João ainda não chegou; Gian no médico.">${esc(x.obs || '')}</textarea>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
        <button class="btn" onclick="salvarNT(${id || 'null'})">💾 Salvar</button>
        ${id ? `<button class="btn btn-sec" style="color:var(--vermelho)" onclick="excluirNT(${id})">🗑 Excluir</button>` : ''}
      </div>
      <div class="status-msg" id="nt-msg"></div>`;
    $('ov-prog').classList.add('visivel');
    avisoNT();
  };
  // alguém marcado está escalado numa atividade no mesmo dia e período?
  window.avisoNT = function () {
    const el = $('nt-aviso'); if (!el) return;
    const data = $('nt-data').value, p = $('nt-periodo').value;
    const pes = [...document.querySelectorAll('.nt-pes:checked')].map(i => +i.value);
    const ocup = PROG.filter(y => y.id !== progAberta && y.data === data && !NT(y) && y.status !== 'cancelada' && sobrepoe(p, y.periodo));
    const quem = pes.filter(pid => ocup.some(y => (y.equipe_ids || []).includes(pid)));
    el.textContent = quem.length ? '⚠ ' + quem.map(nomeP).map(primeiro).join(', ') + ' está(ão) escalado(s) numa atividade neste dia/período. Se a atividade não aconteceu, use "🌧 Reagendar" ou "⚠ Não concluída" nela.' : '';
  };
  window.salvarNT = async function (id) {
    const m = $('nt-msg'); m.classList.add('erro');
    const mot = document.querySelector('input[name="nt-motivo"]:checked');
    const reg = { data: $('nt-data').value, periodo: $('nt-periodo').value, tipo: 'nao_trabalhado', status: 'realizada', motivo: mot ? mot.value : null,
      obs: $('nt-obs').value.trim() || null, equipe_ids: [...document.querySelectorAll('.nt-pes:checked')].map(i => +i.value),
      projeto_id: null, lead_id: null, cliente_id: null, obra_nome: null };
    if (!reg.data) { m.textContent = 'Informe a data.'; return; }
    if (!reg.equipe_ids.length) { m.textContent = 'Marque quem não trabalhou.'; return; }
    if (!reg.motivo) { m.textContent = 'Escolha o motivo.'; return; }
    const { error } = id ? await sb.from('programacao').update(reg).eq('id', id) : await sb.from('programacao').insert(reg);
    if (error) { m.textContent = '⚠ ' + error.message; return; }
    if (reg.data < inicioSemana || reg.data > somaDias(inicioSemana, 6)) inicioSemana = segundaDe(reg.data);
    fecharProg(); await carregar();
    msg('✅ ' + DIAS[deIso(reg.data).getDay()] + ' ' + dBR(reg.data) + ' (' + per(reg.periodo).toLowerCase() + '): não trabalhado — ' + reg.equipe_ids.map(nomeP).map(primeiro).join(', ') + '.');
  };
  window.excluirNT = async function (id) {
    if (!confirm('Excluir este registro de não trabalhado?')) return;
    const { error } = await sb.from('programacao').delete().eq('id', id);
    if (error) { $('nt-msg').classList.add('erro'); $('nt-msg').textContent = '⚠ ' + error.message; return; }
    fecharProg(); await carregar();
  };

  // ── ficha: duplicar, não concluída, continuação ──
  const _abrir = abrirProg;
  abrirProg = function (id) {
    const x = id ? acharProg(id) : null;
    if (NT(x)) return abrirNT(id);
    _abrir.apply(this, arguments);
    if (!x) return;
    const f = $('ficha-prog');
    if (x.status === 'nao_concluida') {
      const s = f.querySelector(':scope > .muted');
      if (s) s.innerHTML = s.innerHTML.replace('⏳ programada', '<span style="color:var(--laranja)">⚠ não concluída' + (x.motivo ? ': ' + esc(x.motivo) : '') + '</span>');
    }
    const botoes = f.querySelector('div[style*="flex-wrap:wrap;margin-top:12px"]');
    if (botoes) botoes.insertAdjacentHTML('beforeend', `<button class="btn btn-sec" title="Copiar esta atividade para outros dias" onclick="abrirDuplicar(${x.id})">📑 Duplicar</button>`);
    // continuação / onde continua
    const info = document.createElement('div'); info.className = 'muted'; info.style.marginTop = '6px'; info.id = 'pg-cont';
    f.querySelector(':scope > .muted') ? f.querySelector(':scope > .muted').after(info) : f.prepend(info);
    if (x.origem_id) sb.from('programacao').select('id, data, motivo').eq('id', x.origem_id).maybeSingle().then(({ data: o }) => {
      if (o && $('pg-cont')) $('pg-cont').innerHTML += `<div>↪ Continuação de <a href="#" onclick="irParaProg(${o.id}, '${o.data}');return false">${DIAS[deIso(o.data).getDay()]} ${dBR(o.data)}</a> (não concluída${o.motivo ? ': ' + esc(o.motivo) : ''})</div>`;
    });
    if (x.status === 'nao_concluida') sb.from('programacao').select('id, data, status').eq('origem_id', x.id).then(({ data: cs }) => {
      if (cs && cs.length && $('pg-cont')) $('pg-cont').innerHTML += cs.map(c => `<div>➡ Continua em <a href="#" onclick="irParaProg(${c.id}, '${c.data}');return false">${DIAS[deIso(c.data).getDay()]} ${dBR(c.data)}</a>${c.status === 'realizada' ? ' · ✅ realizada' : c.status === 'cancelada' ? ' · cancelada' : ''}</div>`).join('');
    });
    // não concluída (dia de hoje ou que já passou)
    if (ABERTA(x.status) && podeConfirmar() && x.data <= hojeISO()) {
      let para = proxUtil(x.data); const hoje = hojeISO();
      if (para < hoje) para = util(hoje) ? hoje : proxUtil(hoje);
      f.insertAdjacentHTML('beforeend', `
        <h3 style="color:var(--laranja)">⚠ Não concluída</h3>
        <p class="muted">A equipe foi mas não terminou. Marque acima, em "Confirmar realizado", <b>quem foi</b>: os diaristas recebem a diária deste dia. Esta atividade fica registrada aqui como não concluída e uma cópia vai para o novo dia.</p>
        <div class="grade" style="margin-top:8px">
          <div><label>Continuar em</label><input class="input" type="date" id="nc-para" value="${para}"></div>
          <div><label>Motivo</label><input class="input" id="nc-motivo" placeholder="Ex.: choveu à tarde, faltou material"></div>
        </div>
        <button class="btn btn-sec" style="margin-top:10px;border-color:var(--laranja);color:var(--laranja)" onclick="naoConcluir(${x.id})">⚠ Não concluída → continuar no novo dia</button>
        <div class="status-msg" id="nc-msg"></div>`);
    }
    if (x.status === 'nao_concluida' && podeConfirmar())
      f.insertAdjacentHTML('beforeend', `<h3>Não concluída</h3><p class="muted">As diárias deste dia já foram lançadas na tela Equipe.</p>
        <button class="btn btn-sec" style="margin-top:8px" onclick="desfazerNC(${x.id})">↺ Desfazer "não concluída"</button><div class="status-msg" id="nc-msg"></div>`);
  };
  window.irParaProg = async function (id, data) {
    fecharProg();
    if (data < inicioSemana || data > somaDias(inicioSemana, 6)) { inicioSemana = segundaDe(data); await carregar(); }
    abrirProg(id);
  };
  window.naoConcluir = async function (id) {
    const x = acharProg(id), m = $('nc-msg'); if (!x || !m) return;
    const pessoas = [...document.querySelectorAll('.cf-pes:checked')].map(i => +i.value);
    const para = $('nc-para').value, motivo = $('nc-motivo').value.trim();
    m.classList.add('erro');
    if (!para || para <= x.data) { m.textContent = 'Escolha um novo dia depois de ' + dBR(x.data) + '.'; return; }
    if (!util(para) && !confirm(DIAS[deIso(para).getDay()] + ' ' + dBR(para) + ' é domingo ou feriado. Continuar mesmo assim?')) return;
    if (!pessoas.length && !confirm('Ninguém marcado como presente: registrar como não concluída sem lançar diária?')) return;
    m.classList.remove('erro'); m.textContent = '⏳ Registrando…';
    const { data, error } = await sb.rpc('nao_concluir_programacao', { p_id: id, p_pessoas: pessoas, p_para: para, p_motivo: motivo || null });
    if (error) { m.classList.add('erro'); m.textContent = '⚠ ' + error.message; return; }
    fecharProg(); await carregar();
    const ocupado = PROG.some(y => y.id !== (data && data.nova_id) && y.data === para && ABERTA(y.status) && sobrepoe(x.periodo, y.periodo));
    msg('⚠ ' + obraDe(x).nome + ': não concluída em ' + dBR(x.data) + ' · ' + ((data && data.lancados) || 0) + ' diária(s) lançada(s) · continua em ' + DIAS[deIso(para).getDay()] + ' ' + dBR(para)
      + (ocupado ? '. Atenção: já há atividade nesse dia — confira a equipe ou use 🌧 Reagendar.' : '.'));
  };
  window.desfazerNC = async function (id) {
    if (!confirm('Desfazer "não concluída"? As diárias deste dia (ainda não pagas) são apagadas e a cópia do novo dia é removida, se ainda não foi feita.')) return;
    const { error } = await sb.rpc('desfazer_programacao', { p_id: id });
    if (error) { const m = $('nc-msg'); m.classList.add('erro'); m.textContent = '⚠ ' + error.message; return; }
    fecharProg(); await carregar(); msg('↺ Voltou a ficar programada.');
  };

  // ── 📑 duplicar: escolhe os dias num calendário de 5 semanas ──
  window.abrirDuplicar = async function (id) {
    const x = acharProg(id); if (!x) return;
    fecharProg();
    const ini = segundaDe(hojeISO() < x.data ? hojeISO() : x.data), fim = somaDias(ini, 34);
    DUP = { x, ini, sel: [], equipe: true, obs: true, cont: {} };
    $('ov-reag').classList.add('visivel');
    $('reag-corpo').innerHTML = '<div class="muted">⏳ Carregando…</div>';
    const { data } = await sb.from('programacao').select('data, tipo, status').gte('data', ini).lte('data', fim).neq('status', 'cancelada').limit(2000);
    (data || []).forEach(y => { if (y.tipo !== 'nao_trabalhado') DUP.cont[y.data] = (DUP.cont[y.data] || 0) + 1; });
    desenharDup();
  };
  window.dupDia = function (iso) { if (!DUP) return; const i = DUP.sel.indexOf(iso); if (i >= 0) DUP.sel.splice(i, 1); else DUP.sel.push(iso); desenharDup(); };
  function desenharDup() {
    const D = DUP; if (!D) return;
    const o = obraDe(D.x), t = TIPOS[D.x.tipo] || TIPOS.outro, hoje = hojeISO();
    let cal = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(n => `<div class="cab">${n}</div>`).join('');
    for (let i = 0; i < 35; i++) {
      const iso = somaDias(D.ini, i), sel = D.sel.includes(iso), n = D.cont[iso] || 0;
      cal += `<button type="button" class="${sel ? 'sel' : ''} ${iso === D.x.data ? 'este' : ''}" ${iso < hoje ? 'disabled' : ''} onclick="dupDia('${iso}')" title="${!util(iso) ? 'Domingo ou feriado' : ''}">
        <span>${dBR(iso).slice(0, 5)}</span><small>${iso === D.x.data ? 'esta' : n ? n + ' ativ.' : !util(iso) ? 'folga' : '&nbsp;'}</small></button>`;
    }
    $('reag-corpo').innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><h3 style="font-family:'Barlow Condensed',sans-serif;color:var(--amarelo);font-size:20px">📑 Duplicar</h3><button class="fechar" onclick="fecharReag()">×</button></div>
      <p class="muted">${t[0]} <b>${esc(o.nome)}</b> · ${esc(t[1])} · ${esc(per(D.x.periodo))} · ${esc((D.x.equipe_ids || []).map(nomeP).map(primeiro).join(', ') || 'sem equipe')}</p>
      <p class="muted" style="margin-top:6px">Toque nos dias para onde copiar (pode marcar vários).</p>
      <div class="cal">${cal}</div>
      <label class="opc"><input type="checkbox" ${D.equipe ? 'checked' : ''} onchange="DUP_set('equipe', this.checked)"><span>Manter a mesma equipe</span></label>
      <label class="opc"><input type="checkbox" ${D.obs ? 'checked' : ''} onchange="DUP_set('obs', this.checked)"><span>Copiar as observações</span></label>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn" onclick="aplicarDup()" ${D.sel.length ? '' : 'disabled'}>📑 Duplicar em ${D.sel.length} dia(s)</button><button class="btn btn-sec" onclick="fecharReag()">Cancelar</button></div>
      <div class="status-msg" id="dup-msg"></div>`;
  }
  window.DUP_set = (k, v) => { if (DUP) DUP[k] = v; };
  window.aplicarDup = async function () {
    const D = DUP; if (!D || !D.sel.length) return;
    const x = D.x, m = $('dup-msg');
    // observação sem as notas automáticas de reagendamento
    const obs = D.obs && x.obs ? x.obs.split('\n').filter(l => !/^(↷|Continua de )/.test(l.trim())).join('\n').trim() || null : null;
    const regs = D.sel.slice().sort().map(data => ({ data, tipo: x.tipo, periodo: x.periodo, projeto_id: x.projeto_id, lead_id: x.lead_id, cliente_id: x.cliente_id,
      obra_nome: x.obra_nome, equipe_ids: D.equipe ? (x.equipe_ids || []) : [], obs, status: 'programada' }));
    m.textContent = '⏳ Duplicando…';
    const { error } = await sb.from('programacao').insert(regs);
    if (error) { m.classList.add('erro'); m.textContent = '⚠ ' + error.message; return; }
    fecharReag(); await carregar();
    msg('✅ ' + obraDe(x).nome + ' duplicada em ' + regs.length + ' dia(s): ' + regs.map(r => dBR(r.data).slice(0, 5)).join(', ') + '.');
  };

  // ── escala no WhatsApp: sem os "não trabalhado" como obra; avisa quem não trabalha ──
  escalaWhats = function (iso) {
    const d = deIso(iso), lista = PROG.filter(x => x.data === iso && x.status !== 'cancelada' && x.status !== 'prevista' && !NT(x));
    const nts = PROG.filter(x => x.data === iso && NT(x));
    const linhas = ['📅 *Escala Energtech — ' + DIAS[d.getDay()] + ' ' + dBR(iso) + '*', ''];
    lista.forEach(x => { const o = obraDe(x), t = TIPOS[x.tipo] || TIPOS.outro;
      linhas.push(t[0] + ' *' + o.nome + '*' + (x.periodo !== 'dia' ? ' (' + PERIODOS[x.periodo].toLowerCase() + ')' : ''));
      if (o.endereco || o.cidade) linhas.push('📍 ' + [o.endereco, o.cidade].filter(Boolean).join(' · ') + ' — https://www.google.com/maps/search/' + encodeURIComponent([o.endereco, o.cidade].filter(Boolean).join(', ')));
      linhas.push('👷 ' + ((x.equipe_ids || []).map(nomeP).map(primeiro).join(', ') || 'equipe a definir'));
      if (x.obs) linhas.push('📝 ' + x.obs);
      linhas.push('');
    });
    nts.forEach(x => linhas.push('⛔ Sem trabalho' + (x.periodo !== 'dia' ? ' (' + PERIODOS[x.periodo].toLowerCase() + ')' : '') + ': ' + (x.equipe_ids || []).map(nomeP).map(primeiro).join(', ') + (x.motivo ? ' — ' + (MOTIVOS[x.motivo] || x.motivo).replace(/^\S+\s/, '') : '')));
    window.open('https://wa.me/?text=' + encodeURIComponent(linhas.join('\n').trim()), '_blank', 'noopener');
  };

  if (perfil && $('semana') && $('semana').innerHTML) render();
})();
