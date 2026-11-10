// Energtech — CRM: filtro da coluna "Ganho" do funil (para a tela não ficar poluída com todas as vendas).
// Padrão: últimos 30 dias (como antes). No topo da coluna dá para escolher um mês, o ano inteiro ou "Todos".
// Buscando um nome/telefone na barra de busca, aparecem os ganhos de qualquer data.
// A escolha fica guardada neste aparelho. Os perdidos continuam como antes (30 dias ou "Ganhos/perdidos antigos").
// Carregado pelo crm.html depois de js/crm.js: envolve filtrados() e render() sem mudar o crm.js.
(function () {
  if (typeof filtrados !== 'function' || typeof render !== 'function') return;
  const CHAVE = 'etg_filtro_ganhos';
  let sel = 'recentes';
  try { sel = localStorage.getItem(CHAVE) || 'recentes'; } catch (e) {}
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const mesDe = l => { const d = new Date(l.etapa_em); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  const buscando = () => !!(($('f-busca') || {}).value || '').trim();

  function passaGanho(l) {
    if (buscando() || sel === 'todos') return true;
    if (sel === 'recentes') return mostrarAntigos || dias(l.etapa_em) <= 30;
    if (/^\d{4}$/.test(sel)) return String(new Date(l.etapa_em).getFullYear()) === sel;
    return mesDe(l) === sel;
  }

  const _filtrados = filtrados;
  filtrados = function () {
    const antes = mostrarAntigos;
    mostrarAntigos = true;   // o crm.js corta ganhos/perdidos de 30 dias; aqui a regra dos ganhos é a do filtro
    let lista;
    try { lista = _filtrados.apply(this, arguments); } finally { mostrarAntigos = antes; }
    return lista.filter(l => {
      if (l.etapa === 'ganho') return passaGanho(l);
      if (l.etapa === 'perdido') return mostrarAntigos || dias(l.etapa_em) <= 30;
      return true;
    });
  };

  function opcoes() {
    const ganhos = leads.filter(l => l.etapa === 'ganho' && !!l.arquivado === verArquivados);
    const porMes = {}, porAno = {};
    ganhos.forEach(l => { const m = mesDe(l); porMes[m] = (porMes[m] || 0) + 1; porAno[m.slice(0, 4)] = (porAno[m.slice(0, 4)] || 0) + 1; });
    const op = (v, t) => `<option value="${v}" ${v === sel ? 'selected' : ''}>${t}</option>`;
    let h = op('recentes', 'Últimos 30 dias');
    Object.keys(porAno).sort().reverse().forEach(a => {
      h += `<optgroup label="${a}">` + op(a, 'Ano ' + a + ' inteiro (' + porAno[a] + ')')
        + Object.keys(porMes).filter(m => m.startsWith(a)).sort().reverse()
            .map(m => op(m, MESES[+m.slice(5) - 1] + '/' + a + ' (' + porMes[m] + ')')).join('') + '</optgroup>';
    });
    if (sel !== 'recentes' && sel !== 'todos' && !porMes[sel] && !porAno[sel]) h += op(sel, sel.length === 4 ? 'Ano ' + sel : MESES[+sel.slice(5) - 1] + '/' + sel.slice(0, 4));
    return h + op('todos', 'Todos (' + ganhos.length + ')');
  }

  window.mudarFiltroGanhos = function (v) {
    sel = v || 'recentes';
    try { localStorage.setItem(CHAVE, sel); } catch (e) {}
    render();
  };

  const _render = render;
  render = function () {
    const r = _render.apply(this, arguments);
    const topo = document.querySelector('#kanban .col-ganho .col-topo');
    if (topo && !topo.querySelector('.filtro-ganhos')) {
      const s = document.createElement('select');
      s.className = 'select filtro-ganhos';
      s.title = buscando() ? 'Buscando: aparecem os ganhos de qualquer data' : 'Quais ganhos mostrar nesta coluna';
      s.style.cssText = 'margin-top:6px;padding:4px 6px;font-size:12px;width:100%';
      s.innerHTML = opcoes();
      s.disabled = buscando();
      s.onchange = () => mudarFiltroGanhos(s.value);
      ['mousedown', 'click', 'dragstart'].forEach(ev => s.addEventListener(ev, e => e.stopPropagation()));
      topo.appendChild(s);
    }
    return r;
  };
  if (typeof leads !== 'undefined' && leads.length) render();
})();
