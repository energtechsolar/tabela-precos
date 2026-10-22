// Energtech — proposta: PDF, reimpressão, WhatsApp, itens, imagens
// (arquivo carregado pelo index.html; a ordem dos <script> importa)

// ── PROPOSTA EM PDF (modelo 2026) ───────────────────────────────────────────────────
// Textos editáveis no painel admin → Configurações → Proposta (PDF)
const PROPOSTA_PADRAO = {
  modulos_importado:  'JA Solar ou Ronma',
  inversor_importado: 'Sofar, Solis ou Huawei',
  modulos_nacional:   'Módulos nacionais (linha FINAME)',
  inversor_nacional:  'PHB',
  garantia_inversor:  '10 anos contra defeitos de fabricação',
  garantia_modulos:   '12 anos contra defeitos de fabricação, além da garantia de geração do fabricante',
  garantia_servicos:  '1 ano de garantia dos serviços de instalação',
  inclusos: 'Projeto elétrico do sistema\nHomologação junto à Celesc\nART — Anotação de Responsabilidade Técnica\nInstalação completa: estrutura, cabos e proteções\n1 ano de assistência técnica Energtech',
  prazo_entrega: '30 dias após a aprovação',
  validade_dias: 15,
  pagamento: 'ENERGTECH ENERGIA SOLAR LTDA\nCNPJ e PIX: 40.297.488/0001-85\nBanco Sicoob (756) · Agência 3069 · Conta 271.041-2',
  codigo_finame: '3293385',
  servico_desc: 'Execução dos serviços de instalação elétrica, mecânica e civil do sistema fotovoltaico, incluindo elaboração do projeto elétrico, homologação junto à concessionária de energia, emissão da ART (Anotação de Responsabilidade Técnica) e comissionamento do sistema para entrada em operação.',
  fator_kit: 1.30,
  repasse_pct: 4,
  contatos: 'www.energtechsolar.com.br  ·  energtechsolar@gmail.com  ·  (49) 99182-8095  ·  Quilombo/SC e Aratiba/RS',
  concessionaria: 'Celesc',
  telefone_aprovacao: '49991828095',
  telefone_exibir: '(49) 99182-8095',
  avista_itens: 'Pagamento único, sem juros\nMelhor valor final\nLiberação imediata do projeto',
  parcelado_itens: 'Condição facilitada\nSem burocracia\nParcelamento direto com a Energtech',
  finame_itens: 'Linha BNDES para equipamentos nacionais\nParcelas fixas',
  fin_ativo: true,
  fin_banco: 'Caixa',
  fin_taxa_mes: 0.99,
  fin_prazos: '36, 48, 60, 72',
  fin_obs: 'Programa Reforma Casa Brasil\nSomente imóvel urbano\nSujeito às regras e limites do programa',
  rodape_legal: 'Energtech Engenharia Solar · CNPJ 40.297.488/0001-85 · Responsável técnico: Eng. Eletricista Eider Balena – CREA-SC 171497-7',
  imagens: { capa:'', pag2:'', pag3:'', pag4:'' },
  // fornecedores do kit (dados bancários + FINAME) — editáveis em Configurações
  fornecedores: [
    { id:'viener', nome:'Viener Tecnologia e Inovação LTDA', finame:'',
      dados:'CNPJ: 33.105.788/0001-50\nIE: 260017736\nRua A, Loteamento Mumbach 2, nº 457 · CEP 89891-000\nfaturamento@viener.com.br\nBanco Cresol (133) · Agência 1616 · Conta 28391-6' },
    { id:'maxsul', nome:'Maxsul Distribuidora de Combustíveis LTDA', finame:'Livoltek 750W~75kWp: 04340203',
      dados:'CNPJ: 00.326.969/0001-57\nBanco Itaú (341) · Agência 1312 · C/C 0099634-9' },
  ],
  fornecedor_padrao: '',
  // contas da Energtech para receber (a padrão já vem marcada na proposta)
  contas: [
    { id:'sicoob', rotulo:'Sicoob', dados:'ENERGTECH ENERGIA SOLAR LTDA\nCNPJ: 40.297.488/0001-85\nPIX: 40297488000185\nBanco Sicoob (756) · Agência 3069 · C/C 271.041-2' },
    { id:'caixa', rotulo:'Caixa', dados:'ENERGTECH ENERGIA SOLAR LTDA\nCNPJ: 40.297.488/0001-85\nPIX: 49991825362\nBanco Caixa (104) · Agência 4626 · C/C 000566314883-0' },
  ],
  conta_padrao: 'sicoob',
};
let PROPOSTA_CFG = JSON.parse(JSON.stringify(PROPOSTA_PADRAO));
function fornecedorSel() { const id = (document.getElementById('prop-fornecedor') || {}).value; return (PROPOSTA_CFG.fornecedores || []).find(f => f.id === id) || null; }
function contaSel() {
  const cs = PROPOSTA_CFG.contas || [];
  const id = (document.getElementById('prop-conta-pag') || {}).value || PROPOSTA_CFG.conta_padrao;
  return cs.find(c => c.id === id) || cs[0] || { rotulo:'', dados: PROPOSTA_CFG.pagamento || '' };
}
function preencherSelectsPagamento(reiniciar) {
  const sf = document.getElementById('prop-fornecedor'), sc = document.getElementById('prop-conta-pag');
  if (!sf || !sc) return;
  const fAtual = reiniciar ? '' : sf.value, cAtual = reiniciar ? '' : sc.value;
  sf.innerHTML = '<option value="">— Não mostrar fornecedor —</option>' + (PROPOSTA_CFG.fornecedores || []).map(f => `<option value="${escHtml(f.id)}">${escHtml(f.nome)}</option>`).join('');
  sc.innerHTML = (PROPOSTA_CFG.contas || []).map(c => `<option value="${escHtml(c.id)}">${escHtml(c.rotulo)}${c.id === PROPOSTA_CFG.conta_padrao ? ' (padrão)' : ''}</option>`).join('');
  sf.value = [...sf.options].some(o => o.value === fAtual) && fAtual ? fAtual : (PROPOSTA_CFG.fornecedor_padrao || '');
  sc.value = [...sc.options].some(o => o.value === cAtual) && cAtual ? cAtual : (PROPOSTA_CFG.conta_padrao || '');
}

// variação típica da geração ao longo do ano no Sul (média = 1)
const PERFIL_MENSAL = [1.15, 1.10, 1.06, 0.96, 0.85, 0.78, 0.83, 0.93, 0.95, 1.06, 1.15, 1.18];
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
// imagens padrão (arquivos do site). O admin pode trocar cada uma pelo painel → Configurações → Imagens da proposta
const FOTOS_PROPOSTA = { capa:'proposta-capa.jpg', pag2:'', pag3:'', pag4:'' };
const SLOTS_IMAGEM = [
  ['capa', 'Capa (página 1)', 168, 95],
  ['pag2', 'Página 2 — rodapé (opcional)', 184, 52],
  ['pag3', 'Página 3 — rodapé (opcional)', 184, 52],
  ['pag4', 'Página 4 — rodapé (opcional)', 184, 52],
];
let capaDaProposta = null; // foto escolhida pelo vendedor só para esta proposta
function urlImagem(slot) { const im = PROPOSTA_CFG.imagens || {}; return im[slot] || FOTOS_PROPOSTA[slot] || ''; }
let ultimoOrcamentoId = null;
const _cacheImg = {};

// carrega uma foto do site e recorta no formato pedido (como "cobrir")
async function fotoRecortada(url, wmm, hmm, larguraPx) {
  const chave = url + '|' + wmm + 'x' + hmm;
  if (chave in _cacheImg) return _cacheImg[chave];
  try {
    let src = url;
    if (!/^data:/.test(url)) {
      const r = await fetch(url, { cache:'no-cache' });
      if (!r.ok) throw new Error('sem foto');
      src = URL.createObjectURL(await r.blob());
    }
    const img = await new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = src; });
    const W = larguraPx || 1400, H = Math.round(W * hmm / wmm);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const esc = Math.max(W / img.width, H / img.height);
    const dw = img.width * esc, dh = img.height * esc;
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    return (_cacheImg[chave] = cv.toDataURL('image/jpeg', 0.82));
  } catch (e) { return (_cacheImg[chave] = null); }
}

function itensPadraoKit(item, tipo) {
  const imp = tipo === 'importado';
  const W = Math.round(item.kwp * 1000 / (item.mod || 1));
  const marcaMod = imp ? PROPOSTA_CFG.modulos_importado : PROPOSTA_CFG.modulos_nacional;
  const marcaInv = imp ? PROPOSTA_CFG.inversor_importado : PROPOSTA_CFG.inversor_nacional;
  return [
    item.mod + ' X MÓDULO FOTOVOLTAICO ' + W + 'W' + (marcaMod ? ' (' + marcaMod + ')' : ''),
    'INVERSOR ' + item.inv + (marcaInv ? ' (' + marcaInv + ')' : ''),
    'KIT ESTRUTURA COMPLETO',
    'CABO SOLAR PRETO E VERMELHO',
    'KIT ATERRAMENTO',
    'QUADRO DE PROTEÇÃO CA (DPS E DISJUNTORES)',
  ].join('\n');
}
function itensDoKit(item, tipo) { return (item.itens && String(item.itens).trim()) ? String(item.itens) : itensPadraoKit(item, tipo); }

function valorCampo(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
const brl = v => 'R$ ' + (+v || 0).toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 });
const brl0 = v => 'R$ ' + Math.round(+v || 0).toLocaleString('pt-BR');
const kwhTxt = v => Math.round(+v || 0).toLocaleString('pt-BR') + ' kWh';
function anosMeses(m) {
  if (!m || !isFinite(m)) return '—';
  const a = Math.floor(m / 12), r = m % 12;
  return [a ? a + (a === 1 ? ' ano' : ' anos') : '', r ? r + (r === 1 ? ' mês' : ' meses') : ''].filter(Boolean).join(' e ');
}

function coletarDadosProposta() {
  const tipo = propostaTipo || (linhaFoco && linhaFoco.startsWith('importado') ? 'importado' : 'nacional');
  const hoje = new Date();
  return calcularDadosProposta({
    item: propostaItem, calc: propostaCalc, tipo,
    orientacao: valorCampo('prop-orientacao') || 'norte',
    estrutura: valorCampo('prop-estrutura') || 'fibrocimento',
    tarifa: +(tipo === 'importado' ? valorCampo('imp-tarifa') : valorCampo('input-tarifa')) || 0.89,
    taxa: +valorCampo('imp-taxa-conc') || 50,
    conta: +valorCampo('prop-conta') || 0, consumo: +valorCampo('prop-consumo') || 0, meta: +valorCampo('prop-conta-meta') || 0,
    modoValor: (document.querySelector('input[name="modo-valor"]:checked') || {}).value || 'global',
    valorKit: +valorCampo('prop-valor-kit') || 0,
    itens: (valorCampo('prop-itens') || itensDoKit(propostaItem, tipo)).split('\n').map(t => t.trim()).filter(Boolean),
    servicoDesc: valorCampo('prop-servico') || PROPOSTA_CFG.servico_desc,
    nome: valorCampo('prop-nome') || 'Cliente', cpf: valorCampo('prop-cpf'), telefone: valorCampo('prop-telefone'),
    email: valorCampo('prop-email'), cidade: valorCampo('prop-cidade'),
    endereco: valorCampo('prop-endereco'), cep: valorCampo('prop-cep'), uc: valorCampo('prop-uc'), concessionaria: valorCampo('prop-concessionaria'),
    regiao: { ...regiaoSel(), fator: fatorRegiao() },
    numero: ultimoOrcamentoId ? String(ultimoOrcamentoId).padStart(5, '0')
      : 'S' + hoje.toISOString().slice(2, 10).replace(/-/g, '') + String(hoje.getHours()).padStart(2, '0') + String(hoje.getMinutes()).padStart(2, '0'),
    emissao: hoje,
    vendedor: perfil && perfil.vendedor ? (perfil.nome || perfil.email) : '',
    fornecedor: fornecedorSel(), contaPag: contaSel(),
  });
}

// mesmos cálculos para a proposta nova e para reimprimir uma proposta salva
function calcularDadosProposta(e) {
  const { item, calc, tipo, orientacao, estrutura, tarifa, taxa } = e;
  let conta = e.conta || 0, consumo = e.consumo || 0;
  if (!consumo && conta) consumo = Math.round(conta / tarifa);
  if (!conta && consumo) conta = consumo * tarifa;
  const contaHoje = conta, consumoHoje = consumo;
  const meta = e.meta || 0;
  const usaMeta = meta > 0 && meta > conta;
  if (usaMeta) { consumo = consumo && conta ? Math.round(consumo * meta / conta) : Math.round(meta / tarifa); conta = meta; }
  const geracao  = Math.round(item.kwp * (e.regiao.fator || fatorRegiao()) * (FATOR_ORIENTACAO[orientacao] || 1));
  const creditos = geracao * tarifa;
  const economia = conta ? Math.max(0, Math.min(creditos, conta - taxa)) : Math.max(0, creditos - taxa);
  const novaConta = conta ? Math.max(taxa, conta - economia) : null;
  const valor = calc.valorFinal;
  const paybackMeses = economia > 0 ? Math.ceil(valor / economia) : null;
  let eco25 = 0; for (let t = 0; t < 25; t++) eco25 += economia * 12 * Math.pow(0.995, t);
  const pag = tipo === 'importado'
    ? { entrada: item.entrada, saldo: Math.max(0, valor - item.entrada), parcela10: Math.max(0, valor - item.entrada) / 10 }
    : { p96: calcParcelaMensal(valor, 8), p120: calcParcelaMensal(valor, 10), kit: valor / 1.30, servicos: valor - valor / 1.30 };
  const modoValor = e.modoValor || 'global';
  let valorKit = modoValor === 'separado' ? (e.valorKit || valor / (+PROPOSTA_CFG.fator_kit || 1.30)) : null;
  if (valorKit !== null) valorKit = Math.min(valorKit, valor);
  const valorServico = valorKit !== null ? valor - valorKit : null;
  if (valorKit !== null && tipo !== 'importado') { pag.kit = valorKit; pag.servicos = valorServico; }
  const emissao = e.emissao || new Date();
  const validade = new Date(emissao.getTime() + (+PROPOSTA_CFG.validade_dias || 15) * 86400000);
  return {
    modoValor, valorKit, valorServico, itens: e.itens, servicoDesc: e.servicoDesc,
    valorDe: +item.inv_r > valor + 0.5 ? +item.inv_r : null,   // preço de tabela riscado ("de ... por ...") quando houve desconto
    contaHoje, consumoHoje, usaMeta,
    tipo, item, valor, orientacao, estrutura, tarifa, taxa, conta, consumo, geracao, economia, novaConta, paybackMeses, eco25, pag,
    nome: e.nome, cpf: e.cpf, telefone: e.telefone, email: e.email, cidade: e.cidade,
    endereco: e.endereco || '', cep: e.cep || '', uc: e.uc || '', concessionaria: e.concessionaria || '',
    regiao: e.regiao, numero: e.numero, emissao, data: emissao.toLocaleDateString('pt-BR'), validade: validade.toLocaleDateString('pt-BR'),
    vendedor: e.vendedor, potW: Math.round(item.kwp * 1000 / (item.mod || 1)),
    fornecedor: e.fornecedor, contaPag: e.contaPag,
  };
}

// ── REIMPRIMIR UMA PROPOSTA SALVA (CRM / painel → index.html?pdf=Nº) ──
async function reimprimirProposta(id) {
  const aviso = document.getElementById('aviso-crm');
  const msg = (t, erro) => { if (aviso) { aviso.textContent = t; aviso.style.display = 'block'; aviso.style.borderColor = erro ? '#f87171' : '#60a5fa'; } };
  msg('⏳ Gerando o PDF da proposta Nº ' + String(id).padStart(5, '0') + '…');
  if (!sb) { msg('⚠ Sem conexão com o servidor.', true); return; }
  const { data: o, error } = await sb.from('orcamentos').select('*').eq('id', id).maybeSingle();
  if (error || !o) { msg('⚠ Proposta Nº ' + id + ' não encontrada ou sem permissão para ver.', true); return; }
  const dd = o.dados || {}, kit = dd.kit || {}, calc = dd.calculo || { valorFinal: o.valor_final };
  if (!kit.kwp) { msg('⚠ Esta proposta foi salva numa versão antiga do sistema e não tem os dados completos para gerar o PDF.', true); return; }
  calc.valorFinal = +o.valor_final;
  let vendedor = '';
  try { const { data: v } = await sb.from('vendedores').select('nome').eq('email', o.vendedor_email).maybeSingle(); vendedor = (v && v.nome) || o.vendedor_email; } catch (e) {}
  const forn = (PROPOSTA_CFG.fornecedores || []).find(f => f.id === dd.fornecedor_id || (dd.fornecedor && f.nome === dd.fornecedor)) || null;
  const contas = PROPOSTA_CFG.contas || [];
  const contaPag = contas.find(c => c.id === dd.conta_id || (dd.conta_pagamento && c.rotulo === dd.conta_pagamento)) || contas.find(c => c.id === PROPOSTA_CFG.conta_padrao) || contas[0] || { dados: '' };
  const d = calcularDadosProposta({
    item: kit, calc, tipo: o.tipo, orientacao: dd.orientacao || 'norte', estrutura: dd.estrutura || 'fibrocimento',
    tarifa: +dd.tarifa || 0.89, taxa: +dd.taxa || 50,
    conta: +dd.conta_atual || 0, consumo: +dd.consumo_kwh || 0, meta: +dd.conta_meta || 0,
    modoValor: dd.modo_valor, valorKit: +dd.valor_kit || 0,
    itens: Array.isArray(dd.itens) && dd.itens.length ? dd.itens : itensDoKit(kit, o.tipo).split('\n'),
    servicoDesc: dd.servico_desc || PROPOSTA_CFG.servico_desc,
    nome: o.cliente_nome || 'Cliente', cpf: dd.cpf_cnpj || '', telefone: telBonito(o.telefone || ''), email: o.email || '', cidade: o.cidade || '',
    endereco: (dd.cliente || {}).endereco || '', cep: (dd.cliente || {}).cep || '', uc: (dd.cliente || {}).uc || '', concessionaria: (dd.cliente || {}).concessionaria || '',
    regiao: dd.regiao && dd.regiao.fator ? dd.regiao : { ...regiaoSel(), fator: fatorRegiao() },
    numero: String(o.id).padStart(5, '0'), emissao: new Date(o.criado_em),
    vendedor, fornecedor: forn, contaPag,
  });
  const fotos = {};
  await Promise.all(SLOTS_IMAGEM.map(async ([slot, , w, h]) => {
    const url = urlImagem(slot);
    let img = url ? await fotoRecortada(url, w, h, 1400) : null;
    if (!img && slot === 'capa' && url !== FOTOS_PROPOSTA.capa) img = await fotoRecortada(FOTOS_PROPOSTA.capa, w, h, 1400);
    fotos[slot] = img;
  }));
  const { doc, arq } = montarPropostaPDF(d, fotos);
  doc.save(arq);
  msg('✅ PDF da proposta Nº ' + d.numero + ' (' + d.nome + ', emitida em ' + d.data + ') gerado: ' + arq);
}

async function gerarPDF(modo) {
  if (!propostaItem || !propostaCalc) return;
  if (!window.jspdf) { alert('Não foi possível carregar o gerador de PDF. Verifique a internet e recarregue a página.'); return; }
  const btn = document.getElementById(modo === 'compartilhar' ? 'btn-share' : 'btn-pdf');
  const txtBtn = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Gerando…'; }
  try {
    const d = coletarDadosProposta();
    const fotos = {};
    await Promise.all(SLOTS_IMAGEM.map(async ([slot, , w, h]) => {
      let url = slot === 'capa' && capaDaProposta ? capaDaProposta : urlImagem(slot);
      let img = url ? await fotoRecortada(url, w, h, 1400) : null;
      if (!img && slot === 'capa' && url !== FOTOS_PROPOSTA.capa) img = await fotoRecortada(FOTOS_PROPOSTA.capa, w, h, 1400);
      fotos[slot] = img;
    }));
    const { doc, arq } = montarPropostaPDF(d, fotos);
    if (modo === 'compartilhar') {
      const arquivo = new File([doc.output('blob')], arq, { type:'application/pdf' });
      try {
        await navigator.share({ files:[arquivo], title:'Proposta Energtech', text: mensagemProposta(d) });
      } catch (e) {
        if (e && e.name !== 'AbortError') { console.error(e); doc.save(arq); }
      }
    } else {
      doc.save(arq);
    }
  } catch (e) {
    console.error(e);
    alert('Erro ao gerar o PDF: ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = txtBtn; }
  }
}

// ── MENSAGEM DE WHATSAPP (resumo da proposta, sempre em reais) ──
function mensagemProposta(d) {
  const primeiro = (d.nome || '').split(' ')[0] || '';
  const imp = d.tipo === 'importado';
  const pagamento = imp
    ? `à vista ${brl(d.valor)} ou entrada de ${brl(d.pag.entrada)} + 10x de ${brl(d.pag.parcela10)}`
    : `à vista ${brl(d.valor)}, ou FINAME em 96x de ${brl(d.pag.p96)} sem juros, ou 120x de ${brl(d.pag.p120)}`;
  const linhasMsg = [
    `Olá${primeiro ? ', ' + primeiro : ''}! ☀`,
    d.vendedor ? `Aqui é ${d.vendedor}, da *Energtech Engenharia Solar*. Segue o resumo da sua proposta:` : `Segue o resumo da sua proposta da *Energtech Engenharia Solar*:`,
    '',
    `🔋 *Sistema:* ${d.item.kwp.toLocaleString('pt-BR')} kWp (${d.item.mod} módulos de ${d.potW} W)`,
    `⚡ *Geração estimada:* ${Math.round(d.geracao).toLocaleString('pt-BR')} kWh por mês`,
    `💡 *Economia estimada:* ${brl(d.economia)} por mês`,
  ];
  if (d.conta && d.usaMeta) linhasMsg.push(`📉 *Conta de luz:* considerando o consumo previsto de ${brl(d.conta)} por mês, passa para cerca de ${brl(d.novaConta)}`);
  else if (d.conta) linhasMsg.push(`📉 *Sua conta de luz:* de ${brl(d.conta)} para cerca de ${brl(d.novaConta)}`);
  linhasMsg.push(d.valorDe ? `💰 *Investimento:* de ~${brl(d.valorDe)}~ por *${brl(d.valor)}*` : `💰 *Investimento:* ${brl(d.valor)}`);
  if (d.modoValor === 'separado') linhasMsg.push(`     (kit ${brl(d.valorKit)} + mão de obra ${brl(d.valorServico)})`);
  linhasMsg.push(`💳 *Pagamento:* ${pagamento}`);
  if (d.paybackMeses) linhasMsg.push(`⏱ *Retorno do investimento:* ${anosMeses(d.paybackMeses)}`);
  linhasMsg.push(`📅 Proposta nº ${d.numero}, válida até ${d.validade}.`, '', 'Envio também a proposta completa em PDF. Qualquer dúvida, estou à disposição!');
  return linhasMsg.join('\n');
}

// ── ITENS E VALORES DA PROPOSTA (editáveis pelo vendedor) ───────────────────
function preencherItensProposta() {
  if (!propostaItem) return;
  const tipo = propostaTipo || 'importado';
  document.getElementById('prop-itens').value = itensDoKit(propostaItem, tipo);
  document.getElementById('prop-servico').value = PROPOSTA_CFG.servico_desc || '';
  const modo = tipo === 'nacional' ? 'separado' : 'global';
  document.querySelectorAll('input[name="modo-valor"]').forEach(r => r.checked = r.value === modo);
  // a tabela é orientativa: o vendedor pode ajustar o total, ou o kit e a mão de obra
  if (propostaCalc.valorTabela === undefined) propostaCalc.valorTabela = propostaCalc.valorFinal;
  const total = propostaCalc.valorFinal;
  const kit = Math.round(total / (+PROPOSTA_CFG.fator_kit || 1.30) * 100) / 100;
  document.getElementById('prop-total-txt').value = fmtReais(total);
  document.getElementById('prop-kit-txt').value = fmtReais(kit);
  document.getElementById('prop-serv-txt').value = fmtReais(total - kit);
  atualizarModoValor();
}
function restaurarItensPadrao() {
  if (!propostaItem) return;
  document.getElementById('prop-itens').value = itensDoKit(propostaItem, propostaTipo || 'importado');
  document.getElementById('prop-servico').value = PROPOSTA_CFG.servico_desc || '';
}

// valores em reais no formato brasileiro: aceita 15.538,88 · 15538,88 · 15538.88 · R$ 15.538
function lerReais(txt) {
  let s = String(txt || '').replace(/[^\d,.]/g, '');
  if (!s) return 0;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(s)) s = s.replace(/\./g, '');
  const v = parseFloat(s);
  return isFinite(v) ? Math.round(v * 100) / 100 : 0;
}
const fmtReais = v => (+v || 0).toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 });
function formatarCampoReais(el) { if (el && el.value.trim()) el.value = fmtReais(lerReais(el.value)); }
function modoSeparado() { return (document.querySelector('input[name="modo-valor"]:checked') || {}).value === 'separado'; }

// grava o total escolhido na proposta (é o valor que vai para o PDF, o WhatsApp e o orçamento salvo)
function definirTotalProposta(v) {
  if (!propostaCalc) return;
  const novo = Math.round((+v || 0) * 100) / 100, mudou = Math.abs(novo - propostaCalc.valorFinal) > 0.009;
  propostaCalc.valorFinal = novo;
  document.getElementById('psi-valor').textContent = fmt(propostaCalc.valorFinal);
  if (mudou) recalcularComissao();
}
// a comissão acompanha o valor final da proposta, com as mesmas regras da régua:
// acima da tabela = adicional dividido vendedor/empresa; abaixo = desconto (faixa gratuita + divisão do excedente)
function recalcularComissao() {
  if (!propostaCalc || !propostaItem || !(+propostaItem.inv_r > 0)) return;
  const base = +propostaItem.inv_r, total = propostaCalc.valorFinal;
  const c = calcLinha(propostaItem, Math.max(0, total - base), total < base ? (base - total) / base * 100 : 0);
  ['comissao', 'comBase', 'addVendedor', 'addEmpresa', 'descVendedor', 'descEmpresa'].forEach(k => propostaCalc[k] = c[k]);
  const rf = document.getElementById('res-final'), rc = document.getElementById('res-comissao');
  if (rf) rf.textContent = fmt(total);
  if (rc) rc.textContent = fmt(c.comissao);
  if (typeof atualizarCustoResumo === 'function') atualizarCustoResumo(propostaItem, propostaCalc);
}
function valorEditado(qual) {
  if (!propostaCalc) return;
  const kitEl = document.getElementById('prop-kit-txt'), servEl = document.getElementById('prop-serv-txt'), totEl = document.getElementById('prop-total-txt');
  if (qual === 'total') {
    const t = lerReais(totEl.value);
    definirTotalProposta(t);
    servEl.value = fmtReais(Math.max(0, t - lerReais(kitEl.value)));
  } else {
    const k = lerReais(kitEl.value), sv = lerReais(servEl.value);
    definirTotalProposta(k + sv);
    totEl.value = fmtReais(k + sv);
  }
  document.getElementById('prop-valor-kit').value = lerReais(kitEl.value) || '';
  mostrarRefTabela();
}
function atualizarModoValor() {
  const sep = modoSeparado();
  document.querySelectorAll('.campo-separado').forEach(el => el.style.display = sep ? '' : 'none');
  const totEl = document.getElementById('prop-total-txt');
  totEl.readOnly = sep;
  totEl.title = sep ? 'Soma do kit + mão de obra' : '';
  if (!propostaCalc) return;
  if (sep) {   // kit + mão de obra sempre fecham o total
    const total = propostaCalc.valorFinal, kitEl = document.getElementById('prop-kit-txt');
    let k = lerReais(kitEl.value);
    if (!k || k > total) k = Math.round(total / (+PROPOSTA_CFG.fator_kit || 1.30) * 100) / 100;
    kitEl.value = fmtReais(k);
    document.getElementById('prop-serv-txt').value = fmtReais(total - k);
  }
  totEl.value = fmtReais(propostaCalc.valorFinal);
  document.getElementById('prop-valor-kit').value = sep ? lerReais(document.getElementById('prop-kit-txt').value) : '';
  mostrarRefTabela();
  if (typeof avisoCpf === 'function') avisoCpf();
}
function mostrarRefTabela() {
  const el = document.getElementById('prop-total-ref');
  if (!el || !propostaCalc) return;
  const tab = propostaCalc.valorTabela ?? propostaCalc.valorFinal, dif = propostaCalc.valorFinal - tab;
  el.textContent = 'Valor da tabela: ' + fmt(tab) + (Math.abs(dif) < 0.01 ? ' (sem ajuste)' : (dif > 0 ? ' · acima da tabela: ' : ' · abaixo da tabela: ') + fmt(Math.abs(dif)));
  const piso = propostaItem && +propostaItem.inv_r ? +propostaItem.inv_r * (1 - (CFG.desconto_max || 0) / 100) : 0;
  if (piso && propostaCalc.valorFinal < piso - 0.5) el.textContent += ' · ⚠ abaixo do desconto máximo permitido (mínimo ' + fmt(piso) + ')';
  el.style.color = dif < -0.009 ? 'var(--vermelho)' : '';
  avisoLimiteServico();
  atualizarDemonstrativo();
}

// limite de serviços do financiamento: serviço até (fator_kit − 1) × kit. Ex.: 1,30 → até 30% do valor do kit
function fatorKit() { return +PROPOSTA_CFG.fator_kit > 1 ? +PROPOSTA_CFG.fator_kit : 1.30; }
function avisoLimiteServico() {
  const el = document.getElementById('prop-limite-aviso');
  if (!el) return;
  if (!propostaCalc || !modoSeparado()) { el.innerHTML = ''; return; }
  const kit = lerReais(document.getElementById('prop-kit-txt').value), serv = lerReais(document.getElementById('prop-serv-txt').value);
  const limite = kit * (fatorKit() - 1), excesso = serv - limite;
  el.innerHTML = excesso > 0.5
    ? '⚠ A mão de obra passa ' + fmt(excesso) + ' do limite do financiamento. <button class="link-mini" onclick="ajustarLimiteServico()">Ajustar ao limite (mantém o total)</button>'
    : '';
}
function ajustarLimiteServico() {
  if (!propostaCalc) return;
  const total = propostaCalc.valorFinal, k = Math.round(total / fatorKit() * 100) / 100;
  document.getElementById('prop-kit-txt').value = fmtReais(k);
  document.getElementById('prop-serv-txt').value = fmtReais(total - k);
  document.getElementById('prop-valor-kit').value = k;
  mostrarRefTabela();
}

// ── admin: demonstrativo financeiro da proposta (custo do kit, nota de repasse, margem real) ──
// Kit na proposta acima do custo → o fornecedor fatura esse valor e devolve a diferença à Energtech
// por nota de repasse, descontando o imposto (repasse_pct). Esse imposto sai só da margem da empresa.
function calcularRepasse(valorKit, custo, pct) {
  if (valorKit == null || custo == null) return null;
  const repasse = Math.max(0, Math.round((valorKit - custo) * 100) / 100);
  const imposto = Math.round(repasse * (+pct || 0)) / 100;
  return { repasse, imposto, volta: Math.round((repasse - imposto) * 100) / 100 };
}
function atualizarDemonstrativo() {
  const el = document.getElementById('prop-demo');
  if (!el) return;
  if (typeof adminLogado === 'undefined' || !adminLogado || !propostaCalc || !propostaItem) { el.style.display = 'none'; el.innerHTML = ''; return; }
  el.style.display = '';
  const custo = typeof custoDoKit === 'function' ? custoDoKit(propostaItem) : null;
  const tit = '<div style="font-weight:700;color:var(--amarelo);margin-bottom:6px">🔒 Demonstrativo financeiro (só admin)</div>';
  if (custo == null) { el.innerHTML = tit + '<div>Custo deste kit não cadastrado — informe no Painel Admin para ver a margem.</div>'; return; }
  const total = propostaCalc.valorFinal, com = +propostaCalc.comissao || 0, sep = modoSeparado();
  const pct = +PROPOSTA_CFG.repasse_pct || 0;
  const kit = sep ? lerReais(document.getElementById('prop-kit-txt').value) : null;
  const r = sep ? calcularRepasse(kit, custo, pct) : null;
  const imposto = r ? r.imposto : 0, margem = total - custo - com - imposto;
  const pctTxt = pct.toLocaleString('pt-BR', { maximumFractionDigits:2 }) + '%';
  const ln = (rot, v, estilo) => `<div style="display:flex;justify-content:space-between;gap:12px;${estilo || ''}"><span>${rot}</span><span>${v}</span></div>`;
  let h = tit + ln('Total da proposta', fmt(total));
  if (sep) {
    h += ln('· Kit na proposta (nota do fornecedor)', fmt(kit), 'color:var(--muted)')
       + ln('· Mão de obra (nota da Energtech)', fmt(total - kit), 'color:var(--muted)');
  }
  h += ln('(−) Custo do kit no fornecedor', fmt(custo));
  if (sep) {
    h += ln('Nota de repasse do fornecedor (kit na proposta − custo)', fmt(r.repasse), 'color:var(--muted)')
       + ln('(−) Imposto descontado no repasse (' + pctTxt + ')', fmt(imposto))
       + ln('Volta do fornecedor para a Energtech', fmt(r.volta), 'color:var(--muted)');
    if (kit < custo - 0.5) h += '<div style="color:var(--vermelho)">⚠ Kit na proposta abaixo do custo do fornecedor.</div>';
  }
  h += ln('(−) Comissão do vendedor', fmt(com))
     + ln('Margem real da Energtech', fmt(margem), 'font-weight:700;border-top:1px solid var(--borda);padding-top:4px;margin-top:4px;color:' + (margem < 0 ? 'var(--vermelho)' : 'var(--verde)'));
  el.innerHTML = h;
}

// admin: itens padrão de cada kit
let _kitItensEditando = null;
function editarItensKit(tipo, idx) {
  const lista = tipo === 'importado' ? IMPORTADO : NACIONAL;
  const item = lista[idx];
  _kitItensEditando = item;
  document.getElementById('itens-kit-titulo').textContent = item.nome + ' — ' + item.kwp + ' kWp (' + (tipo === 'importado' ? 'importado' : 'nacional') + ')';
  document.getElementById('itens-kit-texto').value = itensDoKit(item, tipo);
  document.getElementById('itens-kit-texto').dataset.tipo = tipo;
  document.getElementById('itens-overlay').classList.add('visivel');
}
function fecharItensKit() { document.getElementById('itens-overlay').classList.remove('visivel'); _kitItensEditando = null; }
function aplicarItensKit() {
  if (!_kitItensEditando) return;
  const txt = document.getElementById('itens-kit-texto').value.trim();
  const tipo = document.getElementById('itens-kit-texto').dataset.tipo;
  // se ficou igual ao padrão automático, não grava (continua acompanhando as marcas do admin)
  _kitItensEditando.itens = (txt && txt !== itensPadraoKit(_kitItensEditando, tipo)) ? txt : '';
  fecharItensKit();
  const msg = tipo === 'importado' ? 'admin-msg-imp' : 'admin-msg-nac';
  mostrarMsgAdmin(msg, 'Itens alterados. Clique em "Salvar Alterações" para gravar.', true);
}
function itensKitPadrao() {
  if (!_kitItensEditando) return;
  document.getElementById('itens-kit-texto').value = itensPadraoKit(_kitItensEditando, document.getElementById('itens-kit-texto').dataset.tipo);
}

// ── admin: textos da proposta ──
const CAMPOS_PROPOSTA = [
  ['modulos_importado', 'Módulos — kits importados (marcas)', 'input'],
  ['inversor_importado', 'Inversores — kits importados (marcas)', 'input'],
  ['modulos_nacional', 'Módulos — kits nacionais (marcas)', 'input'],
  ['inversor_nacional', 'Inversores — kits nacionais (marcas)', 'input'],
  ['garantia_inversor', 'Garantia do inversor', 'input'],
  ['garantia_modulos', 'Garantia dos módulos', 'input'],
  ['garantia_servicos', 'Garantia dos serviços', 'input'],
  ['prazo_entrega', 'Prazo de entrega', 'input'],
  ['validade_dias', 'Validade da proposta (dias)', 'number'],
  ['concessionaria', 'Concessionária (aparece nos textos)', 'input'],
  ['codigo_finame', 'Código FINAME padrão (usado quando não há fornecedor escolhido)', 'input'],
  ['fator_kit', 'Divisor do kit ao separar valores — define o limite de serviços do financiamento (1,30 → kit = total ÷ 1,30, serviço até 30% do kit)', 'number'],
  ['repasse_pct', 'Imposto descontado na nota de repasse do fornecedor (%) — aparece só no demonstrativo do admin', 'number'],
  ['telefone_aprovacao', 'WhatsApp do botão "Aprovar proposta" (com DDD, só números)', 'input'],
  ['telefone_exibir', 'Telefone que aparece na página 5', 'input'],
  ['avista_itens', 'Opção à vista — vantagens (uma por linha)', 'textarea'],
  ['parcelado_itens', 'Entrada + parcelas (importados) — vantagens', 'textarea'],
  ['finame_itens', 'FINAME (nacionais) — vantagens', 'textarea'],
  ['fin_ativo', 'Mostrar opção 3 — financiamento bancário', 'check'],
  ['fin_banco', 'Financiamento — banco', 'input'],
  ['fin_taxa_mes', 'Financiamento — taxa ao mês usada no cálculo (não aparece no PDF)', 'number'],
  ['fin_prazos', 'Financiamento — prazos em meses (separados por vírgula)', 'input'],
  ['fin_obs', 'Financiamento — condições (uma por linha)', 'textarea'],
  ['servico_desc', 'Descrição padrão do serviço', 'textarea'],
  ['inclusos', 'Serviços inclusos (um por linha)', 'textarea'],
  ['contatos', 'Contatos (rodapé)', 'input'],
  ['rodape_legal', 'Linha legal (página 5)', 'input'],
];

// ── admin: imagens da proposta (Supabase Storage, bucket "proposta") ──
function renderAdminImagens() {
  const box = document.getElementById('admin-proposta-imagens');
  if (!box) return;
  box.innerHTML = SLOTS_IMAGEM.map(([slot, rot]) => {
    const url = urlImagem(slot);
    const propria = !!(PROPOSTA_CFG.imagens || {})[slot];
    return `<div class="admin-cfg-item">
      <div class="admin-cfg-lbl">${rot}</div>
      <div style="aspect-ratio:16/9;background:#1f1f1f;border-radius:6px;overflow:hidden;margin:6px 0;display:flex;align-items:center;justify-content:center;color:#777;font-size:12px">
        ${url ? `<img src="${escHtml(url)}" alt="" style="width:100%;height:100%;object-fit:cover" onerror="this.replaceWith(document.createTextNode('imagem não encontrada'))">` : 'sem imagem'}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <label class="admin-btn-add" style="margin:0;cursor:pointer">📷 Trocar imagem<input type="file" accept="image/*" style="display:none" onchange="enviarImagemProposta('${slot}', this)"></label>
        ${propria ? `<button class="link-mini" onclick="removerImagemProposta('${slot}')">${slot === 'capa' ? '↺ Voltar à padrão' : '✕ Remover'}</button>` : ''}
        <span class="regiao-aviso" id="img-msg-${slot}"></span>
      </div>
    </div>`;
  }).join('');
}
// reduz a foto no aparelho antes de enviar (máx. 1800 px, JPEG)
function reduzirImagem(arquivo, maxPx) {
  return new Promise((ok, erro) => {
    const img = new Image();
    img.onload = () => {
      const esc = Math.min(1, maxPx / Math.max(img.width, img.height));
      const cv = document.createElement('canvas'); cv.width = Math.round(img.width * esc); cv.height = Math.round(img.height * esc);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      cv.toBlob(b => b ? ok(b) : erro(new Error('falha ao converter')), 'image/jpeg', 0.85);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => erro(new Error('arquivo de imagem inválido'));
    img.src = URL.createObjectURL(arquivo);
  });
}
async function enviarImagemProposta(slot, input) {
  const arq = input.files && input.files[0]; input.value = '';
  const msg = document.getElementById('img-msg-' + slot);
  if (!arq) return;
  if (!sb) { msg.textContent = 'Sem conexão com o banco.'; return; }
  try {
    msg.textContent = '⏳ Enviando…';
    const blob = await reduzirImagem(arq, 1800);
    const caminho = slot + '-' + Date.now() + '.jpg';
    const { error } = await sb.storage.from('proposta').upload(caminho, blob, { contentType:'image/jpeg', upsert:false });
    if (error) throw error;
    const url = sb.storage.from('proposta').getPublicUrl(caminho).data.publicUrl;
    PROPOSTA_CFG.imagens = { ...(PROPOSTA_CFG.imagens || {}), [slot]: url };
    await salvarConfig();
    renderAdminImagens();
    document.getElementById('img-msg-' + slot).textContent = '✅ Imagem trocada';
  } catch (e) {
    console.error(e);
    msg.textContent = '⚠ Não foi possível enviar: ' + (e.message || e);
  }
}
async function removerImagemProposta(slot) {
  PROPOSTA_CFG.imagens = { ...(PROPOSTA_CFG.imagens || {}), [slot]: '' };
  await salvarConfig();
  renderAdminImagens();
}

// ── vendedor: foto de capa só desta proposta (ex.: foto do telhado do cliente) ──
async function escolherCapaProposta(input) {
  const arq = input.files && input.files[0];
  const info = document.getElementById('prop-capa-info');
  if (!arq) return;
  try {
    const blob = await reduzirImagem(arq, 1600);
    capaDaProposta = await new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(blob); });
    info.textContent = '✅ Capa desta proposta: ' + arq.name;
    document.getElementById('btn-capa-padrao').style.display = '';
  } catch (e) { info.textContent = '⚠ ' + e.message; }
}
function usarCapaPadrao() {
  capaDaProposta = null;
  const inp = document.getElementById('prop-capa'); if (inp) inp.value = '';
  document.getElementById('prop-capa-info').textContent = 'Usando a capa padrão da empresa.';
  document.getElementById('btn-capa-padrao').style.display = 'none';
}

