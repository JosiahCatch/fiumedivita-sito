/* Fiume di Vita — pannello articoli */
(() => {
  const API = (window.FDV_CONFIG?.ADMIN_API || '').replace(/\/+$/, '');
  const SITO = window.FDV_CONFIG?.SITO || '../';
  const vista = document.getElementById('vista');
  const toastEl = document.querySelector('.adm-toast');
  const dlg = document.getElementById('dlg');
  const barUser = document.querySelector('.adm-bar__user');
  let io = null, categorie = [], editor = null;
  const anteprimeLocali = new Map();   // immagini appena caricate: percorso -> dataURL (non ancora online)

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const slugify = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  const oggi = () => new Date().toISOString().slice(0, 10);
  const dataIt = (d) => d ? new Date(d + 'T12:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const token = { get: () => sessionStorage.getItem('fdv-token'), set: (t) => sessionStorage.setItem('fdv-token', t), del: () => sessionStorage.removeItem('fdv-token') };

  function toast(msg, tipo = 'ok') {
    toastEl.textContent = msg; toastEl.dataset.tipo = tipo; toastEl.classList.add('is-on');
    clearTimeout(toast.t); toast.t = setTimeout(() => toastEl.classList.remove('is-on'), tipo === 'errore' ? 7000 : 4000);
  }

  async function api(path, opt = {}) {
    if (!API || API.includes('DA_IMPOSTARE')) throw new Error('Il pannello non è ancora collegato al servizio (config.js).');
    const r = await fetch(API + path, {
      method: opt.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(token.get() ? { Authorization: 'Bearer ' + token.get() } : {}) },
      body: opt.body ? JSON.stringify(opt.body) : undefined,
    }).catch(() => { throw new Error('Connessione non riuscita. Controlla internet e riprova.'); });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401 && !opt.login) { token.del(); io = null; mostraLogin(data.errore); throw new Error(data.errore || 'Accedi di nuovo.'); }
    if (!r.ok) throw new Error(data.errore || `Errore ${r.status}`);
    return data;
  }

  /** Esegue un'azione con il pulsante in stato "attendere". */
  async function conAttesa(btn, testo, fn) {
    const prima = btn?.innerHTML;
    if (btn) { btn.disabled = true; btn.innerHTML = esc(testo); }
    try { return await fn(); }
    catch (e) { toast(e.message, 'errore'); }
    finally { if (btn) { btn.disabled = false; btn.innerHTML = prima; } }
  }

  /* ---------------- immagini: ridimensionate nel browser prima dell'invio ---------------- */
  async function preparaImmagine(file, maxLato = 1600) {
    if (!file.type.startsWith('image/')) throw new Error('Scegli un file immagine (JPG, PNG, WebP).');
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, maxLato / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL('image/webp', 0.82);
  }
  async function caricaImmagine(file, articolo) {
    const dataUrl = await preparaImmagine(file);
    const { path } = await api('/api/immagini', { method: 'POST', body: { base64: dataUrl, nome: file.name.replace(/\.\w+$/, ''), articolo } });
    anteprimeLocali.set(path, dataUrl);
    return path;
  }
  const srcAnteprima = (path) => anteprimeLocali.get(path) || (path ? '../' + path : '');

  /* ---------------- dialog ---------------- */
  function chiedi({ titolo, testo = '', campi = [], ok = 'Conferma', pericolo = false, soloOk = false }) {
    return new Promise((resolve) => {
      const f = dlg.querySelector('form');
      f.innerHTML = `<h2>${esc(titolo)}</h2>${testo ? `<p>${esc(testo)}</p>` : ''}
        ${campi.map((c) => `<label class="adm-field"><span>${esc(c.label)}</span><input name="${c.name}" type="${c.type || 'text'}" ${c.auto ? `autocomplete="${c.auto}"` : ''} value="${esc(c.value || '')}" ${c.required !== false ? 'required' : ''} ${c.minlength ? `minlength="${c.minlength}"` : ''}></label>`).join('')}
        <div class="adm-actions">${soloOk ? '' : '<button class="btn btn--outline" value="annulla" formnovalidate>Annulla</button>'}<button class="btn ${pericolo ? 'btn--danger' : ''}" value="ok">${esc(ok)}</button></div>`;
      dlg.onclose = () => resolve(dlg.returnValue === 'ok' ? Object.fromEntries(new FormData(f)) : null);
      dlg.returnValue = ''; dlg.showModal();
      (f.querySelector('input') || f.querySelector('button[value=ok]')).focus();
    });
  }

  /* ---------------- accesso ---------------- */
  function mostraLogin(msg) {
    barUser.hidden = true;
    vista.innerHTML = `<section class="adm-card adm-auth">
      <h1>Accedi</h1><p class="adm-muted">Area riservata agli autori degli articoli.</p>
      ${msg ? `<p class="adm-alert">${esc(msg)}</p>` : ''}
      <form id="f-login" novalidate>
        <label class="adm-field"><span>Nome utente</span><input name="username" autocomplete="username" required autocapitalize="none"></label>
        <label class="adm-field"><span>Password</span><input name="password" type="password" autocomplete="current-password" required></label>
        <p class="adm-errore" aria-live="assertive"></p>
        <button class="btn btn--sun adm-wide">Accedi</button>
      </form></section>`;
    const f = document.getElementById('f-login');
    f.username.focus();
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const err = f.querySelector('.adm-errore');
      if (!f.username.value || !f.password.value) { err.textContent = 'Inserisci nome utente e password.'; return; }
      conAttesa(f.querySelector('button'), 'Accesso…', async () => {
        try {
          const r = await api('/api/login', { method: 'POST', body: { username: f.username.value, password: f.password.value }, login: true });
          token.set(r.token); io = r.utente; await avvia();
        } catch (ex) { err.textContent = ex.message; f.password.select(); }
      });
    });
  }

  function mostraSetup() {
    barUser.hidden = true;
    vista.innerHTML = `<section class="adm-card adm-auth">
      <h1>Configura il pannello</h1>
      <p class="adm-muted">Primo avvio: crea il <strong>responsabile del sito</strong>. Potrà creare gli utenti per gli altri autori.</p>
      <form id="f-setup">
        <label class="adm-field"><span>Codice di configurazione</span><input name="codice" required autocomplete="off"></label>
        <label class="adm-field"><span>Il tuo nome</span><input name="nome" required autocomplete="name"></label>
        <label class="adm-field"><span>Nome utente</span><input name="username" required autocomplete="username" autocapitalize="none"></label>
        <label class="adm-field"><span>Password (almeno 8 caratteri)</span><input name="password" type="password" minlength="8" required autocomplete="new-password"></label>
        <label class="adm-field"><span>Ripeti la password</span><input name="password2" type="password" minlength="8" required autocomplete="new-password"></label>
        <p class="adm-errore" aria-live="assertive"></p>
        <button class="btn btn--sun adm-wide">Crea e accedi</button>
      </form></section>`;
    const f = document.getElementById('f-setup');
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      if (f.password.value !== f.password2.value) { f.querySelector('.adm-errore').textContent = 'Le due password non coincidono.'; return; }
      conAttesa(f.querySelector('button'), 'Configurazione…', async () => {
        try {
          const r = await api('/api/setup', { method: 'POST', body: Object.fromEntries(new FormData(f)), login: true });
          token.set(r.token); io = r.utente; toast('Pannello configurato. Benvenuto!'); await avvia();
        } catch (ex) { f.querySelector('.adm-errore').textContent = ex.message; }
      });
    });
  }

  /* ---------------- struttura ---------------- */
  function cornice(attiva, contenuto) {
    barUser.hidden = false;
    barUser.querySelector('[data-io-nome]').textContent = `${io.nome} · ${io.ruolo === 'superadmin' ? 'responsabile' : 'autore'}`;
    const tabs = [['articoli', 'Articoli'], ['categorie', 'Categorie'], ...(io.ruolo === 'superadmin' ? [['utenti', 'Utenti']] : [])];
    vista.innerHTML = `<nav class="adm-tabs" aria-label="Sezioni del pannello">${tabs.map(([k, t]) => `<a href="#${k}" ${k === attiva ? 'aria-current="page"' : ''}>${t}</a>`).join('')}</nav><div class="adm-view">${contenuto}</div>`;
  }

  const nomeCat = (c, s) => { const C = categorie.find((x) => x.slug === c); const S = C?.sotto.find((x) => x.slug === s); return C ? `${C.nome} › ${S ? S.nome : '?'}` : '—'; };

  async function vistaArticoli() {
    cornice('articoli', `<div class="adm-head"><h1>Articoli</h1><a class="btn btn--sun" href="#nuovo">+ Nuovo articolo</a></div><div class="adm-card"><p class="adm-muted">Caricamento…</p></div>`);
    const lista = await api('/api/articoli');
    const box = vista.querySelector('.adm-card');
    if (!lista.length) { box.innerHTML = `<div class="adm-empty"><h2>Ancora nessun articolo</h2><p class="adm-muted">Scrivi il primo: puoi salvarlo come bozza e pubblicarlo quando è pronto.</p><a class="btn btn--sun" href="#nuovo">Scrivi il primo articolo</a></div>`; return; }
    box.innerHTML = `<label class="adm-field adm-search"><span class="visually-hidden">Cerca</span><input type="search" placeholder="Cerca per titolo…" data-cerca></label>
      <ul class="adm-list">${lista.map((a) => `<li data-t="${esc(a.titolo.toLowerCase())}">
        <div><a class="adm-list__title" href="#modifica/${a.slug}">${esc(a.titolo)}</a>
          <span class="adm-muted">${esc(nomeCat(a.categoria, a.sottocategoria))} · ${esc(dataIt(a.data))}${a.autore ? ' · ' + esc(a.autore) : ''}</span></div>
        <span class="adm-badge" data-stato="${a.stato}">${a.stato === 'pubblicato' ? 'Pubblicato' : 'Bozza'}</span>
        <div class="adm-row-actions">
          ${a.stato === 'pubblicato' ? `<a class="adm-link" href="${SITO}articolo-${a.slug}.html" target="_blank" rel="noopener">Vedi</a>` : ''}
          <a class="adm-link" href="#modifica/${a.slug}">Modifica</a>
          <button class="adm-link adm-link--danger" type="button" data-elimina="${a.slug}" data-titolo="${esc(a.titolo)}">Elimina</button></div></li>`).join('')}</ul>`;
    box.querySelector('[data-cerca]').addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      box.querySelectorAll('.adm-list li').forEach((li) => { li.hidden = q && !li.dataset.t.includes(q); });
    });
    box.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-elimina]'); if (!b) return;
      const ok = await chiedi({ titolo: 'Eliminare l\'articolo?', testo: `"${b.dataset.titolo}" verrà tolto dal sito. Non si può annullare.`, ok: 'Elimina', pericolo: true });
      if (!ok) return;
      await conAttesa(b, 'Elimino…', async () => { await api('/api/articoli/' + b.dataset.elimina, { method: 'DELETE' }); toast('Articolo eliminato. Sparirà dal sito tra circa 2 minuti.'); vistaArticoli(); });
    });
  }

  async function vistaEditor(slug) {
    const nuovo = !slug;
    cornice('articoli', `<div class="adm-head"><a class="adm-link" href="#articoli">← Tutti gli articoli</a></div><div class="adm-card"><p class="adm-muted">Caricamento…</p></div>`);
    const a = nuovo ? { titolo: '', sottotitolo: '', autore: io.nome, data: oggi(), categoria: '', sottocategoria: '', immagine: '', immagine_alt: '', stato: 'bozza', testo: '' } : await api('/api/articoli/' + slug);
    const opzCat = categorie.map((c) => `<option value="${c.slug}" ${c.slug === a.categoria ? 'selected' : ''}>${esc(c.nome)}</option>`).join('');
    vista.querySelector('.adm-card').outerHTML = `<form class="adm-editor" id="f-art" novalidate>
      <h1>${nuovo ? 'Nuovo articolo' : 'Modifica articolo'}</h1>
      <div class="adm-grid">
        <div class="adm-col-main adm-card">
          <label class="adm-field"><span>Titolo *</span><input name="titolo" required maxlength="160" value="${esc(a.titolo)}" class="adm-input-big"></label>
          <label class="adm-field"><span>Sottotitolo <small>(una frase che invoglia a leggere)</small></span><input name="sottotitolo" maxlength="280" value="${esc(a.sottotitolo)}"></label>
          <div class="adm-field"><span>Testo *</span><textarea name="testo" id="testo">${esc(a.testo)}</textarea>
            <small class="adm-muted">Usa i pulsanti per titoletti, grassetto, citazioni ed elenchi. Il pulsante con la montagna inserisce un'immagine.</small></div>
        </div>
        <aside class="adm-col-side">
          <div class="adm-card">
            <h2 class="adm-h3">Pubblicazione</h2>
            <fieldset class="adm-stato"><legend class="visually-hidden">Stato</legend>
              <label><input type="radio" name="stato" value="bozza" ${a.stato !== 'pubblicato' ? 'checked' : ''}> Bozza <small>(non visibile sul sito)</small></label>
              <label><input type="radio" name="stato" value="pubblicato" ${a.stato === 'pubblicato' ? 'checked' : ''}> Pubblicato</label></fieldset>
            <label class="adm-field"><span>Data</span><input type="date" name="data" value="${esc(a.data)}"></label>
            <label class="adm-field"><span>Autore</span><input name="autore" maxlength="80" value="${esc(a.autore)}"></label>
            <p class="adm-errore" aria-live="assertive"></p>
            <button class="btn btn--sun adm-wide" data-salva>Salva</button>
          </div>
          <div class="adm-card">
            <h2 class="adm-h3">Categoria</h2>
            <label class="adm-field"><span>Categoria *</span><select name="categoria" required><option value="">Scegli…</option>${opzCat}</select></label>
            <label class="adm-field"><span>Sottocategoria *</span><select name="sottocategoria" required></select></label>
          </div>
          <div class="adm-card">
            <h2 class="adm-h3">Immagine di copertina</h2>
            <div class="adm-cover">${a.immagine ? `<img src="${esc(srcAnteprima(a.immagine))}" alt="">` : '<span class="adm-muted">Nessuna immagine</span>'}</div>
            <input type="hidden" name="immagine" value="${esc(a.immagine)}">
            <label class="btn btn--outline adm-wide adm-file">Scegli immagine<input type="file" accept="image/*" data-cover hidden></label>
            ${a.immagine ? '<button type="button" class="adm-link adm-link--danger" data-togli-cover>Togli immagine</button>' : ''}
            <label class="adm-field"><span>Descrizione dell'immagine <small>(per chi non vede)</small></span><input name="immagine_alt" maxlength="200" value="${esc(a.immagine_alt)}"></label>
          </div>
        </aside>
      </div></form>`;

    const f = document.getElementById('f-art');
    const selSotto = f.sottocategoria;
    const riempiSotto = () => {
      const c = categorie.find((x) => x.slug === f.categoria.value);
      selSotto.innerHTML = c ? `<option value="">Scegli…</option>${c.sotto.map((s) => `<option value="${s.slug}" ${s.slug === a.sottocategoria ? 'selected' : ''}>${esc(s.nome)}</option>`).join('')}` : '<option value="">Prima scegli la categoria</option>';
      selSotto.disabled = !c;
    };
    riempiSotto(); f.categoria.addEventListener('change', riempiSotto);
    const cartella = () => slugify(f.titolo.value) || 'bozza';

    // editor di testo
    editor = new EasyMDE({
      element: f.testo, spellChecker: false, status: ['words'], minHeight: '360px', forceSync: true,
      placeholder: 'Scrivi qui il tuo articolo…',
      toolbar: ['heading-2', 'heading-3', '|', 'bold', 'italic', 'quote', '|', 'unordered-list', 'ordered-list', '|', 'link',
        { name: 'immagine', action: () => scegliImmagineTesto(), className: 'fa fa-image', title: 'Inserisci immagine' }, '|', 'preview', 'side-by-side', 'fullscreen', '|', 'guide'],
      previewRender: (testo) => editor.markdown(testo.replace(/</g, '&lt;')).replace(/src="(assets\/articoli\/[^"]+)"/g, (_, p) => `src="${srcAnteprima(p)}"`),
    });
    function scegliImmagineTesto() {
      const inp = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/*' });
      inp.onchange = async () => {
        const file = inp.files[0]; if (!file) return;
        toast('Carico l\'immagine…');
        try {
          const path = await caricaImmagine(file, cartella());
          const cm = editor.codemirror; cm.replaceSelection(`\n![${file.name.replace(/\.\w+$/, '')}](${path})\n`); cm.focus();
          toast('Immagine inserita.');
        } catch (e) { toast(e.message, 'errore'); }
      };
      inp.click();
    }

    // copertina
    f.querySelector('[data-cover]').addEventListener('change', async (e) => {
      const file = e.target.files[0]; if (!file) return;
      const box = f.querySelector('.adm-cover'); box.innerHTML = '<span class="adm-muted">Carico…</span>';
      try { const path = await caricaImmagine(file, cartella()); f.immagine.value = path; box.innerHTML = `<img src="${esc(srcAnteprima(path))}" alt="">`; toast('Copertina caricata.'); }
      catch (ex) { box.innerHTML = '<span class="adm-muted">Nessuna immagine</span>'; toast(ex.message, 'errore'); }
    });
    f.querySelector('[data-togli-cover]')?.addEventListener('click', () => { f.immagine.value = ''; f.querySelector('.adm-cover').innerHTML = '<span class="adm-muted">Nessuna immagine</span>'; });

    // avviso se si esce senza salvare
    let modificato = false;
    f.addEventListener('input', () => { modificato = true; });
    editor.codemirror.on('change', () => { modificato = true; });
    window.onbeforeunload = () => (modificato ? true : undefined);

    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const err = f.querySelector('.adm-errore'); err.textContent = '';
      const dati = Object.fromEntries(new FormData(f)); dati.testo = editor.value();
      if (!dati.titolo.trim()) { err.textContent = 'Manca il titolo.'; f.titolo.focus(); return; }
      if (!dati.categoria || !dati.sottocategoria) { err.textContent = 'Scegli categoria e sottocategoria.'; f.categoria.focus(); return; }
      if (dati.testo.trim().length < 20) { err.textContent = 'Il testo è troppo corto.'; editor.codemirror.focus(); return; }
      conAttesa(f.querySelector('[data-salva]'), 'Salvo…', async () => {
        const nuovoSlug = slugify(dati.titolo);
        const r = await api('/api/articoli/' + (nuovo ? nuovoSlug : slug), { method: 'PUT', body: { ...dati, slug: nuovoSlug, nuovo } });
        modificato = false; window.onbeforeunload = null;
        toast(r.stato === 'pubblicato' ? 'Pubblicato! Sarà online sul sito tra circa 2 minuti.' : 'Bozza salvata.');
        location.hash = '#modifica/' + r.slug;
      });
    });
  }

  async function vistaCategorie() {
    cornice('categorie', `<div class="adm-head"><h1>Categorie</h1></div><div class="adm-card"><p class="adm-muted">Caricamento…</p></div>`);
    categorie = await api('/api/categorie');
    let dati = JSON.parse(JSON.stringify(categorie));
    const box = vista.querySelector('.adm-card');
    const disegna = () => {
      box.innerHTML = `<p class="adm-muted">Ogni articolo appartiene a una categoria e a una sua sottocategoria. Puoi rinominarle, riordinarle o aggiungerne di nuove.</p>
        <ol class="adm-cats">${dati.map((c, i) => `<li class="adm-cat" data-i="${i}">
          <div class="adm-cat__head">
            <label class="adm-field"><span>Categoria</span><input data-k="nome" value="${esc(c.nome)}" maxlength="60"></label>
            <div class="adm-row-actions">
              <button type="button" class="adm-link" data-su ${i === 0 ? 'disabled' : ''} aria-label="Sposta su">↑</button>
              <button type="button" class="adm-link" data-giu ${i === dati.length - 1 ? 'disabled' : ''} aria-label="Sposta giù">↓</button>
              <button type="button" class="adm-link adm-link--danger" data-del-cat>Elimina</button></div></div>
          <label class="adm-field"><span>Descrizione</span><input data-k="descrizione" value="${esc(c.descrizione || '')}" maxlength="240"></label>
          <div class="adm-subs">${c.sotto.map((s, j) => `<span class="adm-sub"><input data-sub="${j}" value="${esc(s.nome)}" maxlength="60" aria-label="Sottocategoria ${j + 1} di ${esc(c.nome)}"><button type="button" data-del-sub="${j}" aria-label="Elimina ${esc(s.nome)}">×</button></span>`).join('')}
            <button type="button" class="adm-link" data-add-sub>+ Sottocategoria</button></div></li>`).join('')}</ol>
        <div class="adm-actions"><button type="button" class="btn btn--outline" data-add-cat>+ Nuova categoria</button><button type="button" class="btn btn--sun" data-salva-cat>Salva le categorie</button></div>`;
    };
    disegna();
    box.addEventListener('input', (e) => {
      const li = e.target.closest('.adm-cat'); if (!li) return; const c = dati[li.dataset.i];
      if (e.target.dataset.k) c[e.target.dataset.k] = e.target.value;
      if (e.target.dataset.sub !== undefined) c.sotto[e.target.dataset.sub].nome = e.target.value;
    });
    box.addEventListener('click', async (e) => {
      const t = e.target; const li = t.closest('.adm-cat'); const i = li ? +li.dataset.i : -1;
      if (t.matches('[data-su]')) { [dati[i - 1], dati[i]] = [dati[i], dati[i - 1]]; disegna(); }
      else if (t.matches('[data-giu]')) { [dati[i + 1], dati[i]] = [dati[i], dati[i + 1]]; disegna(); }
      else if (t.matches('[data-del-cat]')) { dati.splice(i, 1); disegna(); }
      else if (t.matches('[data-add-sub]')) { dati[i].sotto.push({ nome: '' }); disegna(); box.querySelector(`.adm-cat[data-i="${i}"] .adm-sub:last-of-type input`)?.focus(); }
      else if (t.matches('[data-del-sub]')) { dati[i].sotto.splice(+t.dataset.delSub, 1); disegna(); }
      else if (t.matches('[data-add-cat]')) { dati.push({ nome: '', descrizione: '', sotto: [{ nome: '' }] }); disegna(); box.querySelector('.adm-cat:last-child input')?.focus(); }
      else if (t.matches('[data-salva-cat]')) {
        dati.forEach((c) => { c.sotto = c.sotto.filter((s) => s.nome.trim()); });
        await conAttesa(t, 'Salvo…', async () => { categorie = await api('/api/categorie', { method: 'PUT', body: dati }); dati = JSON.parse(JSON.stringify(categorie)); disegna(); toast('Categorie salvate. Saranno sul sito tra circa 2 minuti.'); });
      }
    });
  }

  async function vistaUtenti() {
    if (io.ruolo !== 'superadmin') { location.hash = '#articoli'; return; }
    cornice('utenti', `<div class="adm-head"><h1>Utenti</h1><button class="btn btn--sun" type="button" data-nuovo-utente>+ Nuovo utente</button></div><div class="adm-card"><p class="adm-muted">Caricamento…</p></div>`);
    const box = vista.querySelector('.adm-card');
    const disegna = async () => {
      const lista = await api('/api/utenti');
      box.innerHTML = `<p class="adm-muted">Crea un nome utente e una password per ogni persona che scriverà articoli, poi comunicaglieli di persona. Ognuno potrà cambiare la propria password.</p>
      <ul class="adm-list">${lista.map((u) => `<li>
        <div><strong>${esc(u.nome)}</strong> <span class="adm-muted">@${esc(u.username)}</span><br><span class="adm-muted">${u.ruolo === 'superadmin' ? 'Responsabile del sito (gestisce gli utenti)' : 'Autore'}</span></div>
        <span class="adm-badge" data-stato="${u.attivo ? 'pubblicato' : 'bozza'}">${u.attivo ? 'Attivo' : 'Disattivato'}</span>
        <div class="adm-row-actions">${u.username === io.username ? '<span class="adm-muted">(sei tu)</span>' : `
          <button class="adm-link" type="button" data-reset="${esc(u.username)}">Nuova password</button>
          <button class="adm-link" type="button" data-attiva="${esc(u.username)}" data-v="${u.attivo ? 0 : 1}">${u.attivo ? 'Disattiva' : 'Riattiva'}</button>
          <button class="adm-link adm-link--danger" type="button" data-del-utente="${esc(u.username)}">Elimina</button>`}</div></li>`).join('')}</ul>`;
    };
    await disegna();
    vista.querySelector('.adm-view').addEventListener('click', async (e) => {
      const t = e.target;
      if (t.matches('[data-nuovo-utente]')) {
        const r = await chiedi({ titolo: 'Nuovo utente', ok: 'Crea utente', campi: [
          { name: 'nome', label: 'Nome e cognome' }, { name: 'username', label: 'Nome utente (es. marco.rossi)', auto: 'off' },
          { name: 'password', label: 'Password (almeno 8 caratteri)', value: generaPassword(), minlength: 8, auto: 'off' }] });
        if (!r) return;
        try { await api('/api/utenti', { method: 'POST', body: { ...r, ruolo: 'admin' } }); await disegna();
          await chiedi({ titolo: 'Utente creato', testo: `Comunica a ${r.nome} queste credenziali: nome utente "${slugify(r.username).replace(/-/g, '.')}" e password "${r.password}". Annotale ora: per sicurezza non verranno più mostrate.`, ok: 'Fatto', soloOk: true });
        } catch (ex) { toast(ex.message, 'errore'); }
      } else if (t.matches('[data-reset]')) {
        const r = await chiedi({ titolo: 'Nuova password', testo: `Imposta una nuova password per @${t.dataset.reset}. Verrà disconnesso dai dispositivi su cui è collegato.`, ok: 'Salva', campi: [{ name: 'password', label: 'Nuova password', value: generaPassword(), minlength: 8, auto: 'off' }] });
        if (!r) return;
        await conAttesa(t, '…', async () => { await api('/api/utenti/' + t.dataset.reset, { method: 'PATCH', body: { password: r.password } }); toast(`Password cambiata. Comunicala a @${t.dataset.reset}: ${r.password}`); });
      } else if (t.matches('[data-attiva]')) {
        await conAttesa(t, '…', async () => { await api('/api/utenti/' + t.dataset.attiva, { method: 'PATCH', body: { attivo: t.dataset.v === '1' } }); await disegna(); });
      } else if (t.matches('[data-del-utente]')) {
        const ok = await chiedi({ titolo: 'Eliminare l\'utente?', testo: `@${t.dataset.delUtente} non potrà più accedere. I suoi articoli restano sul sito.`, ok: 'Elimina', pericolo: true });
        if (ok) await conAttesa(t, '…', async () => { await api('/api/utenti/' + t.dataset.delUtente, { method: 'DELETE' }); await disegna(); toast('Utente eliminato.'); });
      }
    });
  }
  function generaPassword() {
    const parole = ['fiume', 'vita', 'luce', 'pace', 'gioia', 'sale', 'pane', 'roccia', 'stella', 'seme', 'ponte', 'vento'];
    const r = crypto.getRandomValues(new Uint32Array(3));
    return `${parole[r[0] % parole.length]}-${parole[r[1] % parole.length]}-${1000 + (r[2] % 9000)}`;
  }

  /* ---------------- barra in alto ---------------- */
  barUser.addEventListener('click', async (e) => {
    const az = e.target.dataset.azione;
    if (az === 'esci') { token.del(); io = null; location.hash = ''; mostraLogin(); toast('Sei uscito.'); }
    if (az === 'password') {
      const r = await chiedi({ titolo: 'Cambia la tua password', ok: 'Cambia password', campi: [
        { name: 'attuale', label: 'Password attuale', type: 'password', auto: 'current-password' },
        { name: 'nuova', label: 'Nuova password (almeno 8 caratteri)', type: 'password', minlength: 8, auto: 'new-password' }] });
      if (!r) return;
      try { const x = await api('/api/io/password', { method: 'POST', body: r }); token.set(x.token); toast('Password cambiata.'); } catch (ex) { toast(ex.message, 'errore'); }
    }
  });

  /* ---------------- navigazione ---------------- */
  async function instrada() {
    if (!io) return;
    if (editor) { editor.toTextArea(); editor = null; }
    window.onbeforeunload = null;
    const h = location.hash.slice(1);
    try {
      if (h === 'nuovo') await vistaEditor(null);
      else if (h.startsWith('modifica/')) await vistaEditor(h.split('/')[1]);
      else if (h === 'categorie') await vistaCategorie();
      else if (h === 'utenti') await vistaUtenti();
      else await vistaArticoli();
      vista.focus({ preventScroll: true });
    } catch (e) { toast(e.message, 'errore'); }
  }
  window.addEventListener('hashchange', instrada);

  async function avvia() {
    try {
      if (!io) {
        if (!token.get()) {
          const st = await api('/api/stato', { login: true });
          return st.configurato ? mostraLogin() : mostraSetup();
        }
        io = (await api('/api/io')).utente;
      }
      categorie = await api('/api/categorie');
      await instrada();
    } catch (e) { if (!io) vista.innerHTML = `<section class="adm-card adm-auth"><h1>Pannello non disponibile</h1><p class="adm-alert">${esc(e.message)}</p></section>`; }
  }
  avvia();
})();
