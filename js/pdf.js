// Energtech — desenho do PDF da proposta (5 páginas)
// (arquivo carregado pelo index.html; a ordem dos <script> importa)

function montarPropostaPDF(d, fotos) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
  const W = 210, H = 297, X0 = 13, X1 = 197, CW = X1 - X0;
  const AM = [255,193,7], PR = [17,17,17], PR2 = [31,31,31], CZ = [102,102,102], CZC = [243,243,243], BD = [221,221,221],
        BR = [255,255,255], CL = [204,204,204], AZ = [21,101,192], VD = [46,125,50];
  const cor  = c => doc.setTextColor(c[0], c[1], c[2]);
  const fill = c => doc.setFillColor(c[0], c[1], c[2]);
  const draw = c => doc.setDrawColor(c[0], c[1], c[2]);
  const fonte = (tam, estilo) => { doc.setFontSize(tam); doc.setFont('helvetica', estilo || 'normal'); };
  const texto = (t, x, y, o) => doc.text(String(t), x, y, o || {});
  const linhas = (t, larg) => doc.splitTextToSize(String(t || ''), larg);
  const caixa = (x, y, w, h, c, borda) => { fill(c); if (borda) { draw(borda); doc.setLineWidth(0.25); doc.rect(x, y, w, h, 'FD'); } else doc.rect(x, y, w, h, 'F'); };
  // fonte que cabe na largura (nomes longos, valores grandes)
  const caber = (t, larg, tam, min, estilo) => { let s = tam; fonte(s, estilo); while (s > min && doc.getTextWidth(String(t)) > larg) { s -= 0.5; fonte(s, estilo); } return s; };
  const logo = (x, y, w) => { try { doc.addImage(LOGO_TOPO, 'JPEG', x, y, w, w * 240 / 900); } catch (e) {} };

  // ── ícones simples desenhados (o PDF não tem emoji) ──
  const icone = (tipo, cx, cy, s, c) => {
    c = c || AM; fill(c); draw(c); doc.setLineWidth(s * 0.09);
    if (tipo === 'raio') doc.lines([[s*0.35,-s*0.5],[-s*0.1,s*0.4],[s*0.3,0],[-s*0.55,s*0.62],[s*0.12,-s*0.45],[-s*0.3,0]], cx - s*0.05, cy - s*0.03, [1,1], 'F', true);
    else if (tipo === 'grafico') { [0.4, 0.7, 1.0].forEach((h, i) => doc.rect(cx - s*0.45 + i*s*0.33, cy + s*0.45 - h*s*0.9, s*0.24, h*s*0.9, 'F')); }
    else if (tipo === 'moeda') { doc.circle(cx, cy, s*0.48, 'F'); cor(PR); fonte(s*1.9, 'bold'); texto('$', cx, cy + s*0.24, { align:'center' }); }
    else if (tipo === 'casa') { doc.lines([[s*0.5,-s*0.45],[s*0.5,s*0.45]], cx - s*0.5, cy, [1,1], 'F', true); doc.rect(cx - s*0.35, cy - s*0.02, s*0.7, s*0.48, 'F'); }
    else if (tipo === 'pin') { doc.circle(cx, cy - s*0.15, s*0.32, 'F'); doc.lines([[s*0.3,0],[-s*0.3,s*0.58]], cx - s*0.15, cy - s*0.02, [1,1], 'F', true); fill(BR); doc.circle(cx, cy - s*0.15, s*0.12, 'F'); }
    else if (tipo === 'sol') { doc.circle(cx, cy, s*0.24, 'F'); for (let a = 0; a < 8; a++) { const r = a * Math.PI / 4; doc.line(cx + Math.cos(r)*s*0.33, cy + Math.sin(r)*s*0.33, cx + Math.cos(r)*s*0.5, cy + Math.sin(r)*s*0.5); } }
    else if (tipo === 'painel') { doc.lines([[s*0.75,0],[s*0.2,s*0.55],[-s*0.75,0]], cx - s*0.47, cy - s*0.3, [1,1], 'F', true); draw(BR); doc.setLineWidth(s*0.05); doc.line(cx - s*0.1, cy - s*0.3, cx + s*0.0, cy + s*0.25); doc.line(cx - s*0.37, cy - s*0.03, cx + s*0.38, cy - s*0.03); }
    else if (tipo === 'escudo') { doc.lines([[s*0.42,-s*0.14],[s*0.42,s*0.14],[0,s*0.38],[-s*0.42,s*0.34],[-s*0.42,-s*0.34]], cx - s*0.42, cy - s*0.36, [1,1], 'F', true); }
  };
  const check = (x, y, c) => { draw(c || AM); doc.setLineWidth(0.55); doc.line(x, y - 1.1, x + 0.9, y - 0.1); doc.line(x + 0.9, y - 0.1, x + 2.5, y - 2.2); };
  const listaCheck = (itens, x, y, larg, tam, c, entre) => {
    fonte(tam); itens.forEach(t => { const l = linhas(t, larg - 4); check(x, y); cor(c || PR); fonte(tam); doc.text(l, x + 4, y); y += l.length * tam * 0.42 + (entre || 1.6); });
    return y;
  };
  const anos = t => { const m = String(t || '').match(/\d+\s*(anos?|meses?)/i); return m ? m[0] : ''; };

  const cabecalho = () => {
    caixa(X0, 7, CW, 16.5, PR);
    logo(X0 + 4, 10.3, 36);
    cor(BR); fonte(7.5, 'bold'); texto('Proposta Nº', X1 - 4, 12, { align:'right' }); texto(d.numero, X1 - 4, 15.6, { align:'right' });
    cor(CL); fonte(7); texto(linhas(d.nome, 80)[0], X1 - 4, 19.6, { align:'right' });
  };
  const secao = (n, titulo, sub) => {
    cor(AM); fonte(13, 'bold'); texto(n + '.', X0, 32);
    cor(PR); texto(titulo, X0 + doc.getTextWidth(n + '. '), 32);
    fill(AM); doc.rect(X0 - 3, 34.6, 0.9, 3.8, 'F');
    cor(CZ); fonte(7.5); texto(sub, X0, 37.6);
  };
  const rodape = (n, total) => {
    draw([225,225,225]); doc.setLineWidth(0.25); doc.line(X0, 279, X1, 279);
    cor(CZ); fonte(6.8); texto(PROPOSTA_CFG.contatos || PROPOSTA_PADRAO.contatos, X0, 288);
    cor(PR); fonte(8, 'bold'); texto(n + '/' + total, X1, 288, { align:'right' });
  };
  // cartão cinza com rótulo pequeno em cima
  const rotulo = (t, x, y, c) => { cor(c || CZ); fonte(6.4, 'bold'); texto(t.toUpperCase(), x, y, { charSpace:0.15 }); };
  const fotoRodape = (img, yTopo) => {
    if (!img) return;
    const h = 52, y = 274 - h;
    if (yTopo > y - 4) return;
    doc.addImage(img, 'JPEG', X0, y, CW, h);
  };
  // fim da página: foto do rodapé (se o admin cadastrou) ou uma arte que ocupa o espaço livre
  const FIM = 274;
  const preencher = (img, yTopo, arte, hMin) => {
    if (img) { fotoRodape(img, yTopo); return; }
    const livre = FIM - yTopo;
    if (arte && livre >= hMin) arte(yTopo, livre);
  };
  const tituloArte = (ic, t, y) => { icone(ic, X0 + 2, y - 1.1, 3.4); cor(PR); fonte(9, 'bold'); texto(t, X0 + 6, y); };
  const seta = (x, y, c) => { fill(c || AM); doc.lines([[2.4, 2], [-2.4, 2]], x, y - 2, [1,1], 'F', true); };

  const imp = d.tipo === 'importado';
  const sep = d.modoValor === 'separado';
  const cheio = d.valorCheio || d.valor;                 // parcelado e financiamento: sem o desconto do à vista
  const temDesc = (d.descontoAVista || 0) > 0.5;
  const local = d.cidade || (d.regiao.nome.split(' (')[0] + ' / ' + d.regiao.uf);
  const orientTxt = { norte:'Norte', leste:'Leste', oeste:'Oeste', sul:'Sul' }[d.orientacao] || d.orientacao;
  const estrTxt = { fibrocimento:'Fibrocimento', ceramico:'Cerâmico', metalico:'Metálico', laje:'Laje', solo:'Solo' }[d.estrutura] || d.estrutura;
  const kwpTxt = d.item.kwp.toLocaleString('pt-BR');
  const kwh = v => Math.round(+v || 0).toLocaleString('pt-BR');
  const conc = PROPOSTA_CFG.concessionaria || 'concessionária';

  // ═══════════════ PÁGINA 1 — CAPA ═══════════════
  caixa(X0, 10, CW, 242, PR);
  fill(AM); doc.rect(X0, 251.4, CW, 0.6, 'F');
  logo(21, 15.5, 45);
  cor(BR); fonte(8.5, 'bold'); texto('SUA ENERGIA,', 189, 20, { align:'right' });
  cor(AM); texto('NOSSA SOLUÇÃO', 189, 24.4, { align:'right' });
  const FX = 21, FY = 35, FW = 168, FH = 95;
  if (fotos.capa) doc.addImage(fotos.capa, 'JPEG', FX, FY, FW, FH);
  else { caixa(FX, FY, FW, FH, PR2); icone('sol', FX + FW / 2, FY + FH / 2, 16, [70,70,70]); }

  cor(BR); fonte(8.5, 'bold'); texto('SISTEMA DE ENERGIA SOLAR FOTOVOLTAICA', 21, 141, { charSpace:0.7 });
  fonte(36, 'bold'); texto('PROPOSTA', 20.3, 156.5); texto('COMERCIAL', 20.3, 172);
  cor(AM); fonte(8, 'bold'); texto('PREPARADA PARA', 21, 184.5, { charSpace:0.8 });
  cor(BR); caber(d.nome, 165, 20, 12, 'bold'); texto(d.nome, 21, 193.5);
  cor(CL); fonte(9.5); texto(local, 21, 199.5);

  const c1w = (168 - 8) / 3;
  const capaCards = [
    ['raio', kwpTxt + ' kWp', d.item.mod + ' módulos de ' + d.potW + ' W', 'POTÊNCIA DO SISTEMA'],
    ['grafico', kwh(d.geracao) + ' kWh/mês', kwh(d.geracao * 12) + ' kWh/ano', 'GERAÇÃO ESTIMADA'],
    ['moeda', brl0(d.economia) + '/mês', 'na conta de luz', 'ECONOMIA ESTIMADA'],
  ];
  capaCards.forEach(([ic, val, sub, rot], i) => {
    const x = 21 + i * (c1w + 4), y = 205;
    caixa(x, y, c1w, 33, PR2); fill(AM); doc.rect(x, y, c1w, 0.6, 'F');
    icone(ic, x + c1w / 2, y + 7, 4.2);
    cor(BR); caber(val, c1w - 6, 14, 9, 'bold'); texto(val, x + c1w / 2, y + 19, { align:'center' });
    cor(AM); fonte(7); texto(sub, x + c1w / 2, y + 25.5, { align:'center' });
    fill(AM); doc.rect(x, y + 37, c1w, 5.2, 'F');
    cor(PR); fonte(6.8, 'bold'); texto(rot, x + c1w / 2, y + 40.6, { align:'center' });
  });

  const info = [['Proposta Nº', d.numero], ['Emissão', d.data], ['Válida até', d.validade], ['Consultor', d.vendedor || 'Energtech']];
  const iw = CW / 4;
  info.forEach(([r, v], i) => {
    const x = X0 + i * iw;
    if (i) { draw(BD); doc.setLineWidth(0.25); doc.line(x, 254, x, 271); }
    rotulo(r, x + 4.5, 258.5);
    cor(PR); fonte(9.5, 'bold'); texto(linhas(v, iw - 8)[0], x + 4.5, 263.8);
  });

  // ═══════════════ PÁGINA 2 — RESULTADOS ═══════════════
  doc.addPage(); cabecalho();
  secao(2, 'RESULTADOS DO SEU SISTEMA', 'O que o seu sistema vai produzir e quanto você vai economizar.');
  const res = [
    ['raio', 'Geração estimada', kwh(d.geracao) + ' kWh/mês', kwh(d.geracao * 12) + ' kWh por ano', PR],
    ['moeda', 'Economia estimada', brl0(d.economia) + '/mês', brl0(d.economia * 12) + ' no 1º ano', PR],
  ];
  if (d.conta) {
    if (d.usaMeta) res.push(['casa', 'Conta prevista (sem solar)', brl0(d.conta) + '/mês', d.contaHoje ? 'hoje: ' + brl0(d.contaHoje) + '/mês' : 'consumo previsto', AZ]);
    else res.push(['casa', 'Conta atual (estimada)', brl0(d.conta) + '/mês', d.consumo ? kwh(d.consumo) + ' kWh/mês' : '', AZ]);
    res.push(['casa', 'Nova conta (estimada)', brl0(d.novaConta) + '/mês', 'apenas taxa mínima', VD]);
  }
  const rw = (CW - 3 * (res.length - 1)) / res.length;
  res.forEach(([ic, r, v, s, c], i) => {
    const x = X0 + i * (rw + 3), y = 41;
    caixa(x, y, rw, 36, CZC, BD);
    icone(ic, x + rw / 2, y + 6, 3.4);
    cor(CZ); fonte(6.4, 'bold'); texto(r.toUpperCase(), x + rw / 2, y + 12.5, { align:'center' });
    cor(c); caber(v, rw - 5, 13, 8, 'bold'); texto(v, x + rw / 2, y + 21.5, { align:'center' });
    cor(CZ); fonte(6.8); texto(s, x + rw / 2, y + 29, { align:'center' });
  });

  icone('grafico', X0 + 2, 86.5, 3.4); cor(PR); fonte(9, 'bold'); texto('Estimativa de geração mês a mês', X0 + 6, 87.6);
  const GX = 21, GY = 91, GW = 169, GH = 72;
  caixa(GX, GY, GW, GH, BR, BD);
  const ger = PERFIL_MENSAL.map(f => d.geracao * f);
  const maxV = Math.max(...ger, d.consumo || 0) * 1.15;
  const ax = GX + 13, aw = GW - 18, ay = GY + 8, ah = GH - 18;
  const passo = Math.pow(10, Math.floor(Math.log10(maxV / 4))); const marca = Math.ceil(maxV / 4 / passo) * passo, topo = marca * 4;
  draw([236,236,236]); doc.setLineWidth(0.2); cor([150,150,150]); fonte(6);
  for (let v = 0; v <= topo + 0.1; v += marca) { const yy = ay + ah - (v / topo) * ah; doc.line(ax, yy, ax + aw, yy); texto(Math.round(v).toLocaleString('pt-BR'), ax - 2, yy + 1, { align:'right' }); }
  const bw = aw / 12;
  ger.forEach((v, i) => {
    const hb = (v / topo) * ah; fill(AM); doc.rect(ax + i * bw + bw * 0.18, ay + ah - hb, bw * 0.64, hb, 'F');
    cor(CZ); fonte(6.8); texto(MESES[i], ax + i * bw + bw / 2, ay + ah + 4.5, { align:'center' });
  });
  if (d.consumo) {
    const yc = ay + ah - (d.consumo / topo) * ah;
    draw([90,90,90]); doc.setLineWidth(0.4); doc.setLineDashPattern([1.2, 1], 0); doc.line(ax, yc, ax + aw, yc); doc.setLineDashPattern([], 0);
    fonte(6.5, 'bold'); const lc = (d.usaMeta ? 'Consumo previsto: ' : 'Seu consumo: ') + kwh(d.consumo) + ' kWh/mês', wl = doc.getTextWidth(lc) + 3;
    fill(BR); draw([90,90,90]); doc.setLineWidth(0.25); doc.roundedRect(ax + aw - wl, yc - 4.6, wl, 4.2, 1, 1, 'FD');
    cor([70,70,70]); texto(lc, ax + aw - 1.5, yc - 1.6, { align:'right' });
  }
  cor(CZ); fonte(6); texto('kWh', ax - 2, ay - 3, { align:'right' });
  // tabela dos valores mensais
  const tw = CW / 12;
  caixa(X0, 165, CW, 5.5, PR); caixa(X0, 170.5, CW, 6, CZC);
  ger.forEach((v, i) => {
    cor(AM); fonte(6.6, 'bold'); texto(MESES[i], X0 + i * tw + tw / 2, 168.8, { align:'center' });
    cor(PR); fonte(7, 'bold'); texto(kwh(v), X0 + i * tw + tw / 2, 174.6, { align:'center' });
  });
  cor(CZ); fonte(6.3); texto('Valores em kWh. Geração solar estimada mês a mês para o 1º ano de operação.', X0, 181);

  const fw = (CW - 6) / 3;
  [['pin', 'Local', local], ['sol', 'Telhado voltado para', orientTxt], ['painel', 'Estrutura', estrTxt]].forEach(([ic, r, v], i) => {
    const x = X0 + i * (fw + 3), y = 186;
    caixa(x, y, fw, 18, CZC, BD);
    icone(ic, x + 6, y + 5.3, 3); rotulo(r, x + 9.5, y + 6.4);
    cor(PR); caber(v, fw - 9, 10, 7, 'bold'); texto(v, x + 4.5, y + 13);
  });
  cor(CZ); fonte(6.3);
  texto('Estimativas para o primeiro ano de operação, com base na irradiação solar média da região.', X0, 211);
  texto('A geração real varia com o clima, sombreamento e manutenção, e a economia depende do seu consumo e das tarifas da concessionária.', X0, 214.5);
  if (d.usaMeta) texto('Economia calculada sobre o consumo previsto informado pelo cliente: ' + brl0(d.conta) + ' por mês' + (d.contaHoje ? ' (hoje ' + brl0(d.contaHoje) + ').' : '.'), X0, 218);
  preencher(fotos.pag2, d.usaMeta ? 221 : 217.5, (y0, livre) => {
    if (!(d.economia > 0)) return;
    // economia acumulada ano a ano (perda de 0,5% de geração por ano) x investimento à vista
    const acum = []; let s = 0; for (let t = 0; t < 25; t++) { s += d.economia * 12 * Math.pow(0.995, t); acum.push(s); }
    const y1 = y0 + 6, hBox = Math.min(livre - 8, 64);
    tituloArte('moeda', 'Seu investimento de volta: economia acumulada em 25 anos', y1);
    let xr = X1;   // "Em 10 anos: R$ X   Em 25 anos: R$ Y", da direita para a esquerda
    [[acum[24], 'Em 25 anos: ', VD], [acum[9], 'Em 10 anos: ', PR]].forEach(([v, r, c]) => {
      cor(c); fonte(7.6, 'bold'); texto(brl0(v), xr, y1, { align:'right' }); xr -= doc.getTextWidth(brl0(v));
      cor(CZ); fonte(6.8); texto(r, xr, y1, { align:'right' }); xr -= doc.getTextWidth(r) + 6;
    });
    const by = y1 + 3.5; caixa(X0, by, CW, hBox, BR, BD);
    const gx = X0 + 18, gw = CW - 24, gy = by + 7, gh = hBox - 15, topo = Math.max(acum[24], d.valor) * 1.08;
    const bw3 = gw / 25;
    draw([236,236,236]); doc.setLineWidth(0.2); cor([150,150,150]); fonte(5.8);
    for (let i = 0; i <= 4; i++) { const v = topo * i / 4, yy = gy + gh - gh * i / 4; doc.line(gx, yy, gx + gw, yy); texto(brl0(v).replace('R$', '').trim(), gx - 2, yy + 1, { align:'right' }); }
    acum.forEach((v, i) => {
      const hb = gh * v / topo; fill(v >= d.valor ? AM : [210,210,210]); doc.rect(gx + i * bw3 + bw3 * 0.15, gy + gh - hb, bw3 * 0.7, hb, 'F');
      if (i === 0 || (i + 1) % 5 === 0) { cor(CZ); fonte(6); texto((i + 1) + 'º', gx + i * bw3 + bw3 / 2, gy + gh + 4, { align:'center' }); }
    });
    cor(CZ); fonte(6); texto('ano', gx + gw, gy + gh + 7.5, { align:'right' }); texto('R$', gx - 2, gy - 3, { align:'right' });
    const yi = gy + gh - gh * d.valor / topo;
    draw([90,90,90]); doc.setLineWidth(0.4); doc.setLineDashPattern([1.2, 1], 0); doc.line(gx, yi, gx + gw, yi); doc.setLineDashPattern([], 0);
    fonte(6.5, 'bold'); const li = 'Investimento à vista: ' + brl0(d.valor), wl = doc.getTextWidth(li) + 3;
    fill(BR); draw([90,90,90]); doc.setLineWidth(0.25); doc.roundedRect(gx + 1, yi - 4.6, wl, 4.2, 1, 1, 'FD'); cor([70,70,70]); texto(li, gx + 2.5, yi - 1.6);
    if (d.paybackMeses) {
      fonte(6.5, 'bold'); const lp = 'A partir daqui, a economia é lucro', wp = doc.getTextWidth(lp) + 4;
      const ia = acum.findIndex(v => v >= d.valor); const xa = gx + Math.max(0, ia) * bw3;
      const xl = Math.min(xa, gx + gw - wp);
      fill(AM); doc.roundedRect(xl, gy - 1.5, wp, 4.4, 1, 1, 'F'); cor(PR); texto(lp, xl + 2, gy + 1.7);
    }
  }, 40);

  // ═══════════════ PÁGINA 3 — EQUIPAMENTOS E SERVIÇOS ═══════════════
  doc.addPage(); cabecalho();
  secao(3, 'EQUIPAMENTOS E SERVIÇOS', 'Soluções de qualidade, com marcas reconhecidas e certificadas.');
  const marcaMod = imp ? PROPOSTA_CFG.modulos_importado : PROPOSTA_CFG.modulos_nacional;
  const marcaInv = imp ? PROPOSTA_CFG.inversor_importado : PROPOSTA_CFG.inversor_nacional;
  const bw2 = (CW - 5) / 2;
  const equip = [
    ['Módulos fotovoltaicos', d.item.mod + ' x ' + d.potW + ' W', marcaMod, ['Alta eficiência', (anos(PROPOSTA_CFG.garantia_modulos) || '12 anos') + ' de garantia', 'Certificação Inmetro', 'Resistência a intempéries']],
    ['Inversor', 'Inversor ' + d.item.inv, marcaInv, ['Monitoramento via Wi-Fi', 'Alta confiabilidade', 'Proteções integradas', 'Garantia de ' + (anos(PROPOSTA_CFG.garantia_inversor) || '10 anos')]],
  ];
  equip.forEach(([r, v, m, it], i) => {
    const x = X0 + i * (bw2 + 5), y = 41;
    caixa(x, y, bw2, 48, CZC, BD);
    rotulo(r, x + 5, y + 7);
    cor(PR); caber(v, bw2 - 10, 15, 10, 'bold'); texto(v, x + 5, y + 15);
    cor(CZ); fonte(7.3); texto(linhas(m ? '(' + m + ')' : '', bw2 - 10)[0] || '', x + 5, y + 20.5);
    listaCheck(it, x + 5, y + 27.5, bw2 - 10, 7.6, PR, 1.4);
  });
  const sw4 = (CW - 9) / 4;
  [['Estrutura', estrTxt, 'Para telhado ' + estrTxt.toLowerCase() + ', com certificação'], ['Cabos solares', 'Preto e vermelho', '4 mm, padrão solar'],
   ['Quadro de proteção', 'DPS e disjuntores', 'conforme norma'], ['Kit aterramento', 'Padrão', 'da concessionária']].forEach(([r, v, s], i) => {
    const x = X0 + i * (sw4 + 3), y = 93;
    caixa(x, y, sw4, 23, CZC, BD);
    rotulo(r, x + 4, y + 6.5);
    cor(PR); caber(v, sw4 - 8, 9.5, 7, 'bold'); texto(v, x + 4, y + 12.5);
    cor(CZ); fonte(6.5); doc.text(linhas(s, sw4 - 8).slice(0, 2), x + 4, y + 17);
  });

  // itens do kit (editáveis pelo vendedor)
  let y = 122;
  if (sep) {
    // orçamento detalhado: kit (faturado pelo fornecedor / FINAME) e serviço da Energtech com valores próprios
    rotulo('Orçamento detalhado', X0, y); y += 2;
    const cD = X0 + 3, cUn = X0 + 116, cQt = X0 + 130, cVu = X0 + 158, cTo = X1 - 3, wD = 106;
    caixa(X0, y, CW, 6.5, PR); cor(BR); fonte(6.6, 'bold');
    texto('DESCRIÇÃO', cD, y + 4.3); texto('UN.', cUn, y + 4.3, { align:'center' }); texto('QTD.', cQt, y + 4.3, { align:'center' });
    texto('VALOR UNIT.', cVu, y + 4.3, { align:'right' }); texto('TOTAL', cTo, y + 4.3, { align:'right' });
    y += 6.5;
    const forn = d.fornecedor;
    const blocosItem = [
      { tit: 'Kit gerador fotovoltaico ' + kwpTxt + ' kWp — ' + d.item.mod + ' módulos de ' + d.potW + ' Wp' + (forn ? ' (' + forn.nome + ')' : ''), un:'kit', v:d.valorKit,
        sub: d.itens.map(t => '» ' + t).concat(forn && forn.finame ? ['» Código FINAME: ' + forn.finame] : []) },
      { tit: 'Serviço de instalação, projeto e homologação', un:'SV', v:d.valorServico, sub: d.servicoDesc ? [d.servicoDesc] : [] },
    ];
    blocosItem.forEach((it, i) => {
      fonte(7.8, 'bold'); const lt = linhas(it.tit, wD);
      fonte(6.6); const ls = it.sub.flatMap(t => linhas(t, wD - 2));
      const h = 5 + lt.length * 3.4 + ls.length * 2.85 + 1.5;
      caixa(X0, y, CW, h, i % 2 ? BR : CZC, BD);
      cor(PR); fonte(7.8, 'bold'); doc.text(lt, cD, y + 4.6);
      fonte(7.8); texto(it.un, cUn, y + 4.6, { align:'center' }); texto('1,00', cQt, y + 4.6, { align:'center' }); texto(brl(it.v), cVu, y + 4.6, { align:'right' });
      fonte(7.8, 'bold'); texto(brl(it.v), cTo, y + 4.6, { align:'right' });
      if (ls.length) { cor(CZ); fonte(6.6); doc.text(ls, cD + 2, y + 4.6 + lt.length * 3.4); }
      y += h;
    });
    caixa(X0, y, CW, 7.5, AM); cor(PR); fonte(8.5, 'bold');
    texto('VALOR TOTAL DA PROPOSTA', cD, y + 5); texto(brl(d.valor), cTo, y + 5, { align:'right' });
    y += 7.5 + 7;
  } else {
    rotulo('Itens do kit', X0, y); y += 2;
    const colW = (CW - 14) / 2;
    const itensL = d.itens.map(t => linhas(t, colW - 4));
    const metade = Math.ceil(itensL.length / 2);
    const altCol = arr => arr.reduce((s, l) => s + l.length * 3.2 + 1.3, 0);
    const hItens = Math.max(altCol(itensL.slice(0, metade)), altCol(itensL.slice(metade))) + 6;
    caixa(X0, y, CW, hItens, BR, BD);
    [itensL.slice(0, metade), itensL.slice(metade)].forEach((col, ci) => {
      let yy = y + 5.5; const x = X0 + 5 + ci * (colW + 4);
      col.forEach(l => { fill(AM); doc.circle(x + 0.8, yy - 1, 0.8, 'F'); cor(PR); fonte(7.2); doc.text(l, x + 3.5, yy); yy += l.length * 3.2 + 1.3; });
    });
    y += hItens + 7;
  }

  // serviços inclusos (esquerda) + investimento (direita)
  const incl = String(PROPOSTA_CFG.inclusos || '').split('\n').map(t => t.trim()).filter(Boolean);
  const lw = bw2, rx = X0 + bw2 + 5;
  const yS = y;
  cor(PR); fonte(9, 'bold'); texto('SERVIÇOS INCLUSOS', X0, y); y += 6;
  y = listaCheck(incl, X0, y, lw, 8, PR, 1.5);
  if (d.servicoDesc && !sep) { y += 1; cor(CZ); fonte(6.8); const l = linhas(d.servicoDesc, lw); doc.text(l, X0, y); y += l.length * 2.9; }

  let yr = yS - 4;
  const dv = temDesc ? 5 : 0;
  const hInv = (sep ? 44 : 40) + dv;
  caixa(rx, yr, bw2, hInv, PR);
  cor(AM); fonte(7, 'bold'); texto('INVESTIMENTO TOTAL', rx + 5, yr + 7.5);
  if (d.valorDe) {   // preço de tabela riscado: "de R$ X"
    const tDe = brl(d.valorDe), xr = rx + bw2 - 5;
    cor(CL); fonte(8); texto('de ' + tDe, xr, yr + 7.5, { align:'right' });
    const wDe = doc.getTextWidth(tDe); draw(CL); doc.setLineWidth(0.35); doc.line(xr - wDe, yr + 6.4, xr, yr + 6.4);
  }
  cor(BR); caber(brl(d.valor), bw2 - 10, 21, 13, 'bold'); texto(brl(d.valor), rx + 5, yr + 19);
  if (temDesc) { cor(AM); fonte(7.2, 'bold'); texto(linhas('à vista  ·  parcelado e financiado: ' + brl(cheio), bw2 - 10)[0], rx + 5, yr + 25.5); }
  cor(CL); fonte(7.2);
  if (sep) { texto('Kit gerador: ' + brl(d.valorKit), rx + 5, yr + 27 + dv); texto('Serviços de instalação: ' + brl(d.valorServico) + (temDesc ? ' (à vista)' : ''), rx + 5, yr + 31.5 + dv); texto(brl(d.valor / (d.item.kwp * 1000)) + ' por Wp instalado', rx + 5, yr + 36 + dv); }
  else texto(brl(d.valor / (d.item.kwp * 1000)) + ' por Wp instalado', rx + 5, yr + 27 + dv);
  yr += hInv + 3;
  const pw2 = (bw2 - 3) / 2;
  [['Prazo de entrega', PROPOSTA_CFG.prazo_entrega || '—', ''], ['Retorno do investimento', anosMeses(d.paybackMeses), 'tempo estimado']].forEach(([r, v, s], i) => {
    const x = rx + i * (pw2 + 3);
    caixa(x, yr, pw2, 20, CZC, BD);
    rotulo(r, x + 3.5, yr + 6);
    cor(PR); fonte(9, 'bold'); const l = linhas(v, pw2 - 7).slice(0, 2); doc.text(l, x + 3.5, yr + 11.5);
    if (s) { cor(CZ); fonte(6.4); texto(s, x + 3.5, yr + 11.5 + l.length * 3.8); }
  });
  yr += 20;
  preencher(fotos.pag3, Math.max(y, yr), (y0, livre) => {
    // como funciona: do sol ao crédito na conta de luz
    const y1 = y0 + Math.max(5, Math.min(10, livre - 44)), hB = Math.min(livre - (y1 - y0) - 8, 40);
    tituloArte('sol', 'COMO FUNCIONA O SEU SISTEMA', y1);
    const passos = [['painel', 'Módulos solares', 'Captam a luz do sol e produzem energia durante o dia.'],
                    ['raio', 'Inversor', 'Converte a energia dos módulos para uso na sua casa ou empresa.'],
                    ['casa', 'Consumo na hora', 'O que você usa durante o dia sai direto do seu telhado.'],
                    ['moeda', 'Créditos de energia', 'A sobra vai para a rede da ' + conc + ' e vira crédito na conta por até 60 meses.']];
    const gap = 7, cw4 = (CW - 3 * gap) / 4, by = y1 + 4;
    passos.forEach(([ic, t, s], i) => {
      const x = X0 + i * (cw4 + gap);
      caixa(x, by, cw4, hB, i === 3 ? PR : CZC, i === 3 ? null : BD);
      const r = hB < 42 ? 4.5 : 7, cy = by + r + (hB < 42 ? 3 : 5), yt = cy + r + 5.5;   // versão compacta quando sobra pouco espaço
      fill(i === 3 ? PR2 : BR); doc.circle(x + cw4 / 2, cy, r, 'F'); icone(ic, x + cw4 / 2, cy, r * 0.93);
      cor(i === 3 ? AM : PR); fonte(8.3, 'bold'); texto(t, x + cw4 / 2, yt, { align:'center' });
      cor(i === 3 ? CL : CZ); fonte(6.9); doc.text(linhas(s, cw4 - 7).slice(0, Math.max(1, Math.floor((by + hB - yt - 5) / 2.9) + 1)), x + cw4 / 2, yt + 4.5, { align:'center' });
      if (i < 3) seta(x + cw4 + gap / 2 - 1.2, cy);
    });
  }, 36);

  // ═══════════════ PÁGINA 4 — INVESTIMENTO E FORMAS DE PAGAMENTO ═══════════════
  doc.addPage(); cabecalho();
  secao(4, 'INVESTIMENTO E FORMAS DE PAGAMENTO', 'Escolha a condição que melhor se adapta a você.');
  const itensCfg = k => String(PROPOSTA_CFG[k] || '').split('\n').map(t => t.trim()).filter(Boolean);
  const opcoes = [];
  opcoes.push({ titulo:'À VISTA', desenha:(x, y, w) => {
    let yv = y + 9;
    if (temDesc) {   // "de R$ cheio" riscado em cima do valor à vista
      cor(CZ); fonte(7.5); texto('de ' + brl(cheio), x + 4, y + 6.5);
      const x0 = x + 4 + doc.getTextWidth('de '); draw(CZ); doc.setLineWidth(0.3); doc.line(x0, y + 5.4, x0 + doc.getTextWidth(brl(cheio)), y + 5.4);
      yv = y + 13.5;
    }
    cor(PR); caber(brl(d.valor), w - 8, 15, 10, 'bold'); texto(brl(d.valor), x + 4, yv);
    fill(AM); doc.rect(x + 4, yv + 4, w - 8, 5, 'F'); cor(PR); fonte(6.6, 'bold');
    texto(temDesc ? 'Você economiza ' + brl(d.descontoAVista) : 'Melhor custo-benefício', x + w / 2, yv + 7.4, { align:'center' });
    return listaCheck(itensCfg('avista_itens'), x + 4, yv + 16, w - 8, 7.2, PR, 1.3) - y;
  }});
  if (imp) opcoes.push({ titulo:'ENTRADA + PARCELAS', desenha:(x, y, w) => {
    cor(PR); fonte(11, 'bold'); texto('Entrada: ' + brl(d.pag.entrada), x + 4, y + 8);
    cor(CZ); fonte(6.5); texto('no ato do pedido', x + 4, y + 12);
    const nParc = d.pag.n || 10, comJuros = (+d.pag.juros || 0) > 0;
    cor(PR); fonte(11, 'bold'); doc.text(linhas(nParc + 'x ' + brl(d.pag.parcela10), w - 8), x + 4, y + 19.5);
    cor(CZ); fonte(6.5); texto((comJuros ? 'parcelas mensais fixas  ·  total ' + brl(d.pag.totalPrazo) : 'parcelas mensais' + (temDesc ? '  ·  total ' + brl(cheio) : '')), x + 4, y + 23.5);
    return listaCheck(itensCfg('parcelado_itens'), x + 4, y + 30, w - 8, 7.2, PR, 1.3) - y;
  }});
  else opcoes.push({ titulo:'FINAME (BNDES)', desenha:(x, y, w) => {
    cor(PR); fonte(11, 'bold'); texto('96x ' + brl(d.pag.p96), x + 4, y + 8);
    cor(CZ); fonte(6.5); texto('em 8 anos', x + 4, y + 12);
    cor(PR); fonte(11, 'bold'); texto('120x ' + brl(d.pag.p120), x + 4, y + 19.5);
    cor(CZ); fonte(6.5); texto('em 10 anos', x + 4, y + 23.5);
    let yy = listaCheck(itensCfg('finame_itens'), x + 4, y + 30, w - 8, 7.2, PR, 1.3);
    if (temDesc) { cor(CZ); fonte(6.5); doc.text(linhas('Valor financiado: ' + brl(cheio), w - 8), x + 4, yy + 0.5); yy += 4; }
    if (sep) { cor(CZ); fonte(6.5); doc.text(linhas('Kit financiável: ' + brl(d.valorKit), w - 8), x + 4, yy + 0.5); yy += 4; }
    return yy - y;
  }});
  const prazos = String(PROPOSTA_CFG.fin_prazos || '').split(/[,;\s]+/).map(Number).filter(n => n > 0).slice(0, 6);
  const taxaFin = (+PROPOSTA_CFG.fin_taxa_mes || 0) / 100;
  const pmt = (v, n) => taxaFin > 0 ? v * taxaFin / (1 - Math.pow(1 + taxaFin, -n)) : v / n;
  const mostrarFin = PROPOSTA_CFG.fin_ativo && imp && prazos.length > 0;   // nacional: só FINAME (a linha da Caixa é para imóvel urbano)
  if (mostrarFin) opcoes.push({ titulo:'FINANCIAMENTO', sub: PROPOSTA_CFG.fin_banco, desenha:(x, y, w) => {
    cor(PR); fonte(8.5, 'bold'); texto('Parcelas estimadas', x + 4, y + 7);
    let yy = y + 10;
    if (temDesc) { cor(CZ); fonte(6.5); texto('Valor financiado: ' + brl(cheio), x + 4, y + 11); yy = y + 13.5; }
    caixa(x + 4, yy, w - 8, 5, CZC, BD); cor(PR); fonte(6.5, 'bold');
    texto('Prazo', x + 4 + (w - 8) * 0.25, yy + 3.4, { align:'center' }); texto('Parcela estimada', x + 4 + (w - 8) * 0.72, yy + 3.4, { align:'center' });
    yy += 5;
    prazos.forEach(n => {
      caixa(x + 4, yy, w - 8, 5, BR, BD); cor(PR); fonte(7);
      texto(n + ' meses', x + 4 + (w - 8) * 0.25, yy + 3.4, { align:'center' }); fonte(7, 'bold'); texto(brl(pmt(cheio, n)), x + 4 + (w - 8) * 0.72, yy + 3.4, { align:'center' });
      yy += 5;
    });
    return listaCheck(itensCfg('fin_obs'), x + 4, yy + 5, w - 8, 6.8, PR, 1.2) - y;
  }});
  const ow = (CW - 4 * (opcoes.length - 1)) / opcoes.length;
  // desenha uma vez fora da página para medir a altura e deixar as colunas iguais
  const yOp = 42, hHead = 10;
  let hBody = 0;
  opcoes.forEach((o, i) => { const x = X0 + i * (ow + 4); hBody = Math.max(hBody, o.desenha(x, yOp + hHead + 400, ow) + 4); });
  doc.deletePage(doc.getNumberOfPages()); doc.addPage(); cabecalho();
  secao(4, 'INVESTIMENTO E FORMAS DE PAGAMENTO', 'Escolha a condição que melhor se adapta a você.');
  opcoes.forEach((o, i) => {
    const x = X0 + i * (ow + 4);
    caixa(x, yOp, ow, hHead, PR);
    cor(BR); fonte(6.9, 'bold'); const tt = linhas('OPÇÃO ' + (i + 1) + ' — ' + o.titulo + (o.sub ? ' ' + o.sub.toUpperCase() : ''), ow - 8).slice(0, 2);
    doc.text(tt, x + 4, yOp + (tt.length > 1 ? 4.2 : 6.2));
    caixa(x, yOp + hHead, ow, hBody, BR, BD);
    o.desenha(x, yOp + hHead, ow);
  });
  y = yOp + hHead + hBody + 8;
  const menorParcela = Math.min(...[imp ? d.pag.parcela10 : d.pag.p120].concat(mostrarFin ? prazos.map(n => pmt(cheio, n)) : []).filter(v => v > 0));
  const msgEco = (d.economia > 0 && menorParcela <= d.economia) ? 'Sua economia estimada é de ' + brl0(d.economia) + ' por mês, e a parcela pode começar em ' + brl0(menorParcela) + '.' : '';
  fonte(7.4); const corpo = linhas('Em muitos casos, o valor da parcela pode ser igual ou menor do que a sua conta de luz atual. Ou seja: você troca a conta de energia por um investimento que fica seu.' + (msgEco ? ' ' + msgEco : ''), CW - 16);
  const hEco = 13 + corpo.length * 3.4;
  caixa(X0, y, CW, hEco, AM);
  cor(PR); fonte(10, 'bold'); texto('Parcela menor que a fatura', X0 + 8, y + 7.5);
  fonte(7.4); doc.text(corpo, X0 + 8, y + 12.5);
  y += hEco + 7;
  const obs = [];
  if (sep) obs.push('Composição do valor' + (temDesc ? ' à vista' : '') + ': kit gerador ' + brl(d.valorKit) + ' + serviços de instalação ' + brl(d.valorServico) + '.'
    + (temDesc ? ' No parcelado e no financiamento: kit gerador ' + brl(d.valorKit) + ' + serviços de instalação ' + brl(d.valorServicoCheio) + ' = ' + brl(cheio) + '.' : ''));
  if (temDesc) obs.push('O desconto de ' + brl(d.descontoAVista) + ' vale para o pagamento à vista. Entrada + parcelas e financiamentos são calculados sobre ' + brl(cheio) + '.');
  if (!imp && !(d.fornecedor && d.fornecedor.finame) && PROPOSTA_CFG.codigo_finame) obs.push('Código FINAME do kit: ' + PROPOSTA_CFG.codigo_finame + '.');
  obs.push('Condições de financiamento sujeitas à análise de crédito.');
  // dados do cliente (para cadastro do financiamento) — linhas vazias não aparecem
  const temV = v => v && String(v).trim();
  const linhasCli = [
    [['Nome/Razão social', d.nome && d.nome !== 'Cliente' ? d.nome : '']],
    [['CPF/CNPJ', d.cpf], ['Município/UF', d.cidade]],
    [['Telefone', d.telefone], ['E-mail', d.email]],
    [['Endereço', [d.endereco, d.cep ? 'CEP ' + d.cep : ''].filter(Boolean).join(' · ')]],
    [['Unidade consumidora', d.uc], ['Concessionária', d.concessionaria]],
  ].map(ln => ln.filter(([, v]) => temV(v))).filter(ln => ln.length);
  if (linhasCli.length) {
    rotulo('Dados do cliente', X0, y); y += 2;
    const colW2 = (CW - 14) / 2;
    const hCli = 5 + linhasCli.length * 5.2;
    caixa(X0, y, CW, hCli, CZC, BD);
    let yc = y + 6;
    linhasCli.forEach(ln => {
      ln.forEach(([r, v], j) => {
        const x = X0 + 5 + j * (colW2 + 4), w = ln.length === 1 ? CW - 10 : colW2;
        cor(CZ); fonte(7.2); const rr = r + ': '; texto(rr, x, yc);
        const wr = doc.getTextWidth(rr);
        cor(PR); fonte(7.8, 'bold'); texto(linhas(v, w - wr)[0], x + wr, yc);
      });
      yc += 5.2;
    });
    y += hCli + 6;
  }
  rotulo('Dados para pagamento', X0, y); y += 2;
  const blocos = [];
  if (d.fornecedor) {
    const extra = [];
    if (d.fornecedor.finame) extra.push('Código FINAME: ' + d.fornecedor.finame);
    if (sep) extra.push('Valor do kit: ' + brl(d.valorKit));
    blocos.push({ tit:'FORNECEDOR DO KIT', nome:d.fornecedor.nome, destaque:extra, txt:d.fornecedor.dados });
  }
  blocos.push({ tit: d.fornecedor ? 'INTEGRADOR (ENERGTECH)' : 'ENERGTECH', nome:'', txt:d.contaPag.dados,
    destaque: d.fornecedor && sep ? ['Serviços de instalação: ' + brl(d.valorServico) + (temDesc ? ' à vista · ' + brl(d.valorServicoCheio) + ' no financiamento' : '')] : [] });
  const bwP = blocos.length > 1 ? (CW - 4) / 2 : CW;
  const med = blocos.map(b => {
    fonte(7.8, 'bold'); const n = b.nome ? linhas(b.nome, bwP - 10) : [];
    fonte(7.8, 'bold'); const dz = b.destaque.flatMap(x => linhas(x, bwP - 10));
    fonte(7.8); const tx = linhas(b.txt, bwP - 10);
    return { n, dz, tx, h: 11 + (n.length + dz.length + tx.length) * 3.6 + (dz.length ? 1.5 : 0) };
  });
  const hP = Math.max(...med.map(m => m.h));
  blocos.forEach((b, i) => {
    const x = X0 + i * (bwP + 4), m = med[i];
    caixa(x, y, bwP, hP, CZC, BD);
    rotulo(b.tit, x + 5, y + 6);
    let yy = y + 11;
    cor(PR); fonte(7.8, 'bold'); if (m.n.length) { doc.text(m.n, x + 5, yy); yy += m.n.length * 3.6; }
    if (m.dz.length) { cor([150,100,0]); fonte(7.8, 'bold'); doc.text(m.dz, x + 5, yy); yy += m.dz.length * 3.6 + 1.5; }
    cor(PR); fonte(7.8); doc.text(m.tx, x + 5, yy);
  });
  y += hP + 5;
  cor(CZ); fonte(6.6); obs.forEach(t => { const l = linhas(t, CW); doc.text(l, X0, y); y += l.length * 3 + 0.6; });
  preencher(fotos.pag4, y - 2, (y0, livre) => {
    if (!(d.conta > 0) || !(menorParcela > 0)) return;
    // comparativo em reais: conta de hoje x durante as parcelas x depois de quitado
    const y1 = y0 + Math.min(9, livre - 40);
    tituloArte('grafico', 'QUANTO VOCÊ PAGA POR MÊS', y1);
    const nova = d.novaConta || d.taxa || 0, durante = menorParcela + nova;
    const barras = [[d.usaMeta ? 'Conta prevista sem solar' : 'Conta de luz hoje', d.conta, [198,40,40], ''],
                    ['Com solar, durante as parcelas', durante, AM, 'parcela a partir de ' + brl0(menorParcela) + ' + conta mínima ' + brl0(nova)],
                    ['Com solar, depois de quitado', nova, VD, 'só a conta mínima da ' + conc]];
    const hRow = Math.min(15, (livre - (y1 - y0) - 8) / 3), by = y1 + 4;
    caixa(X0, by, CW, hRow * 3 + 4, CZC, BD);
    const lx = X0 + 5, bx = X0 + 62, bwMax = CW - 62 - 30, maxV = Math.max(...barras.map(b => b[1]));
    barras.forEach(([r, v, c, s], i) => {
      const yy = by + 2 + i * hRow, hb = Math.min(7, hRow - 5);
      cor(PR); fonte(7.6, 'bold'); texto(r, lx, yy + hRow / 2 - (s ? 0.6 : -1));
      if (s) { cor(CZ); fonte(6.2); texto(linhas(s, 55)[0], lx, yy + hRow / 2 + 2.9); }
      fill(c); doc.rect(bx, yy + (hRow - hb) / 2, Math.max(1.5, bwMax * v / maxV), hb, 'F');
      cor(PR); fonte(8.5, 'bold'); texto(brl0(v), bx + Math.max(1.5, bwMax * v / maxV) + 2.5, yy + hRow / 2 + 1.3);
    });
  }, 42);

  // ═══════════════ PÁGINA 5 — GARANTIAS, PROCESSO E PRÓXIMOS PASSOS ═══════════════
  doc.addPage(); cabecalho();
  secao(5, 'GARANTIAS, PROCESSO E PRÓXIMOS PASSOS', 'Segurança para você do início ao fim.');
  cor(PR); fonte(9, 'bold'); texto('GARANTIAS', X0 + 1, 46); texto('NOSSO PROCESSO', X0 + bw2 + 6, 46);
  y = 50;
  [['Módulos fotovoltaicos', PROPOSTA_CFG.garantia_modulos], ['Inversor', PROPOSTA_CFG.garantia_inversor], ['Instalação e serviços', PROPOSTA_CFG.garantia_servicos]].forEach(([r, t]) => {
    const l = linhas(t, bw2 - 15);
    const h = 10 + l.length * 3.1;
    caixa(X0, y, bw2, h, CZC, BD);
    icone('escudo', X0 + 5, y + 5.4, 3.6);
    cor(PR); fonte(8.5, 'bold'); texto(r, X0 + 9, y + 6.3);
    cor(CZ); fonte(7); doc.text(l, X0 + 9, y + 10.5);
    y += h + 3;
  });
  const passos = [['Aprovação da proposta', 'Definição da forma de pagamento'], ['Projeto e documentação', 'Projeto elétrico, ART e homologação na ' + conc],
                  ['Instalação', 'Equipe técnica especializada'], ['Homologação', 'Acompanhamento até a aprovação'], ['Sistema em funcionamento', 'Monitoramento e suporte contínuo']];
  let yp = 50;
  passos.forEach(([t, s], i) => {
    const x = X0 + bw2 + 5;
    caixa(x, yp, 9, 10, PR); cor(BR); fonte(9, 'bold'); texto(String(i + 1), x + 4.5, yp + 6.7, { align:'center' });
    cor(PR); fonte(8.3, 'bold'); texto(t, x + 12, yp + 4.3);
    cor(CZ); fonte(6.9); texto(linhas(s, bw2 - 14)[0], x + 12, yp + 8.3);
    yp += 11.5;
  });
  y = Math.max(y, yp) + 8;
  // por que escolher + próximos passos
  const hb = 52;
  caixa(X0, y, bw2, hb, PR);
  cor(AM); fonte(8.5, 'bold'); texto('POR QUE ESCOLHER A ENERGTECH?', X0 + 5, y + 9);
  const motivos = [['Engenharia especializada', 'Projeto assinado por engenheiro com ART no CREA'], ['Solução completa', 'Do projeto à homologação'],
                   ['Equipamentos de qualidade', 'Marcas reconhecidas e certificadas'], ['Suporte pós-instalação', 'Acompanhamento e atendimento direto com a nossa equipe']];
  const mw = (bw2 - 13) / 2;
  motivos.forEach(([t, s], i) => {
    const x = X0 + 5 + (i % 2) * (mw + 3), yy = y + 17 + Math.floor(i / 2) * 17;
    fill(AM); doc.circle(x + 1, yy - 1.1, 1, 'F');
    cor(BR); fonte(7.4, 'bold'); const lt = linhas(t, mw - 4).slice(0, 2); doc.text(lt, x + 3.5, yy);
    cor(CL); fonte(6.4); doc.text(linhas(s, mw - 4).slice(0, 3), x + 3.5, yy + 3.3 * lt.length + 0.4);
  });
  const px = X0 + bw2 + 5;
  caixa(px, y, bw2, hb, CZC, BD);
  cor(CZ); fonte(6.6, 'bold'); texto('PRÓXIMOS PASSOS', px + bw2 / 2, y + 9, { align:'center', charSpace:0.2 });
  cor(PR); fonte(10.5, 'bold'); texto('Vamos seguir com o seu projeto?', px + bw2 / 2, y + 17, { align:'center' });
  const btW = 56, btX = px + (bw2 - btW) / 2, btY = y + 22;
  fill(AM); doc.rect(btX, btY, btW, 9, 'F'); cor(PR); fonte(8.5, 'bold'); texto('APROVAR PROPOSTA', px + bw2 / 2, btY + 6, { align:'center' });
  const foneAprov = String(PROPOSTA_CFG.telefone_aprovacao || '').replace(/\D/g, '');
  if (foneAprov) {
    const num = foneAprov.length <= 11 ? '55' + foneAprov : foneAprov;
    doc.link(btX, btY, btW, 9, { url: 'https://wa.me/' + num + '?text=' + encodeURIComponent('Olá! Quero aprovar a proposta Nº ' + d.numero + ' (' + d.nome + ').') });
  }
  cor(CZ); fonte(7); texto('Em caso de dúvidas, estou à disposição!', px + bw2 / 2, y + 38, { align:'center' });
  cor(PR); fonte(7.6, 'bold'); texto(linhas([d.vendedor || 'Energtech', PROPOSTA_CFG.telefone_exibir].filter(Boolean).join('  ·  '), bw2 - 6)[0], px + bw2 / 2, y + 43, { align:'center' });
  y += hb + 6;
  const faq = String(PROPOSTA_CFG.faq ?? PROPOSTA_PADRAO.faq ?? '').split('\n').map(t => t.split('|').map(x => x.trim())).filter(x => x[0] && x[1]).slice(0, 6)
    .map(([q, a]) => [q, a.replace(/a concessionária/g, 'a ' + conc)]);
  const livreF = FIM - 8 - y;
  if (faq.length && livreF >= 34) {
    tituloArte('escudo', 'PERGUNTAS FREQUENTES', y + 2);
    const cols = 2, rows = Math.ceil(faq.length / cols), fw2 = (CW - 5) / 2;
    const hF = Math.min(25, (livreF - 8 - (rows - 1) * 3) / rows);
    faq.forEach(([q, a], i) => {
      const x = X0 + (i % cols) * (fw2 + 5), yy = y + 6 + Math.floor(i / cols) * (hF + 3);
      caixa(x, yy, fw2, hF, CZC, BD); fill(AM); doc.rect(x, yy, 1.2, hF, 'F');
      cor(PR); fonte(8, 'bold'); const lq = linhas(q, fw2 - 10).slice(0, 2); doc.text(lq, x + 5, yy + 6);
      cor(CZ); fonte(7); doc.text(linhas(a, fw2 - 10).slice(0, Math.max(1, Math.floor((hF - 7 - lq.length * 3.4) / 3))), x + 5, yy + 6.5 + lq.length * 3.6);
    });
    y += 6 + rows * hF + (rows - 1) * 3 + 6;
  }
  cor(CZ); fonte(6.2); texto(PROPOSTA_CFG.rodape_legal || '', W / 2, y, { align:'center' });

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) { doc.setPage(i); rodape(i, total); }
  const arq = nomeArquivoPadrao('Proposta', d.nome, d.item.kwp, d.numero, d.emissao);
  return { doc, arq };
}

