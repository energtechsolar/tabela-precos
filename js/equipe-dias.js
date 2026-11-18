// Eider Sistemas / CRM — tela Equipe: quadro do mês por pessoa (carregado pelo js/comum.js depois do script da tela).
// Dias trabalhados (diárias lançadas + atividades feitas na agenda), dias "não trabalhado" com motivo e comentário,
// e os dias úteis (segunda a sexta, sem feriado nacional) sem nenhum registro, para não ficar período em branco.
(function () {
  if (typeof render !== 'function' || typeof carregar !== 'function' || !document.getElementById('lancamentos')) return;
  const MOTIVOS = { chuva: '🌧 Chuva / tempo', sem_obra: '📭 Sem obra programada', folga: '🏖 Feriado / folga', falta: '🙋 Falta da pessoa' };
  const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const PERIODOS = { dia: 'dia inteiro', manha: 'manhã', tarde: 'tarde' };
  const fr = p => p === 'dia' ? 1 : 0.5;
  const num = v => String(Math.round(v * 10) / 10).replace('.', ',');
  const deIso = s => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
  const isoDe = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  let PRG = [], FER = null, aberto = null;

  const card = document.createElement('div'); card.className = 'card';
  card.innerHTML = '<h2>📅 Dias do mês por pessoa</h2><div id="dias-mes"><div class="muted">⏳ Carregando…</div></div>';
  document.getElementById('lancamentos').closest('.card').after(card);

  const _carregar = carregar;
  carregar = async function () { await _carregar.apply(this, arguments); await carregarDias(); };
  const _render = render;
  render = function () { _render.apply(this, arguments); renderDias(); };

  async function carregarDias() {
    const ym = $('f-mes').value; if (!ym) return;
    const [p, f] = await Promise.all([
      sb.from('programacao').select('id, data, tipo, periodo, status, equipe_ids, motivo, obs, lead_id, obra_nome, projeto_id, cliente_id').gte('data', ym + '-01').lte('data', ultimoDia(ym)).neq('status', 'cancelada').limit(3000),
      FER ? null : sb.from('feriados').select('data, nome').eq('abrangencia', 'nacional'),
    ]);
    if (p.error) { $('dias-mes').innerHTML = '<div class="muted">⚠ ' + esc(p.error.message) + '</div>'; return; }
    PRG = p.data || []; if (f) FER = f.error ? [] : (f.data || []);
    renderDias();
  }
  // dias úteis do mês até hoje (segunda a sexta, sem feriado nacional): é onde um período em branco aparece como "sem registro"
  function diasUteis(ym) {
    const out = [], hoje = hojeISO(), d = deIso(ym + '-01');
    while (isoDe(d).slice(0, 7) === ym && isoDe(d) <= hoje) {
      const iso = isoDe(d), w = d.getDay();
      if (w >= 1 && w <= 5 && !(FER || []).some(x => x.data === iso)) out.push(iso);
      d.setDate(d.getDate() + 1);
    }
    return out;
  }
  function quadro(pid) {
    const trab = {}, obras = {}, nt = {}, ntReg = [];
    const soma = (o, k, v) => { o[k] = Math.min(1, (o[k] || 0) + v); };
    // diárias lançadas (inclui as lançadas à mão)
    const lanDia = {};
    LAN.filter(x => x.pessoa_id === pid && x.tipo === 'dia').forEach(x => {
      lanDia[x.data] = Math.min(1, (lanDia[x.data] || 0) + +x.quantidade);
      (obras[x.data] = obras[x.data] || new Set()).add(x.lead_id ? ((x.leads || {}).nome || 'obra') : (x.obra_nome || 'sem obra'));
    });
    // atividades feitas na agenda (realizada ou não concluída)
    const prgDia = {};
    const nomeObra = x => { const o = x.lead_id && (OBRAS || []).find(y => y.id === x.lead_id); return (o && o.nome) || x.obra_nome || 'atividade da agenda'; };
    const obrasPrg = {};
    PRG.filter(x => x.tipo !== 'nao_trabalhado' && ['realizada', 'nao_concluida'].includes(x.status) && (x.equipe_ids || []).includes(pid)).forEach(x => {
      soma(prgDia, x.data, fr(x.periodo));
      (obrasPrg[x.data] = obrasPrg[x.data] || new Set()).add(nomeObra(x) + (x.status === 'nao_concluida' ? ' (não concluída)' : ''));
    });
    Object.keys(obrasPrg).forEach(d => { obras[d] = obrasPrg[d]; });   // a agenda diz se foi não concluída; sem agenda, fica o nome do lançamento
    new Set([...Object.keys(lanDia), ...Object.keys(prgDia)]).forEach(d => { trab[d] = Math.max(lanDia[d] || 0, prgDia[d] || 0); });
    PRG.filter(x => x.tipo === 'nao_trabalhado' && (x.equipe_ids || []).includes(pid)).forEach(x => { soma(nt, x.data, fr(x.periodo)); ntReg.push(x); });
    const sem = diasUteis($('f-mes').value).map(d => ({ d, falta: Math.max(0, 1 - (trab[d] || 0) - (nt[d] || 0)) })).filter(x => x.falta > 0);
    const tot = o => Object.values(o).reduce((a, v) => a + v, 0);
    return { trab, obras, nt, ntReg: ntReg.sort((a, b) => a.data < b.data ? -1 : 1), sem, tTrab: tot(trab), tNt: tot(nt), tSem: sem.reduce((a, x) => a + x.falta, 0) };
  }
  function renderDias() {
    const el = $('dias-mes'); if (!el) return;
    const naAgenda = new Set(PRG.flatMap(x => x.equipe_ids || []));
    const pes = PES.filter(p => p.ativo && (p.tipo === 'diarista' || p.tipo === 'comissionado' || (p.tipo === 'fixo' && naAgenda.has(p.id))) || LAN.some(l => l.pessoa_id === p.id && l.tipo === 'dia'));
    if (!pes.length) { el.innerHTML = '<div class="vazio">Ninguém da equipe de campo cadastrado.</div>'; return; }
    const linhas = pes.map(p => {
      const q = quadro(p.id), ab = aberto === p.id;
      const det = !ab ? '' : `<tr><td colspan="5" style="background:var(--card2)">
        ${q.ntReg.length ? '<div class="muted" style="margin-bottom:4px"><b>⛔ Não trabalhado</b></div>' + q.ntReg.map(x => `<div style="padding:4px 0;border-bottom:1px solid #2a2a2a;font-size:13px">
            ${DIAS[deIso(x.data).getDay()]} ${dBR(x.data)} · ${PERIODOS[x.periodo] || x.periodo} · <b>${esc(MOTIVOS[x.motivo] || x.motivo || 'sem motivo')}</b>
            ${x.obs ? '<br><span class="muted">📝 ' + esc(x.obs) + '</span>' : ''}
            <button class="btn btn-sec btn-p" style="margin-left:6px" onclick="comentarNT(${x.id})">✏ ${x.obs ? 'Editar comentário' : 'Comentar'}</button></div>`).join('') : ''}
        ${q.sem.length ? `<div class="muted" style="margin:10px 0 4px"><b>◻ Dias úteis sem registro</b> (nem trabalho nem "não trabalhado")</div>` + q.sem.map(s => `<div style="padding:4px 0;border-bottom:1px solid #2a2a2a;font-size:13px">
            ${DIAS[deIso(s.d).getDay()]} ${dBR(s.d)}${s.falta < 1 ? ' · meio período' : ''}
            <button class="btn btn-sec btn-p" style="margin-left:6px" onclick="marcarNT(${p.id}, '${s.d}', ${s.falta})">⛔ Marcar não trabalhado</button></div>`).join('') : ''}
        ${Object.keys(q.trab).length ? `<div class="muted" style="margin:10px 0 4px"><b>✅ Trabalhados</b></div><div style="font-size:13px;line-height:1.7">` + Object.keys(q.trab).sort().map(d => `${DIAS[deIso(d).getDay()]} ${dBR(d).slice(0, 5)}${q.trab[d] < 1 ? ' (½)' : ''} <span class="muted">${esc([...(q.obras[d] || [])].join(', '))}</span>`).join('<br>') + '</div>' : ''}
      </td></tr>`;
      return `<tr style="cursor:pointer" onclick="abrirDiasPessoa(${p.id})"><td>${ab ? '▾' : '▸'} <b>${esc(p.nome)}</b> <span class="tag">${esc(TIPOS_P[p.tipo] || p.tipo)}</span></td>
        <td class="num">${num(q.tTrab)}</td><td class="num">${q.tNt ? num(q.tNt) : '—'}</td>
        <td class="num">${q.tSem ? '<span style="color:var(--amarelo)">' + num(q.tSem) + '</span>' : '—'}</td></tr>${det}`;
    }).join('');
    el.innerHTML = `<div class="tabela-wrap"><table><thead><tr><th>Pessoa</th><th class="num">Trabalhados</th><th class="num">Não trabalhados</th><th class="num">Sem registro</th></tr></thead><tbody>${linhas}</tbody></table></div>
      <p class="muted" style="margin-top:8px">Em dias (meio período = 0,5). <b>Trabalhados</b>: diárias lançadas e atividades feitas na agenda. <b>Não trabalhados</b>: marcados na agenda (⛔), com motivo. <b>Sem registro</b>: dias úteis (seg. a sex., sem feriado) até hoje sem nada — clique na pessoa para marcar o motivo.</p>`;
  }
  window.abrirDiasPessoa = id => { aberto = aberto === id ? null : id; renderDias(); };
  window.comentarNT = async function (id) {
    const x = PRG.find(y => y.id === id); if (!x) return;
    const t = prompt('Por que não foi trabalhado? (comentário)', x.obs || ''); if (t === null) return;
    const { error } = await sb.from('programacao').update({ obs: t.trim() || null }).eq('id', id);
    if (error) { msg('⚠ ' + error.message, true); return; }
    await carregarDias(); msg('✅ Comentário salvo.');
  };
  // marca um dia útil sem registro como "não trabalhado" para esta pessoa (meio período: o que sobrou do dia)
  window.marcarNT = async function (pid, iso, falta) {
    let periodo = 'dia';
    if (falta < 1) {
      const usados = PRG.filter(x => x.data === iso && (x.equipe_ids || []).includes(pid) && x.periodo !== 'dia').map(x => x.periodo);
      periodo = usados.includes('manha') ? 'tarde' : usados.includes('tarde') ? 'manha' : (prompt('Qual período não foi trabalhado? Digite M (manhã) ou T (tarde):', 'T') || '').trim().toUpperCase().startsWith('M') ? 'manha' : 'tarde';
    }
    const op = prompt('Motivo (' + (PES.find(p => p.id === pid) || {}).nome + ', ' + dBR(iso) + '):\n1 = Chuva / tempo\n2 = Sem obra programada\n3 = Feriado / folga\n4 = Falta da pessoa', '2');
    if (op === null) return;
    const motivo = { 1: 'chuva', 2: 'sem_obra', 3: 'folga', 4: 'falta' }[String(op).trim()];
    if (!motivo) { msg('⚠ Motivo inválido: digite 1, 2, 3 ou 4.', true); return; }
    const obs = prompt('Comentário (opcional):', ''); if (obs === null) return;
    const { error } = await sb.from('programacao').insert({ data: iso, periodo, tipo: 'nao_trabalhado', status: 'realizada', motivo, obs: obs.trim() || null, equipe_ids: [pid] });
    if (error) { msg('⚠ ' + error.message, true); return; }
    await carregarDias(); msg('✅ ' + dBR(iso) + ' marcado como não trabalhado.');
  };

  if (typeof perfil !== 'undefined' && perfil && perfil.admin && $('f-mes').value) carregarDias();
})();
