// Energtech — CRM: documentos da ficha (fatura e CNH/RG) com leitura automática, troca e exclusão.
// - Ao enviar a fatura ou a CNH/RG, o sistema já lê os dados (fatura: função "ler-fatura"; CNH/RG: "ler-documento").
// - "🔎 Ler dados" também na fatura já guardada. O resultado aparece para conferir; "Preencher" coloca na ficha e salva,
//   e a Nova proposta (precificador) já abre com os dados e o consumo médio da fatura.
// - "🔄 Trocar": envia o arquivo certo no lugar do errado (o errado é apagado) e lê de novo.
// - "apagar": o admin apaga qualquer documento; quem enviou apaga o que enviou.
// Carregado pelo crm.html depois de js/crm.js: troca algumas funções do crm.js sem mudar o arquivo.
(function () {
  if (typeof enviarDoc !== 'function' || typeof gravarDocs !== 'function') return;
  const LEITURA = ['fatura', 'cnh'];
  const _ordMes = m => { const [mm, aa] = String(m).split('/'); return (+aa < 100 ? 2000 + +aa : +aa) * 12 + +mm; };
  // média de consumo: os 12 meses mais recentes, sem os meses zerados (imóvel sem uso, ligação nova)
  const mediaFat = f => {
    const ult = (f.historico || []).slice().sort((a, b) => _ordMes(b.mes) - _ordMes(a.mes)).slice(0, 12);
    const com = ult.filter(x => +x.kwh > 0), zerados = ult.length - com.length;
    if (com.length) return { media: Math.round(com.reduce((s, x) => s + +x.kwh, 0) / com.length), meses: com.length, zerados };
    if (+f.consumo_mes_kwh > 0) return { media: Math.round(f.consumo_mes_kwh), meses: 1, zerados };
    return { media: null, meses: 0, zerados };
  };
  const docDe = (id, docId) => ((leads.find(x => x.id === id) || {}).documentos || []).find(d => d.id === docId);
  const podeApagar = d => !!perfil && (perfil.admin || (d && d.autor && d.autor === perfil.email));
  const msgDoc = (t, erro) => { const m = $('doc-msg'); if (!m) return; m.classList.toggle('erro', !!erro); m.innerHTML = t || ''; };

  // links ao lado de cada documento: ler / trocar / apagar
  linkLerDoc = function (l, d) {
    if (!d || !d.path) return '';
    const ler = LEITURA.includes(d.tipo) ? ` · <a href="#" onclick="lerDocLead(${l.id}, '${esc(d.id)}');return false">🔎 Ler dados</a>` : '';
    const trocar = ` · <label style="color:var(--azul);cursor:pointer;text-decoration:underline">🔄 trocar<input type="file" accept="image/*,application/pdf" style="display:none" onchange="trocarDoc(${l.id}, '${esc(d.id)}', this)"></label>`;
    const apagar = podeApagar(d) && !(perfil && perfil.admin) ? ` · <a href="#" style="color:var(--vermelho)" onclick="apagarDoc(${l.id}, '${esc(d.id)}');return false">apagar</a>` : '';
    return ler + trocar + apagar;   // o admin já tem o "apagar" do crm.js
  };

  // apagar: tira da ficha só se o arquivo saiu de verdade da pasta (ou se já não existia)
  apagarDoc = async function (id, docId, semPerguntar) {
    const l = leads.find(x => x.id === id), d = docDe(id, docId); if (!l || !d) return false;
    if (!semPerguntar && !confirm('Apagar "' + (d.nome || d.tipo) + '"?')) return false;
    if (d.path) {
      const r = await sb.storage.from('documentos').remove([d.path]);
      if (r.error || (Array.isArray(r.data) && !r.data.length && !(perfil && perfil.admin))) {
        msgDoc('⚠ Não foi possível apagar o arquivo' + (r.error ? ' (' + esc(r.error.message) + ')' : ': só o admin ou quem enviou pode apagar') + '.', true); return false;
      }
    }
    try { await gravarDocs(id, (l.documentos || []).filter(x => x.id !== docId)); if (!semPerguntar) abrirFicha(id, true); return true; }
    catch (e) { msgDoc('⚠ ' + esc(e.message || e), true); return false; }
  };

  // fotos do iPhone (HEIC) viram JPEG antes de subir: assim abrem em qualquer navegador e a leitura funciona
  if (typeof reduzirFoto === 'function' && typeof paraJpeg === 'function') {
    const _reduzir = reduzirFoto;
    reduzirFoto = async function (arq) {
      if (typeof ehHeic === 'function' && ehHeic(arq)) msgDoc('⏳ Convertendo a foto do iPhone…');
      return _reduzir(await paraJpeg(arq));
    };
  }
  // documento já guardado em HEIC (enviado antes desta correção): converte, troca o arquivo na pasta e segue
  async function converterHeicGuardado(id, d) {
    if (!d || !d.path || !/\.(heic|heif)$/i.test(d.path) || typeof paraJpeg !== 'function') return d;
    msgDoc('⏳ Convertendo a foto do iPhone (HEIC) para JPG…');
    const dl = await sb.storage.from('documentos').download(d.path);
    if (dl.error || !dl.data) throw new Error('não consegui abrir o arquivo' + (dl.error ? ' (' + dl.error.message + ')' : ''));
    const jpg = await reduzirFoto(new File([dl.data], d.nome || 'foto.heic', { type: 'image/heic' }));
    const path = d.path.replace(/\.(heic|heif)$/i, '') + '.jpg';
    const up = await sb.storage.from('documentos').upload(path, jpg, { contentType: 'image/jpeg', upsert: false });
    if (up.error) throw up.error;
    const l = leads.find(x => x.id === id);
    const novo = { ...d, path, nome: String(d.nome || 'foto').replace(/\.(heic|heif)$/i, '') + '.jpg' };
    await gravarDocs(id, (l.documentos || []).map(x => x.id === d.id ? novo : x));
    const r = await sb.storage.from('documentos').remove([d.path]);   // se não puder apagar o antigo, só fica sobrando na pasta
    if (r.error) console.warn('HEIC antigo não apagado:', r.error.message);
    return novo;
  }

  // enviar: guarda e já lê (fatura e CNH/RG)
  const _enviar = enviarDoc;
  enviarDoc = async function (id, tipo, input) {
    const antes = new Set(((leads.find(x => x.id === id) || {}).documentos || []).map(d => d.id));
    await _enviar(id, tipo, input);
    if (!LEITURA.includes(tipo)) return;
    const novo = ((leads.find(x => x.id === id) || {}).documentos || []).find(d => !antes.has(d.id) && d.tipo === tipo);
    if (novo) lerDocLead(id, novo.id);
  };

  // trocar: sobe o novo, apaga o errado e lê de novo
  window.trocarDoc = async function (id, docId, input) {
    const velho = docDe(id, docId); if (!velho) return;
    const arq = input.files && input.files[0]; if (!arq) return;
    const antes = new Set(((leads.find(x => x.id === id) || {}).documentos || []).map(d => d.id));
    await _enviar(id, velho.tipo, input);
    const novo = ((leads.find(x => x.id === id) || {}).documentos || []).find(d => !antes.has(d.id));
    if (!novo) return;   // o envio falhou: o antigo continua
    const ok = await apagarDoc(id, docId, true);
    abrirFicha(id, true);
    if (!ok) msgDoc('⚠ O arquivo novo foi enviado, mas o antigo não pôde ser apagado (só o admin ou quem enviou). Peça ao admin para apagar o antigo.', true);
    if (LEITURA.includes(novo.tipo)) setTimeout(() => lerDocLead(id, novo.id), 50);
  };

  window.lerDocLead = async function (id, docId) {
    let d = docDe(id, docId); if (!d) return;
    try { d = await converterHeicGuardado(id, d); }
    catch (e) { msgDoc('⚠ Não foi possível converter a foto HEIC: ' + esc(e.message || e) + '. Use "🔄 trocar" e envie a foto em JPG.', true); return; }
    if (d.tipo === 'cnh') return lerDocumento(id, d.path);
    return lerFaturaDoc(id, d);
  };

  // ── fatura guardada: baixa da pasta privada e lê no servidor ──
  const b64 = blob => new Promise((ok, erro) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(',')[1]); fr.onerror = () => erro(new Error('não foi possível ler o arquivo')); fr.readAsDataURL(blob); });
  let _fatLida = null;
  async function lerFaturaDoc(id, d) {
    msgDoc('⏳ Lendo a fatura… (leva alguns segundos)');
    try {
      const dl = await sb.storage.from('documentos').download(d.path);
      if (dl.error || !dl.data) throw new Error('não consegui abrir o arquivo' + (dl.error ? ' (' + dl.error.message + ')' : ''));
      const ehPdf = /\.pdf$/i.test(d.path) || dl.data.type === 'application/pdf';
      if (ehPdf && dl.data.size > 9 * 1024 * 1024) throw new Error('PDF maior que 9 MB: envie uma foto da fatura');
      const { data, error } = await sb.functions.invoke('ler-fatura', { body: { arquivo: await b64(dl.data), tipo: ehPdf ? 'application/pdf' : 'image/jpeg' } });
      let r = data;
      if (error) { try { r = await error.context.json(); } catch (_) { r = null; } if (!r) throw new Error(/fetch|network/i.test(error.message || '') ? 'sem conexão com o servidor' : (error.message || 'falha na leitura')); }
      if (!r || !r.ok) throw new Error((r && r.erro) || 'não foi possível ler a fatura');
      const f = r.dados || {};
      const { media, meses, zerados } = mediaFat(f);
      _fatLida = { id, docId: d.id, f, media, meses, zerados };
      // o resumo da leitura fica guardado no documento: a Nova proposta usa o consumo médio
      const l = leads.find(x => x.id === id);
      const docs = (l.documentos || []).map(x => x.id === d.id ? { ...x, dados: { media_kwh: media, meses: _fatLida.meses, valor_total: f.valor_total ?? null, concessionaria: f.concessionaria || null, classificacao: f.classificacao || null, lida_em: new Date().toISOString() } } : x);
      try { await gravarDocs(id, docs); } catch (e) { console.warn('resumo da fatura não guardado', e); }
      mostrarFaturaLida();
    } catch (e) { msgDoc('⚠ ' + esc(e.message || e) + '. Preencha os dados à mão.', true); }
  }
  const CAMPOS_FAT = f => [
    ['cpf', 'CPF / CNPJ', f.cpf_cnpj && !String(f.cpf_cnpj).includes('*') ? f.cpf_cnpj : null],
    ['end', 'Endereço', f.endereco], ['cep', 'CEP', f.cep],
    ['cidade', 'Município / UF', f.cidade ? f.cidade + (f.uf ? ' / ' + f.uf : '') : null],
    ['uc', 'UC', f.uc], ['conc', 'Concessionária', f.concessionaria], ['titular', 'Titular da UC', f.titular],
  ];
  const norm = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
  function mostrarFaturaLida() {
    const L = _fatLida; if (!L) return;
    const f = L.f, campos = CAMPOS_FAT(f);
    const atual = k => (($('fx-' + k) || {}).value || '').trim();
    const dif = campos.filter(([k, , v]) => v && atual(k) && norm(atual(k)) !== norm(v) && !(k === 'cpf' && atual(k).replace(/\D/g, '') === String(v).replace(/\D/g, '')));
    const avisos = [];
    if (f.cpf_cnpj && String(f.cpf_cnpj).includes('*')) avisos.push('CPF/CNPJ mascarado na fatura: peça o documento ao cliente.');
    if (f.legibilidade && f.legibilidade !== 'boa') avisos.push('Leitura ' + (f.legibilidade === 'parcial' ? 'parcial' : 'ruim') + ': confira os campos.');
    if (f.classificacao && /^\s*A\s*\d/i.test(f.classificacao)) avisos.push('Grupo A (média tensão): precisa de análise de demanda.');
    if (f.tem_geracao_propria) avisos.push('A fatura já mostra geração própria/créditos: o consumo pode estar menor que o real.');
    if (L.zerados) avisos.push(L.zerados + (L.zerados === 1 ? ' mês sem consumo (0 kWh) ficou' : ' meses sem consumo (0 kWh) ficaram') + ' fora da média (imóvel sem uso ou ligação nova).');
    if (L.meses && L.meses < 12) avisos.push('Consumo médio com ' + L.meses + (L.meses === 1 ? ' mês' : ' meses') + ' (o ideal são 12).');
    const val = v => v ? '<b>' + esc(v) + '</b>' : '<span style="color:var(--amarelo)">não lido</span>';
    msgDoc(`<div style="background:var(--bg);border:1px solid var(--borda);border-radius:10px;padding:10px 12px;margin-top:6px;line-height:1.7;color:var(--texto)">
      <div style="font-weight:700;color:var(--amarelo)">🔎 Dados lidos da fatura</div>
      ${campos.map(([, r, v]) => r + ': ' + val(v)).join('<br>')}
      <br>Consumo médio: ${L.media ? '<b>' + L.media.toLocaleString('pt-BR') + ' kWh/mês</b>' : val(null)}${f.valor_total != null ? ' · última fatura ' + fmtR(f.valor_total) : ''}
      ${avisos.length ? '<div style="color:var(--amarelo);margin-top:4px">' + avisos.map(a => '⚠ ' + esc(a)).join('<br>') + '</div>' : ''}
      ${dif.length ? '<div style="color:var(--amarelo);margin-top:4px">Diferente do que está na ficha: ' + dif.map(([, r]) => esc(r)).join(', ') + '</div>' : ''}
      <div class="acoes" style="margin-top:6px"><button class="btn" onclick="usarFaturaLida(false)">✅ Preencher ${dif.length ? 'só os vazios' : 'na ficha'} e salvar</button>${dif.length ? '<button class="btn btn-sec" onclick="usarFaturaLida(true)">Substituir também os diferentes</button>' : ''}<button class="btn btn-sec" onclick="msgDoc0()">Fechar</button></div>
      <div class="muted" style="margin-top:4px">O consumo médio já fica guardado: a Nova proposta abre com ele.</div></div>`);
  }
  window.msgDoc0 = () => { _fatLida = null; msgDoc(''); };
  window.usarFaturaLida = async function (substituir) {
    const L = _fatLida; if (!L) return;
    const l = leads.find(x => x.id === L.id) || {};
    CAMPOS_FAT(L.f).forEach(([k, , v]) => {
      const el = $('fx-' + k); if (!el || !v) return;
      if (k === 'titular' && norm(v) === norm(($('fx-nome') || {}).value || l.nome)) return;   // titular = o próprio cliente
      if (el.value.trim() && !substituir) return;
      if (norm(el.value) !== norm(v)) { el.value = v; el.style.borderColor = 'var(--amarelo)'; }
    });
    const nome = $('fx-nome'); if (nome && !nome.value.trim() && L.f.titular) { nome.value = L.f.titular; nome.style.borderColor = 'var(--amarelo)'; }
    _fatLida = null; msgDoc('');
    await salvarFicha(L.id);
    const m = $('fx-msg'); if (m && !m.classList.contains('erro')) m.textContent = '✅ Dados da fatura salvos na ficha (campos destacados). A Nova proposta já abre com eles.';
    const alvo = $('fx-end') || $('fx-uc'); if (alvo) alvo.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // CNH/RG: "Preencher na ficha" já salva (antes era preciso clicar em Salvar)
  if (typeof usarDocLido === 'function') {
    const _usar = usarDocLido;
    usarDocLido = async function () {
      const id = _docLido && _docLido.id;
      _usar.apply(this, arguments);
      if (!id) return;
      await salvarFicha(id);
      const m = $('fx-msg'); if (m && !m.classList.contains('erro')) m.textContent = '✅ Dados do documento salvos na ficha (campos destacados).';
    };
  }
})();
