// Eider Sistemas / CRM — montagem de kit WEG a partir da planilha "Montagem de kits representantes-integradores".
// Duas partes, sem tela (a tela usa estas funções):
//   • wegLerPlanilha(XLSX, workbook) → { itens, cidades, frete, lista }   (lê as abas "Composição Preços" e "Cadastro cidades")
//   • wegMontarKit(cat, opcoes)      → { itens, total (preço de lista), custo (com os descontos), avisos, erros, ... } (mesmas regras da aba "Montar Kit Inversor String"
//                                       e "Montar Kit - Microinversor"; preço = custo da lista × frete)
// Regras elétricas (só para inversores WEG): potência FV ≤ 1,5 × nominal (datasheet), curto-circuito do módulo ≤ limite da MPPT,
// strings dentro de 600 V com a Voc no frio e dentro da faixa de MPPT em potência máxima.
(function (raiz) {
  const norm = s => String(s ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
  const semAcento = s => norm(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  const num = v => (typeof v === 'number' ? v : (v === null || v === undefined || v === '' ? null : (isFinite(+String(v).replace(',', '.')) ? +String(v).replace(',', '.') : null)));

  // ── leitura da planilha ──
  function wegLerPlanilha(XLSX, wb) {
    const ws = wb.Sheets['Composição Preços'];
    if (!ws) throw new Error('Aba "Composição Preços" não encontrada: confira se é a planilha de montagem de kits da WEG.');
    const linhas = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
    const itens = [], frete = {};
    let cab = null, secao = null, lista = null, emFrete = false;
    linhas.forEach(r => {
      const a = norm(r[0]), b = norm(r[1]);
      if (!lista) { const v = r.findIndex(x => norm(x) === 'Versão ->'); if (v >= 0 && r[v + 1]) lista = norm(r[v + 1]); }
      if (a === 'Modalidade de frete') { emFrete = true; return; }
      if (emFrete) { if (a && num(r[4]) !== null) frete[a] = num(r[4]); return; }
      if (b === 'Tipo' || b === 'Tipo Traduzido') { secao = a; cab = r.map(norm); return; }
      if (!cab || !a || num(r[3]) === null) return;
      const dados = {};
      for (let i = 4; i < Math.min(cab.length, 11); i++) if (cab[i] && r[i] !== null && r[i] !== '') dados[cab[i]] = typeof r[i] === 'number' ? r[i] : norm(r[i]);
      itens.push({ codigo: a, tipo: b, item_sap: r[2] !== null ? String(r[2]) : null, preco: num(r[3]), secao, dados });
    });
    const wc = wb.Sheets['Cadastro cidades'], cidades = {};
    if (wc) XLSX.utils.sheet_to_json(wc, { header: 1, raw: true, defval: null }).forEach(r => {
      const mun = semAcento(r[1]), uf = semAcento(r[2]), iso = num(r[4]);
      if (mun && uf && uf.length === 2 && iso) cidades[uf + '|' + mun] = iso;
    });
    if (!itens.length) throw new Error('Nenhum item com preço encontrado na aba "Composição Preços".');
    return { itens, cidades, frete, lista };
  }

  // ── dados técnicos dos inversores WEG (datasheets) ──
  // entrada FV máx = 1,5 × nominal; corrente: máx por MPPT e curto-circuito máx por MPPT; faixa MPPT em potência máxima
  function tecnicoInversor(it) {
    const c = norm(it.codigo), kw = num(it.dados.kW) || 0, mppt = num(it.dados.Entradas) || 1;
    const micro = /micro/i.test(it.tipo);
    if (micro) {
      const pmod = num(it.dados['Máx Pmód']) || (kw <= 1 ? 670 : 700);
      return { micro: true, kw, entradas: mppt, pmodMax: pmod, iscMax: 24, maxPorSerie: /M010/.test(c) ? 5 : 2, estimado: !/M010/.test(c) };
    }
    const t = { micro: false, kw, mppt, pfvMax: kw * 1.5, vmax: 600, imp: 14, isc: 18, vmin: 200, vmaxMppt: 450, partida: 120, estimado: false };
    if (/^SIW200G/.test(c) && kw >= 7) { t.vmin = 225; }
    if (/^SIW300H/.test(c)) { t.imp = 12.5; t.vmin = 90; t.vmaxMppt = 560; t.partida = 100; t.estimado = kw > 6; }
    if (!/^SIW[23]00[GH]/.test(c)) t.estimado = true;
    return t;
  }
  function ehInversorMono(it) { return /^(Micro-?inversor|Inversor) Monof/i.test(it.tipo); }

  // combinações de kits de 3 e 4 módulos (mesma regra da planilha)
  function combos34(n) {
    const r = n % 4, q = Math.floor(n / 4);
    const k3 = n === 5 ? 2 : (n <= 3 ? 1 : r === 1 ? 3 : r === 2 ? 2 : r === 3 ? 1 : 0);
    const k4 = (n === 5 || n === 2 || n === 1) ? 0 : (r === 0 ? q : r === 1 ? q - 2 : r === 2 ? q - 1 : q);
    return { k3, k4 };
  }

  // descontos do integrador sobre o preço de lista (fornecedor_regras 'descontos': { d1: 49, d2: 16 })
  function fatorDesconto(cat) {
    const d = (cat && cat.descontos) || {}, d1 = num(d.d1), d2 = num(d.d2);
    return (1 - (d1 ?? 49) / 100) * (1 - (d2 ?? 16) / 100);
  }

  // ── montagem ──
  // opcoes: { modulo, n, inversor, qtdInv, telhado: 'ceramico'|'fibro_madeira'|'fibro_metalica'|'metalico'|'metalico_longo'|'laje'|'zipado',
  //           regiao: 'HI'|'FGJ', uf, cidade, frete: nome da modalidade, tmin (°C, padrão −10), tec: dados elétricos do módulo (modulos_tecnicos) }
  function wegMontarKit(cat, o) {
    const avisos = [], erros = [], itens = [];
    const porCod = {}; cat.itens.forEach(x => { porCod[norm(x.codigo)] = x; });
    const achar = c => porCod[norm(c)];
    const fator = (o.frete && cat.frete[o.frete]) || cat.frete['CIF - Sem descarga - Região Sul'] || 1;
    const add = (qtd, it, obs) => { if (!it || !(qtd > 0)) return; const unit = Math.round(it.preco * fator * 100) / 100; itens.push({ qtd, codigo: norm(it.codigo), tipo: it.tipo, item_sap: it.item_sap, unit, total: Math.round(qtd * it.preco * fator * 100) / 100, obs: obs || null }); };

    const mod = achar(o.modulo); if (!mod) { erros.push('Módulo não encontrado na lista: ' + o.modulo); return { itens, total: 0, avisos, erros }; }
    const n = Math.max(0, Math.round(+o.n || 0)); if (!n) { erros.push('Informe a quantidade de módulos.'); return { itens, total: 0, avisos, erros }; }
    const wp = num(mod.dados.Wp) || 0, largura = num(mod.dados['Largura (mm)']) || 1134, kwp = n * wp / 1000;
    const inv = achar(o.inversor); if (!inv) { erros.push('Inversor não encontrado na lista: ' + o.inversor); return { itens, total: 0, avisos, erros }; }
    const tec = o.tec || null, t = tecnicoInversor(inv), finame = /\[FINAME\]/i.test(mod.codigo);
    if (/127/.test(inv.tipo)) avisos.push('⚠ ATENÇÃO: inversor ' + inv.tipo + '. Confirme a tensão do padrão do cliente antes de usar.');
    if (!ehInversorMono(inv)) avisos.push('Inversor fora da linha monofásica: as regras elétricas não foram conferidas.');

    add(n, mod);
    let qtdInv = Math.max(1, Math.round(+o.qtdInv || 1)), entradas = 0;
    if (t.micro) {
      erros.push('Montagem com microinversor entra na próxima etapa (acessórios e estrutura próprios). Por enquanto, só inversor string.');
      return { itens, total: 0, avisos, erros };
    } else {
      const pfv = kwp * 1000, pmax = t.pfvMax * 1000 * qtdInv;
      const ratio = kwp / (t.kw * qtdInv);
      if (pfv > pmax + 0.5) avisos.push(`⚠ Sobrecarga: ${kwp.toFixed(2).replace('.', ',')} kWp passa do máximo do inversor pelo datasheet (${(pmax / 1000).toFixed(2).replace('.', ',')} kWp = 1,5 × nominal; relação ${ratio.toFixed(2).replace('.', ',')}). Montagem liberada: confira o clipping e a garantia.`);
      if (t.estimado) avisos.push('Limites elétricos deste inversor estimados pela família (1,5 × nominal): confira o datasheet.');
      // strings: 1 por MPPT; tensão com Voc no frio
      if (tec && tec.voc) {
        const tmin = o.tmin ?? -10, vocF = tec.voc * (1 + (tec.tc_voc / 100) * (tmin - 25));
        const maxSerie = Math.floor(t.vmax / vocF), mppts = t.mppt * qtdInv;
        const nStr = Math.max(1, Math.ceil(n / maxSerie));
        if (nStr > mppts) erros.push(`${n} módulos precisam de ${nStr} strings (máx. ${maxSerie} em série a ${tmin} °C), mas o(s) inversor(es) têm ${mppts} MPPT(s).`);
        else {
          // divide em strings iguais tentando ficar na faixa de MPPT em potência máxima
          let melhor = null;
          for (let s = nStr; s <= mppts; s++) {
            const base = Math.floor(n / s), resto = n % s, menor = base, maior = base + (resto ? 1 : 0);
            const vMin = menor * tec.vmp, vMax = maior * tec.vmp;
            const ok = vMin >= t.vmin && vMax <= t.vmaxMppt && maior <= maxSerie && menor * tec.voc >= t.partida;
            if (ok) { melhor = { s, menor, maior }; break; }
          }
          if (!melhor) avisos.push(`Não há divisão de strings dentro da faixa de MPPT em potência máxima (${t.vmin}–${t.vmaxMppt} V): confira o arranjo.`);
          else o._strings = melhor;
        }
        if (tec.isc > t.isc) erros.push(`Curto-circuito do módulo (${tec.isc} A) passa do limite da MPPT (${t.isc} A).`);
        else if (tec.bifacial && tec.isc * 1.1 > t.isc) avisos.push(`Módulo bifacial: com ganho traseiro de 10% o curto-circuito chega a ${(tec.isc * 1.1).toFixed(1).replace('.', ',')} A (limite ${t.isc} A).`);
        if (tec.imp > t.imp) avisos.push(`Corrente de operação do módulo (${tec.imp} A) acima da máxima da MPPT (${t.imp} A): pequena perda nos picos.`);
      } else avisos.push('Dados elétricos do módulo não cadastrados: tensão e corrente das strings não foram conferidas.');
      add(qtdInv, inv);
      entradas = (num(inv.dados.Entradas) || 0) * qtdInv;
      // DPS CA: 2 (mono 220 V), 3 (mono 127/220 V), 4 (trifásico)
      const dps = /127/.test(inv.tipo) ? 3 : /Trif/i.test(inv.tipo) ? 4 : 2;
      add(dps, achar('SPW02-275-20'));
      add(Math.ceil(entradas * 1.1 - 1e-9), achar('MC4 6 mm²'));
      add(25 * entradas, achar('Unipolar flexível NH 6 mm² Preto'));
      add(25 * entradas, achar('Unipolar flexível NH 6 mm² Vermelho'));
      add(qtdInv, achar(inv.dados['Disjuntor Eq.']));
      o._ratio = ratio;
    }
    const eletrico = itens.reduce((a, x) => a + x.total, 0);

    // estrutura
    const isoCid = cat.cidades[semAcento(o.uf) + '|' + semAcento(o.cidade)] || null;
    if (!isoCid && /ceramico|fibro/.test(o.telhado)) avisos.push('Cidade sem região de vento na lista da WEG: usei 30 m/s. Confira.');
    const iso = isoCid || 30, kit = largura <= 1134 ? 4 : 3;
    const maisBarato = (filtro) => cat.itens.filter(filtro).sort((a, b) => a.preco - b.preco)[0];
    const isoDe = x => num(x.dados['Isopleta (m/s)']);
    const tel = o.telhado || 'ceramico';
    if (tel === 'ceramico') {
      const it = maisBarato(x => norm(x.codigo).startsWith('Cerâmico kit p/ ' + kit) && isoDe(x) >= iso);
      if (!it) erros.push('Estrutura cerâmica não encontrada para ' + iso + ' m/s.'); else add(Math.ceil(n / kit), it, 'isopleta ' + iso + ' m/s');
    } else if (tel === 'fibro_madeira' || tel === 'fibro_metalica') {
      const pref = (tel === 'fibro_madeira' ? 'Fibromadeira' : 'Fibrometálico') + ' kit p/ ' + kit;
      const reg = o.regiao === 'FGJ' ? 'FGJ' : 'HI';
      const it = maisBarato(x => norm(x.codigo).startsWith(pref) && norm(x.dados['Região do telhado']) === reg && isoDe(x) >= iso);
      if (!it) erros.push('Estrutura de fibrocimento não encontrada para ' + iso + ' m/s.'); else add(Math.ceil(n / kit), it, 'isopleta ' + iso + ' m/s');
    } else if (tel === 'metalico' || tel === 'metalico_longo') {
      const longo = tel === 'metalico_longo', larga = largura > 1134;
      const c = combos34(n);
      const n3 = longo && larga ? Math.ceil(n / 3) : c.k3, n4 = longo && larga ? 0 : c.k4;
      const nome3 = larga ? `Metálico 3 módulos em ret 33mm (${longo ? 'perfil longo' : 'perfil 55cm'})` : `Metálico 3 módulos em retrato (${longo ? 'perfil longo' : 'perfil 55cm'})`;
      const nome4 = larga ? `Metálico 4 módulos em ret 33mm (${longo ? 'perfil longo' : 'perfil 55cm'})` : `Metálico 4 módulos em retrato (${longo ? 'perfil longo' : 'perfil 55cm'})`;
      add(n3, achar(nome3)); add(n4, achar(nome4));
      if (n3 && !achar(nome3)) erros.push('Estrutura não encontrada: ' + nome3);
      if (n4 && !achar(nome4)) erros.push('Estrutura não encontrada: ' + nome4);
    } else if (tel === 'laje') {
      const larga = largura > 1134, c = combos34(n);
      add(larga ? Math.ceil(n / 3) : c.k3, achar(larga ? 'Laje 3 módulos em retrato 33mm' : 'Laje 3 módulos em retrato'));
      add(larga ? 0 : c.k4, achar('Laje 4 módulos em retrato'));
    } else if (tel === 'zipado') {
      const c = combos34(n);
      add(c.k3, achar('Zipado 3 módulos em paisagem (sem perfil)'));
      add(c.k4, cat.itens.find(x => /^Zipado 4/.test(norm(x.codigo))));
    } else erros.push('Tipo de telhado sem regra de estrutura: ' + tel);

    const total = Math.round(itens.reduce((a, x) => a + x.total, 0) * 100) / 100;
    // a lista da WEG é preço de venda (tabela); o custo do integrador tem dois descontos em cascata (padrão 49% e 16% → × 0,51 × 0,84)
    const fd = fatorDesconto(cat);
    return { itens, total, custo: Math.round(total * fd * 100) / 100, fatorDesconto: fd, eletrico: Math.round(eletrico * 100) / 100, estrutura: Math.round((total - eletrico) * 100) / 100, kwp, finame,
      tipoKit: finame ? 'nacional' : 'importado', ratio: o._ratio || null, strings: o._strings || null, qtdInv, isopleta: iso, avisos, erros };
  }

  // inversores para a lista: monofásicos (string até 10,5 kW e micro); sugere o menor com potência FV ≤ 1,5 × nominal
  function wegInversores(cat) {
    return cat.itens.filter(x => ehInversorMono(x) && (num(x.dados.kW) || 0) <= 10.5).sort((a, b) => (num(a.dados.kW) - num(b.dados.kW)) || (a.preco - b.preco));
  }
  function wegSugerirInversor(cat, modulo, n) {
    const mod = cat.itens.find(x => norm(x.codigo) === norm(modulo)); if (!mod) return null;
    const kwp = n * (num(mod.dados.Wp) || 0) / 1000;
    const strings = wegInversores(cat).filter(x => !/micro/i.test(x.tipo) && !/127/.test(x.tipo) && /^SIW200G/.test(norm(x.codigo)));
    return strings.find(x => kwp <= (num(x.dados.kW) || 0) * 1.5 + 1e-9) || null;
  }

  const api = { wegLerPlanilha, wegMontarKit, wegFatorDesconto: fatorDesconto, wegInversores, wegSugerirInversor, tecnicoInversor, combos34 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else Object.assign(raiz, api);
})(typeof window !== 'undefined' ? window : globalThis);
