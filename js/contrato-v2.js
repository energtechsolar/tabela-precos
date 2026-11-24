// Eider Sistemas / CRM — contrato modelo 2 (nov/2026). Carregado pelo js/comum.js depois do js/contrato.js e substitui:
// abrirContrato, gerarContrato, baixarContrato e abrirModeloContrato. O montarContratoPDF original (modelo 1) continua
// no js/contrato.js só para reimprimir os contratos antigos exatamente como foram emitidos.
// Modelo 2: preço à vista e a prazo com datas das parcelas, testemunhas, penalidades recíprocas, título executivo,
// Anexo II (números de série) e, no parcelado direto, reserva de domínio (CC 521–528), inadimplemento/limitação remota e seguro.

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
  // parcelado direto: o que já foi salvo no cliente, senão a condição de boleto da proposta mais recente
  const bol = (p0 && p0.dados && p0.dados.boleto) || null;
  const pc = dc.parcelado || (bol && bol.parcelas ? { ativo: bol.modo === 'negociada', entrada: bol.entrada || 0, n: bol.parcelas, parcela: bol.parcela } : {});
  const tt = (dc.testemunhas || []).concat([{}, {}]);
  $('contrato-titulo').textContent = '📝 Contrato';
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
      <div><label>Preço à vista (R$)</label><input class="input" type="number" step="0.01" id="ct-valor" value="${esc(dc.valor || '')}" oninput="$('ct-ext').textContent = extenso(this.value); atualizarParc()"></div>
      <div class="largo muted" id="ct-ext"></div>
      <div class="largo"><label style="display:flex;gap:8px;align-items:center;color:var(--texto);font-size:13px"><input type="checkbox" id="ct-parc" ${pc.ativo ? 'checked' : ''} onchange="atualizarParc()"> <b>Parcelado direto com a Energtech (boleto)</b></label><div class="muted" style="font-size:12px">O contrato sai com preço à vista e a prazo, datas das parcelas, reserva de domínio, limitação remota da geração e seguro.</div></div>
      <div class="largo" id="ct-parc-box"><div class="grade">
        <div><label>Entrada na assinatura (R$, 0 se não tiver)</label><input class="input" type="number" step="0.01" id="ct-entrada" value="${esc(pc.entrada != null ? pc.entrada : '')}" oninput="atualizarParc()"></div>
        <div><label>Nº de parcelas</label><input class="input" type="number" min="1" id="ct-n" value="${esc(pc.n || '')}" oninput="atualizarParc()"></div>
        <div><label>Valor de cada parcela (R$)</label><input class="input" type="number" step="0.01" id="ct-vparc" value="${esc(pc.parcela || '')}" oninput="atualizarParc()"></div>
        <div><label>1º vencimento</label><input class="input" type="date" id="ct-venc1" value="${esc(pc.venc1 || '')}" oninput="atualizarParc()"></div>
        <div class="largo muted" id="ct-parc-res"></div>
        <div><label>Seguro dos equipamentos</label><select class="select" id="ct-seg">
          <option value="" ${!pc.seguro ? 'selected' : ''}>Cliente marca na assinatura</option>
          <option value="plano" ${pc.seguro === 'plano' ? 'selected' : ''}>Contrata o plano da Energtech</option>
          <option value="apolice" ${pc.seguro === 'apolice' ? 'selected' : ''}>Apresenta apólice própria</option></select></div>
        <div><label>Valor anual do plano de proteção (R$)</label><input class="input" type="number" step="0.01" id="ct-seg-valor" value="${esc(pc.seguro_valor || '')}"></div>
      </div></div>
      <div class="largo" id="ct-pag-box"><label>Forma de pagamento</label><textarea class="input" id="ct-pag" rows="3" placeholder="Ex.: Entrada de R$ 3.000,00 na assinatura e saldo de R$ 6.500,00 na instalação.">${esc(dc.forma_pagamento || lf.forma_pagamento || '')}</textarea></div>
      <div><label>Conta para pagamento</label><select class="select" id="ct-conta">${opConta}</select></div>
      <div><label>Prazo de execução (dias úteis)</label><input class="input" type="number" id="ct-prazo" value="${esc(dc.prazo || T.prazo_dias || 60)}"></div>
      <div><label>Foro (comarca)</label><input class="input" id="ct-foro" value="${esc(dc.foro || cidade)}"></div>
      <div><label>Local e data</label><input class="input" id="ct-local" value="${esc(cidade.split('/')[0].trim())}"></div>
      <div><label>Testemunha 1 — nome</label><input class="input" id="ct-t1n" value="${esc(tt[0].nome || '')}"></div>
      <div><label>Testemunha 1 — CPF</label><input class="input" id="ct-t1c" value="${esc(tt[0].cpf || '')}"></div>
      <div><label>Testemunha 2 — nome</label><input class="input" id="ct-t2n" value="${esc(tt[1].nome || '')}"></div>
      <div><label>Testemunha 2 — CPF</label><input class="input" id="ct-t2c" value="${esc(tt[1].cpf || '')}"></div>
      <div class="largo muted">As 2 testemunhas fazem o contrato valer como título executivo (cobrança direta, sem processo para provar a dívida). Pode deixar em branco e preencher à mão na assinatura.</div>
    </div>
    <div class="acoes"><button class="btn" onclick="gerarContrato()" ${contratoProps.length ? '' : 'disabled'}>📝 Gerar contrato (PDF)</button><span class="status-msg" id="ct-msg"></span></div>`;
  $('ov-contrato').classList.add('visivel');
  if (!dc.concessionaria_id || !dc.norma) trocarConcessionaria(); else $('ct-norma').value = dc.norma;
  if (!dc.valor || !dc.estrutura) preencherDaProposta(!!dc.valor);
  $('ct-ext').textContent = extenso($('ct-valor').value);
  atualizarParc();
}

function dataLocal(iso) { if (!iso) return null; const [a, m, d] = String(iso).split('-').map(Number); return a && m && d ? new Date(a, m - 1, d) : null; }

function fmtData(dt) { return dt ? String(dt.getDate()).padStart(2, '0') + '/' + String(dt.getMonth() + 1).padStart(2, '0') + '/' + dt.getFullYear() : '__/__/____'; }

function vencimentosContrato(venc1, n) {
  const d0 = dataLocal(venc1);
  return Array.from({ length: n }, (_, i) => {
    if (!d0) return null;
    const ult = new Date(d0.getFullYear(), d0.getMonth() + i + 1, 0).getDate();
    return new Date(d0.getFullYear(), d0.getMonth() + i, Math.min(d0.getDate(), ult));
  });
}

function taxaEquivalente(saldo, n, parcela) {
  if (!(saldo > 0 && n > 0 && parcela > 0) || parcela * n <= saldo) return 0;
  const vp = i => { let s = 0; for (let k = 1; k <= n; k++) s += parcela / Math.pow(1 + i, k); return s; };
  let a = 0, b = 1; for (let it = 0; it < 80; it++) { const m = (a + b) / 2; if (vp(m) > saldo) a = m; else b = m; }
  return (a + b) / 2;
}

function lerParcelado() {
  const on = !!($('ct-parc') && $('ct-parc').checked);
  const v = { ativo: on, entrada: Math.round((+$('ct-entrada').value || 0) * 100) / 100, n: Math.max(0, Math.round(+$('ct-n').value || 0)),
    parcela: Math.round((+$('ct-vparc').value || 0) * 100) / 100, venc1: $('ct-venc1').value || '', seguro: $('ct-seg').value, seguro_valor: +$('ct-seg-valor').value || 0 };
  v.total = Math.round((v.entrada + v.n * v.parcela) * 100) / 100;
  return v;
}

function atualizarParc() {
  if (!$('ct-parc')) return;
  const pc = lerParcelado();
  $('ct-parc-box').style.display = pc.ativo ? '' : 'none';
  $('ct-pag-box').style.display = pc.ativo ? 'none' : '';
  if (!pc.ativo) return;
  const v = +$('ct-valor').value || 0, res = $('ct-parc-res');
  if (!pc.n || !pc.parcela) { res.textContent = 'Preencha o nº de parcelas e o valor de cada parcela.'; return; }
  if (pc.total < v - 0.004) { res.innerHTML = '<span style="color:var(--vermelho)">⚠ O preço a prazo (' + fmtR(pc.total) + ') ficou menor que o preço à vista. Confira os valores.</span>'; return; }
  const t = taxaEquivalente(v - pc.entrada, pc.n, pc.parcela);
  const vs = vencimentosContrato(pc.venc1, pc.n);
  res.innerHTML = 'Preço a prazo: <b style="color:var(--amarelo)">' + fmtR(pc.total) + '</b> (' + (pc.entrada ? 'entrada ' + fmtR(pc.entrada) + ' + ' : '') + pc.n + '× ' + fmtR(pc.parcela) + ')'
    + ' · acréscimo de ' + fmtR(pc.total - v) + ' sobre o preço à vista'
    + (pc.venc1 ? ' · parcelas de ' + fmtData(vs[0]) + ' a ' + fmtData(vs[vs.length - 1]) : ' · <span style="color:var(--amarelo)">falta o 1º vencimento</span>')
    + (t ? '<br>Equivale a ≈ ' + (t * 100).toFixed(2).replace('.', ',') + '% ao mês (referência interna, não aparece no contrato)' + (t > 0.01 ? ' <span style="color:var(--amarelo)">· acima de 1% ao mês: confirme com o advogado</span>' : '') : '');
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
    testemunhas: [{ nome: $('ct-t1n').value.trim(), cpf: $('ct-t1c').value.trim() }, { nome: $('ct-t2n').value.trim(), cpf: $('ct-t2c').value.trim() }],
  };
  const pc = lerParcelado();
  if (pc.ativo) {
    if (!pc.n || !pc.parcela) { alert('Parcelado: preencha o nº de parcelas e o valor de cada parcela.'); return; }
    if (pc.total < d.valor - 0.004) { alert('O preço a prazo (' + fmtR(pc.total) + ') está menor que o preço à vista (' + fmtR(d.valor) + '). Confira os valores.'); return; }
    if (!pc.venc1 && !confirm('Falta a data do 1º vencimento.\nGerar mesmo assim (datas em branco para preencher à mão)?')) return;
    d.parcelado = pc;
    d.forma_pagamento = (pc.entrada ? 'Entrada de ' + fmtR(pc.entrada) + ' + ' : '') + pc.n + 'x de ' + fmtR(pc.parcela) + ' no boleto direto com a Energtech'
      + (pc.venc1 ? ' (1º venc. ' + fmtData(dataLocal(pc.venc1)) + ')' : '') + ' · total a prazo ' + fmtR(pc.total) + ' · à vista ' + fmtR(d.valor);
  } else d.parcelado = { ativo: false };
  const faltam = [['nome', 'nome'], ['cpf', 'CPF/CNPJ'], ['endereco', 'endereço'], ['municipio', 'município'], ['uc', 'unidade consumidora'], ['forma_pagamento', 'forma de pagamento']].filter(([k]) => !d[k]).map(([, n]) => n);
  if (faltam.length && !confirm('Faltam: ' + faltam.join(', ') + '.\nGerar mesmo assim (com espaço em branco para preencher à mão)?')) return;
  const snap = { modelo: 2, em: new Date().toISOString(), autor: perfil.email, orcamento_id: p.id, d, conc, conta,
    proposta: { id: p.id, kwp: p.kwp, sistema: p.sistema, dados: { itens: (p.dados || {}).itens, kit: { kwp: ((p.dados || {}).kit || {}).kwp, mod: ((p.dados || {}).kit || {}).mod } } },
    contratada: CONTRATO_CFG.contratada, textos: CONTRATO_CFG.textos };
  const { doc, arq } = montarContratoPDF2(d, p, conc, conta, snap);
  doc.save(arq);
  // guarda os dados no cliente para a próxima vez + cópia no histórico de contratos
  const l = contratoLead;
  const { data: atual } = await sb.from('leads').select('contratos').eq('id', l.id).maybeSingle();
  const historico = ((atual && atual.contratos) || []).concat([snap]);
  const mud = { contratos: historico, dados_contrato: d, cpf_cnpj: d.cpf || null, uc: d.uc || null, concessionaria: conc.sigla || conc.nome || null, forma_pagamento: d.forma_pagamento || null, endereco: d.endereco || null, cep: d.cep || null };
  const { error } = await sb.from('leads').update(mud).eq('id', l.id);
  if (!error) {
    Object.assign(l, mud);
    await sb.from('lead_eventos').insert({ lead_id: l.id, texto: '📝 Contrato gerado — proposta Nº ' + String(p.id).padStart(5, '0') + ' · ' + (d.parcelado.ativo ? 'parcelado ' + d.forma_pagamento : fmtR(d.valor)) + ' · ' + (conc.sigla || conc.nome) });
    $('ct-msg').textContent = '✅ Contrato gerado e dados salvos no cliente';
    if (fichaId === l.id) abrirFicha(l.id, true);
  } else { $('ct-msg').textContent = '⚠ PDF gerado, mas os dados não foram salvos: ' + error.message; $('ct-msg').classList.add('erro'); }
}

function montarContratoPDF2(d, p, conc, conta, snap) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'mm', format:'a4' });
  const C = (snap && snap.contratada) || CONTRATO_CFG.contratada || {}, T = (snap && snap.textos) || CONTRATO_CFG.textos || {};
  const M = 22, LW = 210 - 2 * M, LIM = 297 - 24;
  let y = 0;
  const brl = v => (+v || 0).toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 });
  const rs = v => 'R$ ' + brl(v) + ' (' + extenso(v) + ')';
  const sigla = conc.sigla || conc.nome || 'distribuidora';
  const pc = (d.parcelado && d.parcelado.ativo) ? d.parcelado : null;
  const tt = (d.testemunhas || []).concat([{}, {}]);
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
  const par = (txt, o) => {
    o = o || {};
    const tam = o.tam || 10, x0 = M + (o.rec || 0), larg = LW - (o.rec || 0), alt = tam * 0.48;
    txt = String(txt);
    const m = !o.bold && txt.match(/^((?:PARÁGRAFO [A-ZÁÉÍÓÚÂÊÔÃÕÇ]+|DADOS BANCÁRIOS:)\s*–?)\s*/);
    const nNeg = m ? m[1].split(/\s+/).length : 0;
    const palavras = txt.split(/\s+/).filter(Boolean).map((w, i) => ({ w, neg: o.bold || i < nNeg }));
    const fonte = neg => { doc.setFont('helvetica', neg ? 'bold' : 'normal'); doc.setFontSize(tam); };
    const larguraDe = p => { fonte(p.neg); let w = 0; for (const c of p.w) w += doc.getTextWidth(c); return w; };
    fonte(false); const esp = doc.getTextWidth(' ');
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
  // numeração das cláusulas: as da venda parcelada só entram quando há parcelado direto
  const ORD = ['PRIMEIRA','SEGUNDA','TERCEIRA','QUARTA','QUINTA','SEXTA','SÉTIMA','OITAVA','NONA','DÉCIMA','DÉCIMA PRIMEIRA','DÉCIMA SEGUNDA','DÉCIMA TERCEIRA','DÉCIMA QUARTA','DÉCIMA QUINTA','DÉCIMA SEXTA'];
  const nomeC = n => ORD[n - 1].toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());   // "Décima Terceira"
  const N = pc ? { reserva: 12, inad: 13, seguro: 14, foro: 15 } : { foro: 12 };
  let nCl = 0;
  const clausula = t => { nCl++; y += 2; precisa(14); par('CLÁUSULA ' + ORD[nCl - 1] + ' – ' + t, { bold:true, depois:1.5 }); };
  const campo = (rot, val) => { const v = val && String(val).trim() ? val : '____________________________________'; par(rot + ' ' + v, { depois:1.2 }); };
  const rubrica = () => { precisa(8); y += 1; doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text('Rubrica do CONTRATANTE: ______________________', M, y); y += 6; };

  cabecalho();
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); doc.text('CONTRATO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS', 105, y, { align:'center' }); y += 5.5;
  doc.text('E FORNECIMENTO DE EQUIPAMENTOS', 105, y, { align:'center' }); y += 6;
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
  const itensKit = Array.isArray(dados.itens) && dados.itens.length ? dados.itens : [p.sistema];

  clausula('OBJETO');
  par(`O presente contrato tem por objeto o PROJETO E INSTALAÇÃO DE 01 (um) SISTEMA GERADOR FOTOVOLTAICO DE ${kwp} kWp, COM COMPENSAÇÃO DE ENERGIA ELÉTRICA, nos termos da Lei Federal nº 14.300, de 6 de janeiro de 2022 (Marco Legal da Microgeração e Minigeração Distribuída), da Resolução Normativa ANEEL nº 1.000/2021, com as alterações da Resolução Normativa ANEEL nº 1.059/2023, e das normas técnicas da distribuidora ${conc.nome || sigla} à qual a Unidade Consumidora do CONTRATANTE está conectada, em especial a ${d.norma || 'norma técnica de conexão de micro e minigeração distribuída da distribuidora'}, E O FORNECIMENTO DOS EQUIPAMENTOS NECESSÁRIOS, a serem instalados no endereço do CONTRATANTE.`, { just:true });
  par(`Empreendimento: 01 (um) SISTEMA GERADOR FOTOVOLTAICO DE ${kwp} kWp, instalado em ${String(d.estrutura || 'telhado').toLowerCase()}, conectado ao padrão de entrada de energia existente da ${sigla}.`, { just:true });
  par('PARÁGRAFO PRIMEIRO – A CONTRATADA é empresa de prestação de serviços profissionais na área de engenharia e instalação e, pelo presente instrumento e restrita às suas atribuições profissionais, conforme previsto na legislação vigente, compromete-se a executar e fornecer ao CONTRATANTE os serviços e equipamentos descritos no caput, bem como na PROPOSTA TÉCNICO-COMERCIAL do ANEXO I.', { just:true });
  par(`• Potência do sistema: ${kwp} kWp`, { rec:4, depois:0.8 });
  if (nMod) par(`• Quantidade de módulos fotovoltaicos: ${nMod}`, { rec:4, depois:0.8 });
  if (potW) par(`• Potência dos módulos fotovoltaicos: ${potW} Wp`, { rec:4, depois:2.5 });
  par('Lista de produtos e serviços desta proposta:', { bold:true, depois:1.5 });
  itensKit.concat(['HOMOLOGAÇÃO NA CONCESSIONÁRIA DE ENERGIA', 'MATERIAL E MÃO DE OBRA PARA INSTALAÇÃO']).forEach(t => par('• ' + String(t).replace(/[;\s]+$/, ''), { rec:4, depois:0.6, tam:9.5 }));
  y += 2;
  par(`PARÁGRAFO SEGUNDO – Os serviços serão prestados com total autonomia pela CONTRATADA, observando a Lei Federal nº 14.300/2022, a regulamentação da ANEEL e a ${d.norma || 'norma técnica da distribuidora'} da ${sigla}.`, { just:true });
  par('PARÁGRAFO TERCEIRO – Os equipamentos fornecidos serão identificados pelos seus números de série no ANEXO II – TERMO DE IDENTIFICAÇÃO E ENTREGA DOS EQUIPAMENTOS, assinado pelas partes na instalação, que integra este contrato.', { just:true });

  clausula('PAGAMENTO');
  if (!pc) {
    par(`O CONTRATANTE pagará à CONTRATADA o valor global de ${rs(d.valor)}, referente aos serviços executados e aos equipamentos fornecidos conforme o objeto deste contrato.`, { just:true });
    par('PARÁGRAFO PRIMEIRO – No valor contratado, conforme a Cláusula Segunda, estão inclusas todas as despesas incidentes sobre a prestação dos serviços, compreendendo materiais, equipamentos, mão de obra, deslocamentos, impostos, taxas, encargos trabalhistas e outros inerentes ao contrato.', { just:true });
    par('PARÁGRAFO SEGUNDO – Os pagamentos devidos pelo CONTRATANTE serão realizados da seguinte forma:', { just:true });
    par(d.forma_pagamento || '______________________________________________________________', { rec:4 });
  } else {
    const dif = Math.round((pc.total - d.valor) * 100) / 100;
    par(`O preço dos serviços e equipamentos objeto deste contrato é de ${rs(d.valor)} para pagamento à vista.`, { just:true });
    par(`PARÁGRAFO PRIMEIRO – O CONTRATANTE optou pelo pagamento a prazo, direto com a CONTRATADA, pelo preço total de ${rs(pc.total)}, assim composto: ${pc.entrada ? 'entrada de ' + rs(pc.entrada) + ', paga na assinatura deste contrato, e ' : ''}${pc.n} (${extenso(pc.n).replace(/ rea(l|is)$/, '')}) parcelas mensais e sucessivas de ${rs(pc.parcela)}, por boleto bancário, com os vencimentos abaixo. A diferença de ${rs(dif)} entre o preço a prazo e o preço à vista corresponde ao custo do pagamento parcelado; além dela, só incidem os encargos de atraso do Parágrafo Quarto.`, { just:true });
    // tabela de vencimentos em 3 colunas
    const vs = vencimentosContrato(pc.venc1, pc.n), col = 3, lin = Math.ceil(pc.n / col), cw = LW / col;
    precisa(Math.min(lin, 8) * 4.6 + 4);
    doc.setFontSize(9);
    for (let r = 0; r < lin; r++) {
      if (y + 5 > LIM) novaPag();
      for (let c = 0; c < col; c++) {
        const i = c * lin + r; if (i >= pc.n) continue;
        doc.setFont('helvetica', 'bold'); doc.text(String(i + 1).padStart(2, '0') + 'ª', M + 4 + c * cw, y);
        doc.setFont('helvetica', 'normal'); doc.text(fmtData(vs[i]) + '  ·  R$ ' + brl(pc.parcela), M + 12 + c * cw, y);
      }
      y += 4.6;
    }
    y += 2;
    par(`PARÁGRAFO SEGUNDO – No preço estão inclusas todas as despesas incidentes sobre a prestação dos serviços, compreendendo materiais, equipamentos, mão de obra, deslocamentos, impostos, taxas, encargos trabalhistas e outros inerentes ao contrato. O seguro dos equipamentos previsto na Cláusula ${nomeC(N.seguro)} não está incluso.`, { just:true });
    par('PARÁGRAFO TERCEIRO – O CONTRATANTE poderá antecipar o pagamento de parcelas, total ou parcialmente, com redução proporcional da diferença de preço do Parágrafo Primeiro (art. 52, § 2º, do Código de Defesa do Consumidor).', { just:true });
  }
  par('DADOS BANCÁRIOS:', { bold:true, depois:1 });
  String(conta.dados || '').split('\n').filter(Boolean).forEach(l => par(l, { rec:4, depois:0.4, tam:9.5 }));
  y += 2;
  par((pc ? 'PARÁGRAFO QUARTO – ' : 'PARÁGRAFO TERCEIRO – ') + (T.multa_atraso || 'Em caso de atraso no pagamento de qualquer parcela, incidirá multa moratória de 2% (dois por cento) sobre o valor da parcela em atraso, acrescida de juros de mora de 1% (um por cento) ao mês, calculados pro rata die, até a data do efetivo pagamento.'), { just:true });
  if (pc) par('PARÁGRAFO QUINTO – As parcelas vencidas e não pagas poderão ser levadas a protesto, independentemente de aviso, e a cobrança poderá ser feita por execução deste contrato.', { just:true });

  clausula('DOS RECURSOS');
  par('Os recursos técnicos, humanos e outros que se fizerem necessários à execução do objeto deste contrato serão alocados por conta da CONTRATADA.', { just:true });
  par('Os recursos financeiros que se fizerem necessários à execução do objeto deste contrato serão alocados por conta do CONTRATANTE, conforme a Cláusula Segunda.', { just:true });

  clausula('DA EXECUÇÃO');
  par('O objeto do contrato, conforme a Cláusula Primeira, será executado pela CONTRATADA a partir da data de assinatura deste contrato.', { just:true });

  clausula('PRAZO DE EXECUÇÃO');
  par(`Os serviços contratados serão prestados no prazo máximo de ${d.prazo} dias úteis, contados da data de assinatura deste contrato${pc ? (pc.entrada ? ' e do pagamento da entrada' : '') : ' e do pagamento previsto para o início dos serviços na Cláusula Segunda, quando houver'}. A conclusão dos serviços é verificada por meio da solicitação de vistoria da microgeração perante a distribuidora ${sigla}.`, { just:true });
  par('PARÁGRAFO PRIMEIRO – A execução dos serviços objeto do presente contrato fica sujeita aos prazos de análise da distribuidora de energia local, e a CONTRATADA não possui qualquer ingerência sobre os prazos de aprovação das autorizações necessárias. Quaisquer atrasos nos prazos estabelecidos na legislação e regulados pela ANEEL não representarão infração contratual da CONTRATADA nem direito de extinção antecipada do contrato pelo CONTRATANTE, desde que o atraso ocorra em função de ações pendentes exclusivamente da distribuidora.', { just:true });

  clausula('DO ACOMPANHAMENTO E RECEBIMENTO DOS SERVIÇOS');
  par('O acompanhamento da execução do objeto deste contrato será feito pelo CONTRATANTE ou por representante por ele designado, que será responsável pelo recebimento dos serviços por meio de TERMO DE ACEITE DE SERVIÇO, a ser assinado ao final da execução do objeto.', { just:true });

  clausula('OBRIGAÇÕES');
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
   'd) Realizar o acompanhamento e as inspeções dos serviços executados, bem como assinar o termo de aceite e o Anexo II ao final da execução' + (pc ? ';' : '.')]
   .concat(pc ? [`e) Conservar os equipamentos e manter o inversor conectado à internet, nos termos das Cláusulas ${nomeC(N.reserva)} e ${nomeC(N.inad)};`,
                 `f) Manter o seguro dos equipamentos, nos termos da Cláusula ${nomeC(N.seguro)}.`] : [])
   .forEach(t => par(t, { rec:4, just:true, depois:1.5 }));

  clausula('GARANTIA');
  par('Serão oferecidos ao CONTRATANTE dois tipos de garantia: a garantia do fabricante e a garantia da CONTRATADA.', { just:true });
  par('PARÁGRAFO PRIMEIRO – A CONTRATADA repassará integralmente ao CONTRATANTE a garantia fornecida pelos fabricantes dos equipamentos, conforme a relação a seguir:', { just:true });
  par('a) ' + (T.garantia_modulos || ''), { rec:4, just:true, depois:1.2 });
  par('b) ' + (T.garantia_inversor || ''), { rec:4, just:true, depois:1.2 });
  par('c) ' + (T.garantia_servicos || ''), { rec:4, just:true });
  par('PARÁGRAFO SEGUNDO – Perdem a garantia os equipamentos que sofrerem intervenção, remoção ou alteração por terceiros não autorizados pela CONTRATADA.', { just:true });

  clausula('VIGÊNCIA E RESCISÃO');
  par('Ao final do prazo de execução, conforme a Cláusula Quinta, e desde que finalizado o objeto deste contrato pela CONTRATADA e realizados todos os pagamentos pelo CONTRATANTE, conforme a Cláusula Segunda, considerar-se-á extinto o presente contrato, sem prejuízo ou penalidades para as partes.', { just:true });
  par(`PARÁGRAFO PRIMEIRO – Qualquer das partes poderá rescindir unilateralmente o presente contrato, a qualquer tempo, independentemente de notificação ou interpelação judicial ou extrajudicial, desde que comunique por escrito com ${T.aviso_rescisao_dias || 30} dias úteis de antecedência, ressalvado o pagamento dos serviços já prestados e dos equipamentos e materiais adquiridos, e observadas as penalidades da Cláusula Décima.`, { just:true });
  par(pc ? `PARÁGRAFO SEGUNDO – A CONTRATADA poderá rescindir o presente contrato em caso de inadimplemento contratual ou falta de pagamento por parte do CONTRATANTE, na forma da Cláusula ${nomeC(N.inad)}.`
         : 'PARÁGRAFO SEGUNDO – A CONTRATADA poderá rescindir o presente contrato em caso de inadimplemento contratual ou falta de pagamento por parte do CONTRATANTE, retendo dos valores recebidos o correspondente aos serviços já prestados, aos equipamentos e materiais adquiridos e às perdas comprovadas, e devolvendo o saldo, se houver.', { just:true });
  par('PARÁGRAFO TERCEIRO – Os termos do contrato que, por sua natureza, devam subsistir à sua extinção permanecerão em vigor até que sejam integralmente cumpridos.', { just:true });

  clausula('PENALIDADES');
  par('A parte que, por ação ou omissão, sua ou de seus prepostos, causar prejuízo à outra responderá pelos danos comprovadamente causados.', { just:true });
  par(`PARÁGRAFO PRIMEIRO – Em caso de rescisão contratual nos termos da Cláusula Nona, Parágrafo Primeiro, a parte que rescindir o contrato fica obrigada ao pagamento de multa rescisória de ${T.multa_rescisoria || '10% (dez por cento)'} do valor global do presente contrato.`, { just:true });

  clausula('DISPOSIÇÕES GERAIS');
  par('O CONTRATANTE declara ter recebido esclarecimentos sobre o objeto do contrato e não possui dúvidas quanto à sua finalidade e modo de funcionamento.', { just:true });
  par('PARÁGRAFO PRIMEIRO – As partes declaram que leram e compreenderam todas as disposições deste contrato e de seus anexos.', { just:true });
  par('PARÁGRAFO SEGUNDO – O CONTRATANTE autoriza a CONTRATADA a tratar os seus dados pessoais exclusivamente para a execução deste contrato, a elaboração do projeto e a homologação junto à distribuidora, nos termos da Lei nº 13.709/2018 (Lei Geral de Proteção de Dados).', { just:true });
  par('PARÁGRAFO TERCEIRO – Este contrato, assinado pelas partes e por duas testemunhas, ou por assinatura eletrônica, constitui título executivo extrajudicial, nos termos do art. 784, inciso III e § 4º, do Código de Processo Civil.', { just:true });

  if (pc) {
    const diasLim = T.limitacao_dias || 15, diasRet = T.retomada_dias || 60;
    clausula('DA RESERVA DE DOMÍNIO DOS EQUIPAMENTOS');
    par('Nos termos dos arts. 521 a 528 do Código Civil, a CONTRATADA reserva para si a propriedade de todos os equipamentos fornecidos neste contrato (módulos fotovoltaicos, inversor, estrutura e demais componentes do kit), identificados pelos números de série do ANEXO II, até a quitação integral do preço previsto na Cláusula Segunda. Até lá, o CONTRATANTE terá somente a posse direta e o uso dos equipamentos, na condição de depositário.', { just:true });
    par('PARÁGRAFO PRIMEIRO – A propriedade passa automaticamente ao CONTRATANTE com o pagamento da última parcela. O termo de quitação emitido pela CONTRATADA vale como comprovante.', { just:true });
    par('PARÁGRAFO SEGUNDO – Os equipamentos são bens móveis e removíveis. Eles não se incorporam ao imóvel e não constituem benfeitoria nem acessão. Enquanto não houver quitação, o CONTRATANTE não poderá vendê-los, cedê-los, alugá-los, dá-los em garantia, removê-los, modificá-los ou permitir que terceiros mexam neles sem autorização por escrito da CONTRATADA.', { just:true });
    par('PARÁGRAFO TERCEIRO – Se o CONTRATANTE vender, alugar ou transferir o imóvel antes da quitação, deverá avisar a CONTRATADA por escrito com no mínimo 15 (quinze) dias de antecedência.', { just:true });
    par('PARÁGRAFO QUARTO – Para valer contra terceiros, este contrato será registrado no Cartório de Registro de Títulos e Documentos do domicílio do CONTRATANTE (art. 522 do Código Civil), o que o CONTRATANTE desde já autoriza.', { just:true });
    rubrica();

    clausula('DO INADIMPLEMENTO E DA LIMITAÇÃO REMOTA DA GERAÇÃO');
    par(`Se qualquer parcela ficar em atraso por mais de ${diasLim} (${extenso(diasLim).replace(/ rea(l|is)$/, '')}) dias corridos após o vencimento, e o CONTRATANTE tiver sido notificado com no mínimo 5 (cinco) dias de antecedência (por WhatsApp, e-mail ou carta, nos contatos indicados no preâmbulo), a CONTRATADA poderá reduzir ou suspender remotamente a geração do sistema fotovoltaico pelo inversor, até que o débito seja regularizado.`, { just:true });
    par('PARÁGRAFO PRIMEIRO – A medida atinge apenas a geração própria do sistema. O fornecimento de energia pela distribuidora não é interrompido. A redução ou suspensão da geração, enquanto durar o atraso, não dá ao CONTRATANTE direito a indenização por perda de economia ou de créditos de energia.', { just:true });
    par('PARÁGRAFO SEGUNDO – A geração será restabelecida em até 2 (dois) dias úteis depois de confirmado o pagamento das parcelas em atraso, com os encargos da Cláusula Segunda.', { just:true });
    par('PARÁGRAFO TERCEIRO – O CONTRATANTE autoriza o acesso remoto da CONTRATADA ao inversor e ao sistema de monitoramento até a quitação. Também se compromete a manter o inversor conectado à internet e a não alterar senhas, trocar o módulo de comunicação ou desconectá-lo de propósito. A desconexão intencional é considerada descumprimento deste contrato.', { just:true });
    par(`PARÁGRAFO QUARTO – Se o atraso passar de ${diasRet} (${extenso(diasRet).replace(/ rea(l|is)$/, '')}) dias, a CONTRATADA poderá, à sua escolha: (a) considerar vencidas antecipadamente todas as parcelas e cobrar o saldo devedor, inclusive por execução deste contrato; ou (b) depois de constituir o CONTRATANTE em mora, mediante protesto do título ou interpelação judicial (art. 525 do Código Civil), rescindir o contrato e recuperar a posse dos equipamentos, devendo o CONTRATANTE permitir o acesso ao local para a retirada. Havendo recusa, a retomada se dará pela via judicial.`, { just:true });
    par('PARÁGRAFO QUINTO – Se os equipamentos forem retomados, a CONTRATADA poderá reter dos valores já pagos o necessário para cobrir a depreciação, o tempo de uso, os custos de projeto, homologação, instalação e retirada, além das multas previstas. O que sobrar será devolvido ao CONTRATANTE, conforme o art. 527 do Código Civil e o art. 53 do Código de Defesa do Consumidor.', { just:true });
    rubrica();

    clausula('DO SEGURO DOS EQUIPAMENTOS');
    const plano = T.seguro_nome || 'Plano de Proteção Anual Solar';
    const segur = T.seguro_seguradora || '____________________________________';
    par('Enquanto houver parcelas a pagar, o CONTRATANTE é obrigado a manter os equipamentos segurados contra roubo, furto, danos elétricos e fenômenos da natureza, com a CONTRATADA como beneficiária até a quitação.', { just:true });
    const vs = +pc.seguro_valor || 0;
    par(`PARÁGRAFO PRIMEIRO – O CONTRATANTE pode escolher livremente a seguradora. A CONTRATADA oferece o ${plano}, garantido pela seguradora ${segur}, no valor de ${vs ? rs(vs) : 'R$ ____________'} por ano${vs ? ', que podem ser pagos em 12 parcelas de R$ ' + brl(Math.round(vs / 12 * 100) / 100) : ''}. O CONTRATANTE escolhe:`, { just:true });
    const mk = k => pc.seguro === k ? '(X)' : '(   )';
    par(`${mk('plano')} contratar o plano oferecido pela CONTRATADA;`, { rec:4, depois:1 });
    par(`${mk('apolice')} apresentar, em até 10 (dez) dias após a instalação, uma apólice de outra seguradora com cobertura igual ou superior, com a CONTRATADA como beneficiária.`, { rec:4, just:true });
    par('PARÁGRAFO SEGUNDO – O seguro deverá ser renovado todo ano até a quitação.', { just:true });
    par('PARÁGRAFO TERCEIRO – Em caso de sinistro, a indenização será usada primeiro para pagar o saldo devedor com a CONTRATADA. O que sobrar será repassado ao CONTRATANTE.', { just:true });
    par(`PARÁGRAFO QUARTO – Se o seguro não for contratado ou não for renovado, isso é considerado inadimplemento e fica sujeito à Cláusula ${nomeC(N.inad)}.`, { just:true });
    rubrica();
  }

  precisa(120);   // foro, fecho, data e assinaturas na mesma página
  clausula('FORO');
  par(`Elegem as partes o foro da Comarca de ${d.foro || '____________'} para dirimir todas e quaisquer dúvidas ou questões oriundas do presente contrato, renunciando a qualquer outro, por mais especial e privilegiado que seja.`, { just:true });
  par('E, por estarem assim justos e contratados, assinam o presente em 02 (duas) vias de igual teor e forma, na presença de duas testemunhas, obrigando-se por si e seus sucessores, para que produza todos os efeitos de direito.', { just:true });

  const hoje = snap && snap.em ? new Date(snap.em) : new Date();
  const mes = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'][hoje.getMonth()];
  const sw = (LW - 16) / 2;
  const assinaturas = (esq, dir) => {
    doc.setLineWidth(0.3); doc.setDrawColor(60);
    doc.line(M, y, M + sw, y); doc.line(M + sw + 16, y, M + LW, y);
    [esq, dir].forEach((linhas, k) => linhas.forEach((t, i) => {
      doc.setFont('helvetica', i === 0 ? 'bold' : 'normal'); doc.setFontSize(9);
      doc.text(doc.splitTextToSize(t || '', sw)[0] || '', M + k * (sw + 16) + sw / 2, y + 5 + i * 4.5, { align:'center' });
    }));
  };
  y += 4; par(`${d.local || '__________'}, ${hoje.getDate()} de ${mes} de ${hoje.getFullYear()}.`, { depois:22 });
  assinaturas([C.razao || 'CONTRATADA', C.cnpj || '', 'CONTRATADA'], [d.nome || 'CONTRATANTE', d.cpf || '', 'CONTRATANTE']);
  y += 34;
  assinaturas([tt[0].nome ? 'Testemunha 1: ' + tt[0].nome : 'Testemunha 1 — Nome', tt[0].cpf ? 'CPF ' + tt[0].cpf : 'CPF'], [tt[1].nome ? 'Testemunha 2: ' + tt[1].nome : 'Testemunha 2 — Nome', tt[1].cpf ? 'CPF ' + tt[1].cpf : 'CPF']);

  // ANEXO II — identificação e entrega dos equipamentos (números de série)
  novaPag();
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('ANEXO II – TERMO DE IDENTIFICAÇÃO E ENTREGA DOS EQUIPAMENTOS', 105, y, { align:'center' }); y += 6;
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.text('Proposta Nº ' + String(p.id).padStart(5, '0') + ' · ' + (d.nome || '') + ' · UC ' + (d.uc || '________'), 105, y, { align:'center' }); y += 8;
  par('Os equipamentos abaixo, objeto do contrato, foram entregues e instalados no endereço do CONTRATANTE e ficam identificados pelos seus números de série' + (pc ? ', inclusive para os fins da reserva de domínio (art. 523 do Código Civil).' : '.'), { just:true, tam:9.5 });
  const achar = re => itensKit.find(t => re.test(String(t))) || '';
  const limpa = t => String(t).replace(/^\s*\d+\s*[xX×]\s*/, '').replace(/[;\s]+$/, '');
  const nInv = (() => { const m = String(achar(/INVERSOR|MICROINVERSOR/i)).match(/^\s*(\d+)\s*[xX×]/); return m ? +m[1] : 1; })();
  const linhas = [];
  for (let i = 0; i < nInv; i++) linhas.push(['Inversor', limpa(achar(/INVERSOR|MICROINVERSOR/i)) || '']);
  const qMod = +nMod || (() => { const m = String(achar(/M[ÓO]DULO/i)).match(/^\s*(\d+)\s*[xX×]/); return m ? +m[1] : 0; })() || 10;
  const modMod = limpa(achar(/M[ÓO]DULO/i));
  for (let i = 0; i < qMod; i++) linhas.push(['Módulo ' + (i + 1), i === 0 ? modMod : '〃']);
  const cx = [M, M + 8, M + 30, M + 104], cwid = [8, 22, 74, LW - 104];
  const cab = () => { doc.setFillColor(245, 245, 245); doc.rect(M, y - 4, LW, 6, 'F'); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
    ['#', 'Equipamento', 'Marca / modelo', 'Número de série'].forEach((t, i) => doc.text(t, cx[i] + 1.5, y)); y += 4; };
  y += 2; cab();
  doc.setDrawColor(190); doc.setLineWidth(0.2);
  linhas.forEach((l, i) => {
    if (y + 7 > LIM - 40) { novaPag(); cab(); }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text(String(i + 1), cx[0] + 1.5, y + 3.6); doc.text(l[0], cx[1] + 1.5, y + 3.6);
    doc.text(doc.splitTextToSize(l[1].replace('〃', '"  (mesmo modelo)'), cwid[2] - 3)[0] || '', cx[2] + 1.5, y + 3.6);
    doc.rect(M, y, LW, 5.6); [1, 2, 3].forEach(k => doc.line(cx[k], y, cx[k], y + 5.6));
    y += 5.6;
  });
  y += 6; precisa(46);
  par('Local e data: ______________________________, ____/____/________.', { tam:9.5, depois:20 });
  assinaturas([C.razao || 'CONTRATADA', 'CONTRATADA'], [d.nome || 'CONTRATANTE', 'CONTRATANTE']);

  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120);
    doc.text('Página ' + i + ' de ' + n, 105, 287, { align:'center' });
    doc.text('Rubricas: ________  ________', 210 - M, 287, { align:'right' }); doc.setTextColor(17); }
  const arq = nomeArquivoPadrao('Contrato', d.nome, p.kwp, p.id, hoje);
  return { doc, arq };
}

async function baixarContrato(leadId, idx) {
  if (!window.jspdf) { alert('Gerador de PDF não carregou. Verifique a internet.'); return; }
  const { data } = await sb.from('leads').select('contratos').eq('id', leadId).maybeSingle();
  const c = data && data.contratos && data.contratos[idx];
  if (!c) { alert('Contrato não encontrado.'); return; }
  if (!CONTRATO_CFG) await carregarContratoCfg();
  const montar = c.modelo === 2 ? montarContratoPDF2 : montarContratoPDF;   // contratos antigos: modelo 1, idêntico ao emitido
  const { doc, arq } = montar(c.d, c.proposta, c.conc || {}, c.conta || {}, c);
  doc.save(arq);
}

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
    <h3>Venda parcelada direto (boleto)</h3>
    <div class="grade">
      ${campoT('seguro_nome', 'Nome do plano de proteção oferecido pela Energtech')}
      ${campoT('seguro_seguradora', 'Seguradora responsável pelo plano (nome e CNPJ). Em branco, o contrato sai com espaço para preencher')}
      <div><label>Atraso para limitar a geração (dias)</label><input class="input" type="number" data-t="limitacao_dias" value="${esc(T.limitacao_dias || 15)}"></div>
      <div><label>Atraso para vencimento antecipado / retomada (dias)</label><input class="input" type="number" data-t="retomada_dias" value="${esc(T.retomada_dias || 60)}"></div>
    </div>
    <div class="acoes"><button class="btn" onclick="salvarModeloContrato()">💾 Salvar modelo</button><span class="status-msg" id="mc-msg"></span></div>`;
  $('contrato-titulo').textContent = '⚙ Modelo do contrato';
  $('ov-contrato').classList.add('visivel');
}
