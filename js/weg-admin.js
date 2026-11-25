// Eider Sistemas / CRM — Painel Admin → aba "Tabela WEG": importa a planilha mensal da WEG para o banco.
// Fluxo: escolher o .xlsx → o CRM lê no navegador (nada é enviado antes de conferir) → mostra o que mudou em relação à lista
// gravada (itens novos, que saíram, preços que subiram/baixaram) e um kit de referência → "Gravar" salva no banco.
// Tudo aqui é CUSTO: tabelas fornecedor_catalogo / fornecedor_regras só o admin lê e grava (RLS).
// Também expõe wegCatalogoDoBanco() para o montador de kits e a tabela de preços WEG.
(function () {
  if (typeof sb === 'undefined') return;
  const FORN = 'weg';
  const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  const REF = { modulo: '610 Wp - BYD BIFACIAL [FINAME]', n: 10, inversor: 'SIW200G M050 W1', telhado: 'ceramico', uf: 'SC', cidade: 'QUILOMBO', frete: 'CIF - Sem descarga - Região Sul' };
  const brl = v => (+v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let novo = null;          // planilha lida, ainda não gravada
  let cacheBanco = null;

  // ── banco ⇄ catálogo ──
  // alguns nomes se repetem na planilha (estrutura de solo até/acima de 20 módulos; chave seccionadora CA/CC):
  // no banco a chave ganha um complemento e o nome original fica em dados._nome
  function paraLinhas(cat) {
    const vistos = {};
    return cat.itens.map((it, i) => {
      let chave = it.codigo;
      if (vistos[chave]) chave = it.codigo + ' [' + (it.dados['Módulos'] || it.tipo || i) + ']';
      while (vistos[chave]) chave += '*';
      vistos[chave] = 1;
      return { fornecedor: FORN, codigo: chave, item_sap: it.item_sap, tipo: it.tipo, preco: it.preco,
        dados: Object.assign({}, it.dados, { _nome: it.codigo, _secao: it.secao, _ordem: i }), lista: cat.lista, ativo: true };
    });
  }
  async function lerTudo(tabela, colunas, filtro) {
    const out = [];
    for (let de = 0; ; de += 1000) {
      let q = sb.from(tabela).select(colunas).range(de, de + 999);
      q = filtro(q);
      const { data, error } = await q;
      if (error) throw error;
      out.push(...data);
      if (data.length < 1000) break;
    }
    return out;
  }
  async function wegCatalogoDoBanco(forcar) {
    if (cacheBanco && !forcar) return cacheBanco;
    const linhas = await lerTudo('fornecedor_catalogo', 'codigo,item_sap,tipo,preco,dados,lista,ativo,atualizado_em', q => q.eq('fornecedor', FORN));
    const { data: regras, error } = await sb.from('fornecedor_regras').select('chave,dados,lista,atualizado_em').eq('fornecedor', FORN);
    if (error) throw error;
    const R = {}; (regras || []).forEach(r => { R[r.chave] = r; });
    const ativos = linhas.filter(l => l.ativo).sort((a, b) => ((a.dados || {})._ordem ?? 1e9) - ((b.dados || {})._ordem ?? 1e9));
    cacheBanco = {
      itens: ativos.map(l => { const d = Object.assign({}, l.dados); const nome = d._nome || l.codigo, secao = d._secao || null; delete d._nome; delete d._secao; delete d._ordem;
        return { codigo: nome, chave: l.codigo, tipo: l.tipo, item_sap: l.item_sap, preco: +l.preco, secao, dados: d }; }),
      linhas,
      cidades: (R.cidades && R.cidades.dados) || {},
      frete: (R.frete && R.frete.dados) || {},
      lista: (R.frete && R.frete.lista) || (ativos[0] && ativos[0].lista) || null,
      atualizado_em: (R.frete && R.frete.atualizado_em) || null,
    };
    return cacheBanco;
  }
  window.wegCatalogoDoBanco = wegCatalogoDoBanco;

  function carregarScript(src) {
    return new Promise((ok, erro) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => erro(new Error('Não consegui carregar ' + src)); document.head.appendChild(s); });
  }

  // ── tela ──
  function montarAba() {
    const abas = document.querySelector('#admin-painel-area .admin-tabs');
    if (!abas || document.getElementById('admin-sec-weg')) return;
    const b = document.createElement('button');
    b.className = 'admin-tab'; b.textContent = 'Tabela WEG';
    b.onclick = () => { adminTab('weg', b); mostrarSituacao(); };
    abas.appendChild(b);
    const sec = document.createElement('div');
    sec.className = 'admin-secao'; sec.id = 'admin-sec-weg';
    sec.innerHTML = `
      <style>
        #admin-sec-weg .weg-card { background:var(--card2,#1e1e1e); border:1px solid var(--borda,#2e2e2e); border-radius:10px; padding:12px 14px; margin-bottom:12px; font-size:14px; }
        #admin-sec-weg .weg-num { display:flex; flex-wrap:wrap; gap:8px; margin:8px 0; }
        #admin-sec-weg .weg-num div { background:#151515; border-radius:8px; padding:8px 12px; min-width:110px; }
        #admin-sec-weg .weg-num b { display:block; font-size:20px; }
        #admin-sec-weg .weg-num span { font-size:12px; color:var(--muted,#8a8a8a); }
        #admin-sec-weg table { width:100%; border-collapse:collapse; font-size:13px; }
        #admin-sec-weg td, #admin-sec-weg th { padding:5px 8px; border-bottom:1px solid #262626; text-align:left; }
        #admin-sec-weg td.n { text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums; }
        #admin-sec-weg .sobe { color:#f87171; } #admin-sec-weg .desce { color:var(--verde,#4ade80); }
        #admin-sec-weg details summary { cursor:pointer; color:var(--amarelo,#FFC107); margin:6px 0; }
        #admin-sec-weg .erro { color:#f87171; }
      </style>
      <div class="admin-section-titulo">Tabela de custo WEG (planilha de montagem de kits)</div>
      <div class="regiao-aviso" style="margin-bottom:10px">Todo mês, quando a WEG mandar a planilha nova, escolha o arquivo aqui. Antes de gravar o CRM mostra o que mudou. Só o admin vê estes valores.</div>
      <div class="weg-card" id="weg-situacao">Carregando…</div>
      <label class="admin-btn-add" style="display:inline-block">📂 Escolher planilha WEG (.xlsx)
        <input type="file" accept=".xlsx,.xlsm" style="display:none" onchange="wegImportarArquivo(this)"></label>
      <div id="weg-previa"></div>
      <div class="admin-msg" id="admin-msg-weg"></div>`;
    document.getElementById('admin-sec-config').after(sec);
  }

  async function mostrarSituacao() {
    const el = document.getElementById('weg-situacao'); if (!el) return;
    try {
      const c = await wegCatalogoDoBanco(true);
      if (!c.linhas.length) { el.innerHTML = 'Nenhuma lista WEG gravada ainda.'; return; }
      const quando = c.atualizado_em ? new Date(c.atualizado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
      el.innerHTML = `Lista gravada: <b>${esc(c.lista || '—')}</b> · ${c.itens.length} itens ativos · ${Object.keys(c.cidades).length} cidades · gravada em ${quando}${refHtml(c, null)}`;
    } catch (e) { el.innerHTML = `<span class="erro">Não consegui ler a lista gravada: ${esc(e.message)}</span>`; }
  }

  function refKit(cat) {
    if (!cat || !cat.itens.length || typeof wegMontarKit !== 'function') return null;
    try { const k = wegMontarKit(cat, REF); return k.erros.length ? null : k; } catch (_) { return null; }
  }
  function refHtml(cat, antes) {
    const k = refKit(cat); if (!k) return '';
    const a = antes ? refKit(antes) : null;
    const dif = a ? k.total - a.total : 0;
    return `<div style="margin-top:6px;color:var(--muted,#8a8a8a);font-size:13px">Kit de referência (10 × BYD 610 + SIW200G M050, cerâmico, Quilombo, CIF Sul): <b style="color:var(--texto,#e0e0e0)">${brl(k.total)}</b>`
      + (a ? ` · antes ${brl(a.total)} · <span class="${dif > 0 ? 'sobe' : 'desce'}">${dif >= 0 ? '+' : ''}${brl(dif)} (${(dif / a.total * 100).toFixed(1).replace('.', ',')}%)</span>` : '') + '</div>';
  }

  window.wegImportarArquivo = async function (input) {
    const arq = input.files && input.files[0]; input.value = '';
    const prev = document.getElementById('weg-previa');
    if (!arq) return;
    prev.innerHTML = '<div class="weg-card">Lendo a planilha…</div>';
    try {
      if (typeof XLSX === 'undefined') await carregarScript(XLSX_URL);
      const wb = XLSX.read(await arq.arrayBuffer(), { type: 'array' });
      const cat = wegLerPlanilha(XLSX, wb);
      if (!cat.frete['CIF - Sem descarga - Região Sul']) throw new Error('Não achei o frete "CIF - Sem descarga - Região Sul" na planilha. Confira se é a planilha de montagem de kits.');
      if (Object.keys(cat.cidades).length < 1000) throw new Error('A aba "Cadastro cidades" veio vazia ou incompleta.');
      const antes = await wegCatalogoDoBanco(true);
      novo = { cat, linhas: paraLinhas(cat), antes };
      prev.innerHTML = previaHtml(arq.name);
    } catch (e) {
      novo = null;
      prev.innerHTML = `<div class="weg-card erro">❌ ${esc(e.message)}</div>`;
    }
  };

  function previaHtml(nomeArq) {
    const { cat, linhas, antes } = novo;
    const velho = {}; antes.linhas.forEach(l => { velho[l.codigo] = l; });
    const novos = [], mud = [], iguais = [];
    linhas.forEach(l => {
      const v = velho[l.codigo];
      if (!v || !v.ativo) novos.push(l);
      else if (Math.abs(+v.preco - l.preco) > 0.005) mud.push({ l, antes: +v.preco, dif: l.preco - +v.preco, pct: (l.preco / +v.preco - 1) * 100 });
      else iguais.push(l);
    });
    const codNovos = new Set(linhas.map(l => l.codigo));
    const saem = antes.linhas.filter(l => l.ativo && !codNovos.has(l.codigo));
    novo.saem = saem;
    mud.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
    const principais = mud.filter(m => /M[óo]dulo|Inversor|Micro/i.test(m.l.tipo || ''));
    const linhaMud = m => `<tr><td>${esc(m.l.dados._nome)}<div style="font-size:11px;color:var(--muted,#8a8a8a)">${esc(m.l.tipo || '')}</div></td><td class="n">${brl(m.antes)}</td><td class="n">${brl(m.l.preco)}</td><td class="n ${m.dif > 0 ? 'sobe' : 'desce'}">${m.dif > 0 ? '▲' : '▼'} ${Math.abs(m.pct).toFixed(1).replace('.', ',')}%</td></tr>`;
    const tab = lst => `<table><thead><tr><th>Item</th><th class="n">Antes</th><th class="n">Agora</th><th class="n">Variação</th></tr></thead><tbody>${lst.map(linhaMud).join('')}</tbody></table>`;
    const lista = (arr, f) => `<ul style="margin:4px 0 0 18px;font-size:13px">${arr.slice(0, 200).map(f).join('')}</ul>`;
    const primeira = !antes.linhas.length;
    const mesmaLista = antes.lista && antes.lista === cat.lista;
    return `<div class="weg-card">
      <div>Arquivo: <b>${esc(nomeArq)}</b> · versão <b>${esc(cat.lista || '—')}</b>${mesmaLista ? ' <span class="sobe">(mesma versão da lista gravada)</span>' : ''}</div>
      <div class="weg-num">
        <div><b>${linhas.length}</b><span>itens com preço</span></div>
        <div><b>${primeira ? '—' : novos.length}</b><span>novos</span></div>
        <div><b>${primeira ? '—' : mud.length}</b><span>preço mudou</span></div>
        <div><b>${primeira ? '—' : saem.length}</b><span>saíram da lista</span></div>
        <div><b>${Object.keys(cat.cidades).length}</b><span>cidades</span></div>
        <div><b>${(cat.frete['CIF - Sem descarga - Região Sul'] - 1) * 100 > 0 ? '+' + ((cat.frete['CIF - Sem descarga - Região Sul'] - 1) * 100).toFixed(1).replace('.', ',') + '%' : '—'}</b><span>frete CIF Sul</span></div>
      </div>
      ${refHtml(cat, primeira ? null : antes)}
      ${primeira ? '<div style="margin-top:8px">Primeira importação: ainda não há lista anterior para comparar.</div>' : ''}
      ${principais.length ? `<div style="margin-top:10px;font-weight:700">Módulos e inversores com preço novo</div>${tab(principais)}` : ''}
      ${mud.length > principais.length ? `<details><summary>Todos os ${mud.length} itens com preço novo</summary>${tab(mud)}</details>` : ''}
      ${!primeira && novos.length ? `<details><summary>${novos.length} itens novos</summary>${lista(novos, l => `<li>${esc(l.dados._nome)} — ${brl(l.preco)} <span style="color:var(--muted,#8a8a8a)">${esc(l.tipo || '')}</span></li>`)}</details>` : ''}
      ${saem.length ? `<details><summary>${saem.length} itens que saíram (ficam inativos, o histórico não é apagado)</summary>${lista(saem, l => `<li>${esc((l.dados || {})._nome || l.codigo)}</li>`)}</details>` : ''}
      <button class="admin-salvar" id="weg-gravar" onclick="wegGravar()" style="margin-top:12px">💾 Gravar ${esc(cat.lista || 'lista WEG')}</button>
      <button class="admin-btn-add" onclick="document.getElementById('weg-previa').innerHTML='';" style="margin:8px 0 0">Cancelar</button>
    </div>`;
  }

  window.wegGravar = async function () {
    if (!novo) return;
    const btn = document.getElementById('weg-gravar');
    btn.disabled = true; btn.textContent = 'Gravando…';
    try {
      const agora = new Date().toISOString();
      const linhas = novo.linhas.map(l => Object.assign({}, l, { atualizado_em: agora }));
      for (let i = 0; i < linhas.length; i += 200) {
        const { error } = await sb.from('fornecedor_catalogo').upsert(linhas.slice(i, i + 200), { onConflict: 'fornecedor,codigo' });
        if (error) throw error;
      }
      const saem = (novo.saem || []).map(l => l.codigo);
      for (let i = 0; i < saem.length; i += 100) {
        const { error } = await sb.from('fornecedor_catalogo').update({ ativo: false, atualizado_em: agora }).eq('fornecedor', FORN).in('codigo', saem.slice(i, i + 100));
        if (error) throw error;
      }
      const { error: e2 } = await sb.from('fornecedor_regras').upsert([
        { fornecedor: FORN, chave: 'cidades', dados: novo.cat.cidades, lista: novo.cat.lista, atualizado_em: agora },
        { fornecedor: FORN, chave: 'frete', dados: novo.cat.frete, lista: novo.cat.lista, atualizado_em: agora },
      ], { onConflict: 'fornecedor,chave' });
      if (e2) throw e2;
      const lista = novo.cat.lista;
      novo = null;
      document.getElementById('weg-previa').innerHTML = '';
      await mostrarSituacao();
      mostrarMsgAdmin('admin-msg-weg', '✅ Lista ' + (lista || 'WEG') + ' gravada.', true);
    } catch (e) {
      btn.disabled = false; btn.textContent = '💾 Tentar gravar de novo';
      mostrarMsgAdmin('admin-msg-weg', '❌ Não gravou: ' + (e.message || e), false);
    }
  };

  // a aba entra quando o painel admin é aberto (o HTML do painel já existe na página)
  const orig = window.mostrarPainel;
  if (typeof orig === 'function') window.mostrarPainel = function () { const r = orig.apply(this, arguments); montarAba(); return r; };
  montarAba();
})();
