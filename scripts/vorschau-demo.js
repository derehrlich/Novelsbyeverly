// ---- Vorschau: Beispieldaten und Bedienelemente (nur in der Vorschau-Datei, nicht im echten Overlay)
const cfg = { jahreszeit: 'fruehling', tageszeit: 'mittag', phase: 'focus', progress: 55, sprintPct: 28, done: 3, goal: 6, words: 1100, mod: { blume: true, kerze: true, buecher: true, musik: true, kamera: true }, since: Date.now() - 7 * 60000 };

function mk() {
  const layout = structuredClone(DEFAULT_LAYOUT);
  for (const k of ['blume', 'kerze', 'buecher', 'musik']) layout[k].on = cfg.mod[k];
  layout.kamera.on = cfg.mod.kamera;
  const length = cfg.phase === 'break' ? 5 : 25, idle = cfg.phase === 'idle';
  return {
    now: Date.now(), modus: 'wachstum', jahreszeit: cfg.jahreszeit, tageszeit: cfg.tageszeit, progress: cfg.progress / 100,
    scene: 'cafe', deco: [], modules: { blume: cfg.mod.blume, kerze: cfg.mod.kerze, buecher: cfg.mod.buecher }, sprintsToday: cfg.done, layout,
    pomodoro: { done: cfg.done, goal: cfg.goal, minutes: 25 },
    musik: cfg.mod.musik ? { mode: 'server', now: { title: 'Rainy Café', artist: 'Mondschein', cover: '' } } : null,
    timer: { phase: cfg.phase, round: cfg.done + 1, startedAt: idle ? null : cfg.since, endsAt: idle ? null : cfg.since + length * 60000, wordsAtStart: 640 },
    words: { today: cfg.words, goal: 2000, chat: 0 }, communityHours: 0,
    streamerTasks: [{ id: 'a', text: 'Kapitel 12 schreiben', done: true }, { id: 'b', text: 'Szene im Café überarbeiten', done: false }, { id: 'c', text: 'Klappentext entwerfen', done: false }, { id: 'd', text: 'Exposé an Lektorin', done: false }],
    seats: [], events: [], cursor: 'x',
  };
}
const refresh = () => apply(mk());
const mark = (box, attr, value) => { for (const b of $(box).children) b.classList.toggle('aktiv', b.dataset[attr] === String(value)); };
const setSince = () => { const len = cfg.phase === 'break' ? 5 : 25; cfg.since = Date.now() - (cfg.phase === 'break' ? 0.2 : cfg.sprintPct / 100) * len * 60000; };

refresh();
mark('k-jahr', 'j', cfg.jahreszeit); mark('k-zeit', 'z', cfg.tageszeit); mark('k-phase', 'p', cfg.phase);

$('k-jahr').onclick = (e) => { const v = e.target.dataset?.j; if (!v) return; cfg.jahreszeit = v; mark('k-jahr', 'j', v); refresh(); };
$('k-zeit').onclick = (e) => { const v = e.target.dataset?.z; if (!v) return; cfg.tageszeit = v; mark('k-zeit', 'z', v); refresh(); };
$('k-phase').onclick = (e) => {
  const p = e.target.dataset?.p; if (!p) return;
  cfg.phase = p; setSince(); mark('k-phase', 'p', p); refresh();
  if (p !== 'idle') handleEvent({ type: 'phase', phase: p, minutes: p === 'focus' ? 25 : 5 });
};
$('sprintPct').oninput = (e) => { cfg.sprintPct = Number(e.target.value); $('sprintPctWert').textContent = `${e.target.value} %`; if (cfg.phase !== 'focus') { cfg.phase = 'focus'; mark('k-phase', 'p', 'focus'); } setSince(); refresh(); };
$('pomoDone').oninput = (e) => { cfg.done = Number(e.target.value); $('pomoDoneWert').textContent = `${cfg.done} von ${cfg.goal}`; refresh(); };
$('wachsRegler').oninput = (e) => { cfg.progress = Number(e.target.value); cfg.words = Math.round((cfg.progress / 100) * 2000); $('wachsWert').textContent = `${e.target.value} %`; refresh(); };
for (const [id, key] of [['mBlume', 'blume'], ['mKerze', 'kerze'], ['mBuecher', 'buecher'], ['mMusik', 'musik'], ['mKamera', 'kamera']]) $(id).onchange = (e) => { cfg.mod[key] = e.target.checked; refresh(); };
$('tonAn').onchange = (e) => { ton = e.target.checked; if (ton) chime([660, 880], 0.14); };
$('k-event').onclick = (e) => {
  const kind = e.target.dataset?.e; if (!kind) return;
  if (kind === 'woerter') { cfg.words = Math.min(2400, cfg.words + 150); cfg.progress = Math.min(100, Math.round((cfg.words / 2000) * 100)); $('wachsRegler').value = cfg.progress; $('wachsWert').textContent = `${cfg.progress} %`; refresh(); return; }
  handleEvent({ type: kind, n: cfg.done + 1, goal: cfg.goal, writers: 0, minutes: 25, streamerWords: 420, words: 2000, name: 'Lena', rank: 'Federkiel', item: 'Katze' });
};
