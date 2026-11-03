// Pomodoro und Ziele: Ablauf starten/anhalten, Länge/Pause/Wiederholungen, Töne (auch eigene Dateien), Ziele, Wörter, Seiten, To-Do.
import { $, api, esc, fmtN, initSeite, meldung, run, show } from './common.js';
import { sammle, zeichne } from './formular.js';

let state = null, current = null;
async function loadZustand() {
  state = await api('GET', 'state');
  renderTimer(); renderWords(state.words);
  $('pomoHeute').textContent = state.pomodoro.done; $('pomoZiel').textContent = state.pomodoro.goal || '–';
}

// ---- Timer
const pad = (n) => String(n).padStart(2, '0');
function renderTimer() {
  const t = state?.timer;
  if (!t || t.phase === 'idle') { $('timer').textContent = 'bereit'; $('timerInfo').textContent = ''; return; }
  const s = t.paused ? Math.ceil(t.paused.remaining / 1000) : Math.max(0, Math.ceil((t.endsAt - Date.now()) / 1000));
  $('timer').textContent = `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
  $('timerInfo').textContent = (t.paused ? 'Angehalten · ' : '') + (t.phase === 'focus' ? 'Pomodoro läuft' : 'Pause') + (t.cycle ? ` · Durchgang ${t.cycle.index} von ${t.cycle.total}` : '');
}
setInterval(renderTimer, 500);
setInterval(() => { if (!$('app').hidden) { loadZustand().catch(() => {}); loadStream().catch(() => {}); } }, 5000);
const minutes = () => ($('minuten').value ? Number($('minuten').value) : undefined);
$('fokus').onclick = run(async () => { await api('POST', 'timer/focus', { minutes: minutes() }); await loadZustand(); });
$('pause').onclick = run(async () => { await api('POST', 'timer/break', { minutes: minutes() }); await loadZustand(); });
$('halt').onclick = run(async () => { await api('POST', state?.timer?.paused ? 'timer/resume' : 'timer/hold'); await loadZustand(); });
$('stopp').onclick = run(async () => { await api('POST', 'timer/stop'); await loadZustand(); });
for (const [id, delta] of [['pomoMinus', -1], ['pomoPlus', 1]]) $(id).onclick = run(async () => { await api('POST', 'timer/count', { delta }); await loadZustand(); });



// ---- Wörter
function renderWords(w) { $('woerterHeute').textContent = new Intl.NumberFormat('de-DE').format(w.today); $('woerterZiel').textContent = new Intl.NumberFormat('de-DE').format(w.goal); }
const sendWords = (mode) => run(async () => { const v = $('woerterWert').value; if (mode !== 'reset' && v === '') throw new Error('Bitte eine Zahl eingeben'); renderWords(await api('POST', 'words', { mode, value: v })); $('woerterWert').value = ''; });
$('wAbs').onclick = sendWords('absolute'); $('wDelta').onclick = sendWords('delta'); $('wToday').onclick = sendWords('today'); $('wReset').onclick = sendWords('reset');


// ---- Ziele, Seiten, Streamzeit
function fillZiele(settings) {
  $('zielWoerter').value = settings.wordGoal; $('zielSeiten').value = settings.seitenGoal; $('zielStunden').value = settings.streamGoalMinutes / 60;
}
$('zieleSpeichern').onclick = run(async () => {
  const r = await api('PUT', 'settings', { wordGoal: Number($('zielWoerter').value), seitenGoal: Number($('zielSeiten').value), streamGoalMinutes: Math.round(Number($('zielStunden').value) * 60) });
  current = r.settings; fillZiele(r.settings); meldung('Ziele gespeichert'); await loadZustand();
});
async function loadPages() { const p = await api('GET', 'pages'); $('seitenHeute').textContent = fmtN(p.today); $('seitenZiel').textContent = fmtN(p.goal); }
const sendPages = (mode) => run(async () => { const v = $('seitenWert').value; if (v === '') throw new Error('Bitte eine Zahl eingeben'); await api('POST', 'pages', { mode, value: v }); $('seitenWert').value = ''; await loadPages(); });
$('sSet').onclick = sendPages('set'); $('sPlus').onclick = sendPages('delta');
async function loadStream() {
  const s = await api('GET', 'stream');
  $('streamText').textContent = s.startedAt ? `${s.text} Std von ${Math.floor(s.goalMinutes / 60)}:${String(s.goalMinutes % 60).padStart(2, '0')} (${s.quelle === 'twitch' ? 'von Twitch erkannt' : 'von Hand gestartet'})` : 'nicht gestartet';
}
$('streamStart').onclick = run(async () => { await api('POST', 'stream/start'); await loadStream(); });
$('streamStop').onclick = run(async () => { await api('POST', 'stream/stop'); await loadStream(); });


// ---- Aufgaben
async function loadTasks() {
  const { items } = await api('GET', 'tasks');
  $('aufgaben').innerHTML = items.length ? items.map((i) => `<div class="aufgabe ${i.done ? 'fertig' : ''}"><span style="flex:1">${esc(i.text)}</span>${i.done ? '' : `<button class="gruen" data-done="${i.id}">✓</button>`}<button class="hell" data-del="${i.id}">✕</button></div>`).join('') : '<div class="leise">Keine Aufgaben</div>';
  for (const b of $('aufgaben').querySelectorAll('[data-done]')) b.onclick = run(async () => { await api('POST', 'tasks/done', { id: b.dataset.done }); await loadTasks(); });
  for (const b of $('aufgaben').querySelectorAll('[data-del]')) b.onclick = run(async () => { await api('DELETE', `tasks/${b.dataset.del}`); await loadTasks(); });
}
$('aufgabeAdd').onclick = run(async () => { await api('POST', 'tasks', { text: $('neueAufgabe').value }); $('neueAufgabe').value = ''; await loadTasks(); });
$('neueAufgabe').onkeydown = (e) => { if (e.key === 'Enter') $('aufgabeAdd').click(); };
$('aufgabenLeer').onclick = run(async () => { await api('DELETE', 'tasks/all'); await loadTasks(); });


// ---- Ziel-Art (Schaltflächen)
const ZIEL_ARTEN = [['woerter', 'Wörter schreiben'], ['seiten', 'Seiten lesen'], ['zeit', 'Streamzeit'], ['pomodoros', 'Pomodoros']];
function renderZielArt(settings) {
  $('zielArten').innerHTML = ZIEL_ARTEN.map(([v, label]) => `<button data-v="${v}" class="${settings.zielArt === v ? 'aktiv' : ''}">${label}</button>`).join('');
  for (const b of $('zielArten').querySelectorAll('button')) b.onclick = run(async () => { const r = await api('PUT', 'settings', { zielArt: b.dataset.v }); current = r.settings; renderZielArt(r.settings); meldung('Gespeichert – schau ins Overlay'); });
}


// ---- Einstellungen: Ablauf, Töne, Tag und Zeit
const SCHEMA = [
  ['Ablauf', [
    ['focusMinutes', 'Dauer eines Pomodoros (Minuten)', 'number'], ['breakMinutes', 'Dauer der Pause (Minuten)', 'number'],
    ['repeats', 'Wiederholungen (Pomodoro + Pause)', 'number', '1 = ein Pomodoro, eine Pause, dann Schluss. Höher = der Ablauf wiederholt sich entsprechend oft.'],
    ['pomodoroGoal', 'Ziel pro Tag (Anzahl, 0 = ohne)', 'number'], ['announceSprint', 'Ansagen im Chat', 'bool'],
  ]],
  ['Töne', [
    ['soundAn', 'Töne an (aus = alles stumm)', 'bool', 'Hauptschalter: Ist er aus, bleibt das Overlay komplett still.'],
    ['soundStart', 'Ton, wenn ein Pomodoro beginnt', 'bool'], ['soundEnde', 'Ton, wenn ein Pomodoro zu Ende ist', 'bool'],
    ['soundLautstaerke', 'Lautstärke (0–100)', 'number'],
  ]],
  ['Tag und Zeit', [['timezone', 'Zeitzone', 'text'], ['dayRolloverHour', 'Neuer Stream-Tag ab (Uhr)', 'number', 'Streams nach Mitternacht zählen zum Vortag.']]],
];
async function loadSettings() {
  const { settings } = await api('GET', 'settings');
  current = settings;
  zeichne($('formular'), SCHEMA, {}, settings);
  fillZiele(settings); renderZielArt(settings);
  loadPages().catch(() => {}); loadStream().catch(() => {});
}
$('speichern').onclick = run(async () => { const { settings } = await api('PUT', 'settings', sammle($('formular'))); current = settings; zeichne($('formular'), SCHEMA, {}, settings); meldung('Gespeichert'); });

// ---- Eigene Töne: je eine Datei für „Pomodoro beginnt“ und „Pomodoro zu Ende“
const TON_ARTEN = [['start', 'Pomodoro beginnt'], ['ende', 'Pomodoro ist zu Ende']];
async function ladeToene() {
  const info = await fetch('/api/sound').then((r) => r.json());
  $('toene').innerHTML = TON_ARTEN.map(([art, label]) => {
    const d = info[art];
    return `<div class="tonzeile"><b>${label}</b><span class="leise">${d ? `Eigener Ton: ${esc(d.name)} (${Math.max(1, Math.round(d.groesse / 1024))} KB)` : 'Eingebauter Standardton'}</span>
      <div class="reihe"><input type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a" data-datei="${art}"><button data-hoch="${art}">Hochladen</button><button class="hell" data-test="${art}">🔔 Testen</button>${d ? `<button class="hell" data-weg="${art}">Entfernen</button>` : ''}</div></div>`;
  }).join('');
  for (const b of $('toene').querySelectorAll('[data-hoch]')) b.onclick = run(async () => {
    const art = b.dataset.hoch, f = $('toene').querySelector(`[data-datei="${art}"]`).files[0];
    if (!f) throw new Error('Bitte zuerst eine Audiodatei auswählen');
    if (f.size > 4 * 1024 * 1024) throw new Error('Die Datei ist zu groß (höchstens 4 MB). Kurze Töne von 1 bis 5 Sekunden reichen.');
    const res = await fetch(`/api/sound/${art}`, { method: 'PUT', headers: { 'content-type': f.type || 'application/octet-stream', 'x-dateiname': encodeURIComponent(f.name) }, body: f });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error ?? `Fehler ${res.status}`);
    meldung('Ton gespeichert'); await ladeToene();
  });
  for (const b of $('toene').querySelectorAll('[data-weg]')) b.onclick = run(async () => { await fetch(`/api/sound/${b.dataset.weg}`, { method: 'DELETE' }); meldung('Eigener Ton entfernt'); await ladeToene(); });
  for (const b of $('toene').querySelectorAll('[data-test]')) b.onclick = run(async () => { await api('POST', 'test/event', { kind: b.dataset.test === 'start' ? 'tonstart' : 'tonende' }); meldung('Gesendet – du hörst es im Overlay'); });
}

async function start() {
  await loadZustand(); // ohne Anmeldung bricht das hier ab und zeigt den Login
  show(true);
  await Promise.all([loadSettings(), loadTasks(), ladeToene()]);
}
initSeite(start);
