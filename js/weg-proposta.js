// Eider Sistemas / CRM — Proposta rápida: depois do kit sugerido, mostra lado a lado as opções com a mesma quantidade de placas
// (como no Luvik): os kits da tabela Energtech e o kit WEG montado na hora (lista WEG × descontos × markup do kit padrão).
// "Gerar proposta deste sistema": kit da tabela → segue o fluxo normal; kit WEG → abre o Kit personalizado já preenchido
// (módulos, inversor WEG, estrutura, valor, custo, itens) para conferir e clicar em "Usar este kit na proposta".
// O kit WEG só aparece para o admin: a lista de custo da WEG é protegida no banco (vendedor ainda não lê).
(function () {
  if (typeof mostrarSugestao !== 'function' || typeof wegMontarKit !== 'function') return;
  const brl = v => (+v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const kwBR = v => String(+(+v).toFixed(2)).replace('.', ',');
  const MODULO = { nacional: '610 Wp - BYD BIFACIAL [FINAME]', importado: '615 Wp - WEG BIFACIAL' };
  const TELHADO = { fibrocimento: 'fibro_madeira', ceramico: 'ceramico', metalico: 'metalico', aluzinco: 'metalico', laje: 'laje' };
  const NOME_TELHADO = { fibro_madeira: 'Fibrocimento (madeira)', ceramico: 'Cerâmico', metalico: 'Metálico', laje: 'Laje' };
  const escolha = {};   // inversor escolhido no card WEG, por quantidade de placas + tipo
  let tec = null;

  const st = document.createElement('style');
  st.textContent = `
    .opc-grade { display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:10px; margin-top:12px; }
    .opc-card { background:var(--card2,#1b1b1b); border:1px solid var(--borda,#2e2e2e); border-radius:12px; padding:12px; display:flex; flex-direction:column; gap:4px; font-size:13px; }
    .opc-card.sug { border-color:var(--amarelo,#FFC107); }
    .opc-forn { font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted,#8a8a8a); }
    .opc-forn b { color:var(--texto,#e0e0e0); }
    .opc-nome { font-weight:700; font-size:15px; color:#fff; }
    .opc-preco { font-family:'Barlow Condensed',sans-serif; font-size:24px; font-weight:900; color:var(--amarelo,#FFC107); }
    .opc-det { color:var(--muted,#8a8a8a); line-height:1.45; }
    .opc-card select { background:var(--bg,#111); color:var(--texto,#e0e0e0); border:1px solid var(--borda,#2e2e2e); border-radius:8px; padding:6px; font-size:13px; }
    .opc-card button.usar { margin-top:auto; background:#166534; border:1px solid #166534; color:#fff; font-weight:700; border-radius:10px; padding:10px; cursor:pointer; font-size:14px; }
    .opc-adm { font-size:12px; color:var(--verde,#4ade80); }
    .opc-tit { margin-top:14px; font-weight:700; font-size:14px; }`;
  document.head.appendChild(st);

  function cidadeUf() {
    const t = ((document.getElementById('prop-cidade') || {}).value || '').trim();
    const m = t.match(/^(.*?)[\s/,-]+([A-Za-z]{2})$/);
    return m ? { cidade: m[1].trim(), uf: m[2].toUpperCase() } : { cidade: t || 'QUILOMBO', uf: 'SC' };
  }
  const custoDe = k => (typeof custoDoKit === 'function' ? custoDoKit(k) : null);

  const original = mostrarSugestao;
  mostrarSugestao = function () {
    const r = original.apply(this, arguments);
    desenharOpcoes();
    return r;
  };

  function desenharOpcoes() {
    const s = _sugestao, box = document.getElementById('campo-sug');
    if (!s || !box) return;
    const base = s.ordem[s.pos].it, n = +base.mod || 0;
    const adicional = +document.getElementById('slider-adicional').value, descPct = +document.getElementById('slider-desconto').value;
    const mesmos = s.ordem.map((x, pos) => ({ ...x, pos })).filter(x => +x.it.mod === n && !x.it.personalizado);
    const cards = mesmos.map(x => {
      const c = calcLinha(x.it, adicional, descPct), cu = custoDe(x.it);
      return `<div class="opc-card${x.pos === s.pos ? ' sug' : ''}">
        <div class="opc-forn">Fornecedor: <b>Tabela Energtech</b></div>
        <div class="opc-nome">${escHtml(x.it.nome)} · ${kwBR(x.it.kwp)} kWp</div>
        <div class="opc-det">${x.it.mod} módulos · inversor ${escHtml(x.it.inv)}</div>
        <div class="opc-preco">${fmt(c.valorFinal)}</div>
        ${adminLogado && cu ? `<div class="opc-adm">🔒 custo ${brl(cu)} · markup ${((x.it.inv_r / cu - 1) * 100).toFixed(1).replace('.', ',')}%</div>` : ''}
        <button class="usar" onclick="opcUsarTabela(${x.pos})">Gerar proposta deste sistema</button></div>`;
    });
    let sec = document.getElementById('opc-sec');
    if (!sec) { sec = document.createElement('div'); sec.id = 'opc-sec'; box.appendChild(sec); }
    sec.innerHTML = `<div class="opc-tit">Sistemas com ${n} placas</div><div class="opc-grade">${cards.join('')}<div class="opc-card" id="opc-weg"><div class="opc-forn">Fornecedor: <b>WEG</b></div><div class="opc-det">Montando…</div></div></div>`;
    cardWeg(s, base, n).catch(e => { const el = document.getElementById('opc-weg'); if (el) el.remove(); console.warn('WEG:', e); });
  }

  async function cardWeg(s, base, n) {
    const el = () => document.getElementById('opc-weg');
    if (!adminLogado || typeof wegCatalogoDoBanco !== 'function') { el() && el().remove(); return; }
    const cat = await wegCatalogoDoBanco();
    if (!cat.itens.length) { el() && el().remove(); return; }
    if (!tec) { const { data } = await sb.from('modulos_tecnicos').select('*'); tec = {}; (data || []).forEach(m => { tec[m.modelo] = m; }); }
    const tipo = s.tipo, modulo = MODULO[tipo];
    const estr = (document.getElementById('prop-estrutura') || {}).value || 'fibrocimento';
    const telhado = TELHADO[estr];
    const card = el(); if (!card) return;
    const selTelhado = `<select onchange="opcWegTelhado(this.value)">${[['fibrocimento', 'Fibrocimento'], ['ceramico', 'Cerâmico'], ['metalico', 'Metálico'], ['aluzinco', 'Aluzinco'], ['laje', 'Laje'], ['solo', 'Solo']].map(([v, t]) => `<option value="${v}"${v === estr ? ' selected' : ''}>Telhado: ${t}</option>`).join('')}</select>`;
    if (!telhado) { card.innerHTML = `<div class="opc-forn">Fornecedor: <b>WEG</b></div>${selTelhado}<div class="opc-det">Estrutura de solo ainda não é montada pela lista WEG.</div>`; return; }
    const invs = wegInversores(cat).filter(x => !/micro/i.test(x.tipo));
    const sug = wegSugerirInversor(cat, modulo, n);
    const chave = tipo + n, inv = escolha[chave] || (sug && sug.codigo);
    const { cidade, uf } = cidadeUf();
    const k = wegMontarKit(cat, { modulo, n, inversor: inv, telhado, uf, cidade, frete: 'CIF - Sem descarga - Região Sul', tec: tec[modulo] });
    if (k.erros.length) { card.innerHTML = `<div class="opc-forn">Fornecedor: <b>WEG</b></div><div class="opc-det">❌ ${escHtml(k.erros.join(' '))}</div>`; return; }
    const cu = custoDe(base), mk = cu ? base.inv_r / cu - 1 : 0.7;
    const venda = Math.round(k.custo * (1 + mk) * 100) / 100;
    const invIt = invs.find(x => x.codigo === inv) || {};
    const kwInv = +invIt.dados.kW || 0;
    window._opcWeg = { k, modulo, inv, kwInv, telhado, venda, mk, tipo, n, base, cidade, uf };
    card.innerHTML = `
      <div class="opc-forn">Fornecedor: <b>WEG</b> · ${tipo === 'nacional' ? 'Nacional (FINAME)' : 'Importado'}</div>
      <div class="opc-nome">Kit WEG · ${kwBR(k.kwp)} kWp</div>
      <div class="opc-det">${n} × ${escHtml(modulo.replace(/ - /, ' '))}<br>
        <select onchange="opcWegInv('${chave}',this.value)">${invs.map(x => `<option value="${escHtml(x.codigo)}"${x.codigo === inv ? ' selected' : ''}>${escHtml(x.codigo.replace(/ W\d+$/, ''))} · ${kwBR(x.dados.kW)} kW${sug && x.codigo === sug.codigo ? ' ★' : ''}</option>`).join('')}</select><br>
        ${selTelhado}<br>${escHtml(cidade)}/${escHtml(uf)} (${k.isopleta} m/s) · relação ${kwBR(k.kwp / kwInv)}</div>
      <div class="opc-preco">${brl(venda)}</div>
      <div class="opc-adm">🔒 custo ${brl(k.custo)} · markup ${(mk * 100).toFixed(1).replace('.', ',')}% (do ${escHtml(base.nome)})</div>
      ${k.avisos.length ? `<div class="opc-det" title="${escHtml(k.avisos.join('\n'))}" style="cursor:help">⚠ ${k.avisos.length} aviso(s) — passe o mouse</div>` : ''}
      <button class="usar" onclick="opcUsarWeg()">Gerar proposta deste sistema</button>`;
  }

  window.opcWegInv = (chave, v) => { escolha[chave] = v; desenharOpcoes(); };
  window.opcWegTelhado = v => { const e = document.getElementById('prop-estrutura'); if (e) e.value = v; desenharOpcoes(); };
  window.opcUsarTabela = pos => { if (!_sugestao) return; _sugestao.pos = pos; mostrarSugestao(); usarSugestao(); };
  window.opcUsarWeg = () => {
    const w = window._opcWeg; if (!w) return;
    const marcaMod = /BYD/.test(w.modulo) ? 'BYD' : /LONGI/.test(w.modulo) ? 'LONGI' : /TRINA/.test(w.modulo) ? 'TRINA' : 'WEG';
    const wp = +(w.modulo.match(/^(\d+)/) || [])[1] || 0;
    const modInv = w.inv.replace(/ W\d+$/, '');
    const qtdInv = w.k.qtdInv || 1;
    const estrutura = { fibro_madeira: 'fibrocimento', ceramico: 'ceramico', metalico: 'metalico', laje: 'laje' }[w.telhado];
    const itens = [
      `${w.n} X MÓDULO FOTOVOLTAICO ${wp}W BIFACIAL (${marcaMod})${/FINAME/.test(w.modulo) ? ' — FINAME' : ''}`,
      `${qtdInv} X INVERSOR ${kwBR(w.kwInv)} kW MONOFÁSICO 220V (WEG ${modInv})`,
      `ESTRUTURA PARA TELHADO ${NOME_TELHADO[w.telhado].toUpperCase()} (WEG)`,
      'CABO SOLAR 6 mm² PRETO E VERMELHO',
      'CONECTORES MC4',
      'PROTEÇÃO CA (DPS E DISJUNTOR)',
    ].join('\n');
    const uid = 'kp-weg';
    if (typeof custos === 'object') custos[uid] = w.k.custo;
    const pag = w.tipo === 'nacional' ? 'finame' : 'parcelado';
    abrirKitPersonalizado({
      uid, tipo_sistema: 'ongrid', nome_livre: `Kit WEG ${kwBR(w.k.kwp)} kWp`,
      mod: w.n, potW: wp, marca_mod: marcaMod,
      inv_lista: [{ qtd: qtdInv, kw: kwBR(w.kwInv), marca: 'WEG ' + modInv }],
      estrutura, inv_r: w.venda, origem: w.tipo, pagamento: pag,
      entrada: pag === 'parcelado' ? Math.ceil(w.k.custo / 100) * 100 : 0,
      com_pct: w.base.com_pct != null ? +w.base.com_pct : 0.06, art: true, itens,
    });
  };
})();
