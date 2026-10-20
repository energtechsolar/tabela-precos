// Energtech — contrato: geração, histórico e modelo
// (carregado pelo crm.html depois de js/comum.js)

// ── CONTRATO ────────────────────────────────────────────────────────────────
let CONTRATO_CFG = null, CONTAS_PAG = [], contratoLead = null, contratoProps = [];

async function carregarContratoCfg() {
  const [c, p] = await Promise.all([
    sb.from('contrato_cfg').select('dados').eq('id', 1).maybeSingle(),
    sb.from('config').select('dados').eq('id', 'cfg').maybeSingle(),
  ]);
  CONTRATO_CFG = (c.data && c.data.dados) || { contratada:{}, concessionarias:[], textos:{} };
  const prop = p.data && p.data.dados && p.data.dados.proposta;
  CONTAS_PAG = (prop && prop.contas) || [];
}

// valor por extenso (reais e centavos)
function extenso(valor) {
  const un = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const dz = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const ct = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
  const ate999 = n => {
    if (n === 0) return '';
    if (n === 100) return 'cem';
    const c = Math.floor(n / 100), r = n % 100, p = [];
    if (c) p.push(ct[c]);
    if (r) p.push(r < 20 ? un[r] : dz[Math.floor(r / 10)] + (r % 10 ? ' e ' + un[r % 10] : ''));
    return p.join(' e ');
  };
  const inteiro = n => {
    if (n === 0) return 'zero';
    const grupos = [['', ''], ['mil', 'mil'], ['milhão', 'milhões'], ['bilhão', 'bilhões']];
    const partes = []; let i = 0, resto = n;
    while (resto > 0) {
      const g = resto % 1000;
      if (g) {
        let t = (i === 1 && g === 1) ? 'mil' : ate999(g) + (i ? ' ' + (g === 1 ? grupos[i][0] : grupos[i][1]) : '');
        partes.unshift({ t, g });
      }
      resto = Math.floor(resto / 1000); i++;
    }
    return partes.map((p, k) => (k > 0 && (p.g < 100 || p.g % 100 === 0) ? 'e ' : '') + p.t).join(' ').replace(/\s+/g, ' ').trim();
  };
  const v = Math.round((+valor || 0) * 100), r = Math.floor(v / 100), c = v % 100;
  let txt = '';
  if (r) txt = inteiro(r) + (/(ão|ões)$/.test(inteiro(r)) ? ' de' : '') + (r === 1 ? ' real' : ' reais');
  if (c) txt += (r ? ' e ' : '') + inteiro(c) + (c === 1 ? ' centavo' : ' centavos');
  return txt || 'zero reais';
}

function concessionariaPorTexto(txt) {
  const t = String(txt || '').toLowerCase();
  return (CONTRATO_CFG.concessionarias || []).find(c => t && (t.includes(c.id) || t.includes(String(c.sigla || '').toLowerCase()))) || null;
}

async function abrirContrato(id) {
  const l = leads.find(x => x.id === id); if (!l) return;
  if (!CONTRATO_CFG) await carregarContratoCfg();
  contratoLead = l;
  const { data: full } = await sb.from('leads').select('*').eq('id', id).single();
  const lf = full || l;
  const { data: props } = await sb.from('orcamentos').select('id, sistema, kwp, valor_final, tipo, dados, criado_em, cidade').eq('lead_id', id).order('criado_em', { ascending:false });
  contratoProps = props || [];
  const dc = lf.dados_contrato || {};
  const p0 = contratoProps[0];
  const conc = dc.concessionaria_id || (concessionariaPorTexto(lf.concessionaria) || {}).id || ((CONTRATO_CFG.concessionarias || [])[0] || {}).id || '';
  const cidade = dc.municipio || lf.cidade || (p0 && p0.cidade) || '';
  const T = CONTRATO_CFG.textos || {};
  const opProp = contratoProps.map(p => `<option value="${p.id}" ${String(p.id) === String(dc.orcamento_id || '') ? 'selected' : ''}>Nº ${String(p.id).padStart(5, '0')} · ${esc(p.sistema)} · ${String(p.kwp).replace('.', ',')} kWp · ${fmtR(p.valor_final)}</option>`).join('');
  const opConc = (CONTRATO_CFG.concessionarias || []).map(c => `<option value="${esc(c.id)}" ${c.id === conc ? 'selected' : ''}>${esc(c.sigla || c.nome)}</option>`).join('');
  const opConta = CONTAS_PAG.map(c => `<option value="${esc(c.id)}" ${c.id === (dc.conta_id || '') ? 'selected' : ''}>${esc(c.rotulo)}</option>`).join('');
  $('contrato-corpo').innerHTML = `
    ${contratoProps.length ? '' : '<div class="muted" style="color:var(--vermelho)">Este cliente ainda não tem proposta salva. Gere a proposta primeiro (botão "Nova proposta").</div>'}
    <div class="grade">
      <div class="largo"><label>Proposta base</label><select class="select" id="ct-prop" onchange="preencherDaProposta()">${opProp}</select></div>
      <div class="largo"><label>Nome / Razão social</label><input class="input" id="ct-nome" value="${esc(dc.nome || lf.nome)}"></div>
      <div><label>CPF / CNPJ</label><input class="input" id="ct-cpf" value="${esc(dc.cpf || lf.cpf_cnpj || '')}"></div>
      <div><label>Telefone</label><input class="input" id="ct-tel" value="${esc(dc.telefone || telBonito(lf.telefone))}"></div>
      <div class="largo"><label>E-mail</label><input class="input" id="ct-email" value="${esc(dc.email || lf.email || '')}"></div>
      <div class="largo"><label>Endereço da instalação (rua, nº, complemento, bairro)</label><input class="input" id="ct-end" value="${esc(dc.endereco || lf.endereco || '')}"></div>
      <div><label>CEP</label><input class="input" id="ct-cep" value="${esc(dc.cep || lf.cep || '')}"></div>
      <div><label>Município / UF</label><input class="input" id="ct-mun" value="${esc(cidade)}"></div>
      <div><label>Unidade consumidora (UC)</label><input class="input" id="ct-uc" value="${esc(dc.uc || lf.uc || '')}"></div>
      <div><label>Concessionária</label><select class="select" id="ct-conc" onchange="trocarConcessionaria()">${opConc}</select></div>
      <div class="largo"><label>Norma técnica aplicável (preenchida pela concessionária, pode ajustar)</label><textarea class="input" id="ct-norma" rows="2"></textarea></div>
      <div><label>Telhado / estrutura</label><input class="input" id="ct-estr" value="${esc(dc.estrutura || '')}"></div>
      <div><label>Valor global (R$)</label><input class="input" type="number" step="0.01" id="ct-valor" value="${esc(dc.valor || '')}" oninput="$('ct-ext').textContent = extenso(this.value)"></div>
      <div class="largo muted" id="ct-ext"></div>
      <div class="largo"><label>Forma de pagamento</label><textarea class="input" id="ct-pag" rows="3" placeholder="Ex.: Entrada de R$ 3.000,00 na assinatura e saldo de R$ 6.500,00 na instalação.">${esc(dc.forma_pagamento || lf.forma_pagamento || '')}</textarea></div>
      <div><label>Conta para pagamento</label><select class="select" id="ct-conta">${opConta}</select></div>
      <div><label>Prazo de execução (dias úteis)</label><input class="input" type="number" id="ct-prazo" value="${esc(dc.prazo || T.prazo_dias || 60)}"></div>
      <div><label>Foro (comarca)</label><input class="input" id="ct-foro" value="${esc(dc.foro || cidade)}"></div>
      <div><label>Local e data</label><input class="input" id="ct-local" value="${esc(cidade.split('/')[0].trim())}"></div>
    </div>
    <div class="acoes"><button class="btn" onclick="gerarContrato()" ${contratoProps.length ? '' : 'disabled'}>📝 Gerar contrato (PDF)</button><span class="status-msg" id="ct-msg"></span></div>`;
  $('ov-contrato').classList.add('visivel');
  if (!dc.concessionaria_id || !dc.norma) trocarConcessionaria(); else $('ct-norma').value = dc.norma;
  if (!dc.valor || !dc.estrutura) preencherDaProposta(!!dc.valor);
  $('ct-ext').textContent = extenso($('ct-valor').value);
}
function fecharContrato() { $('ov-contrato').classList.remove('visivel'); }
function trocarConcessionaria() {
  const c = (CONTRATO_CFG.concessionarias || []).find(x => x.id === $('ct-conc').value);
  $('ct-norma').value = c ? c.norma : '';
}
function propSelecionada() { return contratoProps.find(p => String(p.id) === $('ct-prop').value) || contratoProps[0]; }
function preencherDaProposta(manterValor) {
  const p = propSelecionada(); if (!p) return;
  const estr = { fibrocimento:'Telhado de fibrocimento', ceramico:'Telhado cerâmico', metalico:'Telhado metálico', laje:'Laje', solo:'Solo' }[(p.dados || {}).estrutura] || 'Telhado';
  if (!$('ct-estr').value || !manterValor) $('ct-estr').value = estr;
  if (!manterValor) { $('ct-valor').value = (+p.valor_final).toFixed(2); $('ct-ext').textContent = extenso(p.valor_final); }
}

async function gerarContrato() {
  if (!window.jspdf) { alert('Não foi possível carregar o gerador de PDF. Verifique a internet.'); return; }
  const p = propSelecionada(); if (!p) return;
  const conc = (CONTRATO_CFG.concessionarias || []).find(x => x.id === $('ct-conc').value) || { nome:'', sigla:'' };
  const conta = CONTAS_PAG.find(c => c.id === $('ct-conta').value) || CONTAS_PAG[0] || { dados:'' };
  const d = {
    orcamento_id: p.id, nome: $('ct-nome').value.trim(), cpf: $('ct-cpf').value.trim(), telefone: $('ct-tel').value.trim(), email: $('ct-email').value.trim(),
    endereco: $('ct-end').value.trim(), cep: $('ct-cep').value.trim(), municipio: $('ct-mun').value.trim(), uc: $('ct-uc').value.trim(),
    concessionaria_id: conc.id, norma: $('ct-norma').value.trim(), estrutura: $('ct-estr').value.trim(), valor: +$('ct-valor').value || +p.valor_final,
    forma_pagamento: $('ct-pag').value.trim(), conta_id: conta.id, prazo: +$('ct-prazo').value || 60, foro: $('ct-foro').value.trim(), local: $('ct-local').value.trim(),
  };
  const faltam = [['nome', 'nome'], ['cpf', 'CPF/CNPJ'], ['endereco', 'endereço'], ['municipio', 'município'], ['uc', 'unidade consumidora'], ['forma_pagamento', 'forma de pagamento']].filter(([k]) => !d[k]).map(([, n]) => n);
  if (faltam.length && !confirm('Faltam: ' + faltam.join(', ') + '.\nGerar mesmo assim (com espaço em branco para preencher à mão)?')) return;
  const snap = { em: new Date().toISOString(), autor: perfil.email, orcamento_id: p.id, d, conc, conta,
    proposta: { id: p.id, kwp: p.kwp, sistema: p.sistema, dados: { itens: (p.dados || {}).itens, kit: { kwp: ((p.dados || {}).kit || {}).kwp, mod: ((p.dados || {}).kit || {}).mod } } },
    contratada: CONTRATO_CFG.contratada, textos: CONTRATO_CFG.textos };
  const { doc, arq } = montarContratoPDF(d, p, conc, conta, snap);
  doc.save(arq);
  // guarda os dados no cliente para a próxima vez + cópia no histórico de contratos
  const l = contratoLead;
  const { data: atual } = await sb.from('leads').select('contratos').eq('id', l.id).maybeSingle();
  const historico = ((atual && atual.contratos) || []).concat([snap]);
  const mud = { contratos: historico, dados_contrato: d, cpf_cnpj: d.cpf || null, uc: d.uc || null, concessionaria: conc.sigla || conc.nome || null, forma_pagamento: d.forma_pagamento || null, endereco: d.endereco || null, cep: d.cep || null };
  const { error } = await sb.from('leads').update(mud).eq('id', l.id);
  if (!error) {
    Object.assign(l, mud);
    await sb.from('lead_eventos').insert({ lead_id: l.id, texto: '📝 Contrato gerado — proposta Nº ' + String(p.id).padStart(5, '0') + ' · ' + fmtR(d.valor) + ' · ' + (conc.sigla || conc.nome) });
    $('ct-msg').textContent = '✅ Contrato gerado e dados salvos no cliente';
    if (fichaId === l.id) abrirFicha(l.id, true);
  } else { $('ct-msg').textContent = '⚠ PDF gerado, mas os dados não foram salvos: ' + error.message; $('ct-msg').classList.add('erro'); }
}


function montarContratoPDF(d, p, conc, conta, snap) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'mm', format:'a4' });
  const C = (snap && snap.contratada) || CONTRATO_CFG.contratada || {}, T = (snap && snap.textos) || CONTRATO_CFG.textos || {};
  const M = 22, LW = 210 - 2 * M, LIM = 297 - 22;
  let y = 0;
  const brl = v => (+v || 0).toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 });
  const sigla = conc.sigla || conc.nome || 'distribuidora';
  const novaPag = () => { doc.addPage(); cabecalho(); };
  const cabecalho = () => {
    doc.setFillColor(255, 193, 7); doc.circle(M + 4, 14, 4, 'F');
    doc.setFillColor(17, 17, 17); doc.lines([[2.2,-3.2],[-0.6,2.6],[1.9,0],[-3.5,4],[0.8,-2.9],[-1.9,0]], M + 3.6, 13.8, [1,1], 'F', true);
    doc.setTextColor(17); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('Energtech', M + 10, 13.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(120); doc.text('ENGENHARIA SOLAR', M + 10, 17);
    doc.setDrawColor(255, 193, 7); doc.setLineWidth(0.6); doc.line(M, 21, 210 - M, 21);
    y = 30; doc.setTextColor(17);
  };
  const precisa = h => { if (y + h > LIM) novaPag(); };
  // parágrafo com justificação real (espaço distribuído entre as palavras) e prefixo "PARÁGRAFO ... –" em negrito
  const par = (txt, o) => {
    o = o || {};
    const tam = o.tam || 10, x0 = M + (o.rec || 0), larg = LW - (o.rec || 0), alt = tam * 0.48;
    txt = String(txt);
    const m = !o.bold && txt.match(/^((?:PARÁGRAFO [A-ZÁÉÍÓÚÂÊÔÃÕÇ]+|DADOS BANCÁRIOS:)\s*–?)\s*/);
    const nNeg = m ? m[1].split(/\s+/).length : 0;
    const palavras = txt.split(/\s+/).filter(Boolean).map((w, i) => ({ w, neg: o.bold || i < nNeg }));
    const fonte = neg => { doc.setFont('helvetica', neg ? 'bold' : 'normal'); doc.setFontSize(tam); };
    const larguraDe = p => { fonte(p.neg); let w = 0; for (const c of p.w) w += doc.getTextWidth(c); return w; };  // soma letra a letra (o PDF não aplica kerning ao desenhar)
    fonte(false); const esp = doc.getTextWidth(' ');
    // monta as linhas
    const linhas = []; let atual = [], usado = 0;
    palavras.forEach(p => {
      const w = larguraDe(p);
      if (atual.length && usado + esp + w > larg) { linhas.push(atual); atual = []; usado = 0; }
      usado += (atual.length ? esp : 0) + w; atual.push({ ...p, larg: w });
    });
    if (atual.length) linhas.push(atual);
    linhas.forEach((ln, i) => {
      if (y + 5 > LIM) novaPag();
      const ultima = i === linhas.length - 1;
      const soma = ln.reduce((s, p) => s + p.larg, 0);
      const gap = (o.just && !ultima && ln.length > 1) ? (larg - soma) / (ln.length - 1) : esp;
      let x = x0;
      ln.forEach(p => { fonte(p.neg); doc.text(p.w, x, y); x += p.larg + gap; });
      y += alt;
    });
    y += o.depois === undefined ? 2.5 : o.depois;
  };
  const clausula = t => { y += 2; precisa(14); par(t, { bold:true, depois:1.5 }); };
  const campo = (rot, val) => { const v = val && String(val).trim() ? val : '____________________________________'; par(rot + ' ' + v, { depois:1.2 }); };

  cabecalho();
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text('CONTRATO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS', 105, y, { align:'center' }); y += 6;
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.text('Proposta Nº ' + String(p.id).padStart(5, '0'), 105, y, { align:'center' }); y += 9;

  par('Pelo presente instrumento particular, de um lado o doravante denominado CONTRATANTE, abaixo qualificado:', { just:true });
  campo('Nome/Razão Social:', d.nome);
  campo('CPF/CNPJ:', d.cpf);
  campo('Telefone:', d.telefone + (d.email ? '   E-mail: ' + d.email : ''));
  campo('Endereço:', [d.endereco, d.cep ? 'CEP ' + d.cep : ''].filter(Boolean).join(', '));
  campo('Município/UF:', d.municipio);
  campo('Unidade Consumidora:', d.uc ? d.uc + '   Concessionária: ' + (conc.nome || sigla) : '');
  y += 2;
  par('e, de outro lado, a pessoa jurídica de direito privado, neste ato representada na forma prevista em seu Contrato Social, doravante denominada simplesmente CONTRATADA, abaixo qualificada:', { just:true });
  campo('Razão Social:', C.razao); campo('CNPJ:', C.cnpj);
  campo('Endereço:', [C.endereco, C.bairro].filter(Boolean).join(', ') + (C.municipio ? ' – ' + C.municipio : ''));
  campo('Sócio:', C.socio + (C.nacionalidade ? ', ' + C.nacionalidade : '') + (C.estado_civil ? ', ' + C.estado_civil : '') + (C.profissao ? ', ' + C.profissao : ''));
  campo('RG:', (C.rg || '') + (C.cpf ? '   CPF: ' + C.cpf : ''));
  y += 2;
  par('têm entre si, justo e contratado o presente, que se regerá pelas seguintes Cláusulas e Condições:', { just:true });

  const kwp = String(p.kwp).replace('.', ',');
  const dados = p.dados || {}, kit = dados.kit || {};
  const nMod = kit.mod || '', potW = kit.kwp && kit.mod ? Math.round(kit.kwp * 1000 / kit.mod) : '';
  clausula('CLÁUSULA PRIMEIRA – OBJETO');
  par(`O presente contrato tem por objeto o PROJETO E INSTALAÇÃO DE 01 (um) SISTEMA GERADOR FOTOVOLTAICO DE ${kwp} kWp, COM COMPENSAÇÃO DE ENERGIA ELÉTRICA, nos termos da Lei Federal nº 14.300, de 6 de janeiro de 2022 (Marco Legal da Microgeração e Minigeração Distribuída), da Resolução Normativa ANEEL nº 1.000/2021, com as alterações da Resolução Normativa ANEEL nº 1.059/2023, e das normas técnicas da distribuidora ${conc.nome || sigla} à qual a Unidade Consumidora do CONTRATANTE está conectada, em especial a ${d.norma || 'norma técnica de conexão de micro e minigeração distribuída da distribuidora'}, E O FORNECIMENTO DOS EQUIPAMENTOS NECESSÁRIOS, a serem instalados no endereço do CONTRATANTE.`, { just:true });
  par(`Empreendimento: 01 (um) SISTEMA GERADOR FOTOVOLTAICO DE ${kwp} kWp, instalado em ${String(d.estrutura || 'telhado').toLowerCase()}, conectado ao padrão de entrada de energia existente da ${sigla}.`, { just:true });
  par('PARÁGRAFO PRIMEIRO – A CONTRATADA é empresa de prestação de serviços profissionais na área de engenharia e instalação e, pelo presente instrumento e restrita às suas atribuições profissionais, conforme previsto na legislação vigente, compromete-se a executar e fornecer ao CONTRATANTE os serviços e equipamentos descritos no caput, bem como na PROPOSTA TÉCNICO-COMERCIAL do ANEXO I.', { just:true });
  par(`• Potência do sistema: ${kwp} kWp`, { rec:4, depois:0.8 });
  if (nMod) par(`• Quantidade de módulos fotovoltaicos: ${nMod}`, { rec:4, depois:0.8 });
  if (potW) par(`• Potência dos módulos fotovoltaicos: ${potW} Wp`, { rec:4, depois:2.5 });
  par('Lista de produtos e serviços desta proposta:', { bold:true, depois:1.5 });
  const itens = (Array.isArray(dados.itens) && dados.itens.length ? dados.itens : [p.sistema]).concat(['HOMOLOGAÇÃO NA CONCESSIONÁRIA DE ENERGIA', 'MATERIAL E MÃO DE OBRA PARA INSTALAÇÃO']);
  itens.forEach(t => par('• ' + String(t).replace(/[;\s]+$/, ''), { rec:4, depois:0.6, tam:9.5 }));
  y += 2;
  par(`PARÁGRAFO SEGUNDO – Os serviços serão prestados com total autonomia pela CONTRATADA, observando a Lei Federal nº 14.300/2022, a regulamentação da ANEEL e a ${d.norma || 'norma técnica da distribuidora'} da ${sigla}.`, { just:true });

  clausula('CLÁUSULA SEGUNDA – PAGAMENTO');
  par(`O CONTRATANTE pagará à CONTRATADA o valor global de R$ ${brl(d.valor)} (${extenso(d.valor)}), referente aos serviços executados e aos equipamentos fornecidos conforme o objeto deste contrato.`, { just:true });
  par('PARÁGRAFO PRIMEIRO – No valor contratado, conforme a Cláusula Segunda, estão inclusas todas as despesas incidentes sobre a prestação dos serviços, compreendendo materiais, equipamentos, mão de obra, deslocamentos, impostos, taxas, encargos trabalhistas e outros inerentes ao contrato.', { just:true });
  par('PARÁGRAFO SEGUNDO – Os pagamentos devidos pelo CONTRATANTE serão realizados da seguinte forma:', { just:true });
  par(d.forma_pagamento || '______________________________________________________________', { rec:4 });
  par('DADOS BANCÁRIOS:', { bold:true, depois:1 });
  String(conta.dados || '').split('\n').filter(Boolean).forEach(l => par(l, { rec:4, depois:0.4, tam:9.5 }));
  y += 2;
  par('PARÁGRAFO TERCEIRO – ' + (T.multa_atraso || ''), { just:true });

  clausula('CLÁUSULA TERCEIRA – DOS RECURSOS');
  par('Os recursos técnicos, humanos e outros que se fizerem necessários à execução do objeto deste contrato serão alocados por conta da CONTRATADA.', { just:true });
  par('Os recursos financeiros que se fizerem necessários à execução do objeto deste contrato serão alocados por conta do CONTRATANTE, conforme a Cláusula Segunda.', { just:true });

  clausula('CLÁUSULA QUARTA – DA EXECUÇÃO');
  par('O objeto do contrato, conforme a Cláusula Primeira, será executado pela CONTRATADA a partir da data de assinatura deste contrato.', { just:true });

  clausula('CLÁUSULA QUINTA – PRAZO DE EXECUÇÃO');
  par(`Os serviços contratados serão prestados no prazo máximo de ${d.prazo} dias úteis após a assinatura deste contrato, contados da data do pagamento da primeira parcela. A conclusão dos serviços é verificada por meio da solicitação de vistoria da microgeração perante a distribuidora ${sigla}.`, { just:true });
  par('PARÁGRAFO PRIMEIRO – A execução dos serviços objeto do presente contrato fica sujeita aos prazos de análise da distribuidora de energia local, e a CONTRATADA não possui qualquer ingerência sobre os prazos de aprovação das autorizações necessárias. Quaisquer atrasos nos prazos estabelecidos na legislação e regulados pela ANEEL não representarão infração contratual da CONTRATADA nem direito de extinção antecipada do contrato pelo CONTRATANTE, desde que o atraso ocorra em função de ações pendentes exclusivamente da distribuidora.', { just:true });

  clausula('CLÁUSULA SEXTA – DO ACOMPANHAMENTO E RECEBIMENTO DOS SERVIÇOS');
  par('O acompanhamento da execução do objeto deste contrato será feito pelo CONTRATANTE ou por representante por ele designado, que será responsável pelo recebimento dos serviços por meio de TERMO DE ACEITE DE SERVIÇO, a ser assinado ao final da execução do objeto.', { just:true });

  clausula('CLÁUSULA SÉTIMA – OBRIGAÇÕES');
  par('Fica estabelecido que o relacionamento entre CONTRATANTE e CONTRATADA, visando resguardar responsabilidades, será preferencialmente pela forma escrita, por meio de consultas e respostas.', { just:true });
  par('PARÁGRAFO PRIMEIRO – São obrigações da CONTRATADA:', { bold:true, depois:1.2 });
  ['a) Prestar os serviços contratados na forma e modo ajustados, dentro das normas e especificações técnicas aplicáveis, dando plena e total garantia dos mesmos;',
   'b) Executar os serviços contratados utilizando a melhor técnica e visando sempre o melhor resultado, sob sua exclusiva responsabilidade, sendo-lhe vedada a transferência dos mesmos a terceiros sem prévia e expressa concordância do CONTRATANTE;',
   'c) Responsabilizar-se pelos atos e/ou omissões praticados por seus empregados e prepostos, bem como pelos danos de qualquer natureza que estes venham a sofrer ou causar ao CONTRATANTE ou a terceiros em decorrência da prestação dos serviços;',
   'd) Efetuar o pagamento da remuneração de seus empregados e prepostos, sendo responsável por todos os ônus e encargos decorrentes da legislação trabalhista, fiscal e previdenciária, além dos impostos, taxas e despesas que venham a ser exigidos em decorrência das obrigações assumidas neste contrato;',
   'e) Responder única e exclusivamente por qualquer indenização pleiteada por seus empregados e prepostos, principalmente quanto a reclamações trabalhistas e/ou acidentes de trabalho;',
   'f) Cumprir todas as determinações das autoridades públicas competentes relativas aos serviços aqui contratados, bem como pagar todos os tributos federais, estaduais e municipais que incidam ou venham a incidir sobre eles;',
   'g) Arcar com as despesas decorrentes dos serviços ora contratados, seja por exigência legal ou por necessidade dos serviços, nada podendo ser cobrado do CONTRATANTE, salvo expressa previsão contratual em contrário.'].forEach(t => par(t, { rec:4, just:true, depois:1.5 }));
  par('PARÁGRAFO SEGUNDO – São obrigações do CONTRATANTE:', { bold:true, depois:1.2 });
  ['a) Efetuar o pagamento na forma e nos prazos definidos no presente contrato;',
   'b) Comunicar à CONTRATADA, por escrito, as reclamações feitas contra seus empregados e prepostos, bem como danos por eles causados;',
   'c) Fornecer à CONTRATADA toda a documentação solicitada para o projeto e a homologação junto à distribuidora, e contratar os serviços complementares que se mostrem necessários e sejam indicados pela CONTRATADA;',
   'd) Realizar o acompanhamento e as inspeções dos serviços executados, bem como assinar o termo de aceite ao final da execução.'].forEach(t => par(t, { rec:4, just:true, depois:1.5 }));

  clausula('CLÁUSULA OITAVA – GARANTIA');
  par('Serão oferecidos ao CONTRATANTE dois tipos de garantia: a garantia do fabricante e a garantia da CONTRATADA.', { just:true });
  par('PARÁGRAFO PRIMEIRO – A CONTRATADA repassará integralmente ao CONTRATANTE a garantia fornecida pelos fabricantes dos equipamentos, conforme a relação a seguir:', { just:true });
  par('a) ' + (T.garantia_modulos || ''), { rec:4, just:true, depois:1.2 });
  par('b) ' + (T.garantia_inversor || ''), { rec:4, just:true, depois:1.2 });
  par('c) ' + (T.garantia_servicos || ''), { rec:4, just:true });

  clausula('CLÁUSULA NONA – VIGÊNCIA E RESCISÃO');
  par('Ao final do prazo de execução, conforme a Cláusula Quinta, e desde que finalizado o objeto deste contrato pela CONTRATADA e realizados todos os pagamentos pelo CONTRATANTE, conforme a Cláusula Segunda, considerar-se-á extinto o presente contrato, sem prejuízo ou penalidades para as partes.', { just:true });
  par(`PARÁGRAFO PRIMEIRO – Qualquer das partes poderá rescindir unilateralmente o presente contrato, a qualquer tempo, independentemente de notificação ou interpelação judicial ou extrajudicial, desde que comunique por escrito com ${T.aviso_rescisao_dias || 30} dias úteis de antecedência, ressalvado o pagamento dos serviços já prestados e dos equipamentos e materiais adquiridos, e observadas as penalidades da Cláusula Décima.`, { just:true });
  par('PARÁGRAFO SEGUNDO – A CONTRATADA poderá rescindir o presente contrato em caso de inadimplemento contratual ou falta de pagamento por parte do CONTRATANTE, sem restituição dos valores já recebidos.', { just:true });
  par('PARÁGRAFO TERCEIRO – Os termos do contrato que, por sua natureza, devam subsistir à sua extinção permanecerão em vigor até que sejam integralmente cumpridos.', { just:true });

  clausula('CLÁUSULA DÉCIMA – PENALIDADES');
  par('O CONTRATANTE responderá por qualquer prejuízo que, direta ou indiretamente, cause à CONTRATADA, seja por ação ou omissão, sua ou de seus prepostos.', { just:true });
  par(`PARÁGRAFO PRIMEIRO – Em caso de rescisão contratual nos termos da Cláusula Nona, Parágrafo Primeiro, a parte que rescindir o contrato fica obrigada ao pagamento de multa rescisória de ${T.multa_rescisoria || '10% (dez por cento)'} do valor global do presente contrato.`, { just:true });

  clausula('CLÁUSULA DÉCIMA PRIMEIRA – DISPOSIÇÕES GERAIS');
  par('O CONTRATANTE declara ter recebido esclarecimentos sobre o objeto do contrato e não possui dúvidas quanto à sua finalidade e modo de funcionamento.', { just:true });
  par('PARÁGRAFO PRIMEIRO – As partes não poderão alegar, em hipótese alguma, como justificativa ou defesa, o desconhecimento, a incompreensão ou a dúvida, no todo ou em parte, das disposições deste contrato e de seu anexo.', { just:true });
  par('PARÁGRAFO SEGUNDO – O CONTRATANTE autoriza a CONTRATADA a tratar os seus dados pessoais exclusivamente para a execução deste contrato, a elaboração do projeto e a homologação junto à distribuidora, nos termos da Lei nº 13.709/2018 (Lei Geral de Proteção de Dados).', { just:true });

  clausula('CLÁUSULA DÉCIMA SEGUNDA – FORO');
  par(`Elegem as partes o foro da Comarca de ${d.foro || '____________'} para dirimir todas e quaisquer dúvidas ou questões oriundas do presente contrato, renunciando a qualquer outro, por mais especial e privilegiado que seja.`, { just:true });
  par('E, por estarem assim justos e contratados, assinam o presente em 02 (duas) vias de igual teor e forma, na presença de duas testemunhas, obrigando-se por si e seus sucessores, para que produza todos os efeitos de direito.', { just:true });

  const hoje = snap && snap.em ? new Date(snap.em) : new Date();
  const mes = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'][hoje.getMonth()];
  precisa(70);
  y += 4; par(`${d.local || '__________'}, ${hoje.getDate()} de ${mes} de ${hoje.getFullYear()}.`, { depois:22 });
  const sw = (LW - 16) / 2;
  doc.setLineWidth(0.3); doc.setDrawColor(60);
  doc.line(M, y, M + sw, y); doc.line(M + sw + 16, y, M + LW, y);
  doc.setFontSize(9); doc.setFont('helvetica', 'bold');
  doc.text(doc.splitTextToSize(C.razao || 'CONTRATADA', sw), M + sw / 2, y + 5, { align:'center' });
  doc.text(doc.splitTextToSize(d.nome || 'CONTRATANTE', sw), M + sw + 16 + sw / 2, y + 5, { align:'center' });
  doc.setFont('helvetica', 'normal');
  doc.text(C.cnpj || '', M + sw / 2, y + 10, { align:'center' }); doc.text(d.cpf || '', M + sw + 16 + sw / 2, y + 10, { align:'center' });
  doc.text('CONTRATADA', M + sw / 2, y + 14, { align:'center' }); doc.text('CONTRATANTE', M + sw + 16 + sw / 2, y + 14, { align:'center' });
  y += 34;
  doc.line(M, y, M + sw, y); doc.line(M + sw + 16, y, M + LW, y);
  doc.text('Testemunha 1 — Nome e CPF', M + sw / 2, y + 5, { align:'center' }); doc.text('Testemunha 2 — Nome e CPF', M + sw + 16 + sw / 2, y + 5, { align:'center' });

  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(120); doc.text('Página ' + i + ' de ' + n, 105, 287, { align:'center' }); doc.setTextColor(17); }
  const arq = nomeArquivoPadrao('Contrato', d.nome, p.kwp, p.id, hoje);
  return { doc, arq };
}

// reimprime um contrato do histórico, exatamente com os dados e a data daquela emissão
async function baixarContrato(leadId, idx) {
  if (!window.jspdf) { alert('Gerador de PDF não carregou. Verifique a internet.'); return; }
  const { data } = await sb.from('leads').select('contratos').eq('id', leadId).maybeSingle();
  const c = data && data.contratos && data.contratos[idx];
  if (!c) { alert('Contrato não encontrado.'); return; }
  if (!CONTRATO_CFG) await carregarContratoCfg();
  const { doc, arq } = montarContratoPDF(c.d, c.proposta, c.conc || {}, c.conta || {}, c);
  doc.save(arq);
}

// detalhes de uma proposta salva (abre/fecha) + botão para gerar o PDF de novo
async function verProposta(id) {
  const box = $('pdet-' + id); if (!box) return;
  if (box.classList.contains('aberto')) { box.classList.remove('aberto'); return; }
  box.classList.add('aberto'); box.innerHTML = '<span class="muted">Carregando…</span>';
  const { data: o, error } = await sb.from('orcamentos').select('*').eq('id', id).maybeSingle();
  if (error || !o) { box.innerHTML = '<span class="muted">Não foi possível carregar.</span>'; return; }
  const dd = o.dados || {};
  const orient = { norte:'Norte', leste:'Leste', oeste:'Oeste', sul:'Sul' }[dd.orientacao] || dd.orientacao || '—';
  const linha = (r, v) => v ? `<dt>${r}</dt><dd>${v}</dd>` : '';
  box.innerHTML = `<dl>
      ${linha('Tipo', o.tipo === 'nacional' ? 'Kit nacional (FINAME)' : 'Kit importado')}
      ${linha('Sistema', esc(o.sistema) + ' · ' + String(o.kwp).replace('.', ',') + ' kWp')}
      ${linha('Valor', fmtR(o.valor_final) + (dd.modo_valor === 'separado' && dd.valor_kit ? ' (kit ' + fmtR(dd.valor_kit) + ' + serviços ' + fmtR(o.valor_final - dd.valor_kit) + ')' : ''))}
      ${linha('Desconto / adicional', (dd.desconto_pct ? dd.desconto_pct + '% desc.' : '') + (dd.adicional ? (dd.desconto_pct ? ' · ' : '') + fmtR(dd.adicional) + ' adic.' : ''))}
      ${linha('Conta de luz', dd.conta_atual ? fmtR(dd.conta_atual) + '/mês' + (dd.conta_meta ? ' · quer gerar ' + fmtR(dd.conta_meta) + '/mês' : '') : '')}
      ${linha('Geração', dd.producao_mensal_kwh ? dd.producao_mensal_kwh.toLocaleString('pt-BR') + ' kWh/mês' : '')}
      ${linha('Telhado', orient + (dd.estrutura ? ' · ' + esc(dd.estrutura) : ''))}
      ${linha('Região', dd.regiao ? esc(dd.regiao.nome) : '')}
      ${linha('Fornecedor', esc(dd.fornecedor || ''))}
      ${linha('Conta p/ pagamento', esc(dd.conta_pagamento || ''))}
      ${linha('Feita por', esc(nomeDe(o.vendedor_email)) + ' em ' + fmtDH(o.criado_em))}
    </dl>
    ${Array.isArray(dd.itens) && dd.itens.length ? '<div class="muted" style="margin-bottom:8px">' + dd.itens.map(esc).join('<br>') + '</div>' : ''}
    <a class="btn" href="./?pdf=${o.id}" target="_blank" rel="noopener">⬇ Gerar PDF desta proposta</a>`;
}

// ── admin: modelo do contrato ──
async function abrirModeloContrato() {
  if (!CONTRATO_CFG) await carregarContratoCfg();
  const C = CONTRATO_CFG.contratada || {}, T = CONTRATO_CFG.textos || {};
  const campoC = (k, rot) => `<div><label>${rot}</label><input class="input" data-c="${k}" value="${esc(C[k] || '')}"></div>`;
  const campoT = (k, rot, area) => `<div class="largo"><label>${rot}</label>${area ? `<textarea class="input" rows="3" data-t="${k}">${esc(T[k] || '')}</textarea>` : `<input class="input" data-t="${k}" value="${esc(T[k] || '')}">`}</div>`;
  $('contrato-corpo').innerHTML = `
    <h3>Concessionárias e normas</h3>
    <div id="mc-conc">${(CONTRATO_CFG.concessionarias || []).map((c, i) => linhaConc(c, i)).join('')}</div>
    <button class="btn btn-sec" onclick="addConc()">+ Concessionária</button>
    <h3>Dados da Energtech (contratada)</h3>
    <div class="grade">${campoC('razao', 'Razão social')}${campoC('cnpj', 'CNPJ')}${campoC('endereco', 'Endereço')}${campoC('bairro', 'Bairro')}${campoC('municipio', 'Município/UF')}${campoC('socio', 'Sócio')}${campoC('nacionalidade', 'Nacionalidade')}${campoC('estado_civil', 'Estado civil')}${campoC('profissao', 'Profissão')}${campoC('rg', 'RG')}${campoC('cpf', 'CPF')}</div>
    <h3>Textos e prazos</h3>
    <div class="grade">
      <div><label>Prazo padrão (dias úteis)</label><input class="input" type="number" data-t="prazo_dias" value="${esc(T.prazo_dias || 60)}"></div>
      <div><label>Aviso de rescisão (dias úteis)</label><input class="input" type="number" data-t="aviso_rescisao_dias" value="${esc(T.aviso_rescisao_dias || 30)}"></div>
      ${campoT('multa_rescisoria', 'Multa rescisória')}${campoT('multa_atraso', 'Multa por atraso no pagamento', true)}
      ${campoT('garantia_modulos', 'Garantia — módulos', true)}${campoT('garantia_inversor', 'Garantia — inversores', true)}${campoT('garantia_servicos', 'Garantia — serviços', true)}
    </div>
    <div class="acoes"><button class="btn" onclick="salvarModeloContrato()">💾 Salvar modelo</button><span class="status-msg" id="mc-msg"></span></div>`;
  $('contrato-titulo').textContent = '⚙ Modelo do contrato';
  $('ov-contrato').classList.add('visivel');
}
function linhaConc(c, i) {
  return `<div class="prop" style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:start" data-i="${i}">
    <input class="input" data-k="sigla" placeholder="Sigla (ex.: COPEL)" value="${esc(c.sigla || '')}">
    <input class="input" data-k="nome" placeholder="Razão social" value="${esc(c.nome || '')}">
    <button class="fechar" title="Remover" onclick="this.closest('.prop').remove()">×</button>
    <textarea class="input" data-k="norma" rows="2" style="grid-column:1/-1" placeholder="Norma técnica aplicável">${esc(c.norma || '')}</textarea>
    <input type="hidden" data-k="id" value="${esc(c.id || '')}"></div>`;
}
function addConc() { $('mc-conc').insertAdjacentHTML('beforeend', linhaConc({ id:'c' + Date.now().toString(36) }, 999)); }
async function salvarModeloContrato() {
  const conc = [...document.querySelectorAll('#mc-conc .prop')].map(el => {
    const o = {}; el.querySelectorAll('[data-k]').forEach(i => o[i.dataset.k] = i.value.trim());
    if (!o.id) o.id = (o.sigla || 'c').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '') || 'c' + Date.now();
    return o;
  }).filter(o => o.sigla || o.nome);
  const contratada = {}; document.querySelectorAll('#contrato-corpo [data-c]').forEach(i => contratada[i.dataset.c] = i.value.trim());
  const textos = {}; document.querySelectorAll('#contrato-corpo [data-t]').forEach(i => textos[i.dataset.t] = i.type === 'number' ? +i.value : i.value.trim());
  const dados = { contratada, concessionarias: conc, textos };
  const { error } = await sb.from('contrato_cfg').upsert({ id: 1, dados, atualizado_em: new Date().toISOString() });
  const msg = $('mc-msg');
  if (error) { msg.textContent = '⚠ ' + error.message; msg.classList.add('erro'); return; }
  CONTRATO_CFG = dados; msg.classList.remove('erro'); msg.textContent = '✅ Modelo salvo';
}

