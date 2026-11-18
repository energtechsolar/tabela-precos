// Eider Sistemas / CRM — tela Conversas: controles do Léo (carregado pelo js/comum.js depois do script da tela).
// Em cada conversa: 🤖 Léo atendendo ⇄ 👤 Equipe (quem responde) e o resumo que o Léo deixou ao passar para a equipe.
// Na lista: etiqueta "Léo passou". Para o admin: ⚙ Léo — ligar/desligar, números de teste, tempo de espera e o texto de instruções.
(function () {
  if (typeof renderChat !== 'function' || typeof renderLista !== 'function') return;
  let CFG = null;
  const st = document.createElement('style');
  st.textContent = `
    .leo-faixa { margin:0 10px 8px; background:#10213a; border:1px solid #1e3a5f; border-radius:8px; padding:8px 12px; font-size:12px; white-space:pre-wrap; }
    .leo-faixa.erro { background:#2a1010; border-color:#7f1d1d; }
    .leo-faixa b { color:var(--azul); } .leo-faixa.erro b { color:var(--vermelho); }
    .tag.passou { color:var(--amarelo); border-color:#7c5a00; }
    .leo-modal { position:fixed; inset:0; background:rgba(0,0,0,.75); z-index:90; display:flex; align-items:center; justify-content:center; }
    .leo-modal > div { background:var(--card); border:1px solid var(--borda); border-radius:14px; padding:18px; width:min(760px, 94vw); max-height:92vh; overflow-y:auto; }
    .leo-modal label { display:block; font-size:12px; color:var(--muted); margin:10px 0 4px; }
    .leo-modal textarea { min-height:340px; font-family:ui-monospace, Menlo, monospace; font-size:12px; line-height:1.4; }`;
  document.head.appendChild(st);

  async function carregarCfg() {
    const { data } = await sb.from('leo_config').select('*').limit(1).maybeSingle();
    CFG = data || null;
  }

  // lista: etiqueta "Léo passou"
  const _lista = renderLista;
  renderLista = function () {
    _lista.apply(this, arguments);
    if (CFG) botaoCfg();
    document.querySelectorAll('#conversas .conv').forEach(el => {
      const m = String(el.getAttribute('onclick') || '').match(/abrir\((\d+)\)/); if (!m) return;
      const c = CONVS.find(x => x.id === +m[1]);
      if (c && c.leo_situacao === 'passou' && c.atendimento !== 'leo') { const n = el.querySelector('.conv-nome > span'); if (n && !n.querySelector('.passou')) n.insertAdjacentHTML('beforeend', '<span class="tag passou" title="O Léo passou esta conversa para a equipe">🤖 passou</span>'); }
      if (c && c.leo_situacao === 'erro') { const n = el.querySelector('.conv-nome > span'); if (n && !n.querySelector('.passou')) n.insertAdjacentHTML('beforeend', '<span class="tag passou" style="color:var(--vermelho)">⚠ Léo</span>'); }
    });
  };

  // conversa: botão Léo ⇄ Equipe e resumo
  const _chat = renderChat;
  renderChat = function () {
    _chat.apply(this, arguments);
    const c = CONVS.find(x => x.id === aberta); if (!c) return;
    const topo = document.querySelector('#chat .chat-topo > div:last-child');
    if (topo && !topo.querySelector('.bt-leo')) {
      const leo = c.atendimento === 'leo';
      const teste = CFG && (CFG.telefones_teste || []).some(t => String(t).replace(/\D/g, '').slice(-8) === String(c.telefone).replace(/\D/g, '').slice(-8));
      const desligado = CFG && !CFG.ativo && !teste;
      topo.insertAdjacentHTML('afterbegin', `<button class="btn btn-p bt-leo ${leo ? '' : 'btn-sec'}" style="${leo ? 'background:#1e3a5f;color:#fff' : ''}"
        title="${leo ? 'O Léo está respondendo esta conversa. Clique para a equipe assumir.' : 'Clique para o Léo responder esta conversa.'}${desligado ? ' (Léo desligado: só responde os números de teste)' : ''}"
        onclick="alternarLeo()">${leo ? '🤖 Léo atendendo' : '👤 Equipe'}${leo && desligado ? ' ⏸' : ''}</button>`);
    }
    const msgs = $('msgs');
    if (msgs && c.leo_resumo && ['passou', 'erro'].includes(c.leo_situacao) && !document.querySelector('.leo-faixa')) {
      msgs.insertAdjacentHTML('afterend', `<div class="leo-faixa ${c.leo_situacao === 'erro' ? 'erro' : ''}"><b>${c.leo_situacao === 'erro' ? '⚠ Léo' : '🤖 Resumo do Léo'}</b>${c.leo_passou_em ? ' <span class="muted">· ' + new Date(c.leo_passou_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + '</span>' : ''}
${esc(c.leo_resumo)}
<button class="btn btn-sec btn-p" style="margin-top:6px" onclick="leoVisto()">✓ Visto</button></div>`);
    }
  };
  window.alternarLeo = async function () {
    const c = CONVS.find(x => x.id === aberta); if (!c) return;
    const para = c.atendimento === 'leo' ? 'humano' : 'leo';
    if (para === 'leo' && !confirm('Passar esta conversa para o Léo responder?\n\nEle responde as próximas mensagens do cliente. Se alguém da equipe escrever aqui, a conversa volta para a equipe.')) return;
    const mud = para === 'leo' ? { atendimento: 'leo', leo_situacao: 'atendendo', leo_resumo: null } : { atendimento: 'humano' };
    const { error } = await sb.from('whatsapp_conversas').update(mud).eq('id', c.id);
    if (error) { alert('⚠ ' + error.message); return; }
    Object.assign(c, mud); renderLista(); renderChat(false);
  };
  window.leoVisto = async function () {
    const c = CONVS.find(x => x.id === aberta); if (!c) return;
    const { error } = await sb.from('whatsapp_conversas').update({ leo_situacao: null }).eq('id', c.id);
    if (error) { alert('⚠ ' + error.message); return; }
    c.leo_situacao = null; renderLista(); renderChat(false);
  };

  // ⚙ Léo (admin): configuração
  function botaoCfg() {
    const topo = document.querySelector('.lista-topo'); if (!topo || topo.querySelector('.bt-leo-cfg') || !(perfil && perfil.admin)) return;
    topo.insertAdjacentHTML('beforeend', `<button class="btn btn-sec btn-p bt-leo-cfg" onclick="abrirCfgLeo()">⚙ Léo ${CFG ? (CFG.ativo ? '· ligado' : '· em teste') : '· não configurado'}</button>`);
  }
  window.abrirCfgLeo = async function () {
    await carregarCfg();
    if (!CFG) { alert('O Léo ainda não foi configurado no banco.'); return; }
    let chaves = null; try { chaves = await (await fetch(SUPABASE_URL + '/functions/v1/leo-atender')).json(); } catch (_) { chaves = null; }
    const d = document.createElement('div'); d.className = 'leo-modal'; d.id = 'leo-modal';
    d.innerHTML = `<div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><h2 style="font-family:'Barlow Condensed',sans-serif;color:var(--amarelo)">🤖 Léo — atendimento por IA</h2><button class="btn btn-sec btn-p" onclick="document.getElementById('leo-modal').remove()">✕</button></div>
      <p class="muted">Responde as conversas marcadas como "🤖 Léo atendendo". Ligado: novas conversas do número do Léo já começam com ele. Em teste: só responde os números da lista de teste.</p>
      <p class="muted" style="margin-top:6px">Chave da IA: ${chaves ? (chaves.chave_ia ? '✅' : '⚠ falta ANTHROPIC_API_KEY') : '?'} · Transcrição de áudio: ${chaves ? (chaves.audio ? '✅' : '⚠ falta OPENAI_API_KEY (os áudios não são entendidos)') : '?'}</p>
      <label><input type="checkbox" id="leo-ativo" ${CFG.ativo ? 'checked' : ''}> <b style="color:var(--texto)">Léo ligado para todos os clientes</b> (desmarcado = só números de teste)</label>
      <label>Números de teste (separados por vírgula, com DDD)</label><input class="input" id="leo-teste" value="${esc((CFG.telefones_teste || []).join(', '))}">
      <label>Espera antes de responder (segundos, para juntar mensagens seguidas)</label><input class="input" id="leo-espera" type="number" min="5" max="120" value="${CFG.espera_seg}" style="width:120px">
      <label>Texto de instruções do Léo</label><textarea class="input" id="leo-prompt">${esc(CFG.prompt)}</textarea>
      <div style="display:flex;gap:8px;margin-top:12px;align-items:center"><button class="btn" onclick="salvarCfgLeo()">💾 Salvar</button><span class="muted" id="leo-msg">${CFG.atualizado_por ? 'Última alteração: ' + esc(CFG.atualizado_por) + ' · ' + new Date(CFG.atualizado_em).toLocaleString('pt-BR') : ''}</span></div>
    </div>`;
    document.body.appendChild(d);
  };
  window.salvarCfgLeo = async function () {
    const ativo = $('leo-ativo').checked;
    if (ativo && !CFG.ativo && !confirm('Ligar o Léo para TODOS os clientes do número do Léo?\n\nNovas conversas começam com ele. Conversas antigas continuam como estão (use o botão em cada uma).')) return;
    const mud = { ativo, telefones_teste: $('leo-teste').value.split(',').map(t => t.replace(/\D/g, '')).filter(t => t.length >= 10).map(t => t.length <= 11 ? '55' + t : t),
      espera_seg: Math.max(5, Math.min(120, +$('leo-espera').value || 25)), prompt: $('leo-prompt').value.trim(), atualizado_por: perfil.email, atualizado_em: new Date().toISOString() };
    if (mud.prompt.length < 200) { alert('O texto de instruções está curto demais.'); return; }
    const { error } = await sb.from('leo_config').update(mud).eq('empresa_id', CFG.empresa_id);
    if (error) { $('leo-msg').textContent = '⚠ ' + error.message; return; }
    // o número do Léo: com o Léo ligado, novas conversas já começam com ele
    await sb.from('whatsapp_canais').update({ leo_ativo: ativo }).eq('empresa_id', CFG.empresa_id).ilike('nome', '%léo%');
    Object.assign(CFG, mud); $('leo-msg').textContent = '✅ Salvo.';
    const b = document.querySelector('.bt-leo-cfg'); if (b) b.textContent = '⚙ Léo · ' + (ativo ? 'ligado' : 'em teste');
  };

  carregarCfg().then(() => { botaoCfg(); if (typeof aberta !== 'undefined' && aberta) renderChat(false); renderLista(); });
})();
