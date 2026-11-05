// Energtech — Recibo de usina em PDF (Arrendamento de Terra / Aluguel de Equipamento), no layout dos modelos Word.
// Nada fixo de empresa aqui: emitente, destinatário, banco e textos vêm do cadastro (emitentes, contrapartes, usinas).
// Uso: const doc = reciboUsinaPDF({ tipo: 'terra'|'equip', numero, emissao, competencia, valor, emitente, destinatario, banco, discriminacao })
//      doc.save('arquivo.pdf') ou doc.output('blob'). Precisa do jsPDF (window.jspdf).

// ── valor por extenso (reais e centavos), em maiúsculas ──
function extensoReais(valor) {
  const U = ['', 'UM', 'DOIS', 'TRÊS', 'QUATRO', 'CINCO', 'SEIS', 'SETE', 'OITO', 'NOVE', 'DEZ', 'ONZE', 'DOZE', 'TREZE', 'QUATORZE', 'QUINZE', 'DEZESSEIS', 'DEZESSETE', 'DEZOITO', 'DEZENOVE'];
  const D = ['', '', 'VINTE', 'TRINTA', 'QUARENTA', 'CINQUENTA', 'SESSENTA', 'SETENTA', 'OITENTA', 'NOVENTA'];
  const C = ['', 'CENTO', 'DUZENTOS', 'TREZENTOS', 'QUATROCENTOS', 'QUINHENTOS', 'SEISCENTOS', 'SETECENTOS', 'OITOCENTOS', 'NOVECENTOS'];
  const ate999 = n => {
    if (n === 0) return '';
    if (n === 100) return 'CEM';
    const c = Math.floor(n / 100), r = n % 100, p = [];
    if (c) p.push(C[c]);
    if (r) p.push(r < 20 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? ' E ' + U[r % 10] : ''));
    return p.join(' E ');
  };
  const inteiro = n => {
    if (n === 0) return 'ZERO';
    const grupos = [], nomes = [['', ''], ['MIL', 'MIL'], ['MILHÃO', 'MILHÕES'], ['BILHÃO', 'BILHÕES']];
    let i = 0;
    while (n > 0) { grupos.push([n % 1000, i]); n = Math.floor(n / 1000); i++; }
    const partes = grupos.filter(g => g[0]).reverse().map(([v, k]) => k === 1 && v === 1 ? 'MIL' : ate999(v) + (k ? ' ' + nomes[k][v > 1 ? 1 : 0] : ''));
    // "E" antes do último grupo quando ele é < 100 ou centena redonda (ex.: MIL E QUINHENTOS)
    const ult = grupos.find(g => g[0]) || [0];
    return partes.length > 1 && (ult[0] < 100 || ult[0] % 100 === 0) && ult[1] === 0
      ? partes.slice(0, -1).join(' ') + ' E ' + partes[partes.length - 1] : partes.join(' ');
  };
  const cents = Math.round((+valor || 0) * 100), r = Math.floor(cents / 100), c = cents % 100;
  const txtR = r ? inteiro(r) + (r === 1 ? ' REAL' : (r % 1000000 === 0 ? ' DE REAIS' : ' REAIS')) : '';
  const txtC = c ? ate999(c) + (c === 1 ? ' CENTAVO' : ' CENTAVOS') : '';
  return txtR && txtC ? txtR + ' E ' + txtC : (txtR || txtC || 'ZERO REAIS');
}

const MESES_EXT = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
const docFmt = d => { const s = String(d || '').replace(/\D/g, ''); return s.length === 14 ? s.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : s.length === 11 ? s.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') : String(d || ''); };
const cepFmt = c => { const s = String(c || '').replace(/\D/g, ''); return s.length === 8 ? s.slice(0, 2) + '.' + s.slice(2, 5) + '-' + s.slice(5) : String(c || ''); };
const brl = v => (+v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function reciboUsinaPDF(d) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const titulo = d.tipo === 'terra' ? 'RECIBO DE ARRENDAMENTO DE TERRA' : 'RECIBO DE ALUGUEL DE EQUIPAMENTO';
  const canhoto = d.tipo === 'terra' ? 'RECIBO DE ALUGUEL' : 'RECIBO DE LOCAÇÃO';
  const num = String(d.numero).padStart(6, '0');
  const [ca, cm] = String(d.competencia).slice(0, 7).split('-').map(Number);
  const em = d.emitente || {}, de = d.destinatario || {}, bc = d.banco || {};
  const X = 12, W = 186, X2 = X + W;   // margens do modelo
  doc.setLineWidth(0.3); doc.setTextColor(0);
  const caixa = (x, y, w, h) => doc.rect(x, y, w, h);
  const txt = (t, x, y, tam, neg, opt) => { doc.setFont('times', neg ? 'bold' : 'normal'); doc.setFontSize(tam); doc.text(Array.isArray(t) ? t : String(t), x, y, opt || {}); };

  // ── cabeçalho: nome | dados do emitente | título + nº + emissão ──
  let y = 12;
  const c1 = 66, c2 = 62, c3 = W - c1 - c2;
  caixa(X, y, c1, 36); caixa(X + c1, y, c2, 36); caixa(X + c1 + c2, y, c3, 36);
  txt(em.nome || '', X + c1 / 2, y + 19, 11, true, { align: 'center', maxWidth: c1 - 6 });
  const cx = X + c1 + c2 / 2;
  doc.setFont('times', 'bold'); doc.setFontSize(10.5);
  const nomeL = doc.splitTextToSize(em.nome || '', c2 - 4).slice(0, 2);
  nomeL.forEach((l, i) => doc.text(l, cx, y + 6.5 + i * 4.2, { align: 'center' }));
  let ye = y + 6.5 + nomeL.length * 4.2 + 0.8;
  const end = [em.endereco, em.bairro].filter(Boolean).map(s => String(s).toUpperCase());
  end.forEach((l, i) => txt(l, cx, ye + i * 3.2, 6.5, true, { align: 'center', maxWidth: c2 - 4 }));
  ye += end.length * 3.2 + 0.6;
  txt('CEP: ' + cepFmt(em.cep), cx, ye, 6.5, true, { align: 'center' });
  if (em.telefone) txt(em.telefone, cx, ye + 3.6, 6.5, true, { align: 'center' });
  doc.line(X + c1, y + 30, X + c1 + c2 + c3, y + 30);
  txt(docFmt(em.documento), cx, y + 34.5, 11, true, { align: 'center' });
  const tx = X + c1 + c2 + c3 / 2;
  doc.setFont('times', 'bold'); doc.setFontSize(10.5);
  doc.splitTextToSize(titulo, c3 - 6).forEach((l, i) => doc.text(l, tx, y + 5.5 + i * 4.3, { align: 'center' }));
  txt('Nº: ' + num, tx, y + 24, 12, true, { align: 'center' });
  txt('Emissão: ' + String(d.emissao || '').split('-').reverse().join('/'), X + c1 + c2 + 1.5, y + 34.5, 9, true);

  // ── destinatário ──
  y += 36;
  caixa(X, y, W, 21);
  txt('DESTINATÁRIO:', X + 1.5, y + 4, 8, true);
  txt(String(de.nome || '').toUpperCase(), X + 1.5, y + 8, 8, true);
  txt('CNPJ: ' + docFmt(de.documento), X + 1.5, y + 11.5, 8, true);
  doc.setFont('times', 'bold'); doc.setFontSize(7);
  doc.splitTextToSize('ENDEREÇO: ' + String(de.endereco || '').toUpperCase(), 78).slice(0, 2).forEach((l, i) => doc.text(l, X + 1.5, y + 15 + i * 2.9, {}));
  txt('BAIRRO: ' + String(de.bairro || '').toUpperCase(), X + 84, y + 15, 7, true);
  txt('CEP: ' + cepFmt(de.cep), X + 140, y + 15, 7, true);
  txt('CIDADE: ' + String(de.cidade || '').toUpperCase(), X + 1.5, y + 20, 7, true);

  // ── discriminação ──
  y += 21;
  caixa(X, y, W, 23);
  txt('DISCRIMINAÇÃO:', X + 1.5, y + 5.5, 11, true);
  txt(d.discriminacao || '', X + 1.5, y + 11.5, 8, true, { maxWidth: W - 3 });

  // ── competência ──
  y += 23;
  caixa(X, y, W, 20);
  txt('COMPETÊNCIA:', X + 1.5, y + 9, 11, true);
  txt(MESES_EXT[cm - 1] + '/' + ca, X + 1.5, y + 13.5, 11, true);

  // ── valor ──
  y += 20;
  caixa(X, y, W, 22);
  txt('VALOR TOTAL DO RECIBO: R$ ' + brl(d.valor), X + 1.5, y + 5, 13, true);
  txt(doc.splitTextToSize('(' + extensoReais(d.valor) + ')', W - 3), X + 1.5, y + 9.5, 9.5, true);

  // ── dados bancários ──
  y += 22;
  caixa(X, y, W, 33);
  const linhasB = bc.nome ? ['DADOS BANCÁRIOS:', 'BANCO Nº ' + (bc.codigo || '') + ' - ' + bc.nome, 'CONTA CORRENTE Nº ' + (bc.conta || ''), 'AGÊNCIA ' + (bc.agencia || '')] : [];
  linhasB.forEach((l, i) => txt(l, X + 1.5, y + 7.5 + i * 4.8, 6.5, true));

  // ── canhoto ──
  y += 33;
  caixa(X + 142, y - 4.5, W - 142, 4.5);
  txt(canhoto, X + 142 + (W - 142) / 2, y - 1.2, 7.5, true, { align: 'center' });
  caixa(X, y, 34, 8); caixa(X + 34, y, 108, 8); caixa(X + 142, y, W - 142, 8);
  txt(em.nome || '', X + 35, y + 2.8, 6, false);
  txt('Nº: ' + num, X + 142 + (W - 142) / 2, y + 5, 11, true, { align: 'center' });
  return doc;
}
if (typeof module !== 'undefined') module.exports = { extensoReais, reciboUsinaPDF };
