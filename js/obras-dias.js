// Eider Sistemas / CRM — tela Instalações: "📅 Dias trabalhados" da equipe, SEM valores (carregado pelo js/comum.js).
// Para quem cuida das obras (admin, engenharia e o papel "obras"). Os dias vêm da função equipe_dias (diárias lançadas,
// só a quantidade) e da própria agenda (atividades feitas e "não trabalhado"). Nenhum valor em reais passa por aqui.
// Dias úteis (seg. a sex., sem feriado nacional) até hoje sem nada aparecem como "sem registro", com botão para marcar o motivo.
(function () {
  if (typeof carregar !== 'function' || !document.getElementById('conteudo')) return;
  const MOTIVOS = { chuva: '🌧 Chuva / tempo', sem_obra: '📭 Sem obra programada', folga: '🏖 Feriado / folga', falta: '🙋 Falta da pessoa' };
  const SEM = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const PER = { dia: 'dia inteiro', manha: 'manhã', tarde: 'tarde' };
  const TIPO = { diarista: 'diarista', fixo: 'fixo', comissionado: 'por instalação' };
  const fr = p => p === 'dia' ? 1 : 0.5;
  const num = v => String(Math.round(v * 10) / 10).replace('.', ',');
  const deIso = s => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
  const isoDe = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const ultimo = ym => { const [y, m] = ym.split('-').map(Number); return isoDe(new Date(y, m, 0)); };
  let PES = [], DIAS = [], PRG = [], FER = null, aberto = null, iniciado = false;

  const card = document.createElement('div'); card.className = 'card'; card.style.marginTop = '16px'; card.id = 'card-dias-equipe';
  card.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px">
      <h2 style="margin:0">📅 Dias trabalhados da equipe</h2>
      <label class="muted">Mês <input class="input" type="month" id="od-mes" style="width:auto;display:inline-block" onchange="odCarregar()"></label></div>
    <div id="od-corpo"><div class="muted">⏳ Carregando…</div></div>`;
  document.getElementById('conteudo').appendChild(card);
  card.style.display = 'none';

  const pode = () => typeof perfil !== 'undefined' && perfil && (perfil.admin || ['engenheiro', 'obras'].includes(perfil.papel_real || perfil.papel));

  window.odCarregar = async function () {
    if (!pode()) { card.style.display = 'none'; return; }
    card.style.display = '';
    const ym = $('od-mes').value || hojeISO().slice(0, 7); $('od-mes').value = ym;
    const ini = ym + '-01', fim = ultimo(ym);
    const [e, d, p, f] = await Promise.all([
      sb.rpc('equipe_escala'),
      sb.rpc('equipe_dias', { p_ini: ini, p_fim: fim }),
      sb.from('programacao').select('id, data, tipo, periodo, status, equipe_ids, motivo, obs, lead_id, obra_nome').gte('data', ini).lte('data', fim).neq('status', 'cancelada').limit(3000),
      FER ? null : sb.from('feriados').select('data').eq('abrangencia', 'nacional'),
    ]);
    const err = [e, d, p].find(x => x.error);
    if (err) { $('od-corpo').innerHTML = '<div class="muted">⚠ ' + esc(err.error.message) + '</div>'; return; }
    PES = e.data || []; DIAS = d.data || []; PRG = p.data || []; if (f) FER = f.error ? [] : (f.data || []);
    desenhar();
  };

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
    const lanDia = {};
    DIAS.filter(x => x.pessoa_id === pid).forEach(x => {
      lanDia[x.data] = Math.min(1, (lanDia[x.data] || 0) + +x.quantidade);
      (obras[x.data] = obras[x.data] || new Set()).add(x.obra || 'sem obra');
    });
    const prgDia = {}, obrasPrg = {};
    PRG.filter(x => x.tipo !== 'nao_trabalhado' && ['realizada', 'nao_concluida'].includes(x.status) && (x.equipe_ids || []).includes(pid)).forEach(x => {
      soma(prgDia, x.data, fr(x.periodo));
      const nome = (x.lead_id && LEADS && LEADS[x.lead_id] && LEADS[x.lead_id].nome) || x.obra_nome || 'atividade da agenda';
      (obrasPrg[x.data] = obrasPrg[x.data] || new Set()).add(nome + (x.status === 'nao_concluida' ? ' (não concluída)' : ''));
    });
    Object.keys(obrasPrg).forEach(d => { obras[d] = obrasPrg[d]; });
    new Set([...Object.keys(lanDia), ...Object.keys(prgDia)]).forEach(d => { trab[d] = Math.max(lanDia[d] || 0, prgDia[d] || 0); });
    PRG.filter(x => x.tipo === 'nao_trabalhado' && (x.equipe_ids || []).includes(pid)).forEach(x => { soma(nt, x.data, fr(x.periodo)); ntReg.push(x); });
    const sem = diasUteis($('od-mes').value).map(d => ({ d, falta: Math.max(0, 1 - (trab[d] || 0) - (nt[d] || 0)) })).filter(x => x.falta > 0);
    const tot = o => Object.values(o).reduce((a, v) => a + v, 0);
    return { trab, obras, ntReg: ntReg.sort((a, b) => a.data < b.data ? -1 : 1), sem, tTrab: tot(trab), tNt: tot(nt), tSem: sem.reduce((a, x) => a + x.falta, 0) };
  }
  function desenhar() {
    const el = $('od-corpo'); if (!el) return;
    const naAgenda = new Set(PRG.flatMap(x => x.equipe_ids || [])), comDia = new Set(DIAS.map(x => x.pessoa_id));
    const pes = PES.filter(p => p.tipo === 'diarista' || p.tipo === 'comissionado' || naAgenda.has(p.id) || comDia.has(p.id));
    if (!pes.length) { el.innerHTML = '<div class="vazio">Ninguém da equipe de campo cadastrado.</div>'; return; }
    const linhas = pes.map(p => {
      const q = quadro(p.id), ab = aberto === p.id;
      const det = !ab ? '' : `<tr><td colspan="4" style="background:var(--card2)">
        ${q.ntReg.length ? '<div class="muted" style="margin-bottom:4px"><b>⛔ Não trabalhado</b></div>' + q.ntReg.map(x => `<div style="padding:4px 0;border-bottom:1px solid #2a2a2a;font-size:13px">
            ${SEM[deIso(x.data).getDay()]} ${dBR(x.data)} · ${PER[x.periodo] || x.periodo} · <b>${esc(MOTIVOS[x.motivo] || x.motivo || 'sem motivo')}</b>
            ${x.obs ? '<br><span class="muted">📝 ' + esc(x.obs) + '</span>' : ''}
            <button class="btn btn-sec btn-p" style="margin-left:6px" onclick="odComentar(${x.id})">✏ ${x.obs ? 'Editar comentário' : 'Comentar'}</button></div>`).join('') : ''}
        ${q.sem.length ? '<div class="muted" style="margin:10px 0 4px"><b>◻ Dias úteis sem registro</b></div>' + q.sem.map(s => `<div style="padding:4px 0;border-bottom:1px solid #2a2a2a;font-size:13px">
            ${SEM[deIso(s.d).getDay()]} ${dBR(s.d)}${s.falta < 1 ? ' · meio período' : ''}
            <button class="btn btn-sec btn-p" style="margin-left:6px" onclick="odMarcarNT(${p.id}, '${s.d}', ${s.falta})">⛔ Marcar não trabalhado</button></div>`).join('') : ''}
        ${Object.keys(q.trab).length ? '<div class="muted" style="margin:10px 0 4px"><b>✅ Trabalhados</b></div><div style="font-size:13px;line-height:1.7">' + Object.keys(q.trab).sort().map(d => `${SEM[deIso(d).getDay()]} ${dBR(d).slice(0, 5)}${q.trab[d] < 1 ? ' (½)' : ''} <span class="muted">${esc([...(q.obras[d] || [])].join(', '))}</span>`).join('<br>') + '</div>' : ''}
      </td></tr>`;
      return `<tr style="cursor:pointer" onclick="odAbrir(${p.id})"><td>${ab ? '▾' : '▸'} <b>${esc(p.nome)}</b> <span class="muted" style="font-size:12px">${esc(TIPO[p.tipo] || p.tipo || '')}</span></td>
        <td style="text-align:right">${num(q.tTrab)}</td><td style="text-align:right">${q.tNt ? num(q.tNt) : '—'}</td>
        <td style="text-align:right">${q.tSem ? '<span style="color:var(--amarelo)">' + num(q.tSem) + '</span>' : '—'}</td></tr>${det}`;
    }).join('');
    el.innerHTML = `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr style="color:var(--muted);font-size:12px;text-align:left"><th>Pessoa</th><th style="text-align:right">Trabalhados</th><th style="text-align:right">Não trabalhados</th><th style="text-align:right">Sem registro</th></tr></thead><tbody>${linhas}</tbody></table></div>
      <p class="muted" style="margin-top:8px;font-size:12px">Em dias (meio período = 0,5). <b>Trabalhados</b>: dias lançados e atividades confirmadas na agenda. <b>Não trabalhados</b>: marcados na agenda (⛔), com motivo. <b>Sem registro</b>: dias úteis até hoje sem nada — clique na pessoa para marcar o motivo.</p>`;
  }
  window.odAbrir = id => { aberto = aberto === id ? null : id; desenhar(); };
  window.odComentar = async function (id) {
    const x = PRG.find(y => y.id === id); if (!x) return;
    const t = prompt('Por que não foi trabalhado? (comentário)', x.obs || ''); if (t === null) return;
    const { error } = await sb.from('programacao').update({ obs: t.trim() || null }).eq('id', id);
    if (error) { msg('⚠ ' + error.message, true); return; }
    await odCarregar(); msg('✅ Comentário salvo.');
  };
  window.odMarcarNT = async function (pid, iso, falta) {
    let periodo = 'dia';
    if (falta < 1) {
      const usados = PRG.filter(x => x.data === iso && (x.equipe_ids || []).includes(pid) && x.periodo !== 'dia').map(x => x.periodo);
      periodo = usados.includes('manha') ? 'tarde' : usados.includes('tarde') ? 'manha' : (prompt('Qual período não foi trabalhado? Digite M (manhã) ou T (tarde):', 'T') || '').trim().toUpperCase().startsWith('M') ? 'manha' : 'tarde';
    }
    const op = prompt('Motivo (' + ((PES.find(p => p.id === pid) || {}).nome || '') + ', ' + dBR(iso) + '):\n1 = Chuva / tempo\n2 = Sem obra programada\n3 = Feriado / folga\n4 = Falta da pessoa', '2');
    if (op === null) return;
    const motivo = { 1: 'chuva', 2: 'sem_obra', 3: 'folga', 4: 'falta' }[String(op).trim()];
    if (!motivo) { msg('⚠ Motivo inválido: digite 1, 2, 3 ou 4.', true); return; }
    const obs = prompt('Comentário (opcional):', ''); if (obs === null) return;
    const { error } = await sb.from('programacao').insert({ data: iso, periodo, tipo: 'nao_trabalhado', status: 'realizada', motivo, obs: obs.trim() || null, equipe_ids: [pid] });
    if (error) { msg('⚠ ' + error.message, true); return; }
    await odCarregar(); msg('✅ ' + dBR(iso) + ' marcado como não trabalhado.');
  };

  // acompanha a tela: depois de cada carga (confirmação, não trabalhado...) atualiza o quadro
  const _carregar = carregar;
  carregar = async function () { const r = await _carregar.apply(this, arguments); odCarregar(); return r; };
  const espera = setInterval(() => { if (typeof perfil !== 'undefined' && perfil) { clearInterval(espera); if (!iniciado) { iniciado = true; odCarregar(); } } }, 300);
  setTimeout(() => clearInterval(espera), 20000);
})();
