// Eider Sistemas / CRM — condição de pagamento da proposta pelo perfil do cliente (carregado depois do precificador)
//  • Imóvel urbano ............ à vista · entrada + parcelas · financiamento Caixa   (modo "opcoes", como antes)
//  • Imóvel rural, sem financiar à vista · entrada + parcelas (sem o financiamento da Caixa)   (modo novo "rural")
//  • Rural com financiamento .. kit Nacional: à vista + simulação FINAME / PRONAF (é a mesma linha)
//  • Condição negociada · Somente à vista · A combinar (sem mudança)
// O modo "rural" é salvo na proposta (dados.boleto.modo) e vale também ao reimprimir.
(function () {
  if (typeof MODOS_PAG === 'undefined' || typeof calcularDadosProposta !== 'function' || typeof montarPropostaPDF !== 'function') return;
  if (!MODOS_PAG.includes('rural')) MODOS_PAG.push('rural');

  const sel = document.getElementById('pag-modo');
  if (sel) {
    const atual = sel.value;
    sel.innerHTML = `
      <option value="opcoes">Imóvel urbano: à vista · entrada + parcelas · financiamento Caixa</option>
      <option value="rural">Imóvel rural (sem financiar): à vista · entrada + parcelas</option>
      <option value="negociada">Condição negociada com o cliente (só o que foi combinado)</option>
      <option value="avista">Somente à vista</option>
      <option value="combinar">A combinar</option>`;
    sel.value = MODOS_PAG.includes(atual) ? atual : 'opcoes';
    const lbl = document.querySelector('label[for="pag-modo"]'); if (lbl) lbl.textContent = 'Condição de pagamento (perfil do cliente)';
    // dica para o rural com financiamento (kit nacional): aparece no lugar do bloco quando a aba é Nacional
    const bloco = document.getElementById('neg-boleto');
    if (bloco && !document.getElementById('pag-dica-nac')) {
      const dica = document.createElement('div');
      dica.id = 'pag-dica-nac'; dica.className = 'proposta-itens';
      dica.innerHTML = '<label class="tit">Condição de pagamento</label><div class="regiao-aviso">Kit Nacional — cliente rural com financiamento: a proposta mostra <b>à vista</b> e a <b>simulação FINAME / PRONAF</b> (Cresol, Sicredi, BB). Cliente rural que não vai financiar: use um kit Importado com "Imóvel rural (sem financiar)".</div>';
      bloco.after(dica);
    }
  }

  const _bloco = atualizarBlocoBoleto;
  atualizarBlocoBoleto = function () {
    const r = _bloco.apply(this, arguments);
    const dica = document.getElementById('pag-dica-nac'); if (dica) dica.style.display = abaAtual === 'importado' ? 'none' : '';
    if (modoPag() === 'rural') {
      const el = document.getElementById('bol-regra');
      if (el) el.textContent = 'Imóvel rural: a proposta mostra à vista e entrada + parcelas (sem o financiamento da Caixa). ' + el.textContent;
    }
    return r;
  };

  // marca o "rural" nos dados da proposta (o cálculo trata como as opções padrão)
  const _calc = calcularDadosProposta;
  calcularDadosProposta = function (e) {
    const d = _calc.apply(this, arguments);
    if (e && e.boleto && e.boleto.modo === 'rural' && d && d.pag) d.pag.rural = true;
    return d;
  };
  // PDF: no rural não entra a opção de financiamento da Caixa
  const _pdf = montarPropostaPDF;
  montarPropostaPDF = function (d) {
    if (!(d && d.pag && d.pag.rural)) return _pdf.apply(this, arguments);
    const antes = PROPOSTA_CFG.fin_ativo;
    PROPOSTA_CFG.fin_ativo = false;
    try { return _pdf.apply(this, arguments); } finally { PROPOSTA_CFG.fin_ativo = antes; }
  };
  if (typeof atualizar === 'function') try { atualizar(); } catch (_) { /* tela ainda carregando */ }
})();
