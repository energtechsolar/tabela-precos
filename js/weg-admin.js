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
      descontos: (R.descontos && R.descontos.dados) || { d1: 49, d2: 16 },
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
      <div class="weg-card">Descontos do integrador sobre o preço de lista da WEG (em cascata):
        <input type="number" class="admin-input admin-input-sm" id="weg-d1" step="0.5" min="0" max="90" style="width:70px"> % e depois
        <input type="number" class="admin-input admin-input-sm" id="weg-d2" step="0.5" min="0" max="90" style="width:70px"> %
        <span id="weg-fator" style="color:var(--muted,#8a8a8a);font-size:13px"></span>
        <button class="admin-btn-add" style="margin:0 0 0 6px" onclick="wegSalvarDescontos()">Salvar descontos</button></div>
      <label class="admin-btn-add" style="display:inline-block">📂 Escolher planilha WEG (.xlsx)
        <input type="file" accept=".xlsx,.xlsm" style="display:none" onchange="wegImportarArquivo(this)"></label>
      <div id="weg-previa"></div>
      <div class="admin-msg" id="admin-msg-weg"></div>
      <div class="admin-section-titulo" style="margin-top:18px">Tabela de preços WEG — markup dos kits padrão</div>
      <div class="regiao-aviso" style="margin-bottom:10px">Preço de venda = custo Energtech × (1 + markup). O markup vem do kit padrão com a mesma quantidade de placas (FINAME → tabela Nacional; os outros → Importado); dá para ajustar na linha. Por enquanto só o admin vê esta tabela.</div>
      <div class="weg-card" id="weg-tabela">Grave uma lista WEG para montar a tabela.</div>`;
    document.getElementById('admin-sec-config').after(sec);
  }

  async function mostrarSituacao() {
    const el = document.getElementById('weg-situacao'); if (!el) return;
    try {
      const c = await wegCatalogoDoBanco(true);
      if (!c.linhas.length) { el.innerHTML = 'Nenhuma lista WEG gravada ainda.'; ['weg-d1', 'weg-d2'].forEach((id, i) => { const x = document.getElementById(id); if (x) x.value = i ? c.descontos.d2 : c.descontos.d1; }); return; }
      const quando = c.atualizado_em ? new Date(c.atualizado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
      const d1 = document.getElementById('weg-d1'), d2 = document.getElementById('weg-d2');
      if (d1 && document.activeElement !== d1) d1.value = c.descontos.d1;
      if (d2 && document.activeElement !== d2) d2.value = c.descontos.d2;
      const f = document.getElementById('weg-fator'); if (f) f.textContent = '→ custo = lista × ' + wegFatorDesconto(c).toFixed(4).replace('.', ',');
      renderTabelaWeg(c);
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
    return `<div style="margin-top:6px;color:var(--muted,#8a8a8a);font-size:13px">Kit de referência (10 × BYD 610 + SIW200G M050, cerâmico, Quilombo, CIF Sul): lista ${brl(k.total)} · custo Energtech <b style="color:var(--texto,#e0e0e0)">${brl(k.custo)}</b>`
      + (a ? ` · custo antes ${brl(a.custo)} · <span class="${dif > 0 ? 'sobe' : 'desce'}">${dif >= 0 ? '+' : ''}${brl(dif * k.fatorDesconto)} (${(dif / a.total * 100).toFixed(1).replace('.', ',')}%)</span>` : '') + '</div>';
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
      cat.descontos = antes.descontos;
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

  window.wegSalvarDescontos = async function () {
    const d1 = +document.getElementById('weg-d1').value, d2 = +document.getElementById('weg-d2').value;
    if (!(d1 >= 0 && d1 < 90 && d2 >= 0 && d2 < 90)) { mostrarMsgAdmin('admin-msg-weg', '❌ Descontos inválidos.', false); return; }
    const { error } = await sb.from('fornecedor_regras').upsert({ fornecedor: FORN, chave: 'descontos', dados: { d1, d2 }, atualizado_em: new Date().toISOString() }, { onConflict: 'fornecedor,chave' });
    if (error) { mostrarMsgAdmin('admin-msg-weg', '❌ Não gravou: ' + error.message, false); return; }
    await mostrarSituacao();
    mostrarMsgAdmin('admin-msg-weg', '✅ Descontos gravados.', true);
  };

  // ── tabela de preços WEG (kits padrão de 6, 8, 10 placas...) ──
  const TELHADOS = [['ceramico', 'Cerâmico'], ['fibro_madeira', 'Fibrocimento (madeira)'], ['fibro_metalica', 'Fibrocimento (metálica)'],
    ['metalico', 'Metálico (minitrilho)'], ['metalico_longo', 'Metálico (perfil longo)'], ['laje', 'Laje'], ['zipado', 'Zipado']];
  // linhas: { n, inv (modelo; vazio = sugerido), qtd (inversores), mk (markup; vazio = do kit padrão) }; várias linhas podem ter o mesmo n
  const T = { modulo: '610 Wp - BYD BIFACIAL [FINAME]', placas: '6, 8, 10', telhado: 'ceramico', uf: 'SC', cidade: 'QUILOMBO', linhas: [] };
  try { const g = JSON.parse(localStorage.getItem('weg_tabela') || 'null'); if (g && Array.isArray(g.linhas)) Object.assign(T, g); } catch (_) { /* sem armazenamento */ }
  const guardarT = () => { try { localStorage.setItem('weg_tabela', JSON.stringify(T)); } catch (_) { /* sem armazenamento */ } };
  const numsPlacas = () => [...new Set(String(T.placas).split(/[^0-9]+/).map(Number).filter(n => n > 0 && n <= 60))].sort((a, b) => a - b);
  // o campo Placas manda: cada número tem pelo menos uma linha; linhas de números que saíram do campo somem
  function sincronizarLinhas() {
    const ns = numsPlacas();
    const ficam = T.linhas.filter(l => ns.includes(l.n));
    ns.forEach(n => { if (!ficam.some(l => l.n === n)) ficam.push({ n, inv: '', qtd: 1, mk: null }); });
    T.linhas = ficam.sort((a, b) => a.n - b.n);
  }
  let tecMods = null;
  async function carregarTec() {
    if (tecMods) return tecMods;
    const { data } = await sb.from('modulos_tecnicos').select('*');
    tecMods = {}; (data || []).forEach(m => { tecMods[m.modelo] = m; });
    return tecMods;
  }
  // markup do kit padrão (preço de tabela ÷ custo − 1) com a mesma quantidade de placas; sem igual, o mais próximo
  function padraoPara(nacional, n) {
    const lista = (nacional ? (typeof NACIONAL !== 'undefined' ? NACIONAL : []) : (typeof IMPORTADO !== 'undefined' ? IMPORTADO : []))
      .map(k => ({ k, custo: typeof custoDoKit === 'function' ? custoDoKit(k) : null, mod: +k.mod || 0 }))
      .filter(x => x.custo > 0 && +x.k.inv_r > 0 && x.mod > 0);
    if (!lista.length) return null;
    const dist = x => Math.abs(x.mod - n);
    const melhor = lista.reduce((a, b) => (dist(b) < dist(a) ? b : a));
    return { nome: melhor.k.nome, mod: melhor.mod, inv: melhor.k.inv, custo: melhor.custo, preco: +melhor.k.inv_r, mk: (+melhor.k.inv_r / melhor.custo - 1) * 100, igual: melhor.mod === n };
  }
  const pct = v => (+v).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
  async function renderTabelaWeg(cat) {
    const el = document.getElementById('weg-tabela'); if (!el || !cat || !cat.itens.length) return;
    const tec = await carregarTec().catch(() => ({}));
    const mods = cat.itens.filter(x => /^M[óo]dulo/i.test(x.tipo || '') && +x.dados.Wp > 0);   // fora as baterias
    if (!mods.some(m => m.codigo === T.modulo) && mods[0]) T.modulo = mods[0].codigo;
    const invs = wegInversores(cat).filter(x => !/micro/i.test(x.tipo));
    const finame = /\[FINAME\]/i.test(T.modulo);
    sincronizarLinhas();
    const linhas = T.linhas.map((r, i) => {
      const n = r.n, sug = wegSugerirInversor(cat, T.modulo, n);
      const inv = (r.inv && invs.some(x => x.codigo === r.inv) ? r.inv : '') || (sug && sug.codigo) || (invs[invs.length - 1] || {}).codigo;
      const qtd = Math.max(1, Math.min(4, +r.qtd || 1));
      const k = wegMontarKit(cat, { modulo: T.modulo, n, inversor: inv, qtdInv: qtd, telhado: T.telhado, uf: T.uf, cidade: T.cidade, frete: 'CIF - Sem descarga - Região Sul', tec: tec[T.modulo] });
      const pad = padraoPara(finame, n);
      const mk = r.mk ?? (pad ? Math.round(pad.mk * 10) / 10 : 70);
      const preco = Math.round(k.custo * (1 + mk / 100) * 100) / 100;
      const kwInv = qtd * (+((invs.find(x => x.codigo === inv) || {}).dados || {}).kW || 0);
      return { i, n, inv, qtd, kwInv, sug, k, pad, mk, preco, repete: i > 0 && T.linhas[i - 1].n === n };
    });
    const opt = (v, t, sel) => `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(t)}</option>`;
    el.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px">
        <select class="admin-input" style="width:auto" onchange="wegTab('modulo',this.value)">${mods.map(m => opt(m.codigo, m.codigo, T.modulo)).join('')}</select>
        <select class="admin-input" style="width:auto" onchange="wegTab('telhado',this.value)">${TELHADOS.map(t => opt(t[0], t[1], T.telhado)).join('')}</select>
        <label style="font-size:13px">Placas <input class="admin-input" style="width:110px" value="${esc(T.placas)}" onchange="wegTab('placas',this.value)"></label>
        <label style="font-size:13px">Cidade <input class="admin-input" style="width:140px" value="${esc(T.cidade)}" onchange="wegTab('cidade',this.value)"></label>
        <input class="admin-input" style="width:50px" value="${esc(T.uf)}" maxlength="2" onchange="wegTab('uf',this.value)">
        <span style="font-size:13px;color:var(--muted,#8a8a8a)">Kit ${finame ? '<b style="color:var(--verde,#4ade80)">Nacional (FINAME)</b>' : '<b>Importado</b>'} · frete CIF Sul</span>
      </div>
      <div style="overflow-x:auto"><table>
        <thead><tr><th>Placas</th><th>kWp</th><th>Inversor</th><th>Qtd</th><th class="n">Custo Energtech<div style="font-weight:400;text-transform:none;letter-spacing:0">lista WEG</div></th><th class="n">Markup</th><th class="n">Preço de venda</th><th title="Kit padrão com a mesma quantidade de placas (passe o mouse para ver custo e markup)">Padrão</th><th></th></tr></thead>
        <tbody>${linhas.map(l => `<tr${l.repete ? ' style="background:rgba(255,255,255,.02)"' : ''}>
          <td style="white-space:nowrap">${l.repete ? '<span style="color:var(--muted,#8a8a8a)">↳</span> ' : ''}${l.n}<br><button type="button" class="admin-btn-add" style="margin:2px 0 0;padding:1px 7px" title="Outra opção de inversor para ${l.n} placas" onclick="wegTabVariar(${l.i})">＋</button>${l.repete ? `<button type="button" class="admin-btn-del" style="margin:2px 0 0 3px;padding:1px 7px" title="Tirar esta opção" onclick="wegTabTirar(${l.i})">✕</button>` : ''}</td>
          <td style="white-space:nowrap">${l.k.kwp ? l.k.kwp.toFixed(2).replace('.', ',') : '—'}<div style="font-size:11px;color:var(--muted,#8a8a8a)">inv. ${String(l.kwInv).replace('.', ',')} kW${l.k.ratio ? ' · ' + l.k.ratio.toFixed(2).replace('.', ',') : ''}</div></td>
          <td><select class="admin-input" style="width:auto" onchange="wegTabLinha(${l.i},'inv',this.value)">${invs.map(x => opt(x.codigo, x.codigo.replace(/ W\d+$/, '') + (l.sug && x.codigo === l.sug.codigo ? ' ★' : ''), l.inv)).join('')}</select></td>
          <td><select class="admin-input" style="width:auto" onchange="wegTabLinha(${l.i},'qtd',+this.value)">${[1, 2, 3, 4].map(q => `<option value="${q}"${q === l.qtd ? ' selected' : ''}>${q}×</option>`).join('')}</select></td>
          <td class="n">${l.k.erros.length ? '—' : brl(l.k.custo) + `<div style="font-size:11px;color:var(--muted,#8a8a8a)">${brl(l.k.total)}</div>`}</td>
          <td class="n"><input type="number" class="admin-input" style="width:62px;text-align:right" step="0.5" value="${l.mk}" onchange="wegTabLinha(${l.i},'mk',this.value === '' ? null : +this.value)"> %</td>
          <td class="n"><b>${l.k.erros.length ? '—' : brl(l.preco)}</b>${l.k.erros.length ? '' : `<div style="font-size:11px;color:var(--verde,#4ade80)" title="Preço de venda − custo Energtech (antes de comissão, impostos e instalação)">venda − custo ${brl(l.preco - l.k.custo)}</div>`}</td>
          <td style="font-size:12px;color:var(--muted,#8a8a8a);white-space:nowrap">${l.pad ? `<span title="${esc(l.pad.nome)} · ${l.pad.mod} placas · ${esc(l.pad.inv)}${l.pad.igual ? '' : ' (mais próximo)'} · custo ${brl(l.pad.custo)} · markup ${pct(l.pad.mk)}">${esc(l.pad.nome)} · ${esc(l.pad.inv)}${l.pad.igual ? '' : ' *'}<br><b style="color:var(--texto,#e0e0e0)">${brl(l.pad.preco)}</b></span>` : '—'}</td>
          <td style="white-space:nowrap">${l.k.erros.length ? `<span class="erro" title="${esc(l.k.erros.join('\n'))}">❌</span>` : l.k.avisos.length ? `<span title="${esc(l.k.avisos.join('\n'))}" style="cursor:help">⚠ ${l.k.avisos.length}</span>` : '✓'}</td>
        </tr>`).join('')}</tbody></table></div>
      <div style="font-size:12px;color:var(--muted,#8a8a8a);margin-top:6px">⚠ passe o mouse para ver os avisos (sobrecarga, strings, região de vento). ★ inversor sugerido: o menor SIW200G com até 1,5 × a potência; dá para trocar o modelo e a quantidade na linha. ＋ cria outra opção de inversor para a mesma quantidade de placas (ex.: 8 placas com 3 kW, 5 kW e 7,5 kW). Abaixo do kWp: potência total dos inversores e a relação kWp ÷ inversor.</div>`;
  }
  const redesenhar = () => { guardarT(); wegCatalogoDoBanco().then(renderTabelaWeg); };
  window.wegTab = (campo, v) => { T[campo] = campo === 'uf' || campo === 'cidade' ? String(v).trim().toUpperCase() : v; if (campo === 'modulo') T.linhas.forEach(l => { l.inv = ''; l.mk = null; }); if (campo === 'placas') sincronizarLinhas(); redesenhar(); };
  window.wegTabLinha = (i, campo, v) => { if (T.linhas[i]) T.linhas[i][campo] = v; redesenhar(); };
  window.wegTabVariar = i => { const l = T.linhas[i]; if (l) T.linhas.splice(i + 1, 0, { n: l.n, inv: '', qtd: 1, mk: l.mk }); redesenhar(); };
  window.wegTabTirar = i => { T.linhas.splice(i, 1); redesenhar(); };

  // a aba entra quando o painel admin é aberto (o HTML do painel já existe na página)
  const orig = window.mostrarPainel;
  if (typeof orig === 'function') window.mostrarPainel = function () { const r = orig.apply(this, arguments); montarAba(); return r; };
  montarAba();
})();
