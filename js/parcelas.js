// Energtech — parcelas a receber de uma venda (usado pelo Financeiro; o CRM passa a usar também)
// Regra, pela forma de pagamento do ganho e pela condição salva na proposta:
//  financiamento/FINAME: o banco paga o kit direto ao fornecedor → 1 parcela do banco (total − kit), sem data
//  à vista: 1 entrada do total
//  condição negociada na proposta (ou "entrada + parcelas" com a condição salva): exatamente a entrada e as parcelas da proposta
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
  const bolOk = bol && +bol.entrada > 0 && +bol.parcelas > 0 && +bol.parcela > 0 && ['negociada', 'opcoes'].includes(bol.modo);
  const base = { lead_id: leadId, orcamento_id: orcamentoId };
  const novas = [];
  if (/financ|finame|banco|bndes|caixa/.test(f)) {
    novas.push({ ...base, tipo: 'banco', descricao: 'Liberação do banco após a instalação (o kit o banco paga direto ao fornecedor)', valor: Math.round((total - kit) * 100) / 100, vencimento: null });
  } else if (/vista/.test(f) || (!f && bol && bol.modo === 'avista')) {
    novas.push({ ...base, tipo: 'entrada', descricao: 'Pagamento à vista', valor: total, vencimento: hoje });
  } else if (bolOk && (bol.modo === 'negociada' || /entrada|parcel|boleto/.test(f))) {
    const n = Math.round(+bol.parcelas), alvo = Math.round((+bol.total_prazo || +bol.entrada + +bol.parcela * n) * 100);
    novas.push({ ...base, tipo: 'entrada', descricao: 'Entrada', valor: +bol.entrada, vencimento: hoje });
    const parc = Math.round(+bol.parcela * 100), ultima = alvo - Math.round(+bol.entrada * 100) - parc * (n - 1);
    for (let i = 1; i <= n; i++) novas.push({ ...base, tipo: 'boleto', descricao: 'Boleto ' + i + '/' + n, valor: (i === n ? ultima : parc) / 100, vencimento: somaMesesParc(hoje, i) });
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
