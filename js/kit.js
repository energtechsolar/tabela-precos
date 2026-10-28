// Energtech — kit personalizado: sistema fora da tabela (ex.: 240 módulos de 620 W + inversor de 100 kW)
// On-grid, zero grid, híbrido com baterias ou off-grid. Vira um "kit" só desta proposta: aparece na tabela,
// passa pela régua, pelo PDF, pelo WhatsApp e é salvo no orçamento (dados.kit), sem entrar na tabela de preços.
// (carregado pelo index.html depois de js/app.js)

const TIPOS_SISTEMA = {
  ongrid:   'On-grid (conectado à rede)',
  zerogrid: 'Zero grid (sem injeção na rede)',
  hibrido:  'Híbrido com baterias',
  offgrid:  'Off-grid (isolado da rede)',
};
const ESTRUTURAS_KIT = [['fibrocimento', 'Fibrocimento'], ['ceramico', 'Cerâmico'], ['metalico', 'Metálico'], ['aluzinco', 'Aluzinco'], ['laje', 'Laje'], ['solo', 'Solo']];
let _kitEditando = null;   // kit personalizado aberto no formulário (para revisar/ajustar)

const listaMarcas = k => String(PROPOSTA_CFG[k] || PROPOSTA_PADRAO[k] || '').split('\n').map(t => t.trim()).filter(Boolean);
const numBR = v => { const s = String(v ?? '').trim(); return s ? +s.replace(/\./g, '').replace(',', '.') : NaN; };
const numBRDec = v => +String(v ?? '').trim().replace(',', '.');

function removerKitsPersonalizados() {
  [IMPORTADO, NACIONAL].forEach(l => { for (let i = l.length - 1; i >= 0; i--) if (l[i] && l[i].personalizado) l.splice(i, 1); });
  Object.keys(typeof custos === 'object' ? custos : {}).forEach(uid => { if (String(uid).startsWith('kp-')) delete custos[uid]; });
}
// coloca o kit na lista (importado = boleto / a combinar; nacional = FINAME) e devolve a posição
function colocarKitNaLista(item, tipo) {
  removerKitsPersonalizados();
  const lista = tipo === 'nacional' ? NACIONAL : IMPORTADO;
  lista.push(item);
  return lista.length - 1;
}

function abrirKitPersonalizado(base) {
  const k = base || _kitEditando || {};
  const dl = (id, itens) => `<datalist id="${id}">${itens.map(m => `<option value="${escHtml(m)}">`).join('')}</datalist>`;
  const invs = (k.inv_lista && k.inv_lista.length) ? k.inv_lista : [{ qtd: 1, kw: '', marca: '' }];
  document.getElementById('kit-corpo').innerHTML = `
    ${dl('lista-marcas-mod', listaMarcas('marcas_modulos'))}${dl('lista-marcas-inv', listaMarcas('marcas_inversores'))}
    <div class="kp-grade">
      <div class="kp-campo kp-largo"><label>Tipo de sistema</label>
        <select id="kp-tipo" class="admin-input" onchange="kitMudou()">${Object.entries(TIPOS_SISTEMA).map(([v, t]) => `<option value="${v}" ${v === (k.tipo_sistema || 'ongrid') ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="kp-titulo kp-largo">Módulos</div>
      <div class="kp-campo"><label>Quantidade</label><input id="kp-mod-qtd" class="admin-input" type="number" min="1" value="${k.mod || ''}" placeholder="240" oninput="kitMudou()"></div>
      <div class="kp-campo"><label>Potência de cada (W)</label><input id="kp-mod-w" class="admin-input" type="number" min="1" value="${k.potW || ''}" placeholder="620" oninput="kitMudou()"></div>
      <div class="kp-campo kp-largo"><label>Fabricante</label><input id="kp-mod-marca" class="admin-input" list="lista-marcas-mod" value="${escHtml(k.marca_mod || '')}" placeholder="Escolha ou digite" oninput="kitMudou()"></div>
      <div class="kp-titulo kp-largo">Inversores</div>
      <div class="kp-largo" id="kp-invs">${invs.map(linhaInversor).join('')}</div>
      <div class="kp-largo"><button class="admin-btn-add" style="margin:0" onclick="adicionarInversorKit()">+ Inversor</button></div>
      <div class="kp-titulo kp-largo kp-bat">Baterias</div>
      <div class="kp-campo kp-bat"><label>Quantidade</label><input id="kp-bat-qtd" class="admin-input" type="number" min="0" value="${(k.baterias || {}).qtd || ''}" oninput="kitMudou()"></div>
      <div class="kp-campo kp-bat"><label>Capacidade de cada (kWh)</label><input id="kp-bat-kwh" class="admin-input" inputmode="decimal" value="${(k.baterias || {}).kwh || ''}" oninput="kitMudou()"></div>
      <div class="kp-campo kp-largo kp-bat"><label>Fabricante / modelo</label><input id="kp-bat-marca" class="admin-input" value="${escHtml((k.baterias || {}).marca || '')}" oninput="kitMudou()"></div>
      <div class="kp-titulo kp-largo">Estrutura e valores</div>
      <div class="kp-campo"><label>Estrutura</label><select id="kp-estr" class="admin-input" onchange="kitMudou()">${ESTRUTURAS_KIT.map(([v, t]) => `<option value="${v}" ${v === (k.estrutura || 'fibrocimento') ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="kp-campo"><label>Valor de venda (R$)</label><input id="kp-valor" class="admin-input" inputmode="decimal" value="${k.inv_r ? fmtReais(k.inv_r) : ''}" placeholder="260.000,00" oninput="kitMudou()" onblur="formatarCampoReais(this)"></div>
      <div class="kp-campo"><label>Origem do kit</label><select id="kp-origem" class="admin-input" onchange="kitMudou()">
        <option value="importado" ${origemKit(k) === 'importado' ? 'selected' : ''}>Importado</option>
        <option value="nacional" ${origemKit(k) === 'nacional' ? 'selected' : ''}>Nacional (FINAME)</option></select></div>
      <div class="kp-campo"><label>Formas de pagamento na proposta</label><select id="kp-pag" class="admin-input" onchange="kitMudou()">
        <option value="tabela" ${k.pagamento !== 'combinar' ? 'selected' : ''}>Iguais às da tabela</option>
        <option value="combinar" ${k.pagamento === 'combinar' ? 'selected' : ''}>A combinar</option></select>
        <div class="regiao-aviso" id="kp-pag-dica" style="margin-top:4px"></div></div>
      <div class="kp-campo" id="kp-entrada-box"><label>Entrada no ato do pedido (R$)</label><input id="kp-entrada" class="admin-input" inputmode="decimal" value="${k.entrada ? fmtReais(k.entrada) : ''}" oninput="kitMudou()" onblur="formatarCampoReais(this)"></div>
      <div class="kp-campo"><label>Comissão do vendedor (%)</label><input id="kp-com" class="admin-input" inputmode="decimal" value="${k.com_pct != null ? String(+(k.com_pct * 100).toFixed(2)).replace('.', ',') : '0'}" oninput="kitMudou()"></div>
      ${adminLogado ? `<div class="kp-campo"><label>🔒 Custo do kit HOJE — quanto pagamos ao fornecedor (só admin)</label><input id="kp-custo" class="admin-input" inputmode="decimal" value="${k.uid && custoDoKit(k) != null ? fmtReais(custoDoKit(k)) : ''}" oninput="kitMudou()" onblur="formatarCampoReais(this)"><div class="regiao-aviso" style="margin-top:4px">Não é o valor da proposta. O valor que vai para o cliente e o banco você coloca depois, em "Valor do kit na proposta".</div></div>` : ''}
      <div class="kp-titulo kp-largo">Itens que aparecem na proposta <button class="link-mini" onclick="document.getElementById('kp-itens').dataset.editado='';kitMudou()">↺ gerar de novo</button></div>
      <div class="kp-largo"><textarea id="kp-itens" class="admin-input" rows="7" style="width:100%;resize:vertical" oninput="this.dataset.editado='1'">${escHtml(k.itens || '')}</textarea></div>
      <div class="kp-largo" id="kp-resumo"></div>
    </div>
    <div class="admin-login-erro" id="kp-erro" style="display:none"></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
      <button class="admin-login-btn" style="margin:0;width:auto;padding:10px 18px" onclick="usarKitPersonalizado()">✅ Usar este kit na proposta</button>
      <button class="link-mini" onclick="fecharKitPersonalizado()">Cancelar</button>
    </div>`;
  if (k.itens) document.getElementById('kp-itens').dataset.editado = '1';
  document.getElementById('kit-overlay').classList.add('visivel');
  kitMudou();
}
// origem do kit: importado (à vista, entrada + parcelas e financiamento) ou nacional (à vista e FINAME)
function origemKit(k) { return k.origem || (k.pagamento === 'finame' ? 'nacional' : 'importado'); }
function fecharKitPersonalizado() { document.getElementById('kit-overlay').classList.remove('visivel'); }
function linhaInversor(v) {
  return `<div class="kp-inv" style="display:grid;grid-template-columns:70px 110px 1fr 34px;gap:8px;margin-bottom:6px">
    <input class="admin-input kp-inv-qtd" type="number" min="1" value="${v.qtd || 1}" title="Quantidade" oninput="kitMudou()">
    <input class="admin-input kp-inv-kw" inputmode="decimal" value="${v.kw || ''}" placeholder="kW" title="Potência de cada (kW)" oninput="kitMudou()">
    <input class="admin-input kp-inv-marca" list="lista-marcas-inv" value="${escHtml(v.marca || '')}" placeholder="Fabricante" oninput="kitMudou()">
    <button class="admin-btn-del" title="Remover" onclick="this.parentElement.remove();kitMudou()">✕</button></div>`;
}
function adicionarInversorKit() { document.getElementById('kp-invs').insertAdjacentHTML('beforeend', linhaInversor({ qtd: 1 })); kitMudou(); }

// lê o formulário e monta o kit (sem efeitos colaterais)
function lerKitPersonalizado() {
  const v = id => (document.getElementById(id) || {}).value || '';
  const qtd = Math.round(+v('kp-mod-qtd') || 0), w = Math.round(+v('kp-mod-w') || 0);
  const invs = [...document.querySelectorAll('#kp-invs .kp-inv')].map(r => ({
    qtd: Math.max(1, Math.round(+r.querySelector('.kp-inv-qtd').value || 1)),
    kw: numBRDec(r.querySelector('.kp-inv-kw').value) || 0,
    marca: r.querySelector('.kp-inv-marca').value.trim(),
  })).filter(i => i.kw > 0);
  const tipoSis = v('kp-tipo') || 'ongrid';
  const comBat = tipoSis === 'hibrido' || tipoSis === 'offgrid';
  const bat = comBat ? { qtd: Math.round(+v('kp-bat-qtd') || 0), kwh: numBRDec(v('kp-bat-kwh')) || 0, marca: v('kp-bat-marca').trim() } : null;
  const kwp = Math.round(qtd * w / 10) / 100;
  const kwInv = invs.reduce((s, i) => s + i.qtd * i.kw, 0);
  const fmtKw = n => String(+n.toFixed(2)).replace('.', ',');
  const invTxt = invs.map(i => (i.qtd > 1 ? i.qtd + 'x ' : '') + fmtKw(i.kw) + ' kW').join(' + ') + (invs.length ? (tipoSis === 'hibrido' ? ' híbrido' : tipoSis === 'offgrid' ? ' off-grid' : '') : '');
  const marcasInv = [...new Set(invs.map(i => i.marca).filter(Boolean))];
  const marcaMod = v('kp-mod-marca').trim();
  const estr = v('kp-estr') || 'fibrocimento', estrNome = (ESTRUTURAS_KIT.find(e => e[0] === estr) || [0, estr])[1];
  const itensAuto = [
    qtd && w ? qtd + ' X MÓDULO FOTOVOLTAICO ' + w + 'W' + (marcaMod ? ' (' + marcaMod + ')' : '') : '',
    ...invs.map(i => i.qtd + ' X INVERSOR ' + fmtKw(i.kw) + ' kW' + (tipoSis === 'hibrido' ? ' HÍBRIDO' : tipoSis === 'offgrid' ? ' OFF-GRID' : '') + (i.marca ? ' (' + i.marca + ')' : '')),
    bat && bat.qtd ? bat.qtd + ' X BATERIA ' + fmtKw(bat.kwh) + ' kWh' + (bat.marca ? ' (' + bat.marca + ')' : '') + ' — total ' + fmtKw(bat.qtd * bat.kwh) + ' kWh' : '',
    'ESTRUTURA PARA TELHADO ' + estrNome.toUpperCase(),
    'CABO SOLAR PRETO E VERMELHO',
    'KIT ATERRAMENTO',
    'QUADRO DE PROTEÇÃO CA (DPS E DISJUNTORES)',
    tipoSis === 'zerogrid' ? 'CONTROLE DE EXPORTAÇÃO ZERO (SMART METER / LIMITADOR)' : '',
  ].filter(Boolean).join('\n');
  const origem = v('kp-origem') || 'importado';
  const pag = v('kp-pag') === 'tabela' ? (origem === 'nacional' ? 'finame' : 'parcelado') : 'combinar';
  return {
    personalizado: true, tipo_sistema: tipoSis, estrutura: estr, pagamento: pag, origem,
    nome: 'Kit personalizado ' + fmtKw(kwp) + ' kWp', top: false,
    kwp, mod: qtd, potW: w, inv: invTxt || '—', inv_lista: invs, kw_inversor: kwInv,
    kwh: Math.round(kwp * FATOR_REF), inv_r: lerReais(v('kp-valor')),
    entrada: pag === 'parcelado' ? lerReais(v('kp-entrada')) : 0,
    com_pct: Math.max(0, numBRDec(v('kp-com')) || 0) / 100,
    marca_mod: marcaMod, marca_inv: marcasInv.join(' / '), baterias: bat,
    itensAuto, custo: document.getElementById('kp-custo') ? lerReais(v('kp-custo')) : null,
  };
}
function kitMudou() {
  const k = lerKitPersonalizado();
  const comBat = k.tipo_sistema === 'hibrido' || k.tipo_sistema === 'offgrid';
  document.querySelectorAll('#kit-corpo .kp-bat').forEach(el => el.style.display = comBat ? '' : 'none');
  document.getElementById('kp-entrada-box').style.display = k.pagamento === 'parcelado' ? '' : 'none';
  const dica = document.getElementById('kp-pag-dica');
  if (dica) dica.textContent = k.pagamento === 'parcelado' ? 'A proposta mostra: à vista, entrada + parcelas no boleto e o financiamento (se estiver ativo), como nos kits importados.'
    : k.pagamento === 'finame' ? 'A proposta mostra: à vista e FINAME (96x e 120x), como nos kits nacionais.'
    : 'A proposta mostra só o valor, com "condições a combinar".';
  const it = document.getElementById('kp-itens');
  if (!it.dataset.editado) it.value = k.itensAuto;
  const avisos = [];
  if (k.kwp && k.kw_inversor) {
    const r = k.kwp / k.kw_inversor;
    avisos.push(`Relação módulos ÷ inversores: <b>${r.toFixed(2).replace('.', ',')}</b>` + (r > 1.35 ? ' — <span style="color:var(--amarelo)">⚠ alta: o inversor vai cortar geração nos horários de pico (clipping). O usual fica entre 1,20 e 1,35.</span>' : r < 1.0 ? ' — <span style="color:var(--amarelo)">⚠ inversor sobrando para a potência dos módulos.</span>' : ' — ok'));
  }
  if (k.kw_inversor > 75 && k.tipo_sistema !== 'offgrid') avisos.push('<span style="color:var(--amarelo)">⚠ Acima de 75 kW: minigeração. Conexão normalmente em média tensão, com projeto e prazos de acesso próprios na distribuidora — confira prazo e escopo da proposta.</span>');
  if (k.tipo_sistema === 'zerogrid') avisos.push('Zero grid: não injeta energia na rede, então não gera créditos. A economia real depende do consumo no horário de sol — confira a economia que vai na proposta.');
  if (k.tipo_sistema === 'hibrido' && !(k.baterias && k.baterias.qtd)) avisos.push('<span style="color:var(--amarelo)">⚠ Sistema híbrido sem baterias informadas.</span>');
  const ger = Math.round(k.kwp * fatorRegiao());
  document.getElementById('kp-resumo').innerHTML = `<div style="background:var(--bg);border:1px solid var(--borda);border-radius:10px;padding:10px 12px;font-size:13px;line-height:1.6">
    <b>${k.kwp ? String(k.kwp).replace('.', ',') + ' kWp' : '—'}</b> · inversores ${k.kw_inversor ? String(+k.kw_inversor.toFixed(2)).replace('.', ',') + ' kW' : '—'} · geração estimada ~${ger.toLocaleString('pt-BR')} kWh/mês (${regiaoSel().nome.split(' (')[0]} ${regiaoSel().uf}, telhado ao norte)
    ${k.inv_r ? ' · ' + fmt(k.inv_r) + (k.kwp ? ' (' + fmt(k.inv_r / (k.kwp * 1000)) + ' por Wp)' : '') : ''}
    ${k.custo ? ' · <span style="color:var(--verde)">🔒 venda − custo: ' + fmt(k.inv_r - k.custo) + '</span>' : ''}
    ${avisos.length ? '<br>' + avisos.join('<br>') : ''}</div>`;
}
function usarKitPersonalizado() {
  const k = lerKitPersonalizado(), erro = document.getElementById('kp-erro');
  const falta = !(k.mod > 0 && k.potW > 0) ? 'Informe a quantidade e a potência dos módulos.'
    : !(k.kw_inversor > 0) ? 'Informe ao menos um inversor com a potência em kW.'
    : !(k.inv_r > 0) ? 'Informe o valor de venda.'
    : k.pagamento === 'parcelado' && !(k.entrada >= 0 && k.entrada < k.inv_r) ? 'A entrada precisa ser menor que o valor de venda.' : '';
  if (falta) { erro.textContent = falta; erro.style.display = 'block'; return; }
  erro.style.display = 'none';
  const item = { ...k, uid: 'kp-' + Date.now().toString(36), itens: document.getElementById('kp-itens').value.trim() || k.itensAuto };
  delete item.itensAuto; delete item.custo;
  const tipo = k.origem === 'nacional' ? 'nacional' : 'importado';
  const idx = colocarKitNaLista(item, tipo);
  if (k.custo && typeof custos === 'object') custos[item.uid] = k.custo;   // só na tela do admin (não vai para a tabela de custos)
  _kitEditando = item;
  fecharKitPersonalizado();
  document.getElementById('slider-adicional').value = 0; document.getElementById('slider-desconto').value = 0;
  trocarAbaPorNome(tipo);
  alternarTabela(true);
  selecionarLinha(tipo, idx, item);
  const est = document.getElementById('prop-estrutura'); if (est) est.value = k.estrutura;
  const av = document.getElementById('aviso-crm');
  if (av) { av.textContent = '🧩 ' + item.nome + ' (' + TIPOS_SISTEMA[k.tipo_sistema] + ') pronto. Preencha o cliente abaixo e clique em "Criar Orçamento". Para ajustar o kit, clique de novo em "Kit personalizado".'; av.style.display = 'block'; av.style.borderColor = '#60a5fa'; }
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') { const o = document.getElementById('kit-overlay'); if (o && o.classList.contains('visivel')) fecharKitPersonalizado(); } });
