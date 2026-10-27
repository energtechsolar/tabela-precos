// Energtech — precificador: tabela, cálculos, regiões
// (arquivo carregado pelo index.html; a ordem dos <script> importa)

// ── DADOS ──────────────────────────────────────────────────────────────────
// Os preços NÃO ficam no código (o site é público): vêm do Supabase, só para usuários logados.
let IMPORTADO = [];
let NACIONAL = [];

// ── CONFIGURAÇÕES (ajustáveis) — valores de reserva; os oficiais vêm do Supabase ──────────────────────────────────────────────
const CFG = {
  desconto_livre: 3,
  desconto_max: 7,
  split_adicional: 0.50,
  split_desconto_extra: 0.50,
};

let abaAtual = 'importado';
let linhaFoco = null;
let finAnos = 8; // linha de financiamento selecionada

// ── FORMATAÇÃO ──────────────────────────────────────────────────────────────
function fmt(v) {
  return 'R$ ' + v.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
}
function fmtShort(v) {
  return 'R$ ' + Math.round(v).toLocaleString('pt-BR');
}

// ── CÁLCULO PARCELA FINANCIAMENTO ───────────────────────────────────────────
function calcParcelaMensal(valorFinanciado, anos) {
  if (anos === 8) {
    // Juros zero: divide igualmente em 96 meses
    return valorFinanciado / 96;
  } else {
    // 10 anos, 3% a.a. → taxa mensal = (1.03)^(1/12) - 1
    const n = 120;
    const i = Math.pow(1.03, 1/12) - 1;
    return valorFinanciado * (i * Math.pow(1+i, n)) / (Math.pow(1+i, n) - 1);
  }
}

// ── PARCELAMENTO NO BOLETO (kits importados) ────────────────────────────────
// Entrada (fixa por kit) + N parcelas mensais fixas. Juros em % ao mês, tabela Price (parcela fixa, como banco).
// O admin define: até quantas parcelas pode ser sem juros, o juro mínimo acima disso e o máximo de parcelas.
// O vendedor escolhe as parcelas (até o máximo dele) e pode subir a taxa, nunca abaixo do mínimo. O admin pode tudo.
const BOLETO_PADRAO = { padrao: 10, sem_juros_ate: 10, juros_min: 0, max_vendedor: 12, max_admin: 36 };
let BOLETO_CFG = { ...BOLETO_PADRAO };
function aplicarBoletoCfg(b) {
  BOLETO_CFG = { ...BOLETO_PADRAO };
  if (b && typeof b === 'object') Object.keys(BOLETO_PADRAO).forEach(k => { if (b[k] !== null && b[k] !== '' && isFinite(+b[k]) && +b[k] >= 0) BOLETO_CFG[k] = +b[k]; });
  montarSelectParcelas(true);
  // volta para a condição padrão (parcelas padrão com o juro mínimo delas)
  const sel = document.getElementById('bol-parcelas'), inp = document.getElementById('bol-juros');
  if (sel) sel.value = String(Math.min(Math.max(1, Math.round(BOLETO_CFG.padrao)), sel.options.length));
  if (inp) inp.value = fmtPct(jurosMinimo(+(sel && sel.value) || BOLETO_CFG.padrao));
}
const ehAdminBoleto = () => typeof perfil !== 'undefined' && !!perfil && !!perfil.admin;
const maxParcelas = () => Math.max(1, Math.round(ehAdminBoleto() ? Math.max(BOLETO_CFG.max_admin, BOLETO_CFG.max_vendedor) : BOLETO_CFG.max_vendedor));
const jurosMinimo = n => n <= BOLETO_CFG.sem_juros_ate ? 0 : BOLETO_CFG.juros_min;
const fmtPct = v => (+v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
function parcelaPrice(saldo, n, jurosPct) {
  n = Math.max(1, Math.round(+n || 1)); const i = (+jurosPct || 0) / 100;
  if (!(saldo > 0)) return 0;
  return i > 0 ? saldo * i / (1 - Math.pow(1 + i, -n)) : saldo / n;
}
// condição escolhida na tela (respeitando o máximo e o juro mínimo de quem está logado)
function boletoEscolhido() {
  const sel = document.getElementById('bol-parcelas'), inp = document.getElementById('bol-juros');
  let n = Math.round(+(sel && sel.value) || BOLETO_CFG.padrao);
  n = Math.min(Math.max(1, n), Math.max(maxParcelas(), n > maxParcelas() && sel && sel.dataset.extra === String(n) ? n : 0));
  let j = inp && inp.value.trim() !== '' ? Math.max(0, +String(inp.value).replace(',', '.') || 0) : jurosMinimo(n);
  if (!ehAdminBoleto()) j = Math.max(j, jurosMinimo(n));
  return { n, juros: Math.round(j * 100) / 100 };
}
function calcBoleto(saldo, b) {
  b = b || boletoEscolhido();
  const parcela = parcelaPrice(saldo, b.n, b.juros);
  return { n: b.n, juros: b.juros, parcela, totalParcelas: parcela * b.n, jurosReais: Math.max(0, parcela * b.n - Math.max(0, saldo)) };
}
function montarSelectParcelas(forcar) {
  const sel = document.getElementById('bol-parcelas'); if (!sel) return;
  const max = maxParcelas();
  if (!forcar && sel.options.length === max && !sel.dataset.extra) return;
  const atual = +sel.value || BOLETO_CFG.padrao;
  let h = ''; for (let n = 1; n <= max; n++) h += `<option value="${n}">${n}x</option>`;
  sel.innerHTML = h; delete sel.dataset.extra;
  sel.value = String(Math.min(Math.max(1, atual), max));
}
// usado ao revisar uma proposta salva com mais parcelas do que o vendedor pode escolher hoje
function definirBoleto(n, juros) {
  const sel = document.getElementById('bol-parcelas'), inp = document.getElementById('bol-juros'); if (!sel || !inp) return;
  montarSelectParcelas(true);
  n = Math.max(1, Math.round(+n || BOLETO_CFG.padrao));
  if (n > maxParcelas()) { sel.insertAdjacentHTML('beforeend', `<option value="${n}">${n}x (proposta original)</option>`); sel.dataset.extra = String(n); }
  sel.value = String(n); inp.value = fmtPct(+juros || 0).replace('.', '');
}
function mudouParcelas() { const inp = document.getElementById('bol-juros'); if (inp) inp.value = fmtPct(jurosMinimo(+document.getElementById('bol-parcelas').value)); atualizar(); }
function conferirJuros() {
  const inp = document.getElementById('bol-juros'); if (!inp) return;
  const b = boletoEscolhido(); inp.value = fmtPct(b.juros); atualizar();
}
function atualizarBlocoBoleto() {
  const bloco = document.getElementById('neg-boleto'); if (!bloco || !document.getElementById('bol-resumo')) return;
  bloco.style.display = abaAtual === 'importado' ? '' : 'none';
  montarSelectParcelas(false);
  const b = boletoEscolhido(), min = jurosMinimo(b.n);
  const inp = document.getElementById('bol-juros');
  if (inp && document.activeElement !== inp && inp.value.trim() === '') inp.value = fmtPct(b.juros);
  const regra = BOLETO_CFG.juros_min > 0
    ? `Até ${BOLETO_CFG.sem_juros_ate}x pode ser sem juros · acima disso mínimo ${fmtPct(BOLETO_CFG.juros_min)}% ao mês`
    : `Até ${BOLETO_CFG.sem_juros_ate}x sem juros (o admin ainda não definiu juros mínimo acima disso)`;
  document.getElementById('bol-regra').textContent = regra + (ehAdminBoleto() ? ' · admin: sem trava' : '');
  const digitado = inp ? Math.max(0, +String(inp.value).replace(',', '.') || 0) : 0;
  const aviso = document.getElementById('bol-aviso');
  aviso.textContent = !ehAdminBoleto() && digitado < min ? `⚠ Em ${b.n}x o juro mínimo é ${fmtPct(min)}% ao mês — a proposta usa ${fmtPct(min)}%.` : '';
  const idx = linhaFoco && linhaFoco.startsWith('importado') ? +linhaFoco.split('-')[1] : -1, item = IMPORTADO[idx];
  const res = document.getElementById('bol-resumo');
  if (!item) { res.textContent = 'Selecione um sistema na tabela para ver a parcela.'; return; }
  const c = calcLinha(item, +document.getElementById('slider-adicional').value, +document.getElementById('slider-desconto').value);
  const saldo = Math.max(0, valorCheioDe(item, c) - item.entrada), k = calcBoleto(saldo, b);
  res.innerHTML = `Entrada <b>${fmt(item.entrada)}</b> + <b>${k.n}x de ${fmt(k.parcela)}</b> · total a prazo <b>${fmt(item.entrada + k.totalParcelas)}</b>`
    + (k.jurosReais > 0.005 ? ` · <span style="color:var(--verde)">juros para a empresa: ${fmt(k.jurosReais)}</span>` : ' · sem juros');
}

// ── CALCULA LINHA ───────────────────────────────────────────────────────────
function calcLinha(item, adicional, descPct) {
  const base = item.inv_r;
  const comBase = base * item.com_pct;
  const addVendedor = adicional * CFG.split_adicional;
  const addEmpresa  = adicional * (1 - CFG.split_adicional);
  const descPctExtra = Math.max(0, descPct - CFG.desconto_livre);
  const valorFinal = (base + adicional) * (1 - descPct / 100);
  const descExtra  = (base + adicional) * (descPctExtra / 100);
  const descVendedor = descExtra * CFG.split_desconto_extra;
  const descEmpresa  = descExtra * (1 - CFG.split_desconto_extra);
  const comissao = comBase + addVendedor - descVendedor;
  return { base, valorFinal, comissao, comBase, addVendedor, addEmpresa, descVendedor, descEmpresa };
}
// desconto só no à vista: entrada + parcelas e financiamentos usam o valor cheio (tabela + adicional, sem o desconto)
function valorCheioDe(item, c) {
  const v = +c.valorFinal || 0, cheio = (+item.inv_r || 0) + (+c.addVendedor || 0) + (+c.addEmpresa || 0);
  return Math.max(v, Math.round(cheio * 100) / 100 || 0);
}

// ── RENDER TABELA ───────────────────────────────────────────────────────────
function renderTabela(dados, tbodyId, tipo) {
  const adicional = +document.getElementById('slider-adicional').value;
  const descPct   = +document.getElementById('slider-desconto').value;
  const tbody = document.getElementById(tbodyId);
  const bol = boletoEscolhido();
  tbody.innerHTML = '';
  if (!dados.length) {
    tbody.innerHTML = `<tr><td colspan="20" style="text-align:center;padding:28px 12px;color:var(--muted)">🔒 Entre com seu login (no topo da página) para ver a tabela de preços.</td></tr>`;
    return;
  }

  dados.forEach((item, idx) => {
    const c = calcLinha(item, adicional, descPct);
    const ajustado  = adicional > 0 || descPct > 0;
    const subiu     = adicional > 0 && descPct === 0;
    const descontou = descPct > 0;
    let finalClass = 'td-final';
    if (subiu) finalClass += ' ajustado';
    if (descontou) finalClass += ' descontado';

    const tr = document.createElement('tr');
    tr.style.cursor = 'pointer';
    if (linhaFoco === `${tipo}-${idx}`) {
      tr.style.background = '#222';
      tr.style.outline = '1.5px solid var(--amarelo)';
    }
    tr.onclick = () => selecionarLinha(tipo, idx, item);

    const tagTop    = item.top ? `<span class="tag-top">Top</span>` : '';
    const tagFiname = tipo === 'nacional' ? `<span class="tag-finame">FINAME</span>` : '';
    const originalStr = ajustado ? `<div class="td-original">${fmt(item.inv_r)}</div>` : '';

    let colsExtra = '';
    if (tipo === 'importado') {
      const saldo = Math.max(0, valorCheioDe(item, c) - item.entrada);
      const k = calcBoleto(saldo, bol);
      colsExtra = `
        <td class="td-muted">${fmt(item.entrada)}</td>
        <td class="td-azul">${fmt(saldo)}</td>
        <td class="td-muted">${k.n}x ${fmtShort(k.parcela)}</td>`;
    } else {
      const pm = calcParcelaMensal(valorCheioDe(item, c), finAnos);
      const pa = pm * 12;
      colsExtra = `
        <td class="td-muted">${fmt(pa)}</td>
        <td class="td-muted">${fmt(pm)}</td>`;
    }

    tr.innerHTML = `
      <td class="td-sistema">${item.nome}${tagTop}${tagFiname}</td>
      <td>${item.kwp} kWp</td>
      <td>${item.mod}</td>
      <td>${item.inv}</td>
      <td>${geracaoKit(item).toLocaleString('pt-BR')} kWh</td>
      <td>${fmt(item.inv_r)}</td>
      <td>${originalStr}<div class="${finalClass}">${fmt(c.valorFinal)}</div></td>
      ${colsExtra}
      <td class="td-comissao">${fmt(c.comissao)}</td>`;
    tbody.appendChild(tr);
  });
}

// ── DASHBOARD IMPORTADO ─────────────────────────────────────────────────────
function atualizarDashImp() {
  if (!linhaFoco || !linhaFoco.startsWith('importado')) return;
  const idx = +linhaFoco.split('-')[1];
  const item = IMPORTADO[idx];
  if (!item) return;
  const adicional = +document.getElementById('slider-adicional').value;
  const descPct   = +document.getElementById('slider-desconto').value;
  const c = calcLinha(item, adicional, descPct);

  const contaAtual = +document.getElementById('imp-conta-atual').value || 400;
  const taxaConc   = +document.getElementById('imp-taxa-conc').value || 50;
  const tarifa     = +document.getElementById('imp-tarifa').value || 0.89;

  // Saldo após entrada, pago em N parcelas (condição escolhida na régua)
  const saldo = Math.max(0, valorCheioDe(item, c) - item.entrada);
  const k = calcBoleto(saldo), N = k.n, parcela10 = k.parcela;

  // Fase 1
  const totalMes   = parcela10 + taxaConc;
  const custoExtra = totalMes - contaAtual;

  // Fase 2
  const creditosReais = geracaoKit(item) * tarifa;
  const ecoLiquida    = creditosReais - taxaConc;

  // Custo real do investimento
  const custoReal = item.entrada + (parcela10 * N) + (taxaConc * N) - (contaAtual * N);
  const paybackMeses = custoReal > 0 ? Math.ceil(custoReal / ecoLiquida) : 0;
  const paybackAnos  = (paybackMeses / 12).toFixed(1);

  document.getElementById('dash-imp-nome-sistema').textContent =
    item.nome + ' · ' + item.kwp + ' kWp · ' + geracaoKit(item).toLocaleString('pt-BR') + ' kWh/mês';

  // Fase 1
  document.getElementById('imp-f1-titulo').textContent    = '⏳ Fase 1 — Durante as ' + N + ' parcelas';
  document.getElementById('imp-f1-periodo').textContent   = N > 1 ? 'Meses 1 a ' + N : 'Mês 1';
  document.getElementById('imp-f1-lbl-parcela').textContent = 'Parcela do saldo (' + N + '×)';
  document.getElementById('imp-f2-titulo').textContent    = '🏆 Fase 2 — Após quitar (mês ' + (N + 1) + '+)';
  document.getElementById('imp-f1-parcela').textContent   = fmt(parcela10);
  document.getElementById('imp-f1-taxa').textContent      = fmt(taxaConc);
  document.getElementById('imp-f1-total-mes').textContent = fmt(totalMes);
  document.getElementById('imp-f1-gastava').textContent   = fmt(contaAtual);

  const extraEl = document.getElementById('imp-f1-extra');
  if (custoExtra > 0) {
    extraEl.textContent = '+ ' + fmt(custoExtra);
    extraEl.className = 'fi-val vermelho';
  } else {
    extraEl.textContent = fmt(Math.abs(custoExtra)) + ' a menos';
    extraEl.className = 'fi-val verde';
  }

  // Fase 2
  document.getElementById('imp-f2-producao').textContent = geracaoKit(item).toLocaleString('pt-BR') + ' kWh';
  document.getElementById('imp-f2-creditos').textContent = fmt(creditosReais);
  document.getElementById('imp-f2-taxa').textContent     = fmt(taxaConc);
  document.getElementById('imp-f2-eco').textContent      = fmt(ecoLiquida);

  // Resumo
  document.getElementById('imp-res-investimento').textContent = fmt(Math.max(0, custoReal));
  document.getElementById('imp-res-payback').textContent      = paybackMeses + ' meses (' + paybackAnos + ' anos)';
  document.getElementById('imp-res-eco-mensal').textContent   = fmt(ecoLiquida);
  document.getElementById('imp-res-eco-ano').textContent      = fmt(ecoLiquida * 12);
}


function atualizarDash() {
  if (!linhaFoco || !linhaFoco.startsWith('nacional')) return;
  const idx = +linhaFoco.split('-')[1];
  const item = NACIONAL[idx];
  if (!item) return;
  const adicional = +document.getElementById('slider-adicional').value;
  const descPct   = +document.getElementById('slider-desconto').value;
  const c = calcLinha(item, adicional, descPct);
  const tarifa = +document.getElementById('input-tarifa').value || 0.89;

  const parcela = calcParcelaMensal(valorCheioDe(item, c), finAnos);
  const contaMensal = geracaoKit(item) * tarifa;
  const economia = contaMensal - parcela;

  document.getElementById('dash-nome-sistema').textContent =
    item.nome + ' · ' + item.kwp + ' kWp · ' + geracaoKit(item).toLocaleString('pt-BR') + ' kWh/mês';

  document.getElementById('dash-parcela').textContent = fmt(parcela);
  document.getElementById('dash-parcela-sub').textContent =
    finAnos === 8 ? '96 parcelas · juros zero' : '120 parcelas · 3% a.a.';

  document.getElementById('dash-conta').textContent = fmt(contaMensal);
  document.getElementById('dash-conta-sub').textContent =
    `${geracaoKit(item).toLocaleString('pt-BR')} kWh × R$ ${tarifa.toFixed(2)}/kWh`;

  const ecoEl = document.getElementById('dash-economia-val');
  if (economia > 0) {
    ecoEl.textContent = fmt(economia);
    ecoEl.className = 'dash-card-val azul';
    document.getElementById('dash-eco-sub').textContent = '✅ cliente economiza todo mês';
  } else {
    ecoEl.textContent = fmt(Math.abs(economia));
    ecoEl.className = 'dash-card-val vermelho';
    document.getElementById('dash-eco-sub').textContent = '⚠ parcela maior que a conta';
  }

  // Barras visuais
  const maior = Math.max(parcela, contaMensal);
  const pParcela = (parcela / maior) * 100;
  const pConta   = (contaMensal / maior) * 100;
  document.getElementById('barra-parcela').style.width = pParcela + '%';
  document.getElementById('barra-conta').style.width   = pConta + '%';
  document.getElementById('barra-parcela-txt').textContent = fmt(parcela);
  document.getElementById('barra-conta-txt').textContent   = fmt(contaMensal);
}

function selecionarFin(anos, btn) {
  finAnos = anos;
  document.querySelectorAll('.fin-btn').forEach(b => b.classList.remove('ativo'));
  btn.classList.add('ativo');
  renderTabela(NACIONAL, 'tbody-nacional', 'nacional');
  atualizarDash();
}

// ── ATUALIZAR TUDO ──────────────────────────────────────────────────────────
function atualizar() {
  const adicional = +document.getElementById('slider-adicional').value;
  const descPct   = +document.getElementById('slider-desconto').value;

  const addV = adicional * CFG.split_adicional;
  const addE = adicional * (1 - CFG.split_adicional);
  document.getElementById('val-adicional').textContent = adicional > 0 ? `+ ${fmt(adicional)}` : 'R$ 0';
  document.getElementById('val-adicional').className = 'slider-val' + (adicional > 0 ? '' : ' neutro');
  document.getElementById('add-vendedor').textContent = fmt(addV);
  document.getElementById('add-empresa').textContent  = fmt(addE);

  const maxA = 2000;
  const pctA = (adicional / maxA) * 100;
  document.getElementById('slider-adicional').style.background =
    `linear-gradient(to right, var(--amarelo) 0%, var(--amarelo) ${pctA}%, var(--borda) ${pctA}%, var(--borda) 100%)`;

  const descLabel = document.getElementById('val-desconto');
  descLabel.textContent = descPct > 0 ? `-${descPct}%` : '0%';
  descLabel.className = 'slider-val' + (descPct > CFG.desconto_livre ? ' negativo' : descPct > 0 ? '' : ' neutro');
  document.getElementById('desc-sublabel').textContent =
    descPct <= CFG.desconto_livre
      ? `Até ${CFG.desconto_livre}% gratuito · sem custo pro vendedor`
      : `Acima de ${CFG.desconto_livre}% → desconta 50/50`;

  const maxD = CFG.desconto_max;
  const pctD = (descPct / maxD) * 100;
  const pctLivre = (CFG.desconto_livre / maxD) * 100;
  document.getElementById('slider-desconto').style.background = descPct <= CFG.desconto_livre
    ? `linear-gradient(to right, var(--borda) 0%, var(--borda) ${100-pctD}%, #facc15 ${100-pctD}%, #facc15 100%)`
    : `linear-gradient(to right, var(--borda) 0%, var(--borda) ${100-pctD}%, #facc15 ${100-pctD}%, #facc15 ${100-pctLivre}%, var(--vermelho) ${100-pctLivre}%, var(--vermelho) 100%)`;

  document.getElementById('desc-max-label').textContent = `máx ${CFG.desconto_max}%`;
  document.getElementById('desc-livre-label').textContent = `↑ gratuito até ${CFG.desconto_livre}%`;

  const dadosAtual = abaAtual === 'importado' ? IMPORTADO : NACIONAL;
  const idxRef = linhaFoco ? +linhaFoco.split('-')[1] : 0;
  const itemRef = dadosAtual[idxRef];
  const cRef = itemRef ? calcLinha(itemRef, adicional, descPct) : { descVendedor: 0, descEmpresa: 0 };
  document.getElementById('desc-vendedor').textContent = fmt(cRef.descVendedor);
  document.getElementById('desc-empresa').textContent  = fmt(cRef.descEmpresa);

  atualizarBlocoBoleto();
  { const th = document.getElementById('th-parcela-imp'); if (th) th.textContent = 'Parcela (' + boletoEscolhido().n + 'x)'; }
  renderTabela(IMPORTADO, 'tbody-importado', 'importado');
  renderTabela(NACIONAL,  'tbody-nacional',  'nacional');
  atualizarResumo(adicional, descPct);
  atualizarDash();
  atualizarDashImp();
}

function selecionarLinha(tipo, idx, item) {
  linhaFoco = `${tipo}-${idx}`;
  atualizar();
  const adicional = +document.getElementById('slider-adicional').value;
  const descPct   = +document.getElementById('slider-desconto').value;
  const cc = calcLinha(item, adicional, descPct);
  document.getElementById('resumo-bar').style.display = 'flex';
  document.getElementById('res-sistema').textContent  = item.nome;
  document.getElementById('res-original').textContent = fmt(item.inv_r);
  document.getElementById('res-final').textContent    = fmt(cc.valorFinal);
  document.getElementById('res-comissao').textContent = fmt(cc.comissao);
  atualizarCustoResumo(item, cc);

  // Dashboard Nacional
  const dashNac = document.getElementById('dash-economia');
  // Dashboard Importado
  const dashImp = document.getElementById('dash-importado');

  if (tipo === 'nacional') {
    dashNac.classList.add('visivel');
    dashImp.classList.remove('visivel');
    atualizarDash();
  } else {
    dashNac.classList.remove('visivel');
    dashImp.classList.add('visivel');
    atualizarDashImp();
  }

  // Abre painel de proposta
  const adicional2 = +document.getElementById('slider-adicional').value;
  const descPct2   = +document.getElementById('slider-desconto').value;
  const calcAtual  = calcLinha(item, adicional2, descPct2);
  abrirProposta(tipo, idx, item, calcAtual);
}

function atualizarResumo(adicional, descPct) {
  if (!linhaFoco) return;
  const [tipo, idx] = linhaFoco.split('-');
  const dados = tipo === 'importado' ? IMPORTADO : NACIONAL;
  const item  = dados[+idx];
  if (!item) return;
  const c = calcLinha(item, adicional, descPct);
  document.getElementById('res-final').textContent    = fmt(c.valorFinal);
  document.getElementById('res-comissao').textContent = fmt(c.comissao);
  atualizarCustoResumo(item, c);
}

// ── TROCA ABA ───────────────────────────────────────────────────────────────
function trocarAba(aba, btn) {
  abaAtual = aba;
  const ct = document.getElementById('campo-tipo'); if (ct) ct.value = aba;
  linhaFoco = null;
  document.getElementById('resumo-bar').style.display = 'none';
  document.getElementById('dash-economia').classList.remove('visivel');
  document.getElementById('dash-importado').classList.remove('visivel');
  document.getElementById('proposta-card').classList.remove('visivel');
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('ativo'));
  btn.classList.add('ativo');
  document.getElementById('tabela-importado').style.display = aba === 'importado' ? '' : 'none';
  document.getElementById('tabela-nacional').style.display  = aba === 'nacional'  ? '' : 'none';
  atualizarBlocoBoleto();   // parcelamento no boleto só aparece nos importados
}

// ── PAINEL PROPOSTA ─────────────────────────────────────────────────────────
const FATOR_ORIENTACAO = { norte: 1.00, leste: 0.88, oeste: 0.88, sul: 0.78 };
const LABEL_ORIENTACAO = { norte: '1,00 (ideal)', leste: '0,88 (-12%)', oeste: '0,88 (-12%)', sul: '0,78 (-22%)' };

let propostaItem = null;
let propostaCalc = null;

function abrirProposta(tipo, idx, item, calc) {
  propostaItem = item;
  propostaCalc = calc;
  propostaTipo = tipo;
  ultimoOrcamentoId = null;
  if (capaDaProposta) usarCapaPadrao();
  preencherSelectsPagamento(true);
  preencherItensProposta();
  atualizarBlocoLead();
  statusProposta('', '');

  document.getElementById('psi-nome').textContent  = item.nome;
  document.getElementById('psi-kwp').textContent   = item.kwp + ' kWp';
  document.getElementById('psi-valor').textContent = fmt(calc.valorFinal);
  document.getElementById('psi-kwh').textContent   = geracaoKit(item).toLocaleString('pt-BR') + ' kWh';

  document.getElementById('proposta-card').classList.add('visivel');
  document.getElementById('btn-whats').style.display = 'none';
  document.getElementById('btn-share').style.display = 'none';

  calcularProducao();
  if (typeof avisoCpf === 'function') avisoCpf();

  // scroll suave até o painel
  setTimeout(() => document.getElementById('proposta-card').scrollIntoView({ behavior:'smooth', block:'start' }), 100);
}

function calcularProducao() {
  if (!propostaItem) return;
  const orientacao = document.getElementById('prop-orientacao').value;
  const fator = FATOR_ORIENTACAO[orientacao];
  const producaoMensal = Math.round(propostaItem.kwp * fatorRegiao() * fator);
  const producaoAnual  = Math.round(producaoMensal * 12);

  document.getElementById('pp-producao-mensal').textContent = producaoMensal.toLocaleString('pt-BR');
  document.getElementById('pp-producao-anual').textContent  = producaoAnual.toLocaleString('pt-BR');
  document.getElementById('pp-fator').textContent           = LABEL_ORIENTACAO[orientacao];
  document.getElementById('proposta-producao').classList.add('visivel');
}

function validarProposta() {
  const nome = document.getElementById('prop-nome').value.trim();
  const input = document.getElementById('prop-nome');
  if (nome) {
    input.classList.remove('erro');
    document.getElementById('proposta-erro').style.display = 'none';
  }
}

function capturarLocalizacao() {
  const btn = document.getElementById('btn-loc');
  btn.textContent = '⏳ Buscando...';
  btn.disabled = true;
  if (!navigator.geolocation) {
    alert('Geolocalização não suportada neste dispositivo.');
    btn.textContent = '📍 Localização';
    btn.disabled = false;
    return;
  }
  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude.toFixed(4);
      const lng = pos.coords.longitude.toFixed(4);
      // Tenta buscar nome da cidade via reverse geocoding
      fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
        .then(r => r.json())
        .then(data => {
          const cidade = data.address?.city || data.address?.town || data.address?.village || data.address?.municipality || '';
          const estado = data.address?.state_code || data.address?.state || '';
          document.getElementById('prop-cidade').value = cidade ? `${cidade} / ${estado}` : `${lat}, ${lng}`;
          const reg = regiaoMaisProxima(+lat, +lng);
          if (reg) mudarRegiao(reg.id, 'localização do aparelho');
          calcularProducao();
        })
        .catch(() => {
          document.getElementById('prop-cidade').value = `${lat}, ${lng}`;
        })
        .finally(() => {
          btn.innerHTML = '✅ Capturado';
          btn.disabled = false;
        });
    },
    err => {
      alert('Não foi possível capturar a localização. Verifique as permissões do navegador.');
      btn.innerHTML = '📍 Localização';
      btn.disabled = false;
    }
  );
}

function criarOrcamento() {
  // nenhum campo é obrigatório (proposta rápida); sem nome, sai como "Cliente"
  salvarOrcamento();
  // Mostra botões PDF e WhatsApp
  document.getElementById('btn-pdf').style.display = 'block';
  document.getElementById('btn-whats').style.display = 'block';
  document.getElementById('btn-share').style.display = podeCompartilharPDF() ? 'block' : 'none';
  // Feedback visual
  const btn = document.getElementById('btn-orcamento');
  btn.textContent = '✅ Orçamento Criado!';
  btn.style.background = '#4ade80';
  btn.style.color = '#111';
  setTimeout(() => {
    btn.textContent = '📄 Criar Orçamento';
    btn.style.background = '';
    btn.style.color = '';
  }, 2500);
}


// ── GERAÇÃO POR REGIÃO ──────────────────────────────────────────────────────
// fator = kWh gerados por kWp instalado, por mês, com telhado ao norte.
// Valores iniciais ESTIMADOS (proporcionais à irradiação média de cada região,
// calibrados em Oeste SC = 106,6). Conferir/ajustar no painel admin.
const FATOR_REF = 106.6;   // referência usada no cadastro de kWh dos kits (Oeste SC)
const REGIOES_PADRAO = [
  { id:'sc-oeste',       uf:'SC', nome:'Oeste (Chapecó, Quilombo, São Miguel)',    fator:106.6, lat:-26.95, lon:-52.80 },
  { id:'sc-meio-oeste',  uf:'SC', nome:'Meio-Oeste (Joaçaba, Videira, Concórdia)', fator:103.0, lat:-27.15, lon:-51.60 },
  { id:'sc-planalto-n',  uf:'SC', nome:'Planalto Norte (Canoinhas, Mafra)',        fator:99.0,  lat:-26.20, lon:-50.20 },
  { id:'sc-serrana',     uf:'SC', nome:'Serra (Lages, São Joaquim)',               fator:101.0, lat:-27.90, lon:-50.20 },
  { id:'sc-vale-norte',  uf:'SC', nome:'Vale do Itajaí e Norte (Blumenau, Joinville)', fator:92.0, lat:-26.70, lon:-49.00 },
  { id:'sc-grande-fln',  uf:'SC', nome:'Grande Florianópolis',                    fator:96.0,  lat:-27.60, lon:-48.60 },
  { id:'sc-sul',         uf:'SC', nome:'Sul (Criciúma, Tubarão)',                  fator:96.0,  lat:-28.60, lon:-49.30 },
  { id:'rs-alto-uruguai',uf:'RS', nome:'Alto Uruguai (Erechim, Aratiba)',          fator:105.0, lat:-27.60, lon:-52.30 },
  { id:'rs-missoes',     uf:'RS', nome:'Noroeste e Missões (Ijuí, Santa Rosa, Santo Ângelo)', fator:108.0, lat:-28.20, lon:-54.20 },
  { id:'rs-planalto',    uf:'RS', nome:'Planalto Médio (Passo Fundo, Carazinho)', fator:104.0, lat:-28.30, lon:-52.60 },
  { id:'rs-serra',       uf:'RS', nome:'Serra Gaúcha (Caxias, Bento Gonçalves)',   fator:101.0, lat:-29.10, lon:-51.30 },
  { id:'rs-centro',      uf:'RS', nome:'Centro (Santa Maria, Santa Cruz)',         fator:105.0, lat:-29.70, lon:-53.40 },
  { id:'rs-metropolitana',uf:'RS',nome:'Metropolitana (Porto Alegre)',             fator:101.0, lat:-30.00, lon:-51.20 },
  { id:'rs-fronteira',   uf:'RS', nome:'Fronteira Oeste e Campanha (Uruguaiana, Bagé)', fator:110.0, lat:-30.30, lon:-55.30 },
  { id:'rs-sul',         uf:'RS', nome:'Sul (Pelotas, Rio Grande)',                fator:101.0, lat:-31.70, lon:-52.40 },
  { id:'pr-sudoeste',    uf:'PR', nome:'Sudoeste (Pato Branco, Francisco Beltrão)',fator:106.6, lat:-26.00, lon:-53.00 },
  { id:'pr-oeste',       uf:'PR', nome:'Oeste (Cascavel, Toledo, Foz)',            fator:110.0, lat:-24.90, lon:-53.70 },
  { id:'pr-noroeste',    uf:'PR', nome:'Noroeste (Umuarama, Paranavaí)',           fator:112.0, lat:-23.40, lon:-52.90 },
  { id:'pr-norte',       uf:'PR', nome:'Norte (Londrina, Maringá)',                fator:112.0, lat:-23.40, lon:-51.50 },
  { id:'pr-centro',      uf:'PR', nome:'Centro e Campos Gerais (Guarapuava, Ponta Grossa)', fator:103.0, lat:-25.20, lon:-50.90 },
  { id:'pr-curitiba',    uf:'PR', nome:'Curitiba e Região',                        fator:96.0,  lat:-25.45, lon:-49.30 },
  { id:'pr-litoral',     uf:'PR', nome:'Litoral (Paranaguá)',                      fator:90.0,  lat:-25.55, lon:-48.55 },
];
let REGIOES = REGIOES_PADRAO.map(r => ({ ...r }));
let regiaoAtual = (() => { try { return localStorage.getItem('energtech_regiao') || 'sc-oeste'; } catch (e) { return 'sc-oeste'; } })();

function regiaoSel() { return REGIOES.find(r => r.id === regiaoAtual) || REGIOES[0]; }
function fatorRegiao() { const r = regiaoSel(); return r && isFinite(r.fator) && r.fator > 0 ? r.fator : FATOR_REF; }
function geracaoKit(item) { return Math.round((+item.kwh || 0) * fatorRegiao() / FATOR_REF); }

function renderSeletorRegiao() {
  const sel = document.getElementById('sel-regiao');
  if (!sel) return;
  const grupos = ['SC','RS','PR'].map(uf => {
    const ops = REGIOES.filter(r => r.uf === uf).map(r =>
      `<option value="${r.id}">${escHtml(r.nome)} — ${String(r.fator).replace('.', ',')} kWh/kWp</option>`).join('');
    return ops ? `<optgroup label="${uf === 'SC' ? 'Santa Catarina' : uf === 'RS' ? 'Rio Grande do Sul' : 'Paraná'}">${ops}</optgroup>` : '';
  }).join('');
  sel.innerHTML = grupos;
  if (!REGIOES.some(r => r.id === regiaoAtual)) regiaoAtual = REGIOES[0] ? REGIOES[0].id : 'sc-oeste';
  sel.value = regiaoAtual;
  const r = regiaoSel();
  const tit = document.getElementById('pp-regiao');
  if (tit && r) tit.textContent = r.nome.split(' (')[0] + ' ' + r.uf;
}

function mudarRegiao(id, origem) {
  if (!REGIOES.some(r => r.id === id)) return;
  regiaoAtual = id;
  try { localStorage.setItem('energtech_regiao', id); } catch (e) {}
  renderSeletorRegiao();
  const aviso = document.getElementById('regiao-aviso');
  if (aviso) aviso.textContent = origem ? '📍 Região definida pela ' + origem + '.' : '';
  atualizar();                 // tabela e painéis usam a geração da região
  if (linhaFoco) {             // atualiza dashboard aberto
    if (linhaFoco.startsWith('importado')) atualizarDashImp(); else atualizarDash();
  }
  calcularProducao();
}

// região mais próxima de uma coordenada (distância simples, corrigida pela latitude)
function regiaoMaisProxima(lat, lon) {
  let melhor = null, dMin = Infinity;
  const k = Math.cos(lat * Math.PI / 180);
  REGIOES.forEach(r => {
    if (!isFinite(r.lat) || !isFinite(r.lon)) return;
    const d = Math.hypot(lat - r.lat, (lon - r.lon) * k);
    if (d < dMin) { dMin = d; melhor = r; }
  });
  return dMin < 3 ? melhor : null;   // ~300 km: fora disso não sugere
}

// cidade digitada → coordenada (OpenStreetMap) → região
let _geoTimer = null, _geoUltima = '';
function regiaoPelaCidade() {
  clearTimeout(_geoTimer);
  _geoTimer = setTimeout(async () => {
    const txt = (document.getElementById('prop-cidade').value || '').trim();
    if (txt.length < 4 || txt === _geoUltima || /^-?\d/.test(txt)) return;
    _geoUltima = txt;
    try {
      const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=' + encodeURIComponent(txt.replace('/', ','));
      const r = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } });
      const d = await r.json();
      if (d && d[0]) {
        const reg = regiaoMaisProxima(+d[0].lat, +d[0].lon);
        if (reg && reg.id !== regiaoAtual) mudarRegiao(reg.id, 'cidade "' + txt + '"');
      }
    } catch (e) { /* sem internet ou serviço fora: mantém a região escolhida */ }
  }, 900);
}

// ── admin: tabela de regiões ──
function renderAdminRegioes() {
  const tb = document.getElementById('admin-tbody-regioes');
  if (!tb) return;
  tb.innerHTML = REGIOES.map((r, i) => `
    <tr>
      <td><select class="admin-input admin-input-sm" onchange="REGIOES[${i}].uf=this.value">
        ${['SC','RS','PR'].map(u => `<option ${r.uf === u ? 'selected' : ''}>${u}</option>`).join('')}</select></td>
      <td><input class="admin-input" style="min-width:280px" value="${escHtml(r.nome)}" onchange="REGIOES[${i}].nome=this.value"></td>
      <td><input class="admin-input admin-input-sm" type="number" step="0.1" min="50" max="160" value="${r.fator}" onchange="REGIOES[${i}].fator=+this.value"></td>
      <td><button class="admin-btn-del" onclick="removerRegiao(${i})">✕</button></td>
    </tr>`).join('');
}
function adicionarRegiao() {
  const r = regiaoSel();
  REGIOES.push({ id:'reg-' + Date.now().toString(36), uf:r ? r.uf : 'SC', nome:'Nova região', fator:FATOR_REF, lat:null, lon:null });
  renderAdminRegioes();
}
function removerRegiao(i) {
  if (REGIOES.length <= 1) return;
  if (!confirm('Remover a região "' + REGIOES[i].nome + '"?')) return;
  REGIOES.splice(i, 1);
  renderAdminRegioes();
}
function restaurarRegioesPadrao() {
  if (!confirm('Voltar todas as regiões para os valores iniciais estimados?')) return;
  REGIOES = REGIOES_PADRAO.map(r => ({ ...r }));
  renderAdminRegioes();
}

