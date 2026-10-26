// Energtech — painel admin: fornecedores, custos, senha, tabelas
// (arquivo carregado pelo index.html; a ordem dos <script> importa)

// ── admin: fornecedores e contas ──
function renderAdminFornecedores() {
  const box = document.getElementById('admin-fornecedores');
  if (!box) return;
  const F = PROPOSTA_CFG.fornecedores || (PROPOSTA_CFG.fornecedores = []);
  const C = PROPOSTA_CFG.contas || (PROPOSTA_CFG.contas = []);
  const campo = (rot, html, larg) => `<div style="${larg ? 'grid-column:1/-1' : ''}"><div class="admin-cfg-lbl">${rot}</div>${html}</div>`;
  box.innerHTML = `
    <div class="admin-cfg-grid">${F.map((f, i) => `
      <div class="admin-cfg-item" style="display:grid;gap:8px">
        ${campo('Fornecedor', `<input class="admin-input" value="${escHtml(f.nome)}" oninput="PROPOSTA_CFG.fornecedores[${i}].nome=this.value">`)}
        ${campo('Código FINAME (marca / código)', `<input class="admin-input" placeholder="Ex.: Livoltek 750W~75kWp: 04340203" value="${escHtml(f.finame)}" oninput="PROPOSTA_CFG.fornecedores[${i}].finame=this.value">`)}
        ${campo('Dados bancários e cadastro', `<textarea class="admin-input" rows="5" style="resize:vertical" oninput="PROPOSTA_CFG.fornecedores[${i}].dados=this.value">${escHtml(f.dados)}</textarea>`)}
        <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
          <label style="display:flex;gap:6px;align-items:center;font-size:12px;cursor:pointer"><input type="radio" name="forn-padrao" ${PROPOSTA_CFG.fornecedor_padrao === f.id ? 'checked' : ''} onchange="PROPOSTA_CFG.fornecedor_padrao='${f.id}'"> Já vir selecionado</label>
          <button class="link-mini" onclick="removerFornecedor(${i})">✕ Remover</button>
        </div>
      </div>`).join('')}
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin:8px 0 16px">
      <button class="admin-btn-add" onclick="adicionarFornecedor()">+ Adicionar fornecedor</button>
      <label style="display:flex;gap:6px;align-items:center;font-size:12px;color:var(--muted);cursor:pointer"><input type="radio" name="forn-padrao" ${!PROPOSTA_CFG.fornecedor_padrao ? 'checked' : ''} onchange="PROPOSTA_CFG.fornecedor_padrao=''"> Nenhum fornecedor pré-selecionado</label>
    </div>
    <div class="admin-cfg-grid">${C.map((c, i) => `
      <div class="admin-cfg-item" style="display:grid;gap:8px">
        ${campo('Conta Energtech — nome curto', `<input class="admin-input" value="${escHtml(c.rotulo)}" oninput="PROPOSTA_CFG.contas[${i}].rotulo=this.value">`)}
        ${campo('Dados que aparecem no PDF', `<textarea class="admin-input" rows="5" style="resize:vertical" oninput="PROPOSTA_CFG.contas[${i}].dados=this.value">${escHtml(c.dados)}</textarea>`)}
        <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
          <label style="display:flex;gap:6px;align-items:center;font-size:12px;cursor:pointer"><input type="radio" name="conta-padrao" ${PROPOSTA_CFG.conta_padrao === c.id ? 'checked' : ''} onchange="PROPOSTA_CFG.conta_padrao='${c.id}'"> Conta padrão</label>
          ${C.length > 1 ? `<button class="link-mini" onclick="removerConta(${i})">✕ Remover</button>` : ''}
        </div>
      </div>`).join('')}
    </div>
    <button class="admin-btn-add" style="margin-top:8px" onclick="adicionarConta()">+ Adicionar conta Energtech</button>`;
}
function idNovo(p) { return p + Date.now().toString(36); }
function adicionarFornecedor() { PROPOSTA_CFG.fornecedores.push({ id:idNovo('f'), nome:'Novo fornecedor', finame:'', dados:'' }); renderAdminFornecedores(); }
function removerFornecedor(i) {
  if (!confirm('Remover este fornecedor?')) return;
  const [f] = PROPOSTA_CFG.fornecedores.splice(i, 1);
  if (PROPOSTA_CFG.fornecedor_padrao === f.id) PROPOSTA_CFG.fornecedor_padrao = '';
  renderAdminFornecedores();
}
function adicionarConta() { PROPOSTA_CFG.contas.push({ id:idNovo('c'), rotulo:'Nova conta', dados:'ENERGTECH ENERGIA SOLAR LTDA\nCNPJ: 40.297.488/0001-85\n' }); renderAdminFornecedores(); }
function removerConta(i) {
  if (!confirm('Remover esta conta?')) return;
  const [c] = PROPOSTA_CFG.contas.splice(i, 1);
  if (PROPOSTA_CFG.conta_padrao === c.id) PROPOSTA_CFG.conta_padrao = PROPOSTA_CFG.contas[0].id;
  renderAdminFornecedores();
}

function renderAdminProposta() {
  const box = document.getElementById('admin-proposta-campos');
  if (!box) return;
  box.innerHTML = CAMPOS_PROPOSTA.map(([k, rot, t]) => `
    <div class="admin-cfg-item" style="${t === 'textarea' ? 'grid-column:1/-1' : ''}">
      <div class="admin-cfg-lbl">${rot}</div>
      ${t === 'check'
        ? `<label style="display:flex;gap:8px;align-items:center;cursor:pointer"><input type="checkbox" id="pcfg-${k}" ${PROPOSTA_CFG[k] ? 'checked' : ''}> Sim</label>`
        : t === 'textarea'
        ? `<textarea class="admin-input" id="pcfg-${k}" rows="5" style="width:100%;resize:vertical">${escHtml(PROPOSTA_CFG[k])}</textarea>`
        : `<input class="admin-input" id="pcfg-${k}" type="${t === 'number' ? 'number' : 'text'}" style="width:100%" value="${escHtml(PROPOSTA_CFG[k])}">`}
    </div>`).join('');
}
function lerAdminProposta() {
  const novo = { ...PROPOSTA_CFG };
  CAMPOS_PROPOSTA.forEach(([k, , t]) => {
    const el = document.getElementById('pcfg-' + k);
    if (!el) return;
    novo[k] = t === 'check' ? el.checked : t === 'number' ? (+el.value || PROPOSTA_PADRAO[k]) : el.value.trim();
  });
  return novo;
}


function enviarWhatsApp() {
  if (!propostaItem || !propostaCalc) return;
  const d = coletarDadosProposta();
  const msg = mensagemProposta(d);
  const numero = telDigitos(d.telefone);
  const url = numero
    ? `https://wa.me/${numero}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}

// celular: compartilhar o PDF direto (WhatsApp, e-mail…) quando o aparelho permite
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P') && propostaItem && propostaCalc
      && document.getElementById('proposta-card').classList.contains('visivel')) {
    e.preventDefault();
    gerarPDF('baixar');
  }
});

// ── CUSTOS DOS KITS (somente admin) ─────────────────────────────────────────
let custos = {};        // uid -> custo (o que está na tela)
let custosSalvos = {};  // uid -> custo (o que está no banco)

function novoUid() {
  return (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
    : 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
function garantirUids() {
  IMPORTADO.forEach(k => { if (!k.uid) k.uid = novoUid(); });
  NACIONAL.forEach(k => { if (!k.uid) k.uid = novoUid(); });
}
function custoDoKit(item) {
  if (!item || !item.uid) return null;
  return (item.uid in custos) ? custos[item.uid] : null;
}
function definirCusto(item, tipo, valor) {
  if (!item.uid) item.uid = novoUid();
  const v = String(valor).trim() === '' ? null : +valor;
  if (v === null) delete custos[item.uid]; else custos[item.uid] = v;
}
async function carregarCustos() {
  custos = {}; custosSalvos = {};
  if (!sb) return;
  const { data, error } = await sb.from('kit_custos').select('kit_uid, custo');
  if (error) { console.error('Supabase custos:', error); return; }
  (data || []).forEach(c => { custos[c.kit_uid] = +c.custo; custosSalvos[c.kit_uid] = +c.custo; });
}
async function gravarCustos() {
  if (!sb || !adminLogado) return { ok:true };
  const tipoDe = uid => IMPORTADO.some(k => k.uid === uid) ? 'importado' : (NACIONAL.some(k => k.uid === uid) ? 'nacional' : null);
  const mudou = Object.keys(custos).filter(uid => custos[uid] !== custosSalvos[uid] && isFinite(custos[uid]))
    .map(uid => ({ kit_uid: uid, tipo: tipoDe(uid), custo: custos[uid], atualizado_em: new Date().toISOString() }));
  const apagar = Object.keys(custosSalvos).filter(uid => !(uid in custos));
  if (!mudou.length && !apagar.length) return { ok:true, alterados:false };
  if (mudou.length) {
    const { error } = await sb.from('kit_custos').upsert(mudou, { onConflict:'kit_uid' });
    if (error) { console.error('Supabase custos:', error); return { ok:false, msg:'Preços salvos, mas houve erro ao salvar os custos: ' + error.message }; }
    mudou.forEach(m => custosSalvos[m.kit_uid] = m.custo);
  }
  if (apagar.length) {
    const { error } = await sb.from('kit_custos').delete().in('kit_uid', apagar);
    if (!error) apagar.forEach(u => delete custosSalvos[u]);
  }
  return { ok:true, alterados:true };
}
function atualizarCustoResumo(item, c) {
  const elC = document.getElementById('res-custo'), elM = document.getElementById('res-margem');
  if (!elC || !adminLogado) return;
  const custo = custoDoKit(item);
  if (custo === null) { elC.textContent = 'não informado'; elM.textContent = '—'; elM.style.color = ''; return; }
  const margem = c.valorFinal - custo - c.comissao;
  elC.textContent = fmt(custo);
  elM.textContent = fmt(margem) + '  (' + (margem / c.valorFinal * 100).toLocaleString('pt-BR', { maximumFractionDigits:1 }) + '%)';
  elM.style.color = margem < 0 ? 'var(--vermelho)' : 'var(--verde)';
}

// ── TROCAR SENHA ────────────────────────────────────────────────────────────
function abrirTrocarSenha() {
  if (!perfil) { abrirLogin(); return; }
  ['senha-atual','senha-nova','senha-confirma'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('senha-erro').style.display = 'none';
  document.getElementById('senha-ok').style.display = 'none';
  document.getElementById('senha-usuario').textContent = perfil.email;
  document.getElementById('senha-overlay').classList.add('visivel');
  setTimeout(() => document.getElementById('senha-atual').focus(), 100);
}

function fecharTrocarSenha() {
  document.getElementById('senha-overlay').classList.remove('visivel');
}

async function trocarSenha() {
  const atual = document.getElementById('senha-atual').value;
  const nova  = document.getElementById('senha-nova').value;
  const conf  = document.getElementById('senha-confirma').value;
  const erro  = document.getElementById('senha-erro');
  const ok    = document.getElementById('senha-ok');
  const btn   = document.getElementById('senha-btn');
  const falha = t => { erro.textContent = t; erro.style.display = 'block'; };
  erro.style.display = 'none'; ok.style.display = 'none';
  if (!sb || !perfil) return falha('Sem conexão ou sessão expirada. Entre novamente.');
  if (!atual || !nova || !conf) return falha('Preencha os três campos.');
  if (nova.length < 8) return falha('A nova senha precisa ter pelo menos 8 caracteres.');
  if (nova !== conf) return falha('A confirmação não confere com a nova senha.');
  if (nova === atual) return falha('A nova senha precisa ser diferente da atual.');
  btn.disabled = true; btn.textContent = 'Salvando…';
  // confirma a senha atual antes de trocar
  const { error: e1 } = await sb.auth.signInWithPassword({ email: perfil.email, password: atual });
  if (e1) { btn.disabled = false; btn.textContent = 'Salvar nova senha'; return falha('Senha atual incorreta.'); }
  const { error: e2 } = await sb.auth.updateUser({ password: nova });
  btn.disabled = false; btn.textContent = 'Salvar nova senha';
  if (e2) { console.error('Supabase senha:', e2); return falha('Não foi possível trocar: ' + (e2.message || 'tente novamente.')); }
  ['senha-atual','senha-nova','senha-confirma'].forEach(id => document.getElementById(id).value = '');
  ok.style.display = 'block';
  setTimeout(fecharTrocarSenha, 2500);
}

// ── PAINEL ADMIN ────────────────────────────────────────────────────────────
async function verificarSessao() { await carregarPerfil(); }

function mostrarLoginArea(titulo) {
  document.getElementById('admin-overlay').classList.add('visivel');
  document.getElementById('admin-senha-input').value = '';
  document.getElementById('admin-erro').style.display = 'none';
  document.getElementById('admin-login-titulo').textContent = titulo;
  document.getElementById('admin-login-area').style.display = 'block';
  document.getElementById('admin-painel-area').style.display = 'none';
  setTimeout(() => document.getElementById('admin-email-input').focus(), 100);
}

function abrirLogin() {
  modoLogin = 'usuario';
  mostrarLoginArea('🔑 Entrar — Vendedores');
}

function abrirAdmin() {
  modoLogin = 'admin';
  if (perfil && perfil.admin) {
    document.getElementById('admin-overlay').classList.add('visivel');
    mostrarPainel();
    return;
  }
  mostrarLoginArea('🔐 Acesso Admin');
  if (perfil && !perfil.admin) {
    const erro = document.getElementById('admin-erro');
    erro.textContent = 'Você está logado como ' + perfil.email + ', que não é admin. Entre com uma conta de admin.';
    erro.style.display = 'block';
  }
}

function fecharAdmin() {
  document.getElementById('admin-overlay').classList.remove('visivel');
}

function fecharAdminOverlay(e) {
  if (e.target === document.getElementById('admin-overlay')) fecharAdmin();
}

async function loginAdmin() {
  const email = document.getElementById('admin-email-input').value.trim();
  const senha = document.getElementById('admin-senha-input').value;
  const erro  = document.getElementById('admin-erro');
  const btn   = document.getElementById('admin-login-btn');
  erro.style.display = 'none';
  if (!sb) { erro.textContent = 'Sem conexão com o servidor.'; erro.style.display = 'block'; return; }
  if (!email || !senha) { erro.textContent = 'Preencha e-mail e senha.'; erro.style.display = 'block'; return; }
  btn.disabled = true; btn.textContent = 'Entrando…';
  const { error } = await sb.auth.signInWithPassword({ email, password: senha });
  if (error) {
    btn.disabled = false; btn.textContent = 'Entrar';
    erro.textContent = 'E-mail ou senha incorretos.';
    erro.style.display = 'block';
    document.getElementById('admin-senha-input').value = '';
    document.getElementById('admin-senha-input').focus();
    return;
  }
  await carregarPerfil();
  await carregarDoSupabase();
  btn.disabled = false; btn.textContent = 'Entrar';
  if (modoLogin === 'admin') {
    if (perfil && perfil.admin) {
      mostrarPainel();
    } else {
      erro.textContent = 'Login feito, mas este usuário não é admin.';
      erro.style.display = 'block';
    }
    return;
  }
  fecharAdmin();
}

async function sairAdmin() {
  if (sb) await sb.auth.signOut();
  ['etg_config', 'etg_leads', 'etg_perfil'].forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
  fecharAdmin();
  await carregarPerfil();
  await carregarDoSupabase();
}

function mostrarPainel() {
  document.getElementById('admin-login-area').style.display = 'none';
  document.getElementById('admin-painel-area').style.display = 'block';
  renderAdminTabela('importado');
  renderAdminTabela('nacional');
  carregarConfig();
}

function adminTab(aba, btn) {
  document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('ativo'));
  btn.classList.add('ativo');
  document.querySelectorAll('.admin-secao').forEach(s => s.classList.remove('ativa'));
  document.getElementById('admin-sec-' + aba).classList.add('ativa');
}

function renderAdminTabela(tipo) {
  const dados = tipo === 'importado' ? IMPORTADO : NACIONAL;
  const tbody = document.getElementById('admin-tbody-' + tipo);
  tbody.innerHTML = '';
  dados.forEach((item, idx) => {
    const tr = document.createElement('tr');
    if (tipo === 'importado') {
      tr.innerHTML = `
        <td class="arrastar" title="Arraste para mudar a posição"><span class="alca">⠿</span><span class="setas"><button onclick="moverSistema('importado',${idx},-1)" title="Subir">▲</button><button onclick="moverSistema('importado',${idx},1)" title="Descer">▼</button></span></td>
        <td><input class="admin-input admin-input-md" value="${item.nome}" onchange="IMPORTADO[${idx}].nome=this.value"></td>
        <td style="text-align:center"><input type="checkbox" class="admin-check" ${item.top?'checked':''} onchange="IMPORTADO[${idx}].top=this.checked"></td>
        <td><input class="admin-input admin-input-sm" type="number" step="0.01" value="${item.kwp}" onchange="IMPORTADO[${idx}].kwp=+this.value"></td>
        <td><input class="admin-input admin-input-sm" type="number" value="${item.mod}" onchange="IMPORTADO[${idx}].mod=+this.value"></td>
        <td><input class="admin-input admin-input-sm" value="${item.inv}" onchange="IMPORTADO[${idx}].inv=this.value"></td>
        <td><input class="admin-input admin-input-sm" type="number" value="${item.kwh}" onchange="IMPORTADO[${idx}].kwh=+this.value"></td>
${celulasPreco('importado', idx, item)}
        <td><input class="admin-input admin-input-md" type="number" step="0.01" value="${item.entrada}" onchange="IMPORTADO[${idx}].entrada=+this.value"></td>
        <td><input class="admin-input admin-input-sm" type="number" step="0.01" value="${(item.com_pct*100).toFixed(1)}" onchange="IMPORTADO[${idx}].com_pct=+this.value/100"></td>
        <td style="white-space:nowrap"><button class="admin-btn-del" title="Itens do kit" style="color:var(--amarelo)" onclick="editarItensKit('importado',${idx})">📦</button> <button class="admin-btn-del" onclick="removerLinha('importado',${idx})">✕</button></td>`;
    } else {
      tr.innerHTML = `
        <td class="arrastar" title="Arraste para mudar a posição"><span class="alca">⠿</span><span class="setas"><button onclick="moverSistema('nacional',${idx},-1)" title="Subir">▲</button><button onclick="moverSistema('nacional',${idx},1)" title="Descer">▼</button></span></td>
        <td><input class="admin-input admin-input-md" value="${item.nome}" onchange="NACIONAL[${idx}].nome=this.value"></td>
        <td style="text-align:center"><input type="checkbox" class="admin-check" ${item.top?'checked':''} onchange="NACIONAL[${idx}].top=this.checked"></td>
        <td><input class="admin-input admin-input-sm" type="number" step="0.01" value="${item.kwp}" onchange="NACIONAL[${idx}].kwp=+this.value"></td>
        <td><input class="admin-input admin-input-sm" type="number" value="${item.mod}" onchange="NACIONAL[${idx}].mod=+this.value"></td>
        <td><input class="admin-input admin-input-sm" value="${item.inv}" onchange="NACIONAL[${idx}].inv=this.value"></td>
        <td><input class="admin-input admin-input-sm" type="number" value="${item.kwh}" onchange="NACIONAL[${idx}].kwh=+this.value"></td>
${celulasPreco('nacional', idx, item)}
        <td class="admin-calc" id="der-nacional-${idx}-p8"></td>
        <td class="admin-calc" id="der-nacional-${idx}-p10"></td>
        <td><input class="admin-input admin-input-sm" type="number" step="0.01" value="${(item.com_pct*100).toFixed(1)}" onchange="NACIONAL[${idx}].com_pct=+this.value/100"></td>
        <td style="white-space:nowrap"><button class="admin-btn-del" title="Itens do kit" style="color:var(--amarelo)" onclick="editarItensKit('nacional',${idx})">📦</button> <button class="admin-btn-del" onclick="removerLinha('nacional',${idx})">✕</button></td>`;
    }
    tr.draggable = true;
    tr.dataset.idx = idx;
    tr.addEventListener('dragstart', e => {
      if (e.target.closest && e.target.closest('input,button')) { e.preventDefault(); return; }
      _arrasto = { tipo, de: idx }; tr.classList.add('arrastando'); e.dataTransfer.effectAllowed = 'move';
    });
    tr.addEventListener('dragend', () => { tr.classList.remove('arrastando'); tbody.querySelectorAll('.alvo').forEach(x => x.classList.remove('alvo')); });
    tr.addEventListener('dragover', e => { if (_arrasto && _arrasto.tipo === tipo) { e.preventDefault(); tbody.querySelectorAll('.alvo').forEach(x => x.classList.remove('alvo')); tr.classList.add('alvo'); } });
    tr.addEventListener('drop', e => { e.preventDefault(); if (_arrasto && _arrasto.tipo === tipo) moverPara(tipo, _arrasto.de, idx); _arrasto = null; });
    tbody.appendChild(tr);
    atualizarDerivados(tipo, idx);
  });
}

// ── preço de venda pelo custo (só admin): custo → markup → valor de venda; mostra venda − custo e as parcelas ──
// O markup não é guardado: é sempre calculado do valor de venda e do custo. Custo e markup nunca chegam aos vendedores.
const reaisAdm = v => (+v || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
function markupDe(item) { const c = custoDoKit(item); return c && +item.inv_r ? (item.inv_r / c - 1) * 100 : null; }
function celulasPreco(tipo, idx, item) {
  const p = `der-${tipo}-${idx}-`;
  return `
        <td><input class="admin-input admin-input-md admin-input-custo" type="number" step="0.01" min="0" placeholder="—" value="${custoDoKit(item) ?? ''}" oninput="mudarCusto('${tipo}',${idx},this.value)"></td>
        <td><input class="admin-input admin-input-sm admin-input-custo" type="number" step="0.5" id="${p}mk" placeholder="—" title="Markup sobre o custo. Ao mudar, recalcula o valor de venda." oninput="mudarMarkup('${tipo}',${idx},this.value)"></td>
        <td><input class="admin-input admin-input-md" type="number" step="0.01" id="${p}valor" value="${item.inv_r}" oninput="mudarValor('${tipo}',${idx},this.value)"></td>
        <td class="admin-calc admin-lucro" id="${p}lucro"></td>`;
}
function atualizarDerivados(tipo, idx) {
  const item = listaDo(tipo)[idx]; if (!item) return;
  const c = custoDoKit(item), p = `der-${tipo}-${idx}-`, el = id => document.getElementById(p + id);
  const mk = el('mk');
  if (mk) { mk.disabled = !c; if (document.activeElement !== mk) { const m = markupDe(item); mk.value = m === null ? '' : m.toFixed(1); } }
  const vr = el('valor'); if (vr && document.activeElement !== vr) vr.value = item.inv_r;
  const lu = el('lucro');
  if (lu) { const d = c === null ? null : (+item.inv_r || 0) - c; lu.textContent = d === null ? '—' : reaisAdm(d); lu.classList.toggle('neg', d !== null && d < 0); }
  if (tipo === 'nacional') {
    const v = +item.inv_r || 0;
    if (el('p8')) el('p8').textContent = v ? reaisAdm(calcParcelaMensal(v, 8)) : '—';
    if (el('p10')) el('p10').textContent = v ? reaisAdm(calcParcelaMensal(v, 10)) : '—';
  }
}
function mudarCusto(tipo, idx, v) { definirCusto(listaDo(tipo)[idx], tipo, v); atualizarDerivados(tipo, idx); }
function mudarValor(tipo, idx, v) { listaDo(tipo)[idx].inv_r = +v; atualizarDerivados(tipo, idx); }
function mudarMarkup(tipo, idx, v) {
  const item = listaDo(tipo)[idx], c = custoDoKit(item);
  if (!c || String(v).trim() === '' || !isFinite(+v)) return;
  item.inv_r = Math.round(c * (1 + (+v) / 100) * 100) / 100;
  atualizarDerivados(tipo, idx);
}
function aplicarMarkupTodos(tipo) {
  const msgId = tipo === 'importado' ? 'admin-msg-imp' : 'admin-msg-nac';
  const v = +document.getElementById('mk-todos-' + tipo).value;
  if (!isFinite(v) || v <= 0) { mostrarMsgAdmin(msgId, '⚠ Informe um markup maior que zero.', false); return; }
  let n = 0, sem = 0;
  listaDo(tipo).forEach(it => { const c = custoDoKit(it); if (!c) { sem++; return; } it.inv_r = Math.round(c * (1 + v / 100) * 100) / 100; n++; });
  renderAdminTabela(tipo);
  mostrarMsgAdmin(msgId, `Markup de ${String(v).replace('.', ',')}% aplicado em ${n} kit(s)${sem ? '; ' + sem + ' sem custo ficaram como estavam' : ''}. Confira e clique em "Salvar Alterações".`, true);
}

// ── ordem dos sistemas: arrastar, setas, ordenar por potência; nomes "Sistema N" se renumeram sozinhos ──
let _arrasto = null;
function listaDo(tipo) { return tipo === 'importado' ? IMPORTADO : NACIONAL; }
function renumerarSistemas(lista) {
  lista.forEach((it, i) => { if (!it.nome || /^\s*(sistema\s*\d+|novo sistema)\s*$/i.test(it.nome)) it.nome = 'Sistema ' + (i + 1); });
}
function aposMudarOrdem(tipo) {
  renumerarSistemas(listaDo(tipo));
  renderAdminTabela(tipo);
  const msg = tipo === 'importado' ? 'admin-msg-imp' : 'admin-msg-nac';
  mostrarMsgAdmin(msg, 'Ordem alterada. Clique em "Salvar Alterações" para gravar.', true);
}
function moverPara(tipo, de, para) {
  const l = listaDo(tipo);
  if (de === para || de < 0 || para < 0 || de >= l.length || para >= l.length) return;
  const [it] = l.splice(de, 1); l.splice(para, 0, it);
  aposMudarOrdem(tipo);
}
function moverSistema(tipo, idx, dir) { moverPara(tipo, idx, idx + dir); }
function ordenarPorPotencia(tipo) {
  listaDo(tipo).sort((a, b) => (+a.kwp || 0) - (+b.kwp || 0));
  aposMudarOrdem(tipo);
}
// "3" → "3 kW", "3+4" → "3+4 kW"
function normalizarInversor(lista) { lista.forEach(it => { const v = String(it.inv || '').trim(); if (v && !/[a-z]/i.test(v)) it.inv = v + ' kW'; }); }

function adicionarLinha(tipo) {
  if (tipo === 'importado') {
    IMPORTADO.push({ uid:novoUid(), nome:"Novo Sistema", top:false, kwp:0, mod:0, inv:"", kwh:0, inv_r:0, entrada:0, com_pct:0.06 });
  } else {
    NACIONAL.push({ uid:novoUid(), nome:"Novo Sistema", top:false, kwp:0, mod:0, inv:"", kwh:0, inv_r:0, parc_a:0, parc_m:0, com_pct:0.06 });
  }
  aposMudarOrdem(tipo);
}

function removerLinha(tipo, idx) {
  if (!confirm('Remover este sistema?')) return;
  if (tipo === 'importado') IMPORTADO.splice(idx, 1);
  else NACIONAL.splice(idx, 1);
  aposMudarOrdem(tipo);
}

function validarSistemas(lista, campos) {
  if (!lista.length) return 'A tabela não pode ficar vazia.';
  for (let i = 0; i < lista.length; i++) {
    for (const c of campos) {
      if (typeof lista[i][c] !== 'number' || !isFinite(lista[i][c]))
        return `"${lista[i].nome || 'Sistema ' + (i+1)}": campo ${c} está vazio ou inválido.`;
    }
  }
  return null;
}

function mostrarMsgAdmin(id, texto, ok) {
  const el = document.getElementById(id);
  el.textContent = texto;
  el.style.color = ok ? '' : '#f87171';
  el.style.display = 'block';
  clearTimeout(el._t);
  el._t = setTimeout(() => el.style.display = 'none', ok ? 3000 : 8000);
}

async function gravarNoSupabase(linhas) {
  // grava só o que mudou desde a última leitura/gravação
  const mudou = linhas.filter(l => chave(l.dados) !== ultimoSalvo[l.id]);
  if (!mudou.length) return { ok:true, nada:true };
  if (!sb) return { ok:false, msg:'Sem conexão com o servidor.' };
  const { data, error } = await sb.from('config').upsert(mudou, { onConflict:'id' }).select('id, dados, atualizado_em');
  if (error || !data || data.length !== mudou.length) {
    console.error('Supabase:', error);
    const semPermissao = !error || error.code === '42501' || /row-level security|permission/i.test(error.message || '');
    return { ok:false, msg: semPermissao
      ? 'Sem permissão para salvar. Saia e entre novamente na conta admin.'
      : 'Erro ao salvar: ' + (error.message || 'tente novamente.') };
  }
  data.forEach(l => { ultimoSalvo[l.id] = chave(l.dados); });
  const maisRecente = data.map(l => l.atualizado_em).sort().pop();
  mostrarInfo('Preços atualizados em ' + fmtDataHora(maisRecente));
  return { ok:true };
}

async function salvarAdmin() {
  NACIONAL.forEach(it => { const pm = Math.round(calcParcelaMensal(+it.inv_r || 0, 8) * 100) / 100; it.parc_m = pm; it.parc_a = Math.round(pm * 12 * 100) / 100; });   // parcelas sempre calculadas do valor
  const msgId = document.getElementById('admin-sec-importado').classList.contains('ativa')
    ? 'admin-msg-imp' : 'admin-msg-nac';
  const problema =
    validarSistemas(IMPORTADO, ['kwp','mod','kwh','inv_r','entrada','com_pct']) ||
    validarSistemas(NACIONAL,  ['kwp','mod','kwh','inv_r','parc_a','parc_m','com_pct']);
  if (problema) { mostrarMsgAdmin(msgId, '⚠ ' + problema, false); return; }

  garantirUids();
  renumerarSistemas(IMPORTADO); renumerarSistemas(NACIONAL);
  normalizarInversor(IMPORTADO); normalizarInversor(NACIONAL);
  renderAdminTabela('importado'); renderAdminTabela('nacional');
  const botoes = document.querySelectorAll('.admin-salvar');
  botoes.forEach(b => b.disabled = true);
  let r = await gravarNoSupabase([
    { id:'importado', dados: IMPORTADO },
    { id:'nacional',  dados: NACIONAL  },
  ]);
  if (r.ok) {
    const rc = await gravarCustos();
    if (!rc.ok) r = rc;
    else if (rc.alterados) r = { ok:true };
  }
  botoes.forEach(b => b.disabled = false);

  linhaFoco = null;
  document.getElementById('resumo-bar').style.display = 'none';
  document.getElementById('dash-economia').classList.remove('visivel');
  document.getElementById('dash-importado').classList.remove('visivel');
  atualizar();

  if (r.ok) mostrarMsgAdmin(msgId, r.nada ? 'Nenhuma alteração para salvar.' : '✅ Alterações salvas para todos os vendedores!', true);
  else      mostrarMsgAdmin(msgId, '⚠ ' + r.msg, false);
}

function carregarConfig() {
  document.getElementById('cfg-desc-livre').value   = CFG.desconto_livre;
  document.getElementById('cfg-desc-max').value     = CFG.desconto_max;
  document.getElementById('cfg-split-add').value    = CFG.split_adicional * 100;
  document.getElementById('cfg-split-desc').value   = CFG.split_desconto_extra * 100;
  document.getElementById('cfg-adicional-max').value = document.getElementById('slider-adicional').max;
  renderAdminRegioes();
  renderAdminProposta();
  renderAdminImagens();
  renderAdminFornecedores();
}

async function salvarConfig() {
  const novo = {
    desconto_livre:       +document.getElementById('cfg-desc-livre').value,
    desconto_max:         +document.getElementById('cfg-desc-max').value,
    split_adicional:      +document.getElementById('cfg-split-add').value / 100,
    split_desconto_extra: +document.getElementById('cfg-split-desc').value / 100,
    adicional_max:        +document.getElementById('cfg-adicional-max').value,
  };
  const regioesInvalidas = REGIOES.some(r => !r.nome || !isFinite(r.fator) || r.fator < 50 || r.fator > 160);
  if (Object.values(novo).some(v => !isFinite(v) || v < 0) || regioesInvalidas) {
    mostrarMsgAdmin('admin-msg-cfg', '⚠ Preencha todos os campos com números válidos.', false);
    return;
  }
  CFG.desconto_livre       = novo.desconto_livre;
  CFG.desconto_max         = novo.desconto_max;
  CFG.split_adicional      = novo.split_adicional;
  CFG.split_desconto_extra = novo.split_desconto_extra;
  document.getElementById('slider-adicional').max = novo.adicional_max;
  atualizar();

  const botoes = document.querySelectorAll('.admin-salvar');
  botoes.forEach(b => b.disabled = true);
  novo.regioes = clonar(REGIOES);
  novo.proposta = lerAdminProposta();
  PROPOSTA_CFG = { ...novo.proposta };
  for (const k in _cacheImg) delete _cacheImg[k];
  preencherSelectsPagamento();
  renderSeletorRegiao();
  atualizar();
  const r = await gravarNoSupabase([{ id:'cfg', dados: novo }]);
  botoes.forEach(b => b.disabled = false);

  if (r.ok) mostrarMsgAdmin('admin-msg-cfg', r.nada ? 'Nenhuma alteração para salvar.' : '✅ Configurações salvas para todos os vendedores!', true);
  else      mostrarMsgAdmin('admin-msg-cfg', '⚠ ' + r.msg, false);
}


