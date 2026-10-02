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
    // tocco sul velo accanto al pannello: chiude
    document.addEventListener('click', (e) => {
      if (nav.classList.contains('is-open') && !nav.contains(e.target) && !toggle.contains(e.target)) close();
    });
    document.addEventListener('keydown', (e) => {
      if (!nav.classList.contains('is-open')) return;
      if (e.key === 'Escape') { close(); toggle.focus(); return; }
      if (e.key === 'Tab') {
        const items = [toggle, ...[...nav.querySelectorAll('a')].filter((a) => a.offsetParent !== null)];
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
    // la copertina scelta da noi (data-cover) resta per tutte le lingue
    if (img && !img.hasAttribute('data-cover')) { img.removeAttribute('srcset'); img.src = `https://i.ytimg.com/vi/${id}/sddefault.jpg`; }
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

  /* ---- La nostra storia: il fiume che passa per ogni tappa e si riempie scorrendo ---- */
  const storia = document.querySelector('.storia-wrap');
  if (storia) {
    const svg = storia.querySelector('.storia__fiume');
    const [base, acqua, futuro] = ['base', 'acqua', 'futuro'].map((k) => svg.querySelector(`.storia__fiume-${k}`));
    const tappe = [...storia.querySelectorAll('.storia__tappa')];
    const N = 400;                       // punti di campionamento del fiume
    let lung = 0, campioni = [], punti = [];
    let mostrato = -1, obiettivo = 0, corsa = 0;
    let vh = window.innerHeight;          // altezza dello schermo: cambia solo se cambia la larghezza
    let larghezza = window.innerWidth;

    const disegna = () => {
      const box = storia.getBoundingClientRect();
      svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
      punti = tappe.map((t) => {
        const r = t.querySelector('.storia__punto').getBoundingClientRect();
        return [r.left + r.width / 2 - box.left, r.top + r.height / 2 - box.top];
      });
      // anse del fiume: ogni tratto si piega da un lato, il successivo dall'altro
      const ansa = Math.min(70, box.width * 0.06);
      let d = `M${punti[0][0]},${punti[0][1]}`;
      for (let i = 1; i < punti.length; i++) {
        const [x0, y0] = punti[i - 1], [x1, y1] = punti[i], dy = y1 - y0, s = (i % 2 ? 1 : -1) * ansa;
        d += ` C${x0 + s},${y0 + dy * 0.4} ${x1 + s},${y1 - dy * 0.4} ${x1},${y1}`;
      }
      base.setAttribute('d', d);
      acqua.setAttribute('d', d);
      const [xf, yf] = punti[punti.length - 1];
      futuro.setAttribute('d', `M${xf},${yf + 18} C${xf - ansa / 2},${yf + 70} ${xf + ansa / 2},${yf + 110} ${xf},${box.height + 40}`);
      lung = acqua.getTotalLength();
      acqua.style.strokeDasharray = `${lung} ${lung}`;
      // per sapere quanto fiume serve per arrivare a una certa altezza
      campioni = Array.from({ length: N + 1 }, (_, i) => acqua.getPointAtLength((lung * i) / N).y);
      mostrato = -1;   // ridisegna subito alla nuova misura
      riempi();
    };

    // quanta acqua serve per arrivare all'altezza y (interpolando tra due campioni: niente scatti)
    const lunghezzaA = (y) => {
      if (y <= campioni[0]) return 0;
      if (y >= campioni[N]) return lung;
      let lo = 0, hi = N;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (campioni[m] < y) lo = m; else hi = m; }
      const t = (y - campioni[lo]) / ((campioni[hi] - campioni[lo]) || 1);
      return (lung * (lo + t)) / N;
    };

    const mostra = (l) => {
      mostrato = l;
      acqua.style.strokeDashoffset = String(lung - l);
      const y = acqua.getPointAtLength(Math.max(0, l)).y;   // fin dove è arrivata l'acqua
      tappe.forEach((t, k) => t.classList.toggle('is-raggiunta', !!punti[k] && punti[k][1] <= y + 1));
    };

    // l'acqua insegue la posizione dello scroll con una piccola inerzia: il movimento resta morbido
    const scorri = () => {
      corsa = 0;
      const d = obiettivo - mostrato;
      if (Math.abs(d) < 0.5) { mostra(obiettivo); return; }
      mostra(mostrato + d * 0.14);
      corsa = requestAnimationFrame(scorri);
    };

    const riempi = () => {
      const livello = reduce ? Infinity : vh * 0.62 - storia.getBoundingClientRect().top;   // poco sotto metà schermo
      obiettivo = lunghezzaA(livello);
      if (reduce || mostrato < 0) { mostra(obiettivo); return; }
      if (!corsa) corsa = requestAnimationFrame(scorri);
    };

    disegna();
    window.addEventListener('scroll', riempi, { passive: true });
    // sul telefono la barra dell'indirizzo che compare e scompare cambia l'altezza: si ricalcola solo se cambia la larghezza
    window.addEventListener('resize', () => {
      if (window.innerWidth === larghezza) return;
      larghezza = window.innerWidth; vh = window.innerHeight;
      requestAnimationFrame(disegna);
    });
    if ('ResizeObserver' in window) new ResizeObserver(() => requestAnimationFrame(disegna)).observe(storia.querySelector('.storia'));
    window.addEventListener('load', disegna);   // le foto cambiano l'altezza delle tappe
  }

  /* ---- Anno nel footer ---- */
  document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
})();
