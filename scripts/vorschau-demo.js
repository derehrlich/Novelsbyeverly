// ---- Vorschau: Beispieldaten und Bedienelemente (nur in der Vorschau-Datei, nicht im echten Overlay)
const NAMES = ['Lena', 'Marie', 'Jonas', 'Sophie', 'Paul', 'Emma', 'Noah', 'Mia', 'Ben', 'Lotta'];
const RANKS = ['Notizbuch', 'Federkiel', 'Tintenfleck', 'Lektorat', 'Schreibstube', 'Manuskript', 'Notizbuch', 'Bestseller', 'Tintenfleck', 'Federkiel'];
const TASKS = ['Kapitel 3 überarbeiten', 'Dialoge feilen', '', 'Recherche Mittelalter', 'Exposé', '', 'Plot-Twist', '', 'Figurenbogen', ''];
const SLOT_ORDER = [2, 7, 0, 5, 4, 9, 1, 6, 3, 8];
const HOURS = [0, 2, 5, 10, 20, 40, 80];
const DECO = [['lichter', 2], ['pflanzen', 5], ['katze', 10], ['buecher', 20], ['voegel', 40], ['regenbogen', 80]];
const cfg = { scene: 'cafe', phase: 'focus', count: 8, hourIdx: 3, words: 1234, since: Date.now() - 7 * 60000 };

const figureFor = (i) => Object.assign(startFigur('demo' + i), [
  { kopf: 'muetze', gesicht: 'brille' }, { kopf: 'kopfhoerer', hals: 'schal', tisch: 'notizbuch', getraenk: 'kaffee' }, {},
  { kopf: 'blumenkranz', tisch: 'schreibmaschine', tier: 'eule' }, { gesicht: 'sonnenbrille' }, { tier: 'katze' }, {}, { kopf: 'muetze', tier: 'katze', getraenk: 'kakao' }, {}, { gesicht: 'brille', hals: 'schal' },
][i % 10]);

function mk() {
  const hours = HOURS[cfg.hourIdx];
  const length = cfg.phase === 'break' ? 5 : 25;
  const idle = cfg.phase === 'idle';
  return {
    now: Date.now(), scene: cfg.scene, deco: DECO.filter(([, h]) => hours >= h).map(([id]) => id),
    timer: { phase: cfg.phase, round: 2, startedAt: idle ? null : cfg.since, endsAt: idle ? null : cfg.since + length * 60000, wordsAtStart: 640 },
    words: { today: cfg.words, goal: 2000, chat: 4210 }, communityHours: hours,
    streamerTasks: [{ id: 'a', text: 'Kapitel 12 schreiben', done: true }, { id: 'b', text: 'Szene im Café überarbeiten', done: false }, { id: 'c', text: 'Klappentext entwerfen', done: false }],
    seats: Array.from({ length: cfg.count }, (_, i) => ({
      id: 'demo' + i, name: NAMES[i], slot: SLOT_ORDER[i], rank: RANKS[i], figure: figureFor(i),
      tasks: TASKS[i] ? [{ id: 't' + i, text: TASKS[i], done: i === 4 }] : [],
    })),
    events: [], cursor: 'x',
  };
}
const refresh = () => apply(mk());
const mark = (box, attr, value) => { for (const b of $(box).children) b.classList.toggle('aktiv', b.dataset[attr] === String(value)); };

refresh();
mark('k-szene', 's', cfg.scene); mark('k-phase', 'p', cfg.phase);

$('k-szene').onclick = (e) => { const s = e.target.dataset?.s; if (!s) return; cfg.scene = s; mark('k-szene', 's', s); refresh(); };
$('k-phase').onclick = (e) => {
  const p = e.target.dataset?.p; if (!p) return;
  cfg.phase = p; cfg.since = Date.now() - (p === 'break' ? 60000 : 7 * 60000); mark('k-phase', 'p', p); refresh();
  if (p !== 'idle') handleEvent({ type: 'phase', phase: p, minutes: p === 'focus' ? 25 : 5 });
};
$('anzahl').oninput = (e) => { cfg.count = Number(e.target.value); $('anzahlWert').textContent = cfg.count; refresh(); };
$('stunden').oninput = (e) => { cfg.hourIdx = Number(e.target.value); $('stundenWert').textContent = `${HOURS[cfg.hourIdx]} Std`; refresh(); };
$('tonAn').onchange = (e) => { ton = e.target.checked; if (ton) chime([660, 880], 0.14); };
$('k-event').onclick = (e) => {
  const kind = e.target.dataset?.e; if (!kind) return;
  if (kind === 'woerter') { cfg.words += 150; refresh(); return; }
  if (kind === 'sit') {
    if (cfg.count >= 10) cfg.count = 9;
    cfg.count += 1; $('anzahl').value = cfg.count; $('anzahlWert').textContent = cfg.count; refresh();
    handleEvent({ type: 'sit', slot: SLOT_ORDER[cfg.count - 1], name: NAMES[cfg.count - 1] });
    return;
  }
  handleEvent({ type: kind, writers: Math.max(1, cfg.count), minutes: 25, streamerWords: 420, words: 2000, name: 'Lena', rank: 'Federkiel', item: 'Katze' });
};
