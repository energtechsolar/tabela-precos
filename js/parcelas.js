// Energtech — parcelas a receber de uma venda (usado pelo Financeiro; o CRM passa a usar também)
// Regra, pela forma de pagamento do ganho e pela condição salva na proposta:
//  financiamento/FINAME: o banco paga o kit direto ao fornecedor → 1 parcela do banco (total − kit), sem data
//  à vista: 1 entrada do total
//  condição negociada na proposta (ou "entrada + parcelas" com a condição salva): exatamente a entrada e as parcelas da proposta
//    (entrada zero = só os boletos; 1º vencimento = o do contrato "1º venc. DD/MM/AAAA", senão daqui a 1 mês)
//    Atenção: o texto da forma de pagamento de venda parcelada também traz "à vista R$ ..." como referência — não é venda à vista.
//  sem condição salva: entrada no valor do kit + N boletos mensais (pergunta N)
//  kit na proposta acima do custo: + repasse do fornecedor (nota de repasse, já sem o imposto)
// Precisa do cliente Supabase global "sb". Devolve { novas, kit, aviso } — quem chama grava em "recebimentos".
const somaMesesParc = (iso, n) => { const d = new Date(iso + 'T12:00:00'); const dia = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); d.setDate(Math.min(dia, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); return d.toISOString().slice(0, 10); };
const hojeParc = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
async function parcelasDaVenda({ leadId, orcamentoId, forma, valorFinal, perguntarN }) {
  const [o, c] = await Promise.all([
    sb.from('orcamentos').select('valor_final, modo_valor:dados->>modo_valor, valor_kit:dados->>valor_kit, repasse_pct:dados->>repasse_pct, boleto:dados->boleto').eq('id', orcamentoId).maybeSingle(),
    sb.from('orcamento_custos').select('custo_kit').eq('orcamento_id', orcamentoId).maybeSingle(),
  ]);
  if (o.error) return { erro: o.error.message };
  const od = o.data || {}, total = +od.valor_final || +valorFinal || 0;
  const custo = c.data && c.data.custo_kit != null ? +c.data.custo_kit : null;
  const kitProp = od.modo_valor === 'separado' && +od.valor_kit ? +od.valor_kit : null;
  const kit = kitProp || custo || 0;
  const f = String(forma || '').toLowerCase(), hoje = hojeParc();
  const bol = od.boleto && typeof od.boleto === 'object' ? od.boleto : null;
  const bolOk = bol && +bol.entrada >= 0 && +bol.parcelas > 0 && +bol.parcela > 0 && ['negociada', 'opcoes'].includes(bol.modo);
  const parcelado = /\d+\s*x\s*de/.test(f);                          // "19x de R$ 1.000,00 no boleto..."
  const v1 = String(forma || '').match(/1º venc\.?\s*(\d{2})\/(\d{2})\/(\d{4})/);
  const venc1 = v1 ? `${v1[3]}-${v1[2]}-${v1[1]}` : null;
  const base = { lead_id: leadId, orcamento_id: orcamentoId };
  const novas = [];
  if (/financ|finame|banco|bndes|caixa/.test(f)) {
    novas.push({ ...base, tipo: 'banco', descricao: 'Liberação do banco após a instalação (o kit o banco paga direto ao fornecedor)', valor: Math.round((total - kit) * 100) / 100, vencimento: null });
  } else if ((/vista/.test(f) && !parcelado) || (!f && bol && bol.modo === 'avista')) {
    novas.push({ ...base, tipo: 'entrada', descricao: 'Pagamento à vista', valor: total, vencimento: hoje });
  } else if (bolOk && (bol.modo === 'negociada' || parcelado || /entrada|parcel|boleto/.test(f))) {
    const n = Math.round(+bol.parcelas), alvo = Math.round((+bol.total_prazo || +bol.entrada + +bol.parcela * n) * 100);
    if (+bol.entrada > 0) novas.push({ ...base, tipo: 'entrada', descricao: 'Entrada', valor: +bol.entrada, vencimento: hoje });
    const parc = Math.round(+bol.parcela * 100), ultima = alvo - Math.round(+bol.entrada * 100) - parc * (n - 1);
    for (let i = 1; i <= n; i++) novas.push({ ...base, tipo: 'boleto', descricao: 'Boleto ' + i + '/' + n, valor: (i === n ? ultima : parc) / 100, vencimento: venc1 ? somaMesesParc(venc1, i - 1) : somaMesesParc(hoje, i) });
  } else {
    const n = perguntarN ? perguntarN() : 0;
    if (!n) return { novas: [], kit, cancelado: true };
    novas.push({ ...base, tipo: 'entrada', descricao: 'Entrada (valor do kit)', valor: kit, vencimento: hoje });
    const resto = Math.round((total - kit) * 100), parte = Math.floor(resto / n);
    for (let i = 1; i <= n; i++) novas.push({ ...base, tipo: 'boleto', descricao: 'Boleto ' + i + '/' + n, valor: (i === n ? resto - parte * (n - 1) : parte) / 100, vencimento: somaMesesParc(hoje, i) });
  }
  if (kitProp && custo != null && kitProp - custo > 0.5) {
    const pct = od.repasse_pct != null && od.repasse_pct !== '' ? +od.repasse_pct : 4;
    const rep = Math.round((kitProp - custo) * 100) / 100, volta = Math.round((rep - Math.round(rep * pct) / 100) * 100) / 100;
    novas.push({ ...base, tipo: 'repasse', descricao: 'Nota de repasse do fornecedor ' + rep.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) + ' − imposto (já descontado)', valor: volta, vencimento: null });
  }
  return { novas, kit, aviso: kit ? '' : 'Não achei o valor do kit: confira a entrada / parcela do banco.' };
}

// CRM (ficha do cliente → "⚡ Sugerir parcelas"): usa esta mesma regra, com o resumo para conferir antes de lançar
if (typeof sugerirParcelas === 'function' && typeof msgReceb === 'function') {
  sugerirParcelas = async function (leadId) {
    const l = leads.find(x => x.id === leadId), p = l && propostaDoLead(l);
    if (!p) { msgReceb('⚠ Marque a proposta fechada (link "alterar" no bloco Negócio ganho).', true); return; }
    msgReceb('⏳ Calculando…');
    const r = await parcelasDaVenda({ leadId, orcamentoId: p.id, forma: l.forma_pagamento, valorFinal: p.valor_final,
      perguntarN: () => Math.max(0, Math.min(24, parseInt(prompt('Em quantos boletos fica o restante (depois da entrada no valor do kit)?', '3'), 10) || 0)) });
    if (r.erro) { msgReceb('⚠ ' + r.erro, true); return; }
    if (r.cancelado || !r.novas.length) { msgReceb(''); return; }
    const fR = v => (+v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), fD = iso => iso ? iso.split('-').reverse().join('/') : '';
    const resumo = r.novas.map(x => '• ' + x.descricao + ': ' + fR(x.valor) + (x.vencimento ? ' em ' + fD(x.vencimento) : ' (sem data)')).join('\n');
    if (!confirm('Parcelas:\n\n' + resumo + '\n\nLançar? (dá para ajustar valores e datas depois)')) { msgReceb(''); return; }
    const { data, error } = await sb.from('recebimentos').insert(r.novas).select('*');
    if (error) { msgReceb('⚠ ' + error.message, true); return; }
    recebs = (data || []).concat(recebs); renderRecebimentos();
    msgReceb(r.aviso ? '⚠ ' + r.aviso : '✅ Parcelas lançadas. Confira valores e datas (o banco e o repasse ficam sem data até você saber).', !!r.aviso);
  };
}
