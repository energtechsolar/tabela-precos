// Eider Sistemas / CRM — "Negócio ganho": escolher a opção de pagamento que o cliente fechou, entre as que a proposta ofereceu.
//  Importado, imóvel urbano ... à vista · entrada + parcelas (boleto) · financiamento Caixa
//  Importado, imóvel rural .... à vista · entrada + parcelas (boleto)
//  Importado, negociada ........ a condição combinada  ·  só à vista ........ à vista
//  Nacional ................... à vista · financiamento FINAME / PRONAF (mesma linha)
//  + "Outra" (digitar + dizer quem paga o kit ao fornecedor).
//  A opção vai para leads.pagamento_tipo (é ela que decide financiado ou não no Financeiro, Instalações e parcelas);
//  forma_pagamento guarda só o texto descritivo.
(function () {
  if (typeof abrirGanho !== 'function' || typeof confirmarGanho !== 'function' || !document.getElementById('ganho-pag')) return;
  const R = v => (+v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const campoTxt = document.getElementById('ganho-pag').closest('.campo');
  const box = document.createElement('div');
  box.className = 'campo'; box.id = 'ganho-opcoes'; box.style.marginTop = '10px';
  campoTxt.before(box);
  const st = document.createElement('style');
  st.textContent = `#ganho-opcoes .gop { display:flex; gap:10px; align-items:flex-start; border:1px solid var(--borda,#2e2e2e); border-radius:10px; padding:9px 11px; margin-top:6px; cursor:pointer; }
    #ganho-opcoes .gop:has(input:checked) { border-color:var(--verde,#4ade80); background:rgba(74,222,128,.06); }
    #ganho-opcoes .gop b { display:block; } #ganho-opcoes .gop span { font-size:13px; color:var(--muted,#8a8a8a); }`;
  document.head.appendChild(st);
  let opcoes = [], leadAtual = null;
  // "Outra condição": quem paga o kit ao fornecedor
  const quem = document.createElement('div');
  quem.className = 'campo'; quem.id = 'ganho-quem'; quem.style.marginTop = '8px'; quem.style.display = 'none';
  quem.innerHTML = '<label>Quem paga o kit ao fornecedor?</label><select class="input" id="ganho-quem-sel"><option value="">— escolha —</option>'
    + '<option value="outra">Energtech (o cliente paga a Energtech)</option><option value="financiamento">Banco — financiamento (paga direto ao fornecedor)</option></select>';
  campoTxt.after(quem);
  window.ganhoTipoAtual = () => {
    const sel = document.querySelector('input[name="ganho-op"]:checked'), x = sel ? opcoes[+sel.value] : null;
    if (!x) return null;
    return x.k === 'outra' ? (document.getElementById('ganho-quem-sel').value || null) : x.k;
  };

  function textoParcelado(b) {
    const ent = +b.entrada || 0, n = +b.parcelas, p = +b.parcela, tot = +b.total_prazo || ent + p * n;
    return (ent > 0 ? 'Entrada de ' + R(ent) + ' + ' : '') + n + 'x de ' + R(p) + ' no boleto direto com a Energtech · total a prazo ' + R(tot);
  }
  async function montar() {
    const id = +document.getElementById('ganho-prop').value || null;
    opcoes = [];
    if (id) {
      const { data: o } = await sb.from('orcamentos').select('id, tipo, valor_final, boleto:dados->boleto, kit:dados->kit').eq('id', id).maybeSingle();
      if (o) {
        const b = o.boleto && typeof o.boleto === 'object' ? o.boleto : null, modo = b ? b.modo || 'opcoes' : 'opcoes';
        const vista = { k: 'avista', t: 'À vista', d: R(o.valor_final), txt: 'À vista ' + R(o.valor_final) };
        if (o.tipo === 'nacional') opcoes = [vista, { k: 'finame', t: 'Financiamento FINAME / PRONAF', d: 'o banco paga o kit ao fornecedor; o restante é liberado após a instalação', txt: 'Financiamento FINAME / PRONAF' }];
        else if (modo === 'combinar' || (o.kit && o.kit.pagamento === 'combinar')) opcoes = [];
        else if (modo === 'avista') opcoes = [vista];
        else if (modo === 'negociada' && b && +b.parcelas > 0) opcoes = [{ k: 'negociada', t: 'Condição negociada', d: textoParcelado(b), txt: textoParcelado(b) }];
        else {
          opcoes = [vista];
          if (b && +b.parcelas > 0) opcoes.push({ k: 'parcelado', t: 'Entrada + parcelas (boleto)', d: textoParcelado(b), txt: textoParcelado(b) });
          if (modo !== 'rural') opcoes.push({ k: 'caixa', t: 'Financiamento Caixa', d: 'o banco paga o kit ao fornecedor; o restante é liberado após a instalação', txt: 'Financiamento Caixa' });
        }
      }
    }
    opcoes.push({ k: 'outra', t: 'Outra condição', d: 'digite abaixo', txt: '' });
    const atual = document.getElementById('ganho-pag').value.trim();
    const tipoSalvo = leadAtual && leadAtual.pagamento_tipo;
    const marcada = opcoes.find(x => x.txt && x.txt === atual)
      || (tipoSalvo ? opcoes.find(x => x.k === tipoSalvo) : null)
      || (atual || tipoSalvo ? opcoes[opcoes.length - 1] : null);
    box.innerHTML = '<label>Opção de pagamento escolhida pelo cliente</label>' + opcoes.map((x, i) => `<label class="gop"><input type="radio" name="ganho-op" value="${i}" ${x === marcada ? 'checked' : ''} onchange="ganhoOpcao(${i})"><div><b>${x.t}</b><span>${x.d}</span></div></label>`).join('');
    const ehOutra = !!(marcada && marcada.k === 'outra');
    campoTxt.style.display = ehOutra ? '' : 'none'; quem.style.display = ehOutra ? '' : 'none';
    document.getElementById('ganho-quem-sel').value = ehOutra && ['outra', 'financiamento'].includes(tipoSalvo) ? tipoSalvo : '';
    if (marcada && marcada.k !== 'outra' && !atual) document.getElementById('ganho-pag').value = marcada.txt;
    const lbl = campoTxt.querySelector('label'); if (lbl) lbl.textContent = 'Forma de pagamento (texto)';
  }
  window.ganhoOpcao = i => {
    const x = opcoes[i]; if (!x) return;
    const inp = document.getElementById('ganho-pag');
    if (x.k === 'outra') { if (opcoes.some(o => o.txt && o.txt === inp.value.trim())) inp.value = ''; campoTxt.style.display = ''; quem.style.display = ''; inp.focus(); }
    else { inp.value = x.txt; campoTxt.style.display = 'none'; quem.style.display = 'none'; }
  };
  document.getElementById('ganho-prop').addEventListener('change', () => { document.getElementById('ganho-pag').value = ''; montar(); });

  const _abrir = abrirGanho;
  abrirGanho = function (id) { leadAtual = (typeof leads !== 'undefined' && leads.find(x => x.id === id)) || null; const r = _abrir.apply(this, arguments); montar(); return r; };
  const _confirmar = confirmarGanho;
  confirmarGanho = function () {
    if (!document.querySelector('input[name="ganho-op"]:checked') && !document.getElementById('ganho-pag').value.trim()) { alert('Escolha a opção de pagamento que o cliente fechou.'); return; }
    if (!document.getElementById('ganho-pag').value.trim()) { alert('Digite a forma de pagamento combinada.'); return; }
    if (!ganhoTipoAtual()) { alert('Em "Outra condição", diga quem paga o kit ao fornecedor (Energtech ou banco).'); return; }
    return _confirmar.apply(this, arguments);
  };
})();
