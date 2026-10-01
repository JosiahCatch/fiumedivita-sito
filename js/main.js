/* Fiume di Vita — interazioni del sito */
(function () {
  const root = document.documentElement;
  root.classList.remove('no-js');

  /* ---- Palette (anteprima proposte: ?palette=a|b|c|d) ---- */
  const PALETTES = ['a', 'b', 'c', 'd'];
  try { localStorage.removeItem('fdv-palette'); } catch (e) {}   // vecchie scelte salvate: non devono più cambiare il sito
  const setPalette = (p) => {
    if (p === 'a') root.removeAttribute('data-palette');
    else root.setAttribute('data-palette', p);
    document.querySelectorAll('[data-set-palette]').forEach((el) => {
      const on = el.dataset.setPalette === p;
      el.setAttribute('aria-pressed', String(on));
      el.closest('.palette-option')?.classList.toggle('is-active', on);
    });
  };
  const qp = new URLSearchParams(location.search).get('palette');
  setPalette(PALETTES.includes(qp) ? qp : 'a');
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-set-palette]');
    if (b) setPalette(b.dataset.setPalette);
  });
  if (new URLSearchParams(location.search).has('final')) root.classList.add('hide-todo');

  /* ---- Header: solido dopo lo scroll ---- */
  const header = document.querySelector('.site-header');
  const onScroll = () => header && header.classList.toggle('is-solid', window.scrollY > 40);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---- Menu mobile ---- */
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('site-nav');
  if (toggle && nav) {
    const close = () => {
      nav.classList.remove('is-open');
      document.body.classList.remove('nav-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Apri il menu');
    };
    toggle.addEventListener('click', () => {
      const open = !nav.classList.contains('is-open');
      nav.classList.toggle('is-open', open);
      document.body.classList.toggle('nav-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Chiudi il menu' : 'Apri il menu');
      if (open) nav.querySelector('a')?.focus();
    });
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
    document.addEventListener('keydown', (e) => {
      if (!nav.classList.contains('is-open')) return;
      if (e.key === 'Escape') { close(); toggle.focus(); return; }
      if (e.key === 'Tab') {
        const items = [toggle, ...nav.querySelectorAll('a')];
        const i = items.indexOf(document.activeElement);
        const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i === items.length - 1 || i < 0 ? 0 : i + 1);
        e.preventDefault(); items[next].focus();
      }
    });
    window.matchMedia('(min-width: 1021px)').addEventListener('change', (m) => m.matches && close());
  }

  /* ---- Reveal on scroll ---- */
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reveals = document.querySelectorAll('.reveal');
  if (!reduce && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-in'));
  }

  /* ---- YouTube "lite": carica l'iframe solo al click ---- */
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button.yt[data-id]');
    if (!btn) return;
    const iframe = document.createElement('iframe');
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.src = `https://www.youtube-nocookie.com/embed/${btn.dataset.id}?autoplay=1&rel=0`;
    iframe.title = btn.getAttribute('aria-label') || 'Video';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    iframe.allowFullscreen = true;
    // il player prende il posto del pulsante (un iframe dentro un <button> non è valido e confonde i lettori di schermo)
    const player = document.createElement('div');
    player.className = btn.className;
    player.append(iframe);
    btn.replaceWith(player);
    iframe.focus();
  });

  /* ---- Cambio lingua del video nello stesso player ---- */
  document.querySelectorAll('[data-yt-swap]').forEach((b) => b.addEventListener('click', () => {
    const group = b.closest('.video-langs');
    const player = b.closest('section').querySelector('.yt');
    group.querySelectorAll('[data-yt-swap]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    const id = b.dataset.ytSwap;
    const iframe = player.querySelector('iframe');
    if (iframe) { iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`; return; }
    player.dataset.id = id;
    const img = player.querySelector('img');
    if (img) { img.removeAttribute('srcset'); img.src = `https://i.ytimg.com/vi/${id}/sddefault.jpg`; }
  }));

  /* ---- Scroller orizzontali con frecce ---- */
  document.querySelectorAll('[data-scroller]').forEach((wrap) => {
    const track = wrap.querySelector('.scroller');
    wrap.querySelectorAll('[data-dir]').forEach((b) => b.addEventListener('click', () => {
      const card = track.firstElementChild;
      const step = card ? card.getBoundingClientRect().width + 16 : 300;
      track.scrollBy({ left: Number(b.dataset.dir) * step, behavior: reduce ? 'auto' : 'smooth' });
    }));
  });

  /* ---- Playlist predicazioni (tab accessibili, con link diretto #nome-playlist) ---- */
  const tablist = document.querySelector('[role="tablist"]');
  if (tablist) {
    const tabs = [...tablist.querySelectorAll('[role="tab"]')];
    const select = (tab, focus) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) tab.focus();
      tab.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
      history.replaceState(null, '', '#' + tab.dataset.tab);
    };
    tablist.addEventListener('click', (e) => { const t = e.target.closest('[role="tab"]'); if (t) select(t); });
    tablist.addEventListener('keydown', (e) => {
      const i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      let n = null;
      if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
      if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
      if (e.key === 'Home') n = 0;
      if (e.key === 'End') n = tabs.length - 1;
      if (n !== null) { e.preventDefault(); select(tabs[n], true); }
    });
    const fromHash = () => {
      const t = tabs.find((x) => '#' + x.dataset.tab === location.hash);
      if (!t) return;
      select(t);
      tablist.scrollIntoView({ block: 'start', behavior: 'auto' });   // il contenuto della playlist è subito visibile
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
  }

  /* ---- Galleria che scorre: pulsante pausa ---- */
  document.querySelectorAll('[data-marquee-toggle]').forEach((btn) => {
    const wrap = btn.closest('.marquee-wrap');
    const label = btn.querySelector('span');
    const set = (paused) => {
      wrap.classList.toggle('is-paused', paused);
      btn.setAttribute('aria-pressed', String(paused));
      label.textContent = paused ? 'Riprendi' : 'Metti in pausa';
      btn.querySelector('svg').innerHTML = paused ? '<path d="M7 4.5v15l13-7.5z"/>' : '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>';
    };
    if (reduce) set(true);
    btn.addEventListener('click', () => set(!wrap.classList.contains('is-paused')));
  });

  /* ---- Mappa attiva solo al clic (Google viene contattato solo dopo il consenso) ---- */
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-map-load]');
    if (!btn) return;
    const box = btn.closest('[data-map-src]');
    const iframe = document.createElement('iframe');
    iframe.src = box.dataset.mapSrc;
    iframe.title = 'Mappa: Fiume di Vita, Via Casalanno 85';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.allowFullscreen = true;
    box.classList.remove('map--click');
    box.replaceChildren(iframe);
    iframe.focus();
  });

  /* ---- Ricerca condivisa: parole (senza accenti, per radice) e brani biblici con versetti ---- */
  const fdvNorm = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['\u2019]/g, ' ').trim();
  const fdvCreaRicerca = (testo) => {
    const q = fdvNorm(testo);
    if (!q) return null;
    const r = q.match(/^((?:[1-3]\s?)?[a-z]+)\s+(\d{1,3})(?::(\d{1,3}))?$/);   // "filippesi 4:7"
    const contiene = (refCard) => !!r && (refCard || '').split(/;\s*/).some((parte) => {
      const m = parte.match(/((?:[1-3]\s)?[a-z]+)\s+(\d+)(?::(\d+)(?:-(\d+))?)?/);
      if (!m || m[1].replace(/\s/g, '') !== r[1].replace(/\s/g, '') || +m[2] !== +r[2]) return false;
      if (!r[3] || !m[3]) return true;
      return +r[3] >= +m[3] && +r[3] <= +(m[4] || m[3]);
    });
    // radice della parola: "perdono" trova anche perdonare, perdonati
    const parole = q.split(/\s+/).map((w) => (w.length >= 6 ? w.replace(/[aeiou]$/, '') : w));
    // ogni parola deve essere l'inizio di una parola del testo: "giona" non trova "prigione"
    return (el) => contiene(el.dataset.ref) || parole.every((w) => (' ' + (el.dataset.cerca || '')).includes(' ' + w));
  };
  const fdvUrlCerca = (valore) => {
    try { const u = new URL(location.href); if (valore) u.searchParams.set('cerca', valore); else u.searchParams.delete('cerca'); history.replaceState(null, '', u); } catch (e) {}
  };

  /* ---- Articoli: filtri per categoria / sottocategoria (#categoria/sottocategoria) e ricerca ---- */
  const aBox = document.querySelector('[data-articoli]');
  if (aBox) {
    const cards = [...document.querySelectorAll('.agrid .acard')];
    const vuoto = document.querySelector('.aempty');
    const vuotoTesto = vuoto?.querySelector('[data-aempty-testo]');
    const cerca = aBox.querySelector('[data-acerca]');
    const pulisci = aBox.querySelector('[data-acerca-clear]');
    const esito = aBox.querySelector('[data-acerca-esito]');
    const nomeCat = (slug) => aBox.querySelector(`[data-fcat="${slug}"]`)?.childNodes[0].textContent.trim() || '';
    let cat = '', sub = '';
    const applica = (aggiornaHash) => {
      aBox.querySelectorAll('[data-fcat]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.fcat === cat)));
      aBox.querySelectorAll('[data-sub-of]').forEach((d) => { d.hidden = d.dataset.subOf !== cat; });
      aBox.querySelectorAll('[data-desc-of]').forEach((d) => { d.hidden = d.dataset.descOf !== cat; });
      aBox.querySelectorAll(`[data-sub-of="${cat}"] [data-fsub]`).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.fsub === sub)));
      const testo = (cerca?.value || '').trim();
      const trova = fdvCreaRicerca(testo);
      let n = 0, altrove = 0;
      cards.forEach((c) => {
        const inSezione = (!cat || c.dataset.cat === cat) && (!sub || c.dataset.sub === sub);
        const corrisponde = !trova || trova(c);
        c.hidden = !(inSezione && corrisponde); n += inSezione && corrisponde; altrove += !inSezione && corrisponde;
      });
      if (pulisci) pulisci.hidden = !testo;
      if (esito) esito.textContent = testo && n ? `${n} ${n === 1 ? 'articolo trovato' : 'articoli trovati'} per “${testo}”${cat ? ` in ${nomeCat(cat)}` : ''}` : '';
      if (vuoto) {
        vuoto.hidden = n > 0;
        if (vuotoTesto) vuotoTesto.textContent = !testo ? 'Nessun articolo in questa sezione, per ora.'
          : altrove ? `Qui non ci sono articoli per “${testo}”, ma ${altrove === 1 ? "ce n'è uno in un'altra sezione" : `ce ne sono ${altrove} in altre sezioni`}.`
          : `Nessun articolo trovato per “${testo}”. Prova con un'altra parola o con un libro della Bibbia.`;
        const tutti = vuoto.querySelector('[data-aempty-tutti]'); if (tutti) tutti.hidden = !cat && !sub;
      }
      if (aggiornaHash) history.replaceState(null, '', location.pathname + location.search + (cat ? `#${cat}${sub ? '/' + sub : ''}` : ''));
    };
    const daHash = () => { [cat = '', sub = ''] = location.hash.slice(1).split('/'); applica(false); };
    document.addEventListener('click', (e) => {
      const bc = e.target.closest('[data-fcat]'); const bs = e.target.closest('[data-fsub]');
      if (bc) { cat = bc.dataset.fcat; sub = ''; applica(true); }
      if (bs) { sub = bs.dataset.fsub; applica(true); }
    });
    let tempo;
    cerca?.addEventListener('input', () => { clearTimeout(tempo); tempo = setTimeout(() => { fdvUrlCerca(cerca.value.trim()); applica(false); }, 120); });
    cerca?.addEventListener('keydown', (e) => { if (e.key === 'Escape') { cerca.value = ''; fdvUrlCerca(''); applica(false); } });
    pulisci?.addEventListener('click', () => { cerca.value = ''; fdvUrlCerca(''); applica(false); cerca.focus(); });
    const iniziale = new URLSearchParams(location.search).get('cerca');
    if (iniziale && cerca) cerca.value = iniziale;
    window.addEventListener('hashchange', daHash);
    daHash();
  }

  /* ---- Articolo: condivisione ---- */
  document.querySelectorAll('[data-share]').forEach((box) => {
    const wa = box.querySelector('[data-share-wa]');
    if (wa) wa.href = 'https://wa.me/?text=' + encodeURIComponent(box.dataset.titolo + ' ' + location.href);
    box.querySelector('[data-share-copia]')?.addEventListener('click', async (e) => {
      try { await navigator.clipboard.writeText(location.href); e.target.textContent = 'Link copiato ✓'; }
      catch { e.target.textContent = location.href; }
      setTimeout(() => { e.target.textContent = 'Copia il link'; }, 2500);
    });
  });

  /* ---- Predicazioni: ricerca per parola, brano o predicatore ---- */
  const pForm = document.querySelector('[data-pcerca]');
  if (pForm) {
    const input = pForm.querySelector('input');
    const pulisci = pForm.querySelector('[data-pcerca-clear]');
    const esito = pForm.querySelector('[data-pcerca-esito]');
    const box = document.querySelector('[data-pcerca-risultati]');
    const griglia = box.querySelector('.grid');
    const vuoto = box.querySelector('.pcerca-vuoto');
    const tablistP = document.querySelector('[role="tablist"]');
    const pannelli = [...document.querySelectorAll('[role="tabpanel"]')];
    const tutte = [...document.querySelectorAll('[role="tabpanel"] .sermon[data-cerca]')];
    let tempo;
    const cerca = () => {
      const trova = fdvCreaRicerca(input.value);
      pulisci.hidden = !trova;
      fdvUrlCerca(input.value.trim());
      if (!trova) {
        box.hidden = true; tablistP.hidden = false; esito.textContent = '';
        const sel = tablistP.querySelector('[aria-selected="true"]');
        pannelli.forEach((p) => { p.hidden = p.id !== sel?.getAttribute('aria-controls'); });
        return;
      }
      const visti = new Set();
      const trovate = tutte.filter((c) => {
        if (visti.has(c.dataset.vid)) return false;
        const ok = trova(c);
        if (ok) visti.add(c.dataset.vid);
        return ok;
      });
      tablistP.hidden = true; pannelli.forEach((p) => { p.hidden = true; }); box.hidden = false;
      griglia.replaceChildren(...trovate.map((c) => {
        const copia = c.cloneNode(true);
        const etichetta = document.createElement('span'); etichetta.className = 'pcerca__serie'; etichetta.textContent = c.dataset.serie;
        copia.append(etichetta);
        return copia;
      }));
      vuoto.hidden = trovate.length > 0;
      esito.textContent = trovate.length ? `${trovate.length} ${trovate.length === 1 ? 'predicazione trovata' : 'predicazioni trovate'} per “${input.value.trim()}”` : '';
    };
    input.addEventListener('input', () => { clearTimeout(tempo); tempo = setTimeout(cerca, 120); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Escape') { input.value = ''; cerca(); } });
    pulisci.addEventListener('click', () => { input.value = ''; cerca(); input.focus(); });
    const iniziale = new URLSearchParams(location.search).get('cerca');
    if (iniziale) { input.value = iniziale; cerca(); }
  }

  /* ---- WhatsApp fisso: nascosto quando non serve (copre pulsanti e testi) ---- */
  const fab = document.querySelector('.fab');
  if (fab && 'IntersectionObserver' in window) {
    const visibili = new Set();
    const fio = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) visibili.add(en.target); else visibili.delete(en.target); });
      fab.classList.toggle('is-hidden', visibili.size > 0);
    });
    document.querySelectorAll('a[href^="https://wa.me"]:not(.fab), .map, .site-footer').forEach((el) => fio.observe(el));
  }

  /* ---- Anno nel footer ---- */
  document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
})();
