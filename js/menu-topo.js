// Eider Sistemas / CRM — barra de menu do topo, igual em todas as telas (carregada pelo js/comum.js).
// Substitui o topo amarelo antigo de cada tela. Ele continua no HTML, escondido, porque o código da tela ainda escreve nele
// (nome, Sair, Trocar senha, Modo simples...): essas ações da tela são copiadas para o menu do usuário (👤 ▾).
// Cada pessoa vê só as telas que pode abrir (as mesmas regras que as telas já usavam; o banco continua conferindo).
// Computador: uma linha (52 px). Até 1024 px (celular/tablet): logo + nome da tela + ☰ (abre a lista).
(function () {
  const antigo = document.querySelector('body > .header');
  if (typeof sb === 'undefined' || !sb || !antigo || document.getElementById('topo')) return;

  const papel = p => p.papel_real || p.papel;   // "obras" aparece como engenharia nas telas da agenda (ver comum.js)
  const interno = p => p.admin || papel(p) === 'interno';
  const obra = p => p.admin || ['interno', 'engenheiro'].includes(papel(p));
  const agenda = p => obra(p) || papel(p) === 'obras';   // Instalações e Clientes: também o papel "obras" (sem valores)
  const PAGINAS = [
    { arq: 'crm.html', ico: '🗂', nome: 'CRM', pode: interno },
    { arq: 'conversas.html', ico: '💬', nome: 'Conversas', pode: interno },
    { arq: './', ico: '📄', nome: 'Precificador', pode: p => p.admin || p.vendedor || !!p.papel, atual: ['', 'index.html'] },
    { arq: 'painel.html', ico: '📊', nome: 'Orçamentos', pode: p => p.admin || p.vendedor },
    { arq: 'clientes.html', ico: '👥', nome: 'Clientes', pode: agenda },
    { arq: 'instalacoes.html', ico: '📅', nome: 'Instalações', pode: agenda },
    { arq: 'estoque.html', ico: '📦', nome: 'Estoque', pode: obra },
    { arq: 'financeiro.html', ico: '💰', nome: 'Financeiro', pode: p => p.admin },
    { arq: 'equipe.html', ico: '👷', nome: 'Equipe', pode: p => p.admin },
    { arq: 'usinas.html', ico: '☀️', nome: 'Usinas', pode: p => p.admin && temUsinas },
  ];
  const aqui = location.pathname.split('/').pop() || '';
  const atualDe = pg => (pg.atual || [pg.arq]).includes(aqui);
  const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let perfil = null, temUsinas = false;

  const st = document.createElement('style');
  st.textContent = `
    body > .header { display:none !important; }
    #topo { background:var(--amarelo,#FFC107); color:#111; display:flex; align-items:center; gap:4px; padding:0 14px; min-height:52px; position:relative; z-index:60; flex-shrink:0; }
    #topo a { color:#111; text-decoration:none; }
    #topo .topo-logo { display:flex; align-items:center; gap:8px; margin-right:10px; font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:20px; white-space:nowrap; }
    #topo .topo-logo i { width:30px; height:30px; border-radius:50%; background:#111; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    #topo .topo-titulo { display:none; font-weight:800; font-size:16px; flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    #topo .topo-links { display:flex; gap:2px; flex:1; min-width:0; overflow-x:auto; scrollbar-width:none; }
    #topo .topo-links::-webkit-scrollbar { display:none; }
    #topo .topo-links a { font-family:'Barlow',sans-serif; font-weight:700; font-size:14px; padding:7px 10px; border-radius:8px; white-space:nowrap; }
    #topo .topo-links a:hover { background:rgba(0,0,0,.1); }
    #topo .topo-links a.atual { background:#111; color:var(--amarelo,#FFC107); }
    #topo .topo-links .qtd { background:#166534; color:#fff; border-radius:10px; font-size:11px; padding:0 6px; margin-left:4px; }
    #topo .topo-user { position:relative; margin-left:6px; }
    #topo .topo-user > button, #topo .topo-ham { background:rgba(0,0,0,.12); border:none; color:#111; font-family:'Barlow',sans-serif; font-weight:700; font-size:13px; padding:6px 11px; border-radius:20px; cursor:pointer; white-space:nowrap; }
    #topo .topo-ham { display:none; font-size:20px; padding:2px 10px; border-radius:8px; }
    #topo .topo-menu { display:none; position:absolute; right:0; top:calc(100% + 6px); background:#1a1a1a; border:1px solid #2e2e2e; border-radius:10px; min-width:220px; padding:6px 0; box-shadow:0 8px 24px rgba(0,0,0,.5); }
    #topo .topo-user.aberto .topo-menu { display:block; }
    #topo .topo-menu a, #topo .topo-menu .info { display:block; padding:9px 14px; color:var(--texto,#e0e0e0); font-size:14px; }
    #topo .topo-menu a:hover { background:#222; }
    #topo .topo-menu .info { color:var(--muted,#8a8a8a); font-size:12px; border-bottom:1px solid #2e2e2e; }
    #topo .topo-acoes-cel { display:none; }
    @media (max-width:1320px) and (min-width:1025px) {
      #topo .topo-logo span { display:none; }
      #topo .topo-links { gap:0; } #topo .topo-links a { font-size:13px; padding:6px 6px; }
    }
    @media (max-width:1024px) {
      #topo { flex-wrap:wrap; min-height:50px; padding:0 10px; row-gap:0; }
      #topo .topo-logo span { display:none; }
      #topo .topo-titulo { display:block; }
      #topo .topo-ham { display:block; order:3; }
      #topo .topo-logo { order:1; } #topo .topo-titulo { order:2; } #topo .topo-links { order:4; } #topo .topo-acoes-cel { order:5; }
      #topo .topo-user { display:none; }
      #topo .topo-links { display:none; }
      #topo.aberto .topo-links { display:flex; flex-direction:column; flex:0 0 calc(100% + 20px); background:#151515; margin:0 -10px; padding:6px 0; }
      #topo.aberto .topo-links a { color:var(--texto,#e0e0e0); border-radius:0; padding:11px 16px; font-size:15px; }
      #topo.aberto .topo-links a.atual { background:transparent; color:var(--amarelo,#FFC107); border-left:3px solid var(--amarelo,#FFC107); }
      #topo.aberto .topo-acoes-cel { display:block; flex:0 0 calc(100% + 20px); background:#151515; margin:0 -10px; padding:4px 0 8px; border-top:1px solid #2e2e2e; }
      #topo .topo-acoes-cel a, #topo .topo-acoes-cel .info { display:inline-block; color:var(--muted,#8a8a8a); padding:8px 16px; font-size:14px; }
      #topo .topo-acoes-cel a { color:var(--texto,#e0e0e0); }
    }`;
  document.head.appendChild(st);

  const nav = document.createElement('nav'); nav.id = 'topo';
  antigo.parentNode.insertBefore(nav, antigo);
  // Precificador: o aviso da tabela de preços ("Preços atualizados em…" / "Sem conexão…") continua visível, no alto da página
  const infoPreco = antigo.querySelector('#info-atualizacao'), pagina = document.querySelector('.page');
  if (infoPreco && pagina) { infoPreco.style.cssText = 'font-size:12px;color:var(--muted,#8a8a8a);text-align:right;margin:-6px 0 8px'; pagina.insertBefore(infoPreco, pagina.firstChild); }

  // ações da própria tela (links com onclick no topo antigo): Sair, Trocar senha, Modo simples, Entrar...
  const origens = () => ['#header-links', '#usuario-bar'].map(s => antigo.querySelector(s)).filter(Boolean);
  function acoes() {
    const out = [];
    origens().forEach(el => el.querySelectorAll('a[onclick]').forEach(a => {
      const t = a.textContent.trim(); if (t && !out.some(o => o.t === t)) out.push({ t, on: a.getAttribute('onclick') });
    }));
    return out;
  }
  const naoLidas = () => { const a = antigo.querySelector('.link-conversas'); const m = a && a.textContent.match(/\((\d+)\)/); return m ? +m[1] : 0; };

  function desenhar() {
    const pg = PAGINAS.find(atualDe);
    const vis = perfil ? PAGINAS.filter(x => { try { return x.pode(perfil); } catch (_) { return false; } }) : [];
    if (pg && !vis.includes(pg)) vis.unshift(pg);   // a tela aberta sempre aparece (a própria tela decide o acesso)
    const inicio = vis.find(x => x.arq === 'crm.html') || vis[0] || { arq: './' };
    const n = naoLidas();
    const lista = acoes().map(a => `<a href="#" onclick="${esc(a.on)}">${esc(a.t)}</a>`).join('');
    const infoEl = antigo.querySelector('#info-atualizacao');
    const info = (perfil ? `<div class="info">👤 ${esc(perfil.nome || perfil.email)}${papel(perfil) || perfil.admin ? ' · ' + esc(papel(perfil) || 'admin') : ''}</div>` : '')
      + (infoEl && infoEl.textContent.trim() ? `<div class="info">${esc(infoEl.textContent.trim())}</div>` : '');
    const primeiro = perfil ? String(perfil.nome || perfil.email || '').trim().split(/[\s@]+/)[0] : '';
    nav.innerHTML = `
      <a class="topo-logo" href="${inicio.arq}" title="Início"><i><svg width="18" height="18" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="13" fill="#FFC107"/><path d="M16 3L8 15h7l-3 10 10-13h-7l1-9z" fill="#111"/></svg></i><span>Energtech</span></a>
      <span class="topo-titulo">${esc(pg ? pg.nome : (document.title || ''))}</span>
      <div class="topo-links">${vis.map(x => `<a href="${x.arq}" class="${atualDe(x) ? 'atual' : ''}">${x.ico} ${esc(x.nome)}${x.arq === 'conversas.html' && n ? `<span class="qtd">${n}</span>` : ''}</a>`).join('')}</div>
      ${lista || info ? `<div class="topo-user"><button type="button" onclick="this.parentNode.classList.toggle('aberto')">👤 ${esc(primeiro || 'Conta')} ▾</button><div class="topo-menu">${info}${lista}</div></div>` : ''}
      <button type="button" class="topo-ham" aria-label="Menu" onclick="document.getElementById('topo').classList.toggle('aberto');this.textContent=document.getElementById('topo').classList.contains('aberto')?'✕':'☰'">☰</button>
      <div class="topo-acoes-cel">${info}${lista}</div>`;
  }

  async function carregar() {
    try {
      const { data } = await sb.auth.getSession();
      if (!data || !data.session) { perfil = null; desenhar(); return; }
      const r = await sb.rpc('meu_perfil');
      perfil = r.data || { email: data.session.user.email };
      if (perfil.admin) { const u = await sb.from('usinas').select('id').limit(1); temUsinas = !u.error && (u.data || []).length > 0; }
    } catch (_) { /* sem conexão: mostra o que der */ }
    desenhar();
  }

  desenhar();
  carregar();
  sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT') carregar(); });
  // a tela reescreve o topo antigo (login, nome, mensagens não lidas): copia de novo
  let pend = null;
  new MutationObserver(() => { clearTimeout(pend); pend = setTimeout(desenhar, 80); }).observe(antigo, { childList: true, subtree: true, characterData: true });
  document.addEventListener('click', e => {
    const u = nav.querySelector('.topo-user.aberto'); if (u && !u.contains(e.target)) u.classList.remove('aberto');
    if (e.target.closest && e.target.closest('#topo .topo-menu a, #topo .topo-acoes-cel a')) { nav.classList.remove('aberto'); const h = nav.querySelector('.topo-ham'); if (h) h.textContent = '☰'; }
  });
})();
