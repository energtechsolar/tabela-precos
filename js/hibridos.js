// Eider Sistemas / CRM — kits HÍBRIDOS (com baterias)
//  • Painel Admin → aba "Híbridos": cadastro dos kits (fica em config id='hibrido'; o custo vai para kit_custos, só admin)
//  • Precificador → botão "🔋 Híbridos": lista os kits com preço; "Gerar proposta deste sistema" coloca o kit na tabela
//    como sistema híbrido (mesmo caminho do Kit personalizado): PDF "híbrido com baterias", pagamento igual ao Importado,
//    salvo como proposta importada com o kit marcado como híbrido.
(function () {
  if (typeof sb === 'undefined' || !sb || typeof colocarKitNaLista !== 'function') return;
  const R = v => (+v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const kwBR = v => String(+(+v || 0).toFixed(2)).replace('.', ',');
  const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = v => { const s = String(v ?? '').trim(); return s ? +s.replace(/\./g, '').replace(',', '.') : 0; };
  const novoId = () => 'hb' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  let HB = [], uidsSalvos = [];
  const kwpDe = k => Math.round((+k.mod || 0) * (+k.potW || 0) / 10) / 100;
  const geracaoDe = k => +k.kwh > 0 ? +k.kwh : Math.round(kwpDe(k) * (typeof FATOR_REF !== 'undefined' ? FATOR_REF : 106.6));
  const armazen = k => (+k.bat_qtd || 0) * (+k.bat_kwh || 0);

  async function carregar() {
    const { data, error } = await sb.from('config').select('dados').eq('id', 'hibrido').maybeSingle();
    if (!error && data && Array.isArray(data.dados)) HB = JSON.parse(JSON.stringify(data.dados));
    else { try { const c = JSON.parse(localStorage.getItem('etg_config') || '[]'); const l = (c || []).find(x => x.id === 'hibrido'); HB = l && Array.isArray(l.dados) ? l.dados : []; } catch (_) { HB = []; } }
    uidsSalvos = HB.map(k => k.uid);
    return HB;
  }

  // ── estilos ──
  const st = document.createElement('style');
  st.textContent = `
    .hb-card { background:var(--card2,#1e1e1e); border:1px solid var(--borda,#2e2e2e); border-radius:12px; padding:12px 14px; margin-bottom:12px; }
    .hb-grade { display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:8px; }
    .hb-grade label { font-size:11px; color:var(--muted,#8a8a8a); display:block; }
    .hb-grade .admin-input { width:100%; box-sizing:border-box; }
    .hb-tit { font-size:12px; font-weight:700; color:var(--amarelo,#FFC107); margin:10px 0 4px; letter-spacing:.05em; text-transform:uppercase; }
    .hb-resumo { font-size:13px; color:var(--muted,#8a8a8a); margin-top:8px; }
    .hb-lista { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:10px; }
    .hb-opc { background:var(--card2,#1b1b1b); border:1px solid var(--borda,#2e2e2e); border-radius:12px; padding:12px; display:flex; flex-direction:column; gap:4px; font-size:13px; }
    .hb-opc .nome { font-weight:700; font-size:15px; color:#fff; }
    .hb-opc .det { color:var(--muted,#8a8a8a); line-height:1.45; }
    .hb-opc .preco { font-family:'Barlow Condensed',sans-serif; font-size:24px; font-weight:900; color:var(--amarelo,#FFC107); }
    .hb-opc button { margin-top:auto; background:#166534; border:1px solid #166534; color:#fff; font-weight:700; border-radius:10px; padding:10px; cursor:pointer; font-size:14px; }`;
  document.head.appendChild(st);

  // ════════ PAINEL ADMIN: aba Híbridos ════════
  function montarAba() {
    const abas = document.querySelector('#admin-painel-area .admin-tabs');
    if (!abas || document.getElementById('admin-sec-hibrido')) return;
    const b = document.createElement('button');
    b.className = 'admin-tab'; b.textContent = 'Híbridos';
    b.onclick = async () => { adminTab('hibrido', b); await carregar(); renderAdmin(); };
    const weg = [...abas.children].find(x => x.textContent.trim() === 'Tabela WEG');
    weg ? weg.after(b) : abas.appendChild(b);
    const sec = document.createElement('div');
    sec.className = 'admin-secao'; sec.id = 'admin-sec-hibrido';
    sec.innerHTML = `<div class="admin-section-titulo">Sistemas — Kits Híbridos (com baterias)</div>
      <div class="regiao-aviso" style="margin-bottom:10px">Os kits aparecem no botão "🔋 Híbridos" do precificador. A proposta sai como "Sistema fotovoltaico híbrido com baterias", com as mesmas formas de pagamento do Importado. O custo só o admin vê.</div>
      <div id="hb-admin"></div>
      <button class="admin-btn-add" onclick="hbNovo()">+ Adicionar kit híbrido</button>
      <button class="admin-salvar" onclick="hbSalvar()">💾 Salvar kits híbridos</button>
      <div class="admin-msg" id="admin-msg-hb"></div>`;
    (document.getElementById('admin-sec-weg') || document.getElementById('admin-sec-config')).after(sec);
  }
  const mostrar = (v, tipo) => tipo === 'n' ? (+v ? String(v).replace('.', ',') : '') : (v ?? '');
  const campo = (i, k, rot, tipo, extra) => `<div><label>${rot}</label><input class="admin-input" ${tipo === 'n' ? 'inputmode="decimal"' : ''} value="${esc(mostrar(HB[i][k], tipo))}" oninput="hbCampo(${i},'${k}',this.value,'${tipo || ''}')" ${extra || ''}></div>`;
  function resumoKit(k) {
    const custo = typeof custoDoKit === 'function' ? custoDoKit(k) : null, kwp = kwpDe(k);
    return `${kwp ? kwBR(kwp) + ' kWp' : '—'} · inversor ${k.inv_kw ? kwBR(k.inv_kw) + ' kW' : '—'}${kwp && +k.inv_kw ? ' (relação ' + kwBR(kwp / k.inv_kw) + ')' : ''} · armazenamento ${armazen(k) ? kwBR(armazen(k)) + ' kWh' : '—'} · geração ~${geracaoDe(k).toLocaleString('pt-BR')} kWh/mês`
      + (custo && +k.inv_r ? ` · <span style="color:var(--verde,#4ade80)">🔒 markup ${((k.inv_r / custo - 1) * 100).toFixed(1).replace('.', ',')}% · venda − custo ${R(k.inv_r - custo)}</span>` : '');
  }
  function renderAdmin() {
    const el = document.getElementById('hb-admin'); if (!el) return;
    if (!HB.length) { el.innerHTML = '<div class="hb-card">Nenhum kit híbrido cadastrado.</div>'; return; }
    el.innerHTML = HB.map((k, i) => `<div class="hb-card">
      <div style="display:flex;gap:8px;align-items:center"><input class="admin-input" style="flex:1;font-weight:700" value="${esc(k.nome || '')}" placeholder="Nome do kit (ex.: Híbrido 5 kW + 10 kWh)" oninput="hbCampo(${i},'nome',this.value)">
        <button class="admin-btn-del" onclick="hbRemover(${i})">Remover</button></div>
      <div class="hb-tit">Módulos</div><div class="hb-grade">${campo(i, 'mod', 'Quantidade', 'n')}${campo(i, 'potW', 'Potência de cada (W)', 'n')}${campo(i, 'marca_mod', 'Marca')}</div>
      <div class="hb-tit">Inversor híbrido</div><div class="hb-grade">${campo(i, 'inv_kw', 'Potência (kW)', 'n')}
        <div><label>Ligação</label><select class="admin-input" onchange="hbCampo(${i},'inv_fases',this.value)"><option value="mono" ${k.inv_fases !== 'tri' ? 'selected' : ''}>Monofásico</option><option value="tri" ${k.inv_fases === 'tri' ? 'selected' : ''}>Trifásico</option></select></div>${campo(i, 'marca_inv', 'Marca / modelo')}</div>
      <div class="hb-tit">Baterias</div><div class="hb-grade">${campo(i, 'bat_qtd', 'Quantidade', 'n')}${campo(i, 'bat_kwh', 'kWh de cada', 'n')}${campo(i, 'marca_bat', 'Marca / modelo')}</div>
      <div class="hb-tit">Valores</div><div class="hb-grade">${campo(i, 'kwh', 'Geração kWh/mês (vazio = automático)', 'n')}
        ${typeof adminLogado !== 'undefined' && adminLogado ? `<div><label>🔒 Custo do kit</label><input class="admin-input" inputmode="decimal" value="${typeof custoDoKit === 'function' && custoDoKit(k) != null ? String(custoDoKit(k)).replace('.', ',') : ''}" oninput="hbCusto(${i},this.value)"></div>` : ''}
        ${campo(i, 'inv_r', 'Preço de venda (R$)', 'n')}${campo(i, 'entrada', 'Entrada da tabela (R$)', 'n')}
        <div><label>Comissão (%)</label><input class="admin-input" inputmode="decimal" value="${k.com_pct != null ? String(+(k.com_pct * 100).toFixed(2)).replace('.', ',') : '6'}" oninput="hbCampo(${i},'com_pct',this.value,'pct')"></div></div>
      <div class="hb-resumo" id="hb-res-${i}">${resumoKit(k)}</div></div>`).join('');
  }
  window.hbCampo = (i, k, v, tipo) => {
    if (!HB[i]) return;
    HB[i][k] = tipo === 'n' ? num(v) : tipo === 'pct' ? num(v) / 100 : v;
    const r = document.getElementById('hb-res-' + i); if (r) r.innerHTML = resumoKit(HB[i]);
  };
  window.hbCusto = (i, v) => { if (!HB[i] || typeof definirCusto !== 'function') return; definirCusto(HB[i], 'hibrido', String(v).trim() === '' ? '' : num(v)); const r = document.getElementById('hb-res-' + i); if (r) r.innerHTML = resumoKit(HB[i]); };
  window.hbNovo = () => { HB.push({ uid: novoId(), nome: '', mod: 0, potW: 0, marca_mod: '', inv_kw: 0, inv_fases: 'mono', marca_inv: '', bat_qtd: 0, bat_kwh: 0, marca_bat: '', kwh: 0, inv_r: 0, entrada: 0, com_pct: 0.06 }); renderAdmin(); };
  window.hbRemover = i => { if (!confirm('Remover o kit "' + (HB[i].nome || 'sem nome') + '"? (só some depois de Salvar)')) return; HB.splice(i, 1); renderAdmin(); };
  window.hbSalvar = async () => {
    const ruim = HB.find(k => !String(k.nome || '').trim() || !(+k.mod > 0) || !(+k.potW > 0) || !(+k.inv_kw > 0) || !(+k.inv_r > 0));
    if (ruim) { mostrarMsgAdmin('admin-msg-hb', '❌ Preencha nome, módulos, potência, inversor e preço de venda de todos os kits.', false); return; }
    const agora = new Date().toISOString();
    const dados = HB.map(k => ({ ...k, kwp: kwpDe(k) }));
    const { error } = await sb.from('config').upsert({ id: 'hibrido', dados, atualizado_em: agora }, { onConflict: 'id' });
    if (error) { mostrarMsgAdmin('admin-msg-hb', '❌ Não gravou: ' + error.message, false); return; }
    if (typeof adminLogado !== 'undefined' && adminLogado && typeof custos === 'object') {
      const linhas = HB.filter(k => custos[k.uid] != null && isFinite(custos[k.uid])).map(k => ({ kit_uid: k.uid, tipo: 'hibrido', custo: custos[k.uid], atualizado_em: agora }));
      if (linhas.length) { const r = await sb.from('kit_custos').upsert(linhas, { onConflict: 'kit_uid' }); if (r.error) { mostrarMsgAdmin('admin-msg-hb', '⚠ Kits salvos, mas o custo não: ' + r.error.message, false); return; } }
      const sairam = uidsSalvos.filter(u => !HB.some(k => k.uid === u) || custos[u] == null);
      if (sairam.length) await sb.from('kit_custos').delete().in('kit_uid', sairam);
    }
    uidsSalvos = HB.map(k => k.uid);
    mostrarMsgAdmin('admin-msg-hb', '✅ ' + HB.length + ' kit(s) híbrido(s) salvo(s).', true);
  };
  const _painel = window.mostrarPainel;
  if (typeof _painel === 'function') window.mostrarPainel = function () { const r = _painel.apply(this, arguments); montarAba(); return r; };
  montarAba();

  // ════════ PRECIFICADOR: botão 🔋 Híbridos ════════
  const btnPers = document.getElementById('btn-kit-pers');
  if (btnPers && !document.getElementById('btn-hibridos')) {
    const b = document.createElement('button');
    b.className = 'btn-tabela'; b.id = 'btn-hibridos'; b.textContent = '🔋 Híbridos';
    b.onclick = () => abrirHibridos();
    btnPers.after(b);
  }
  const ov = document.createElement('div');
  ov.className = 'admin-overlay'; ov.id = 'hb-overlay'; ov.style.zIndex = '1100';
  ov.onclick = e => { if (e.target === ov) ov.classList.remove('visivel'); };
  ov.innerHTML = `<div class="admin-modal" style="max-width:860px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div class="admin-login-titulo" style="margin:0">🔋 Sistemas híbridos (com baterias)</div><button class="admin-close" onclick="document.getElementById('hb-overlay').classList.remove('visivel')">✕</button></div>
    <div class="regiao-aviso" style="margin-bottom:10px">Escolha o kit. A proposta sai como sistema híbrido com baterias, com as formas de pagamento do Importado (pelo perfil do cliente).</div>
    <div id="hb-lista" class="hb-lista">Carregando…</div></div>`;
  document.body.appendChild(ov);

  async function abrirHibridos() {
    ov.classList.add('visivel');
    const el = document.getElementById('hb-lista');
    el.textContent = 'Carregando…';
    await carregar();
    if (!HB.length) { el.innerHTML = '<div class="regiao-aviso">Nenhum kit híbrido cadastrado. O admin cadastra no Painel Admin → aba Híbridos.</div>'; return; }
    el.innerHTML = HB.map((k, i) => {
      const custo = typeof adminLogado !== 'undefined' && adminLogado && typeof custoDoKit === 'function' ? custoDoKit(k) : null;
      return `<div class="hb-opc"><div class="nome">${esc(k.nome)}</div>
        <div class="det">${k.mod} módulos de ${k.potW} W${k.marca_mod ? ' (' + esc(k.marca_mod) + ')' : ''} · ${kwBR(kwpDe(k))} kWp<br>
          Inversor híbrido ${kwBR(k.inv_kw)} kW ${k.inv_fases === 'tri' ? 'trifásico' : 'monofásico'}${k.marca_inv ? ' (' + esc(k.marca_inv) + ')' : ''}<br>
          ${+k.bat_qtd ? k.bat_qtd + ' bateria(s) de ' + kwBR(k.bat_kwh) + ' kWh = <b>' + kwBR(armazen(k)) + ' kWh</b>' : 'sem baterias informadas'}${k.marca_bat ? ' (' + esc(k.marca_bat) + ')' : ''}<br>
          Geração ~${geracaoDe(k).toLocaleString('pt-BR')} kWh/mês</div>
        <div class="preco">${R(k.inv_r)}</div>
        ${custo ? `<div style="font-size:12px;color:var(--verde,#4ade80)">🔒 custo ${R(custo)} · venda − custo ${R(k.inv_r - custo)}</div>` : ''}
        <button onclick="hbUsar(${i})">Gerar proposta deste sistema</button></div>`;
    }).join('');
  }
  window.abrirHibridos = abrirHibridos;

  window.hbUsar = i => {
    const k = HB[i]; if (!k) return;
    const estr = (document.getElementById('prop-estrutura') || {}).value || 'fibrocimento';
    const estrNome = (typeof ESTRUTURAS_KIT !== 'undefined' && (ESTRUTURAS_KIT.find(e => e[0] === estr) || [])[1]) || estr;
    const fases = k.inv_fases === 'tri' ? 'TRIFÁSICO' : 'MONOFÁSICO';
    const itens = [
      `${k.mod} X MÓDULO FOTOVOLTAICO ${k.potW}W${k.marca_mod ? ' (' + k.marca_mod + ')' : ''}`,
      `1 X INVERSOR HÍBRIDO ${kwBR(k.inv_kw)} kW ${fases}${k.marca_inv ? ' (' + k.marca_inv + ')' : ''}`,
      +k.bat_qtd ? `${k.bat_qtd} X BATERIA ${kwBR(k.bat_kwh)} kWh${k.marca_bat ? ' (' + k.marca_bat + ')' : ''} — total ${kwBR(armazen(k))} kWh` : '',
      'ESTRUTURA PARA TELHADO ' + String(estrNome).toUpperCase(),
      'CABO SOLAR PRETO E VERMELHO',
      'KIT ATERRAMENTO',
      'QUADRO DE PROTEÇÃO CA (DPS E DISJUNTORES)',
    ].filter(Boolean).join('\n');
    const item = {
      uid: 'kp-' + k.uid, personalizado: true, tipo_sistema: 'hibrido', origem: 'importado', pagamento: 'parcelado',
      nome: k.nome, top: false, kwp: kwpDe(k), mod: +k.mod, potW: +k.potW,
      inv: kwBR(k.inv_kw) + ' kW híbrido', inv_lista: [{ qtd: 1, kw: +k.inv_kw, marca: k.marca_inv || '' }], kw_inversor: +k.inv_kw,
      kwh: geracaoDe(k), inv_r: +k.inv_r, entrada: +k.entrada || 0, com_pct: k.com_pct != null ? +k.com_pct : 0.06,
      marca_mod: k.marca_mod || '', marca_inv: k.marca_inv || '', baterias: { qtd: +k.bat_qtd || 0, kwh: +k.bat_kwh || 0, marca: k.marca_bat || '' },
      estrutura: estr, art: true, simples: false, itens, hibrido_tabela: k.uid,
    };
    const idx = colocarKitNaLista(item, 'importado');
    const custo = typeof adminLogado !== 'undefined' && adminLogado && typeof custoDoKit === 'function' ? custoDoKit(k) : null;
    if (custo != null && typeof custos === 'object') custos[item.uid] = custo;
    if (typeof _kitEditando !== 'undefined') _kitEditando = item;
    ov.classList.remove('visivel');
    document.getElementById('slider-adicional').value = 0; document.getElementById('slider-desconto').value = 0;
    trocarAbaPorNome('importado');
    if (typeof alternarTabela === 'function') alternarTabela(true);
    selecionarLinha('importado', idx, item);
    const est = document.getElementById('prop-estrutura'); if (est) est.value = estr;
    const av = document.getElementById('aviso-crm');
    if (av) { av.textContent = '🔋 ' + item.nome + ' (híbrido com baterias) pronto. Preencha o cliente abaixo e clique em "Criar Orçamento".'; av.style.display = 'block'; av.style.borderColor = '#60a5fa'; }
  };
})();
