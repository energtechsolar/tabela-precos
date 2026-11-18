// Eider Sistemas / CRM — proposta em PDF direto no WhatsApp do cliente (tela do precificador).
// 1) Depois de "Criar Orçamento": botão "📲 Enviar PDF no WhatsApp" — gera o PDF e manda na conversa do lead, com o resumo como legenda.
// 2) Vindo da tela Conversas (index.html?pdf=Nº&wa=CONVERSA): gera a proposta salva e manda na conversa, sem baixar.
// Usa a mesma função de envio da tela Conversas (whatsapp-enviar): só admin e vendas internas, e só dentro das 24 h
// depois da última mensagem do cliente (regra do WhatsApp). Carregado pelo index.html depois de js/kit.js.
(function () {
  if (typeof montarPropostaPDF !== 'function') return;
  const JANELA_MS = 24 * 3600 * 1000;
  const pode = () => typeof perfil !== 'undefined' && perfil && (perfil.admin || perfil.papel === 'interno');
  const seguro = t => String(t || 'proposta.pdf').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').slice(-80);
  const aviso = (t, erro) => { const a = document.getElementById('aviso-crm'); if (a) { a.textContent = t; a.style.display = 'block'; a.style.borderColor = erro ? '#f87171' : '#4ade80'; } };

  async function conversaDoLead(leadId) {
    const { data } = await sb.from('whatsapp_conversas').select('id, empresa_id, ultima_entrada_em').eq('lead_id', leadId)
      .order('ultima_entrada_em', { ascending: false, nullsFirst: false }).limit(1);
    return data && data[0];
  }
  // sobe o PDF na pasta privada da conversa e manda pelo WhatsApp oficial
  async function enviarPdf(conv, doc, arq, legenda) {
    if (!conv.ultima_entrada_em || Date.now() - new Date(conv.ultima_entrada_em).getTime() > JANELA_MS)
      throw new Error('passaram mais de 24 h desde a última mensagem do cliente; pela regra do WhatsApp só dá para mandar mensagem modelo');
    const caminho = `${conv.empresa_id}/${conv.id}/env-${Date.now()}-${seguro(arq)}`;
    const up = await sb.storage.from('whatsapp').upload(caminho, doc.output('blob'), { contentType: 'application/pdf', upsert: false });
    if (up.error) throw new Error('não foi possível subir o PDF: ' + up.error.message);
    const { data, error } = await sb.functions.invoke('whatsapp-enviar', { body: { conversa_id: conv.id, texto: String(legenda || '').slice(0, 1024), midia_path: caminho, midia_mime: 'application/pdf', nome_arquivo: arq } });
    let r = data;
    if (error) { try { r = await error.context.json(); } catch (_) { r = null; } throw new Error((r && r.erro) || error.message); }
    if (!r || !r.ok) throw new Error((r && r.erro) || 'falha ao enviar');
  }

  // ── 1) botão na proposta aberta ──
  window.enviarPropostaWhatsApp = async function () {
    if (typeof propostaItem === 'undefined' || !propostaItem || !propostaCalc) return;
    const lead = typeof leadSelecionado !== 'undefined' ? leadSelecionado : null;
    if (!lead) { alert('Escolha o lead do CRM nesta proposta para enviar pelo WhatsApp da empresa.'); return; }
    const conv = await conversaDoLead(lead);
    if (!conv) { alert('Este lead ainda não tem conversa no WhatsApp da empresa (o cliente precisa mandar mensagem primeiro).\n\nUse o botão "💬 Enviar pelo WhatsApp" de sempre.'); return; }
    const btn = document.getElementById('btn-wa-oficial'), txt = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Enviando…'; }
    try {
      const d = coletarDadosProposta();
      const fotos = await fotosDaProposta(typeof capaDaProposta !== 'undefined' ? capaDaProposta : null);
      const { doc, arq } = montarPropostaPDF(d, fotos);
      await enviarPdf(conv, doc, arq, mensagemProposta(d));
      aviso('✅ Proposta Nº ' + d.numero + ' enviada no WhatsApp do cliente (PDF + resumo). Acompanhe em 💬 Conversas.');
    } catch (e) { aviso('⚠ Não foi enviada: ' + (e.message || e), true); alert('⚠ Não foi enviada: ' + (e.message || e)); }
    finally { if (btn) { btn.disabled = false; btn.textContent = txt; } }
  };
  function colocarBotao() {
    const ref = document.getElementById('btn-whats');
    if (!ref || document.getElementById('btn-wa-oficial')) return;
    const b = document.createElement('button');
    b.className = 'btn-whats'; b.id = 'btn-wa-oficial'; b.style.cssText = 'display:none;background:#166534';
    b.textContent = '📲 Enviar PDF no WhatsApp (Conversas)'; b.title = 'Gera o PDF e manda na conversa do lead pelo WhatsApp da empresa';
    b.onclick = () => window.enviarPropostaWhatsApp();
    ref.parentNode.insertBefore(b, ref.nextSibling);
  }
  // aparece junto com "Gerar PDF" (depois de "Criar Orçamento"), para admin e vendas internas
  if (typeof criarOrcamento === 'function') {
    const _criar = criarOrcamento;
    criarOrcamento = function () {
      const r = _criar.apply(this, arguments);
      colocarBotao(); const b = document.getElementById('btn-wa-oficial'); if (b) b.style.display = pode() ? 'block' : 'none';
      return r;
    };
  }
  if (typeof abrirProposta === 'function') {
    const _abrir = abrirProposta;
    abrirProposta = function () { const r = _abrir.apply(this, arguments); const b = document.getElementById('btn-wa-oficial'); if (b) b.style.display = 'none'; return r; };
  }

  // ── 2) reimpressão pedida pela tela Conversas: em vez de baixar, manda na conversa ──
  const q = new URLSearchParams(location.search), waConv = +q.get('wa');
  if (waConv && q.get('pdf')) {
    const _montar = montarPropostaPDF;
    let feito = false;
    montarPropostaPDF = function (d) {
      const r = _montar.apply(this, arguments);
      if (feito) return r;
      feito = true;
      const baixar = r.doc.save.bind(r.doc);
      r.doc.save = function () {
        (async () => {
          await Promise.resolve();   // depois do aviso "PDF gerado" da reimpressão
          aviso('⏳ Enviando a proposta Nº ' + d.numero + ' no WhatsApp…');
          try {
            const { data: conv } = await sb.from('whatsapp_conversas').select('id, empresa_id, ultima_entrada_em').eq('id', waConv).maybeSingle();
            if (!conv) throw new Error('conversa não encontrada');
            await enviarPdf(conv, r.doc, r.arq, mensagemProposta(d));
            aviso('✅ Proposta Nº ' + d.numero + ' enviada no WhatsApp do cliente. Pode fechar esta aba.');
          } catch (e) { aviso('⚠ Não foi enviada: ' + (e.message || e) + '. O PDF foi baixado para você enviar à mão.', true); baixar(r.arq); }
        })();
      };
      return r;
    };
  }
})();
