// Energtech — leitura do boletim mensal da cooperativa (PDF com texto) direto no navegador, sem IA.
// Adaptadores por cooperativa: LEITORES_BOLETIM.move(pdf). Nada é inventado: valor não encontrado fica null
// e a tela pede para conferir. As conferências (somas) dizem se o boletim "fecha".
// Precisa do pdf.js (window.pdfjsLib).

const numBRL = t => { if (t == null) return null; const s = String(t).replace(/[R$\s]/g, ''); if (!/\d/.test(s)) return null; const n = Number(s.replace(/\./g, '').replace(',', '.')); return isFinite(n) ? Math.round(n * 100) / 100 : null; };
const numMWh = t => { const m = String(t || '').match(/(-?[\d.]+,\d+)\s*MWh/i); return m ? Number(m[1].replace(/\./g, '').replace(',', '.')) : null; };

async function itensDoPdf(buf, pagina) {
  const doc = await window.pdfjsLib.getDocument({ data: buf }).promise;
  const pg = await doc.getPage(pagina || 1);
  const tc = await pg.getTextContent();   // itens sem letra/número são glifos invisíveis do PDF: ignorados
  return { paginas: doc.numPages, itens: tc.items.filter(i => i.str && /[0-9A-Za-zÀ-ÿ$&]/.test(i.str)).map(i => ({ s: i.str.trim(), x: i.transform[4], y: i.transform[5] })) };
}

// valor logo ACIMA de um rótulo (mesma coluna): o layout da MOVE põe o número em cima do texto
function valorAcima(itens, rotulo, re) {
  const rs = itens.filter(i => i.s === rotulo);
  for (const r of rs) {
    const c = itens.filter(i => i !== r && re.test(i.s) && i.y > r.y + 4 && i.y < r.y + 25 && Math.abs(i.x - r.x) < 25)
      .sort((a, b) => (a.y - r.y) - (b.y - r.y));
    if (c.length) return c[0].s;
  }
  return null;
}

const LEITORES_BOLETIM = {
  // Cooperativa MOVE — "Demonstrativo de Resultado Mensal"
  async move(buf) {
    const { itens } = await itensDoPdf(buf, 1);
    const avisos = [];
    const R$ = /^-?R\$\s*-?[\d.]+(,\d+)?$/;
    if (!itens.some(i => /Demonstrativo de Resultado Mensal/i.test(i.s))) return { ok: false, erro: 'Este PDF não parece um boletim da MOVE (falta "Demonstrativo de Resultado Mensal").' };
    // usina e competência (topo da página)
    const topo = itens.filter(i => i.y > 780);
    const tUsina = (topo.find(i => /^\d+\.\s*\S/.test(i.s)) || itens.find(i => /^\d+\.\s*UFV/i.test(i.s)) || {}).s || '';
    const mU = tUsina.match(/^(\d+)\.\s*(.+)$/);
    const tComp = (topo.find(i => /^\d{2}\/\d{4}$/.test(i.s)) || {}).s || '';
    const mC = tComp.match(/^(\d{2})\/(\d{4})$/);
    // linha da tabela (abaixo do cabeçalho Usina | Injetada | Compensada | Total | Gestao | OEM | Terra | Equip)
    // cabeçalho: os 8 títulos na mesma linha da palavra "Usina"
    const hU = itens.find(i => i.s === 'Usina' && itens.some(j => j.s === 'Equip' && Math.abs(j.y - i.y) < 3));
    const cab = {}; if (hU) ['Usina', 'Injetada', 'Compensada', 'Total', 'Gestao', 'OEM', 'Terra', 'Equip'].forEach(k => { const h = itens.find(i => i.s === k && Math.abs(i.y - hU.y) < 3); if (h) cab[k] = h; });
    const tab = {};
    if (cab.Usina) {
      const linha = itens.filter(i => i.y < cab.Usina.y - 5 && i.y > cab.Usina.y - 25);
      // cada valor vai para a coluna do cabeçalho mais próxima à esquerda (os números ficam alinhados à direita)
      const cols = Object.entries(cab).sort((a, b) => a[1].x - b[1].x);
      linha.forEach(v => { let k = null; cols.forEach(([nome, h]) => { if (h.x <= v.x + 2) k = nome; }); if (k && tab[k] == null) tab[k] = v.s; });
    } else avisos.push('Não achei a tabela-resumo do boletim.');
    const val = {
      usina_codigo: mU ? mU[1] : null, usina_nome: mU ? mU[2].trim() : null,
      competencia: mC ? mC[2] + '-' + mC[1] + '-01' : null,
      uc: valorAcima(itens, 'UC', /^\d{5,}$/),
      om: numBRL(valorAcima(itens, 'O&M', R$)),
      terra: numBRL(valorAcima(itens, 'Arrendamento de Terra', R$)),
      equip: numBRL(valorAcima(itens, 'Aluguel de Equipamento', R$)),
      om_contratual: numBRL(valorAcima(itens, 'O&M Contratual', R$)),
      terra_contratual: numBRL(valorAcima(itens, 'Arrendamento de Terra Contratual', R$)),
      equip_contratual: numBRL(valorAcima(itens, 'Aluguel de Equipamento Contratual', R$)),
      fatura_usina: numBRL(valorAcima(itens, 'Fatura Usina', R$)),
      inadimplencia: numBRL(valorAcima(itens, 'Inadimplência', R$)),
      gestao: numBRL(valorAcima(itens, 'Gestão', R$)),
      ajuste: numBRL(valorAcima(itens, 'Ajuste', R$)),
      injetada_mwh: numMWh(tab.Injetada) ?? numMWh(valorAcima(itens, 'Injeção Realizada', /MWh/)),
      compensada_mwh: numMWh(tab.Compensada),
      resultado: numBRL(tab.Total),
      tabela: { om: numBRL(tab.OEM), terra: numBRL(tab.Terra), equip: numBRL(tab.Equip), gestao: numBRL(tab.Gestao), total: numBRL(tab.Total) },
    };
    // conferências: o boletim precisa "fechar" antes de gerar recibos
    const igual = (a, b) => a != null && b != null && Math.abs(a - b) < 0.015;
    const t = val.tabela, conf = [];
    conf.push({ nome: 'Arrendamento de Terra: resumo = tabela', ok: igual(val.terra, t.terra), a: val.terra, b: t.terra });
    conf.push({ nome: 'Aluguel de Equipamento: resumo = tabela', ok: igual(val.equip, t.equip), a: val.equip, b: t.equip });
    conf.push({ nome: 'O&M (Nota Fiscal): resumo = tabela', ok: igual(val.om, t.om), a: val.om, b: t.om });
    const liq = [val.equip_contratual, val.fatura_usina, val.inadimplencia, val.gestao, val.ajuste];
    conf.push({ nome: 'Equipamento = contratual + fatura da usina + inadimplência + gestão + ajuste', ok: liq.every(v => v != null) && igual(Math.round(liq.reduce((a, b) => a + b, 0) * 100) / 100, val.equip), a: liq.every(v => v != null) ? Math.round(liq.reduce((a, b) => a + b, 0) * 100) / 100 : null, b: val.equip });
    conf.push({ nome: 'Resultado = O&M + Terra + Equipamento', ok: t.total != null && igual(Math.round(((val.om || 0) + (val.terra || 0) + (val.equip || 0)) * 100) / 100, t.total), a: Math.round(((val.om || 0) + (val.terra || 0) + (val.equip || 0)) * 100) / 100, b: t.total });
    const faltando = ['usina_codigo', 'competencia', 'terra', 'equip', 'om'].filter(k => val[k] == null);
    if (faltando.length) avisos.push('Não consegui ler: ' + faltando.join(', ') + '. Confira no boletim e preencha.');
    return { ok: true, cooperativa: 'move', valores: val, conferencias: conf, fecha: conf.every(c => c.ok) && !faltando.length, avisos };
  },
};

// NFS-e (DANFSe do Emissor Nacional): número, chave, data de emissão, valor, CNPJ do prestador
async function lerDanfse(buf) {
  const { itens } = await itensDoPdf(buf, 1);
  const todo = itens.map(i => i.s).join(' ');
  const chave = (todo.match(/\b(\d{50})\b/) || [])[1] || null;
  const num = valorAbaixo(itens, 'NÚMERO DA NFS-e', /^\d+$/);
  const emis = valorAbaixo(itens, 'DATA E HORA DA EMISSÃO DA NFS-e', /^\d{2}\/\d{2}\/\d{4}/);
  const valor = numBRL(valorAbaixo(itens, 'VALOR DA OPERAÇÃO / SERVIÇO', /R\$/));
  const cnpj = (todo.match(/\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/) || [])[1] || null;
  const ref = (todo.match(/REF\.?\s*(\d{2})\/(\d{4})/i) || []);
  return { ok: !!(chave || num), numero: num, chave, emitida_em: emis ? emis.slice(6, 10) + '-' + emis.slice(3, 5) + '-' + emis.slice(0, 2) : null, valor, cnpj_prestador: cnpj ? cnpj.replace(/\D/g, '') : null, ref: ref[1] ? ref[2] + '-' + ref[1] + '-01' : null };
}
function valorAbaixo(itens, rotulo, re) {
  const r = itens.find(i => i.s === rotulo); if (!r) return null;
  const c = itens.filter(i => re.test(i.s) && i.y < r.y && i.y > r.y - 20 && Math.abs(i.x - r.x) < 30).sort((a, b) => b.y - a.y);
  return c.length ? c[0].s : null;
}
if (typeof module !== 'undefined') module.exports = { LEITORES_BOLETIM, lerDanfse, numBRL };
