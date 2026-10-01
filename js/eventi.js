/* =========================================================
   EVENTI — modifica solo questa lista per aggiungere eventi.
   Formato data: "AAAA-MM-GG". Gli eventi passati spariscono da soli.
   ========================================================= */
const EVENTI = [
  // Esempio (togli le // per attivarlo):
  // {
  //   data: "2026-10-25",
  //   ora: "18:00",
  //   titolo: "Serata giovani",
  //   categoria: "Giovanissimi",
  //   luogo: "Via Casalanno, 85 — Pozzuoli",
  //   descrizione: "Musica, pizza e una parola per la tua vita.",
  //   link: ""            // facoltativo: link a info o iscrizione
  // },
];

/* Il culto della domenica compare in automatico come appuntamento fisso, in cima all'elenco. */
const CULTO = { ora: "10:15", titolo: "Culto della domenica", categoria: "Ogni settimana",
  descrizione: "Ci vediamo dalle 10:00 per un caffè insieme, alle 10:15 inizia il culto.",
  luogo: "Via Casalanno, 85 — Pozzuoli" };

(function () {
  const list = document.getElementById('lista-eventi');
  if (!list) return;
  const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  const MESI_LUNGHI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const eventi = EVENTI.filter((e) => new Date(e.data + 'T00:00') >= today)
    .sort((a, b) => (a.data + (a.ora || '')).localeCompare(b.data + (b.ora || '')));

  // prossima domenica (oggi, se è domenica)
  const dom = new Date(today);
  dom.setDate(dom.getDate() + ((7 - dom.getDay()) % 7));

  const culto = `<article class="event event--fisso">
      <div class="event__date" aria-hidden="true"><b>Dom</b><span>${CULTO.ora}</span></div>
      <div>
        <span class="tag">${esc(CULTO.categoria)}</span>
        <h3>${esc(CULTO.titolo)}</h3>
        <p>Prossimo: <time datetime="${iso(dom)}T${CULTO.ora}">${GIORNI[dom.getDay()]} ${dom.getDate()} ${MESI_LUNGHI[dom.getMonth()]}</time> · ${esc(CULTO.luogo)}</p>
        <p>${esc(CULTO.descrizione)}</p>
      </div>
      <a class="btn btn--outline" href="visita.html">Come arrivare</a>
    </article>`;

  const speciali = eventi.map((e) => {
    const dt = new Date(e.data + 'T00:00');
    const action = e.link ? `<a class="btn btn--outline" href="${esc(e.link)}">Scopri di più<span class="visually-hidden">: ${esc(e.titolo)}</span></a>` : '';
    return `<article class="event">
      <div class="event__date" aria-hidden="true"><b>${dt.getDate()}</b><span>${MESI[dt.getMonth()]}</span></div>
      <div>
        <span class="tag">${esc(e.categoria)}</span>
        <h3>${esc(e.titolo)}</h3>
        <p><time datetime="${e.data}${e.ora ? 'T' + e.ora : ''}">${GIORNI[dt.getDay()]} ${dt.getDate()} ${MESI[dt.getMonth()]}${e.ora ? ' · ore ' + esc(e.ora) : ''}</time>${e.luogo ? ' — ' + esc(e.luogo) : ''}</p>
        ${e.descrizione ? `<p>${esc(e.descrizione)}</p>` : ''}
      </div>
      ${action}
    </article>`;
  }).join('');

  list.innerHTML = culto + `<h3 class="events-sub">Eventi speciali</h3>` + (speciali ||
    `<p class="events-empty">Al momento non ci sono eventi speciali in programma. Scrivici su WhatsApp per essere avvisato quando ne organizziamo uno.</p>`);
})();
