// Energtech — CRM (só admin): comissão de cada venda.
// - "Vendedor da venda": ganha a opção "➕ Cadastrar outra pessoa…" (pessoa de fora, sem acesso ao sistema).
// - Comissão do vendedor: automática (cadastro / proposta) ou ajustada nesta venda, em R$ ou em %.
// - Indicação: quem indicou o cliente e quanto recebe (R$ ou %), além do vendedor.
// Tudo fica na tabela venda_comissoes (só o admin lê); o Financeiro cria o "a pagar" de cada um
// (financeiro_sincronizar) e as duas comissões entram como custo no Lucro por obra.
// Carregado pelo crm.html depois de js/crm.js: envolve abrirFicha e salvarFicha sem mudar o crm.js.
(function () {
  if (typeof abrirFicha !== 'function' || typeof salvarFicha !== 'function') return;
  const VC = {};   // venda_comissoes por lead (cache da tela)
  const num = t => { let s = String(t ?? '').replace(/[R$%\s]/g, ''); if (!s) return null; if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); const n = Number(s); return isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null; };
  const txt = v => v == null ? '' : String(v).replace('.', ',');
  const valorVenda = l => { const p = typeof propostaDoLead === 'function' ? propostaDoLead(l) : null; return p ? +p.valor_final || 0 : 0; };
  const comissionaveis = sel => pessoas.filter(p => (p.recebe_comissao && p.ativo) || p.id === sel);
  const opPessoas = (sel, vazio) => '<option value="">' + vazio + '</option>' + comissionaveis(sel).map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(p.nome)}${p.tipo === 'indicador' ? ' · indicação' : ''}${p.comissao_pct != null ? ' · ' + txt(p.comissao_pct) + '%' : ''}</option>`).join('') + '<option value="novo">➕ Cadastrar outra pessoa…</option>';

  async function carregarVC(id) {
    if (id in VC) return VC[id];
    const { data, error } = await sb.from('venda_comissoes').select('*').eq('lead_id', id).maybeSingle();
    if (error) { console.warn('venda_comissoes:', error.message); return (VC[id] = null); }
    return (VC[id] = data || {});
  }

  function bloco(l, v) {
    const modoC = v.comissao_valor != null ? 'rs' : v.comissao_pct != null ? 'pct' : 'auto';
    const modoI = v.indicacao_pct != null ? 'pct' : 'rs';
    const opModo = (m, auto) => (auto ? `<option value="auto" ${m === 'auto' ? 'selected' : ''}>Automática</option>` : '') + `<option value="rs" ${m === 'rs' ? 'selected' : ''}>Valor (R$)</option><option value="pct" ${m === 'pct' ? 'selected' : ''}>% da venda</option>`;
    return `<div class="largo" id="cv-bloco" style="background:var(--card2);border:1px solid var(--borda);border-radius:10px;padding:10px">
      <div class="grade">
        <div><label>🔒 Comissão do vendedor</label><select class="select" id="cv-modo" onchange="cvPrevia()">${opModo(modoC, true)}</select></div>
        <div><label>Valor / %</label><input class="input" id="cv-val" inputmode="decimal" value="${modoC === 'rs' ? txt(v.comissao_valor) : modoC === 'pct' ? txt(v.comissao_pct) : ''}" placeholder="automática" oninput="cvPrevia()"></div>
        <div><label>🔒 Indicação (quem indicou o cliente)</label><select class="select" id="cv-ind" onchange="cvTrocarPessoa(this)">${opPessoas(v.indicador_id || null, '— Ninguém —')}</select></div>
        <div style="display:flex;gap:6px"><div style="flex:1"><label>Como</label><select class="select" id="cv-ind-modo" onchange="cvPrevia()">${opModo(modoI, false)}</select></div>
          <div style="flex:1"><label>Valor / %</label><input class="input" id="cv-ind-val" inputmode="decimal" value="${txt(modoI === 'pct' ? v.indicacao_pct : v.indicacao_valor)}" oninput="cvPrevia()"></div></div>
      </div>
      <div class="muted" id="cv-previa" style="margin-top:6px"></div></div>`;
  }

  window.cvPrevia = function () {
    const el = $('cv-previa'); if (!el || !fichaId) return;
    const l = leads.find(x => x.id === fichaId) || {}, total = valorVenda(l);
    const modo = $('cv-modo').value, v = num($('cv-val').value);
    $('cv-val').disabled = modo === 'auto'; if (modo === 'auto') $('cv-val').value = '';
    const vend = pessoas.find(p => p.id === (+($('fx-vend') || {}).value || l.vendedor_id));
    const com = modo === 'rs' ? v : modo === 'pct' ? (v != null ? total * v / 100 : null) : null;
    const ind = +$('cv-ind').value || null, iv = num($('cv-ind-val').value), im = $('cv-ind-modo').value;
    const indR = ind && iv != null ? (im === 'pct' ? total * iv / 100 : iv) : null;
    const partes = [];
    partes.push('Vendedor' + (vend ? ' (' + esc(vend.nome.split(' ')[0]) + ')' : '') + ': ' + (modo === 'auto' ? 'automática' + (vend && vend.comissao_pct != null ? ' (' + txt(vend.comissao_pct) + '% = ' + fmtR(total * vend.comissao_pct / 100) + ')' : ' (cadastro / proposta)') : com != null ? '<b>' + fmtR(com) + '</b>' : '—'));
    if (ind) partes.push('Indicação: ' + (indR != null ? '<b>' + fmtR(indR) + '</b>' : '<span style="color:var(--amarelo)">informe o valor</span>'));
    el.innerHTML = (total ? 'Venda ' + fmtR(total) + ' · ' : '') + partes.join(' · ') + ' — salva com "💾 Salvar" e entra no Financeiro (a pagar conforme o cliente paga).';
  };

  // ➕ cadastrar pessoa de fora (indicação), direto pelo select do vendedor ou da indicação
  async function novaPessoa(sel) {
    const nome = (prompt('Nome de quem vai receber a comissão (ex.: quem indicou o cliente):') || '').trim();
    if (!nome) return null;
    const pix = (prompt('PIX (opcional):') || '').trim() || null;
    const { data, error } = await sb.from('equipe').insert({ nome, tipo: 'indicador', recebe_comissao: true, pix, ativo: true }).select('id, nome, tipo, recebe_comissao, comissao_pct, ativo').single();
    if (error) { alert('Não foi possível cadastrar: ' + error.message); return null; }
    pessoas.push(data); pessoas.sort((a, b) => a.nome.localeCompare(b.nome));
    return data;
  }
  window.cvTrocarPessoa = async function (el) {
    if (el.value === 'novo') {
      const p = await novaPessoa();
      const atual = p ? p.id : null;
      el.innerHTML = el.id === 'fx-vend' ? opVendedorVendaMais(atual) : opPessoas(atual, '— Ninguém —');
      el.value = atual || '';
      ['fx-vend', 'cv-ind'].forEach(id => { const o = $(id); if (o && o !== el) { const v = o.value; o.innerHTML = id === 'fx-vend' ? opVendedorVendaMais(+v || null) : opPessoas(+v || null, '— Ninguém —'); o.value = v; } });
    }
    cvPrevia();
  };
  const opVendedorVendaMais = sel => opPessoas(sel, '— Não informado —');

  const _abrir = abrirFicha;
  abrirFicha = async function (id) {
    const r = await _abrir.apply(this, arguments);
    if (!perfil || !perfil.admin) return r;
    const sv = $('fx-vend'); if (!sv || $('cv-bloco')) return r;
    const l = leads.find(x => x.id === id); if (!l) return r;
    sv.innerHTML = opVendedorVendaMais(l.vendedor_id || null);
    sv.setAttribute('onchange', 'cvTrocarPessoa(this)');
    const v = await carregarVC(id);
    if (v === null || fichaId !== id || $('cv-bloco')) return r;   // tabela ainda não criada (SQL) ou outra ficha aberta
    sv.closest('div').insertAdjacentHTML('afterend', bloco(l, v));
    cvPrevia();
    return r;
  };

  const _salvar = salvarFicha;
  salvarFicha = async function (id) {
    const sv = $('fx-vend'); if (sv && sv.value === 'novo') sv.value = '';
    const temBloco = !!$('cv-bloco');
    const reg = temBloco ? (() => {
      const modo = $('cv-modo').value, v = num($('cv-val').value), ind = +$('cv-ind').value || null, iv = num($('cv-ind-val').value), im = $('cv-ind-modo').value;
      return { lead_id: id, comissao_valor: modo === 'rs' ? v : null, comissao_pct: modo === 'pct' ? v : null,
        indicador_id: ind, indicacao_valor: ind && im === 'rs' ? iv : null, indicacao_pct: ind && im === 'pct' ? iv : null };
    })() : null;
    if (reg && reg.comissao_pct > 100 || reg && reg.indicacao_pct > 100) { const m = $('fx-msg'); if (m) { m.textContent = '⚠ Percentual acima de 100%.'; m.classList.add('erro'); } return; }
    await _salvar.apply(this, arguments);
    if (!reg) return;
    const m = $('fx-msg');
    if (m && m.classList.contains('erro')) return;
    const { error } = await sb.from('venda_comissoes').upsert(reg, { onConflict: 'lead_id' });
    if (error) { if (m) { m.textContent = '⚠ Ficha salva, mas a comissão não: ' + error.message; m.classList.add('erro'); } return; }
    VC[id] = { ...(VC[id] || {}), ...reg };
    const l = leads.find(x => x.id === id);
    if (l && l.etapa === 'ganho') sb.rpc('financeiro_sincronizar', { p_mes: new Date().toISOString().slice(0, 10) }).then(() => {}, () => {});
    if (m) m.textContent = '✅ Salvo (comissões' + (l && l.etapa === 'ganho' ? ' já no Financeiro' : ' entram no Financeiro quando o negócio for ganho') + ')';
  };
})();
