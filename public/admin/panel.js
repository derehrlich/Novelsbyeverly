// Stream-Panel: schlanke Seite für den Stream mit zwei Reitern: Pomodoro (Ablauf starten, anhalten, Längen, Wiederholungen, Töne)
// und Aufgaben (schnell hinzufügen und abhaken). Kann auch als OBS-Dock eingebunden werden.
import { $, api, esc, initSeite, meldung, run, show } from './common.js';

const FELDER = ['focusMinutes', 'breakMinutes', 'repeats', 'pomodoroGoal', 'soundLautstaerke'];
const KISTEN = ['soundAn', 'soundStart', 'soundEnde'];
const pad = (n) => String(n).padStart(2, '0');
let state = null, tippt = false;

function zeige() {
  const t = state?.timer;
  const laeuft = t && t.phase !== 'idle';
  const rest = !laeuft ? 0 : t.paused ? Math.ceil(t.paused.remaining / 1000) : Math.max(0, Math.ceil((t.endsAt - Date.now()) / 1000));
  $('zeit').textContent = laeuft ? `${pad(Math.floor(rest / 60))}:${pad(rest % 60)}` : '–';
  $('phase').textContent = !laeuft ? 'Bereit' : t.paused ? 'Angehalten' : t.phase === 'focus' ? 'Pomodoro läuft' : 'Pause';
  $('phase').className = `phase ${laeuft && !t.paused ? t.phase : ''}`;
  $('stand').textContent = laeuft && t.cycle ? `Durchgang ${t.cycle.index} von ${t.cycle.total}` : laeuft ? `Runde ${t.round}` : '';
  const bis = t?.paused ? t.paused.at : Date.now();
  $('balken').style.width = laeuft ? `${Math.min(100, ((bis - t.startedAt) / Math.max(1, t.endsAt - t.startedAt)) * 100)}%` : '0%';
  $('halt').textContent = t?.paused ? '▶ Weiter' : '⏸';
  $('halt').title = t?.paused ? 'Fortsetzen' : 'Anhalten';
  $('halt').disabled = !laeuft;
  $('geschafft').textContent = state?.pomodoro.done ?? 0; $('ziel').textContent = state?.pomodoro.goal || '–';
}
async function laden() { state = await api('GET', 'state'); zeige(); }

let merker;
function gespeichert(text) { $('gespeichert').textContent = text; clearTimeout(merker); merker = setTimeout(() => { $('gespeichert').textContent = ''; }, 2500); }
// Jedes Feld speichert nur sich selbst; die Antwort setzt nur dieses Feld auf den geprüften Wert (z. B. 999 → 180).
// So überschreibt ein Speichern nie, was du gerade in einem anderen Feld tippst.
async function speichern(id) {
  const wert = KISTEN.includes(id) ? $(id).checked : $(id).value === '' ? null : Number($(id).value);
  if (wert === null) { const { settings } = await api('GET', 'settings'); $(id).value = settings[id]; return; }
  const { settings } = await api('PUT', 'settings', { [id]: wert });
  if (KISTEN.includes(id)) $(id).checked = settings[id]; else $(id).value = settings[id];
  if (id === 'soundLautstaerke') $('lautWert').textContent = `${settings[id]} %`;
  gespeichert('✓ Gespeichert');
}
function fuellen(s) { for (const id of FELDER) $(id).value = s[id]; for (const id of KISTEN) $(id).checked = s[id]; $('lautWert').textContent = `${s.soundLautstaerke} %`; }
// Eingaben werden gespeichert, sobald du ein Feld verlässt oder Enter drückst
for (const id of [...FELDER, ...KISTEN]) {
  $(id).onchange = run(() => speichern(id));
  $(id).onfocus = () => { tippt = true; }; $(id).onblur = () => { tippt = false; };
  $(id).onkeydown = (e) => { if (e.key === 'Enter') e.target.blur(); };
}
$('soundLautstaerke').oninput = () => { $('lautWert').textContent = `${$('soundLautstaerke').value} %`; };

// Wer gerade ein Feld getippt hat und direkt auf Start drückt, soll den neuen Wert bekommen
const speichernFallsNoetig = async () => { if (tippt) { document.activeElement?.blur(); await new Promise((r) => setTimeout(r, 250)); } };
$('fokus').onclick = run(async () => { await speichernFallsNoetig(); await api('POST', 'timer/focus', {}); await laden(); });
$('halt').onclick = run(async () => { await api('POST', state?.timer?.paused ? 'timer/resume' : 'timer/hold'); await laden(); });
$('stopp').onclick = run(async () => { await api('POST', 'timer/stop'); await laden(); });
for (const [id, delta] of [['minus', -1], ['plus', 1]]) $(id).onclick = run(async () => { await api('POST', 'timer/count', { delta }); await laden(); });
$('tonStart').onclick = run(async () => { await api('POST', 'test/event', { kind: 'tonstart' }); meldung('Gesendet – du hörst es im Overlay'); });
$('tonEnde').onclick = run(async () => { await api('POST', 'test/event', { kind: 'tonende' }); meldung('Gesendet – du hörst es im Overlay'); });

// ---- Aufgaben: hinzufügen, abhaken, löschen
async function ladeAufgaben() {
  const { items } = await api('GET', 'tasks');
  const offen = items.filter((i) => !i.done).length;
  $('aufgabenZahl').hidden = !offen; $('aufgabenZahl').textContent = offen;
  $('aufgabenLeer').hidden = items.length > 0;
  $('aufgaben').innerHTML = items.map((i) => `<div class="aufgabe ${i.done ? 'fertig' : ''}">${i.done ? '<span class="leise haken">✓</span>' : `<button class="gruen haken" data-fertig="${i.id}" title="Erledigt">✓</button>`}<span class="text">${esc(i.text)}</span><button class="hell" data-weg="${i.id}" title="Löschen">🗑</button></div>`).join('');
  for (const b of $('aufgaben').querySelectorAll('[data-fertig]')) b.onclick = run(async () => { await api('POST', 'tasks/done', { id: b.dataset.fertig }); await ladeAufgaben(); });
  for (const b of $('aufgaben').querySelectorAll('[data-weg]')) b.onclick = run(async () => { await api('DELETE', `tasks/${b.dataset.weg}`); await ladeAufgaben(); });
}
const neueAufgabe = run(async () => {
  const text = $('neueAufgabe').value.trim();
  if (!text) return;
  await api('POST', 'tasks', { text }); $('neueAufgabe').value = ''; await ladeAufgaben(); $('neueAufgabe').focus();
});
$('aufgabeAdd').onclick = neueAufgabe;
$('neueAufgabe').onkeydown = (e) => { if (e.key === 'Enter') neueAufgabe(); };
$('neueAufgabe').onfocus = () => { tippt = true; }; $('neueAufgabe').onblur = () => { tippt = false; };
$('aufgabenAlle').onclick = run(async (e) => { e.preventDefault(); if (confirm('Die ganze Aufgabenliste leeren?')) { await api('DELETE', 'tasks/all'); await ladeAufgaben(); } });

// ---- Reiter (der zuletzt benutzte wird gemerkt)
function reiter(name) {
  for (const b of $('umschalter').querySelectorAll('button')) b.classList.toggle('aktiv', b.dataset.tab === name);
  $('tab-pomodoro').hidden = name !== 'pomodoro'; $('tab-aufgaben').hidden = name !== 'aufgaben';
  try { localStorage.setItem('panelReiter', name); } catch { /* ohne Merken */ }
  if (name === 'aufgaben') ladeAufgaben().catch(() => {});
}
for (const b of $('umschalter').querySelectorAll('button')) b.onclick = () => reiter(b.dataset.tab);

setInterval(zeige, 500);
setInterval(() => { if (!$('app').hidden && !tippt) { laden().catch(() => {}); ladeAufgaben().catch(() => {}); } }, 3000);

async function start() {
  await api('GET', 'state'); show(true);
  const { settings } = await api('GET', 'settings');
  fuellen(settings); await laden(); await ladeAufgaben();
  let r = 'pomodoro'; try { r = localStorage.getItem('panelReiter') ?? 'pomodoro'; } catch { /* Standard */ }
  reiter(r === 'aufgaben' ? 'aufgaben' : 'pomodoro');
}
initSeite(start);
