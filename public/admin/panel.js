// Stream-Panel: schlanke Seite für den Stream (Pomodoro starten, Längen und Ziel einstellen). Kann auch als OBS-Dock eingebunden werden.
import { $, api, initSeite, meldung, run, show } from './common.js';

const FELDER = ['focusMinutes', 'breakMinutes', 'longBreakMinutes', 'longBreakEvery', 'pomodoroGoal'];
const KISTEN = ['autoBreak', 'autoCycle'];
const pad = (n) => String(n).padStart(2, '0');
let state = null, tippt = false;

function zeige() {
  const t = state?.timer;
  const läuft = t && t.phase !== 'idle';
  const rest = läuft ? Math.max(0, Math.ceil((t.endsAt - Date.now()) / 1000)) : 0;
  $('zeit').textContent = läuft ? `${pad(Math.floor(rest / 60))}:${pad(rest % 60)}` : '–';
  $('phase').textContent = !läuft ? 'Bereit' : t.phase === 'focus' ? 'Pomodoro läuft' : 'Pause';
  $('phase').className = `phase ${läuft ? t.phase : ''}`;
  $('stand').textContent = läuft && t.phase === 'focus' ? `Runde ${t.round}` : '';
  $('balken').style.width = läuft ? `${Math.min(100, 100 - (rest / Math.max(1, (t.endsAt - t.startedAt) / 1000)) * 100)}%` : '0%';
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
  gespeichert('✓ Gespeichert');
}
function fuellen(s) { for (const id of FELDER) $(id).value = s[id]; for (const id of KISTEN) $(id).checked = s[id]; }
// Eingaben werden gespeichert, sobald du ein Feld verlässt oder Enter drückst
for (const id of [...FELDER, ...KISTEN]) {
  $(id).onchange = run(() => speichern(id));
  $(id).onfocus = () => { tippt = true; }; $(id).onblur = () => { tippt = false; };
  $(id).onkeydown = (e) => { if (e.key === 'Enter') e.target.blur(); };
}

const minuten = () => ($('einmal').value ? Number($('einmal').value) : undefined);
$('fokus').onclick = run(async () => { await speichernFallsNoetig(); await api('POST', 'timer/focus', { minutes: minuten() }); $('einmal').value = ''; await laden(); });
$('pause').onclick = run(async () => { await speichernFallsNoetig(); await api('POST', 'timer/break', { minutes: minuten() }); $('einmal').value = ''; await laden(); });
$('stopp').onclick = run(async () => { await api('POST', 'timer/stop'); await laden(); });
for (const [id, delta] of [['minus', -1], ['plus', 1]]) $(id).onclick = run(async () => { await api('POST', 'timer/count', { delta }); await laden(); });
// Wer gerade ein Feld getippt hat und direkt auf Start drückt, soll den neuen Wert bekommen
const speichernFallsNoetig = async () => { if (tippt) { document.activeElement?.blur(); await new Promise((r) => setTimeout(r, 150)); } };

setInterval(zeige, 500);
setInterval(() => { if (!$('app').hidden && !tippt) laden().catch(() => {}); }, 3000);

async function start() {
  await api('GET', 'state'); show(true);
  const { settings } = await api('GET', 'settings');
  fuellen(settings); await laden();
}
initSeite(start);
