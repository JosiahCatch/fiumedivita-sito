/* Fiume di Vita — interazioni del sito */
(function () {
  const root = document.documentElement;
  root.classList.remove('no-js');

  /* ---- Palette (anteprima proposte: ?palette=a|b|c|d) ---- */
  const PALETTES = ['a', 'b', 'c', 'd'];
  const setPalette = (p) => {
    if (p === 'a') root.removeAttribute('data-palette');
    else root.setAttribute('data-palette', p);
    try { localStorage.setItem('fdv-palette', p); } catch (e) {}
    document.querySelectorAll('[data-set-palette]').forEach((el) => {
      const on = el.dataset.setPalette === p;
      el.setAttribute('aria-pressed', String(on));
      el.closest('.palette-option')?.classList.toggle('is-active', on);
    });
  };
  const qp = new URLSearchParams(location.search).get('palette');
  let saved = null;
  try { saved = localStorage.getItem('fdv-palette'); } catch (e) {}
  const initial = PALETTES.includes(qp) ? qp : (PALETTES.includes(saved) ? saved : 'a');
  setPalette(initial);
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
    btn.replaceChildren(iframe);
    btn.removeAttribute('data-id');
    btn.style.cursor = 'default';
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
    if (img) img.src = `https://i.ytimg.com/vi/${id}/sddefault.jpg`;
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
    const fromHash = () => { const t = tabs.find((x) => '#' + x.dataset.tab === location.hash); if (t) select(t); };
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

  /* ---- Anno nel footer ---- */
  document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
})();
