/* Fiume di Vita — importazione articoli da Word (.docx), PDF, testo (.txt/.md).
 * Tutto avviene nel browser: il file non viene inviato a nessun servizio esterno.
 * Restituisce: { titolo, sottotitolo, autore, testo (Markdown con segnaposto ⟦IMG n⟧), immagini: [dataURL], avvisi: [], categoria, sottocategoria } */
(() => {
  const LIB = {
    mammoth: 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js',
    turndown: 'https://cdnjs.cloudflare.com/ajax/libs/turndown/7.2.0/turndown.min.js',
    pdf: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    pdfWorker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  };
  const caricati = {};
  const carica = (src) => caricati[src] || (caricati[src] = new Promise((ok, ko) => {
    const s = document.createElement('script'); s.src = src; s.onload = ok;
    s.onerror = () => ko(new Error('Impossibile caricare il lettore di documenti. Controlla la connessione.'));
    document.head.append(s);
  }));

  /* ---------- parole chiave per suggerire la (sotto)categoria ---------- */
  const PAROLE = {
    'matrimonio': 'matrimonio matrimoni marito mariti moglie mogli sposi sposo sposa coniuge coniugi coppia coppie nozze fidanzati fidanzamento',
    'famiglia': 'famiglia famiglie figli figlio figlia genitori genitore padre madre mamma papà educazione bambini',
    'lavoro': 'lavoro lavorare lavoratore colleghi collega ufficio carriera datore stipendio professione impiego',
    'preghiera': 'preghiera preghiere pregare prego pregate intercessione digiuno',
    'relazioni': 'amicizia amici amico relazioni relazione rapporti vicino prossimo conflitti',
    'sofferenza': 'sofferenza soffrire dolore prova prove malattia lutto ansia depressione dolori tribolazione',
    'la-croce': 'croce crocifisso crocifissione golgota calvario sangue sacrificio morte espiazione',
    'la-grazia': 'grazia misericordia dono immeritato favore',
    'il-perdono': 'perdono perdonare perdonati perdonato riconciliazione colpa',
    'la-fede': 'fede credere credente fiducia fidarsi dubbio dubbi',
    'il-futuro': 'futuro ritorno risurrezione resurrezione cielo eternità eterna eterno paradiso speranza apocalisse giudizio',
    'studi-biblici': 'versetto versetti capitolo capitoli studio studiare esegesi testo passo lettera vangelo antico nuovo testamento',
    'chi-e-dio': 'trinità creatore onnipotente santità attributi carattere signore',
    'spirito-santo': 'spirito consolatore doni pentecoste',
    'la-chiesa': 'chiesa chiese comunità corpo membri culto battesimo cena comunione',
    'domande-difficili': 'perché male scienza evoluzione dubbio domande domanda',
    'societa': 'società politica leggi giustizia povertà sociale',
    'cultura': 'cultura film musica libro libri arte social',
    'testimonianze': 'testimonianza storia conversione convertito cambiato vita',
    'notizie': 'evento eventi notizia notizie annuncio programma incontro',
    'il-centro': 'centro cantiere costruzione lavori edificio',
  };
  function suggerisci(categorie, titolo, testo) {
    const conta = (t) => { const m = new Map(); for (const w of t.toLowerCase().normalize('NFC').match(/[a-zàèéìòù]+/g) || []) m.set(w, (m.get(w) || 0) + 1); return m; };
    const nt = conta(titolo), nx = conta(testo);
    let migliore = null, punti = 0;
    for (const c of categorie) for (const s of c.sotto) {
      const parole = new Set(((PAROLE[s.slug] || '') + ' ' + s.nome + ' ' + c.nome).toLowerCase().match(/[a-zàèéìòù]{4,}/g) || []);
      let p = 0; parole.forEach((w) => { p += (nt.get(w) || 0) * 4 + Math.min(nx.get(w) || 0, 6); });
      if (p > punti) { punti = p; migliore = { categoria: c.slug, sottocategoria: s.slug }; }
    }
    return punti >= 2 ? migliore : null;
  }

  /* ---------- pulizia comune ---------- */
  const RE_AUTORE = /^(?:di|a cura di|autore|autrice|scritto da)\s*[:\-–]?\s*(.{3,60})$/i;
  /** Toglie da `blocchi` titolo, sottotitolo e autore iniziali. blocchi: [{tipo: 'h1'|'h2'|'h3'|'p', testo, md, sottotitolo?, corsivo?}] */
  function estraiTesta(blocchi) {
    let titolo = '', sottotitolo = '', autore = '';
    const togli = (x) => blocchi.splice(blocchi.indexOf(x), 1);
    const pieni = () => blocchi.filter((x) => x.testo);
    const primi = pieni().slice(0, 3);
    const t = primi.find((x) => x.tipo === 'h1') || (primi[0] && primi[0].testo.length <= 160 && !/[.!?;:]$/.test(primi[0].testo) ? primi[0] : null);
    if (t) { titolo = t.testo; togli(t); }
    let primo = true;
    for (const x of pieni().slice(0, 4)) {
      const ma = x.testo.match(RE_AUTORE);
      if (!autore && ma && x.testo.length < 70) { autore = ma[1].replace(/[.,;]+$/, '').trim(); togli(x); continue; }
      if (primo && !sottotitolo && (x.sottotitolo || ((x.tipo === 'h2' || x.tipo === 'h3' || x.corsivo) && x.testo.length <= 240 && !/[:;]$/.test(x.testo)))) { sottotitolo = x.testo; togli(x); primo = false; continue; }
      primo = false;
    }
    return { titolo, sottotitolo, autore };
  }

  /* ---------- Word (.docx) ---------- */
  async function daWord(file) {
    await Promise.all([carica(LIB.mammoth), carica(LIB.turndown)]);
    const avvisi = [], immagini = [];
    const res = await window.mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() }, {
      styleMap: ["p[style-name='Title'] => h1:fresh", "p[style-name='Titolo'] => h1:fresh", "p[style-name='Subtitle'] => p.sottotitolo:fresh", "p[style-name='Sottotitolo'] => p.sottotitolo:fresh",
        "p[style-name='Quote'] => blockquote:fresh", "p[style-name='Citazione'] => blockquote:fresh", "p[style-name='Intense Quote'] => blockquote:fresh"],
      convertImage: window.mammoth.images.imgElement(async (img) => {
        if (!/^image\/(png|jpe?g|gif|webp|bmp)$/.test(img.contentType)) { avvisi.push('Un\'immagine in un formato non supportato (' + img.contentType + ') è stata saltata.'); return { src: '' }; }
        immagini.push(`data:${img.contentType};base64,${await img.read('base64')}`);
        return { src: `fdv-img-${immagini.length - 1}` };
      }),
    });
    const doc = new DOMParser().parseFromString(`<body>${res.value}</body>`, 'text/html');
    doc.querySelectorAll('img[src=""]').forEach((x) => x.remove());
    const td = new window.TurndownService({ headingStyle: 'atx', bulletListMarker: '-', emDelimiter: '*', strongDelimiter: '**' });
    td.addRule('img', { filter: 'img', replacement: (_, n) => { const m = (n.getAttribute('src') || '').match(/fdv-img-(\d+)/); return m ? `\n\n⟦IMG ${m[1]}⟧\n\n` : ''; } });
    td.addRule('h1', { filter: 'h1', replacement: (c) => `\n\n## ${c.trim()}\n\n` });           // titoli interni: livello 2
    td.addRule('h4plus', { filter: ['h4', 'h5', 'h6'], replacement: (c) => `\n\n### ${c.trim()}\n\n` });
    const blocchi = [...doc.body.children].map((el) => ({
      tipo: /^H[1-3]$/.test(el.tagName) ? el.tagName.toLowerCase() : 'p',
      testo: el.textContent.replace(/\s+/g, ' ').trim(),
      sottotitolo: el.classList.contains('sottotitolo'),
      corsivo: el.tagName === 'P' && el.children.length === 1 && el.firstElementChild.tagName === 'EM' && el.textContent.trim() === el.firstElementChild.textContent.trim(),
      md: td.turndown(el.outerHTML).trim(),
    })).filter((x) => x.testo || /⟦IMG/.test(x.md));
    const testa = estraiTesta(blocchi);
    return { ...testa, testo: blocchi.map((x) => x.md).filter(Boolean).join('\n\n'), immagini, avvisi };
  }

  /* ---------- PDF ---------- */
  async function daPdf(file) {
    await carica(LIB.pdf);
    const pdfjs = window.pdfjsLib; pdfjs.GlobalWorkerOptions.workerSrc = LIB.pdfWorker;
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const righe = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const pag = await pdf.getPage(n);
      const { items, styles } = await pag.getTextContent();
      let cur = null;
      for (const it of items) {
        if (!it.str && !it.hasEOL) continue;
        const size = Math.round(Math.hypot(it.transform[2], it.transform[3]) * 10) / 10 || 10;
        const y = it.transform[5];
        const font = (styles[it.fontName] || {}).fontFamily + ' ' + it.fontName;
        const bold = /bold|black|heavy|semibold/i.test(font), italic = /italic|oblique/i.test(font);
        if (!cur || Math.abs(cur.y - y) > size * 0.5) { cur = { pagina: n, y, size, bold, italic: true, testo: '' }; righe.push(cur); }
        cur.testo += it.str; cur.size = Math.max(cur.size, size); cur.bold = cur.bold || bold; if (it.str.trim()) cur.italic = cur.italic && italic;
        if (it.hasEOL) cur = null;
      }
    }
    const pulite = righe.map((r) => ({ ...r, testo: r.testo.replace(/\s+/g, ' ').trim() })).filter((r) => r.testo);
    // togli numeri di pagina e intestazioni/piè di pagina ripetuti
    const freq = new Map(); pulite.forEach((r) => freq.set(r.testo, (freq.get(r.testo) || 0) + 1));
    const utili = pulite.filter((r) => !/^(pag(ina)?\.?\s*)?\d{1,3}(\s*(di|\/)\s*\d{1,3})?$/i.test(r.testo) && !(pdf.numPages >= 2 && r.testo.length < 80 && freq.get(r.testo) >= Math.max(2, Math.ceil(pdf.numPages * 0.6))));
    if (!utili.length) throw new Error('Questo PDF non contiene testo selezionabile (forse è una scansione). Prova con il file Word originale.');
    const corpo = [...utili.reduce((m, r) => m.set(r.size, (m.get(r.size) || 0) + r.testo.length), new Map())].sort((a, b) => b[1] - a[1])[0][0];
    // righe -> paragrafi
    const blocchi = []; let par = null, prec = null;
    for (const r of utili) {
      const titoletto = r.size >= corpo * 1.18 || (r.bold && r.testo.length < 90 && !/[.,;:]$/.test(r.testo));
      // nuovo paragrafo: spazio verticale più ampio, oppure nuova pagina dopo una frase conclusa
      const salto = prec && (r.pagina !== prec.pagina ? /[.!?»”"]$/.test(prec.testo) : (prec.y - r.y) > prec.size * 1.75);
      if (titoletto) {
        par = null;
        blocchi.push({ tipo: r.size >= corpo * 1.6 ? 'h1' : r.size >= corpo * 1.3 ? 'h2' : 'h3', testo: r.testo, size: r.size, corsivo: r.italic });
      } else if (!par || salto || prec?.titoletto || /^[•\-–·]\s/.test(r.testo)) {
        par = { tipo: 'p', testo: r.testo }; blocchi.push(par);
      } else {
        par.testo = par.testo.endsWith('-') && /^[a-zà-ù]/.test(r.testo) ? par.testo.slice(0, -1) + r.testo : par.testo + ' ' + r.testo;
      }
      prec = { ...r, titoletto };
    }
    // il testo più grande della prima pagina è il titolo
    const grande = blocchi.filter((b) => b.size).sort((a, b) => b.size - a.size)[0];
    if (grande && blocchi.indexOf(grande) < 4) grande.tipo = 'h1';
    blocchi.forEach((b) => { b.md = b.tipo === 'p' ? (/^[•\-–·]\s/.test(b.testo) ? '- ' + b.testo.replace(/^[•\-–·]\s*/, '') : b.testo) : `${b.tipo === 'h3' ? '###' : '##'} ${b.testo}`; });
    const testa = estraiTesta(blocchi);
    // voci di elenco consecutive: una per riga, senza righe vuote in mezzo
    const unisci = (bl) => bl.reduce((out, b, k) => out + (k === 0 ? '' : (/^- /.test(b.md) && /^- /.test(bl[k - 1].md) ? '\n' : '\n\n')) + b.md, '');
    const avvisi = ['Dai PDF si importa solo il testo: se ci sono immagini, aggiungile con il pulsante immagine o come copertina.'];
    return { ...testa, testo: unisci(blocchi), immagini: [], avvisi };
  }

  /* ---------- testo semplice / Markdown ---------- */
  async function daTesto(file) {
    const t = (await file.text()).replace(/\r\n/g, '\n').trim();
    const blocchi = t.split(/\n{2,}/).map((md) => ({ tipo: /^#\s/.test(md) ? 'h1' : /^##\s/.test(md) ? 'h2' : 'p', testo: md.replace(/^#+\s*/, '').replace(/\s+/g, ' ').trim(), md }));
    // prima riga breve, seguita da altro testo nello stesso blocco: è il titolo
    const r0 = blocchi[0]?.md.split('\n');
    if (r0 && r0.length > 1 && !/^#/.test(r0[0]) && r0[0].length <= 160) blocchi.splice(0, 1, { tipo: 'h1', testo: r0[0].trim(), md: '' }, { tipo: 'p', testo: r0.slice(1).join(' ').trim(), md: r0.slice(1).join('\n') });
    const testa = estraiTesta(blocchi);
    return { ...testa, testo: blocchi.map((x) => x.md).filter(Boolean).join('\n\n'), immagini: [], avvisi: [] };
  }

  async function leggi(file, categorie) {
    const nome = file.name.toLowerCase();
    if (file.size > 25 * 1024 * 1024) throw new Error('Il file è troppo grande (massimo 25 MB).');
    let r;
    if (nome.endsWith('.docx')) r = await daWord(file);
    else if (nome.endsWith('.pdf')) r = await daPdf(file);
    else if (/\.(txt|md|markdown)$/.test(nome)) r = await daTesto(file);
    else if (nome.endsWith('.doc')) throw new Error('Il vecchio formato .doc non è supportato: in Word scegli "Salva con nome" → "Documento di Word (.docx)" e riprova.');
    else if (/\.(odt|pages|rtf)$/.test(nome)) throw new Error('Formato non supportato: salva il documento come Word (.docx) o PDF e riprova.');
    else throw new Error('Formato non riconosciuto. Puoi importare file Word (.docx), PDF o testo (.txt).');
    r.testo = r.testo.replace(/\n{3,}/g, '\n\n').trim();
    if (!r.titolo) r.titolo = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
    const s = suggerisci(categorie, r.titolo, r.testo);
    return { ...r, ...(s || {}) };
  }

  /* ---------- riferimenti biblici (stessa logica di _build/bibbia.py) ---------- */
  const LIBRI = { Genesi: 'Genesi', Esodo: 'Esodo', Levitico: 'Levitico', Numeri: 'Numeri', Deuteronomio: 'Deuteronomio', 'Giosuè': 'Giosuè', Giudici: 'Giudici', Rut: 'Rut',
    Samuele: 'Samuele', Re: 'Re', Cronache: 'Cronache', Esdra: 'Esdra', Neemia: 'Neemia', Ester: 'Ester', Giobbe: 'Giobbe', Salmi: 'Salmi', Salmo: 'Salmi', Proverbi: 'Proverbi',
    Ecclesiaste: 'Ecclesiaste', Qoelet: 'Ecclesiaste', 'Cantico dei Cantici': 'Cantico dei Cantici', Isaia: 'Isaia', Geremia: 'Geremia', Lamentazioni: 'Lamentazioni',
    Ezechiele: 'Ezechiele', Daniele: 'Daniele', Osea: 'Osea', Gioele: 'Gioele', Amos: 'Amos', Abdia: 'Abdia', Giona: 'Giona', Michea: 'Michea', Naum: 'Naum', Abacuc: 'Abacuc',
    Sofonia: 'Sofonia', Aggeo: 'Aggeo', Zaccaria: 'Zaccaria', Malachia: 'Malachia', Matteo: 'Matteo', Marco: 'Marco', Luca: 'Luca', Giovanni: 'Giovanni', Atti: 'Atti',
    Romani: 'Romani', Corinzi: 'Corinzi', Galati: 'Galati', Efesini: 'Efesini', Filippesi: 'Filippesi', Colossesi: 'Colossesi', Tessalonicesi: 'Tessalonicesi',
    Timoteo: 'Timoteo', Tito: 'Tito', Filemone: 'Filemone', Ebrei: 'Ebrei', Giacomo: 'Giacomo', Pietro: 'Pietro', Giuda: 'Giuda', Apocalisse: 'Apocalisse' };
  const AMBIGUI = new Set(['Rut', 'Re', 'Giona', 'Amos', 'Marco', 'Luca', 'Giovanni', 'Tito', 'Pietro', 'Giacomo', 'Giuda', 'Daniele', 'Michea', 'Naum', 'Abdia', 'Osea', 'Gioele',
    'Aggeo', 'Zaccaria', 'Malachia', 'Esdra', 'Neemia', 'Ester', 'Giobbe', 'Timoteo', 'Filemone', 'Isaia', 'Geremia', 'Ezechiele', 'Matteo', 'Atti', 'Samuele', 'Cronache']);
  const NUMERATI = new Set(['Samuele', 'Re', 'Cronache', 'Corinzi', 'Tessalonicesi', 'Timoteo', 'Pietro', 'Giovanni']);
  const nomi = Object.keys(LIBRI).sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const RE_RIF = new RegExp(`(?<![\\p{L}\\d])(?:([123]|I{1,3})\\s*)?(${nomi.join('|')})\\s+(\\d{1,3})(?:\\s*[:,]\\s*(\\d{1,3}(?:\\s*[-–]\\s*\\d{1,3})?(?:\\s*[.,;]\\s*\\d{1,3}(?:\\s*[-–]\\s*\\d{1,3})?)*))?(?!\\d)`, 'gu');
  function brani(testo) {
    const out = [];
    for (const m of String(testo || '').matchAll(RE_RIF)) {
      const libro = LIBRI[m[2]]; const num = { I: '1', II: '2', III: '3' }[m[1]] || m[1] || '';
      const vv = (m[4] || '').replace(/\s+/g, '').replace(/–/g, '-').replace(/[.,;]+$/, '');
      if (AMBIGUI.has(m[2]) && !vv) continue;
      if (NUMERATI.has(libro) && !num && libro !== 'Giovanni') continue;
      if (num && !NUMERATI.has(libro)) continue;
      const rif = `${num ? num + ' ' : ''}${libro} ${m[3]}${vv ? ':' + vv : ''}`;
      if (!out.includes(rif)) out.push(rif);
    }
    // "Filippesi 4" è superfluo se c'è già "Filippesi 4:6-7"
    return out.filter((r) => r.includes(':') || !out.some((x) => x !== r && x.startsWith(r + ':')));
  }

  window.FDVImporta = { leggi, brani };
})();
