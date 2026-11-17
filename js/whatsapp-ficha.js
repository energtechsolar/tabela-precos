// Eider Sistemas / CRM — bloco "💬 WhatsApp" na ficha do lead: últimas mensagens e botão para abrir a conversa.
// Se existir conversa com o mesmo telefone ainda sem lead, oferece ligar. Só admin e vendas internas (como no banco).
// Carregado pelo crm.html depois de js/crm.js: envolve abrirFicha() sem mudar o crm.js.
(function () {
  if (typeof abrirFicha !== 'function') return;
  const pode = () => typeof perfil !== 'undefined' && perfil && (perfil.admin || perfil.papel === 'interno');
  const hhmm = iso => { const d = new Date(iso); return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
  const TIPO = { imagem: '📷 Foto', audio: '🎤 Áudio', video: '🎬 Vídeo', documento: '📄 Documento', localizacao: '📍 Localização' };

  async function montar(leadId) {
    const ficha = document.getElementById('ficha'); if (!ficha || fichaId !== leadId) return;
    const l = (typeof leads !== 'undefined' ? leads : []).find(x => x.id === leadId) || {};
    const { data: convs, error } = await sb.from('whatsapp_conversas').select('id, telefone, ultima_msg_em, nao_lidas, canal_id').eq('lead_id', leadId).order('ultima_msg_em', { ascending: false, nullsFirst: false });
    if (error || fichaId !== leadId) return;   // módulo desligado ou sem acesso: não mostra nada
    let html = '';
    if (convs && convs.length) {
      const { data: msgs } = await sb.from('whatsapp_mensagens').select('direcao, tipo, texto, autor, criado_em').eq('conversa_id', convs[0].id).order('criado_em', { ascending: false }).limit(5);
      const lista = (msgs || []).reverse().map(m => `<div style="display:flex;gap:8px;font-size:13px;padding:3px 0;${m.direcao === 'saida' ? 'color:#86efac' : ''}">
          <span class="muted" style="white-space:nowrap">${hhmm(m.criado_em)}</span>
          <span>${m.direcao === 'saida' ? (m.autor === 'leo' ? '🤖 ' : '↩ ') : ''}${esc(m.texto || TIPO[m.tipo] || '')}</span></div>`).join('');
      const nl = convs.reduce((a, c) => a + (c.nao_lidas || 0), 0);
      html = `<h3>💬 WhatsApp ${nl ? `<span style="background:#4ade80;color:#052e16;border-radius:10px;padding:0 7px;font-size:12px">${nl} nova(s)</span>` : ''}</h3>
        <div style="background:var(--card2);border:1px solid var(--borda);border-radius:8px;padding:8px 10px">${lista || '<div class="muted">Sem mensagens ainda.</div>'}</div>
        <div class="acoes" style="margin-top:8px">${convs.map((c, i) => `<a class="btn btn-verde" href="conversas.html?conversa=${c.id}">💬 ${i ? 'Outra conversa' : 'Abrir conversa e responder'}</a>`).join('')}</div>`;
    } else {
      const d = String(l.telefone || '').replace(/\D/g, '');
      if (d.length >= 8) {
        const { data: soltas } = await sb.from('whatsapp_conversas').select('id, telefone, nome_contato').is('lead_id', null).like('telefone', '%' + d.slice(-8)).limit(3);
        if (fichaId !== leadId) return;
        if (soltas && soltas.length) html = `<h3>💬 WhatsApp</h3><div class="muted">Há conversa no WhatsApp com esse telefone ainda sem lead.</div>
          <div class="acoes" style="margin-top:8px">${soltas.map(c => `<button class="btn btn-verde" onclick="ligarConversaAoLead(${c.id}, ${leadId})">🔗 Ligar conversa${c.nome_contato ? ' de ' + esc(c.nome_contato) : ''}</button>`).join('')}</div>`;
      }
    }
    if (!html) return;
    const bloco = document.createElement('div'); bloco.className = 'bloco-whatsapp'; bloco.innerHTML = html;
    const antigo = ficha.querySelector('.bloco-whatsapp'); if (antigo) antigo.remove();
    const acoes = ficha.querySelector('.acoes');
    if (acoes && acoes.parentNode) acoes.parentNode.insertBefore(bloco, acoes.nextSibling); else ficha.appendChild(bloco);
  }

  window.ligarConversaAoLead = async function (conversaId, leadId) {
    const { error } = await sb.from('whatsapp_conversas').update({ lead_id: leadId }).eq('id', conversaId);
    if (error) { alert('⚠ ' + error.message); return; }
    montar(leadId);
  };

  const _abrir = abrirFicha;
  abrirFicha = async function (id) {
    const r = await _abrir.apply(this, arguments);
    if (pode()) montar(id).catch(e => console.warn('WhatsApp na ficha:', e));
    return r;
  };
})();
