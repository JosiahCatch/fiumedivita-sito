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

/* Il culto della domenica viene aggiunto in automatico (prossime 4 domeniche). */
const CULTO = { ora: "10:15", titolo: "Culto della domenica", categoria: "Ogni settimana",
  descrizione: "Ci vediamo dalle 10:00 per un caffè insieme, alle 10:15 inizia il culto.",
  luogo: "Via Casalanno, 85 — Pozzuoli" };

(function () {
  const list = document.getElementById('lista-eventi');
  if (!list) return;
  const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const items = EVENTI.filter((e) => new Date(e.data + 'T00:00') >= today);
  const d = new Date(today);
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  for (let i = 0; i < 4; i++) { items.push({ ...CULTO, data: iso(d) }); d.setDate(d.getDate() + 7); }
  items.sort((a, b) => (a.data + (a.ora || '')).localeCompare(b.data + (b.ora || '')));

  const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  list.innerHTML = items.map((e) => {
    const dt = new Date(e.data + 'T00:00');
    const action = e.link
      ? `<a class="btn btn--outline" href="${esc(e.link)}">Scopri di più</a>`
      : `<a class="btn btn--outline" href="visita.html">Come arrivare</a>`;
    return `<article class="event reveal is-in">
      <div class="event__date" aria-hidden="true"><b>${dt.getDate()}</b><span>${MESI[dt.getMonth()]}</span></div>
      <div>
        <span class="tag">${esc(e.categoria)}</span>
        <h3>${esc(e.titolo)}</h3>
        <p><time datetime="${e.data}${e.ora ? 'T' + e.ora : ''}">${GIORNI[dt.getDay()]} ${dt.getDate()} ${MESI[dt.getMonth()]}${e.ora ? ' · ore ' + esc(e.ora) : ''}</time> — ${esc(e.luogo)}</p>
        ${e.descrizione ? `<p>${esc(e.descrizione)}</p>` : ''}
      </div>
      ${action}
    </article>`;
  }).join('');
})();
