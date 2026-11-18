// Eider Sistemas / CRM — Financeiro › Lucro por obra: resumo da obra na agenda (carregado pelo js/comum.js depois do script da tela).
// Dias de obra, pessoas por dia (inclui os fixos, que não geram diária), dias não concluídos e o que ainda está programado.
(function () {
  if (typeof renderObras !== 'function') return;
  const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const PER = { dia: 'dia', manha: 'manhã', tarde: 'tarde' };
  const fr = p => p === 'dia' ? 1 : 0.5;
  const num = v => String(Math.round(v * 10) / 10).replace('.', ',');
  const deIso = s => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
  let PRG = null, PJL = {}, EQN = {}, carregando = null;

  function carregarPrg() {
    if (!carregando) carregando = Promise.all([
      sb.from('programacao').select('id, data, tipo, periodo, status, equipe_ids, motivo, lead_id, projeto_id').neq('status', 'cancelada').neq('tipo', 'nao_trabalhado').limit(5000),
      sb.from('projetos').select('id, lead_id').limit(5000),
      sb.from('equipe').select('id, nome, tipo'),
    ]).then(([p, j, e]) => {
      PRG = p.error ? [] : (p.data || []);
      PJL = {}; ((j && j.data) || []).forEach(x => { PJL[x.id] = x.lead_id; });
      EQN = {}; ((e && e.data) || []).forEach(x => { EQN[x.id] = x; });
    });
    return carregando;
  }
  const _r = renderObras;
  renderObras = function () { _r.apply(this, arguments); resumo(); };

  function resumo() {
    if (!obraAberta) return;
    if (PRG === null) { carregarPrg().then(resumo); return; }
    const cel = document.querySelector('#aba-obras td[colspan="10"] .grade2 > div:last-child');
    if (!cel || cel.querySelector('.resumo-obra')) return;
    const lead = obraAberta;
    const lista = PRG.filter(x => (x.lead_id || PJL[x.projeto_id]) === lead).sort((a, b) => a.data < b.data ? -1 : a.data > b.data ? 1 : a.id - b.id);
    const feitos = lista.filter(x => x.status === 'realizada' || x.status === 'nao_concluida');
    const futuras = lista.filter(x => x.status === 'programada' || x.status === 'prevista');
    const porDia = {}; feitos.forEach(x => { porDia[x.data] = Math.min(1, (porDia[x.data] || 0) + fr(x.periodo)); });
    const dias = Object.values(porDia).reduce((a, v) => a + v, 0);
    const pessoasDia = feitos.reduce((a, x) => a + fr(x.periodo) * (x.equipe_ids || []).length, 0);
    const nc = feitos.filter(x => x.status === 'nao_concluida').length;
    const nome = id => { const p = EQN[id]; return p ? String(p.nome).split(' ')[0] + (p.tipo === 'fixo' ? ' <span class="muted">(fixo)</span>' : '') : '#' + id; };
    const html = !lista.length ? `<div class="resumo-obra muted" style="margin-bottom:10px"><b>Obra na agenda</b><br>Nenhuma atividade desta obra na agenda de instalações.</div>`
      : `<div class="resumo-obra" style="margin-bottom:12px">
        <div class="muted" style="margin-bottom:4px"><b>Obra na agenda</b></div>
        <div style="font-size:13px;margin-bottom:6px">📅 <b>${num(dias)} dia(s) de obra</b>${nc ? ` <span style="color:var(--laranja)">(${nc} não concluído${nc > 1 ? 's' : ''})</span>` : ''} · 👷 <b>${num(pessoasDia)} pessoa(s)-dia</b>${dias ? ' · média de ' + num(pessoasDia / dias) + ' por dia' : ''}</div>
        ${feitos.length ? `<table><tbody>${feitos.map(x => `<tr><td>${DIAS[deIso(x.data).getDay()]} ${dBR(x.data).slice(0, 5)}${x.periodo !== 'dia' ? ' <span class="muted">(' + PER[x.periodo] + ')</span>' : ''}</td>
          <td>${(x.equipe_ids || []).map(nome).join(', ') || '<span class="muted">sem equipe</span>'}</td>
          <td>${x.status === 'nao_concluida' ? '<span style="color:var(--laranja)" title="' + esc(x.motivo || '') + '">⚠ não concluída</span>' : '✅'}</td></tr>`).join('')}</tbody></table>` : ''}
        ${futuras.length ? `<div class="muted" style="margin-top:6px">Ainda programado: ${futuras.map(x => dBR(x.data).slice(0, 5) + (x.status === 'prevista' ? ' (prevista)' : '')).join(', ')}</div>` : ''}
      </div>`;
    cel.insertAdjacentHTML('afterbegin', html);
  }
  if (typeof obraAberta !== 'undefined' && obraAberta) resumo();
})();
