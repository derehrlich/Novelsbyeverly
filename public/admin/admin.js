import { ITEMS, SLOTS, SZENEN, slotValues } from '../js/katalog.mjs';
import { DEFAULT_LAYOUT, normalizeLayout } from '../js/layout.mjs';
import { initNav, PAGES, PREVIEW_PAGES, setHiddenPages, showPage } from './nav.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

async function api(method, path, body) {
  const res = await fetch(`/api/admin/${path}`, { method, headers: body ? { 'content-type': 'application/json' } : (method === 'GET' ? {} : { 'content-type': 'application/json' }), body: body ? JSON.stringify(body) : (method === 'GET' ? undefined : '{}') });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== 'login') { show(false); throw new Error('Nicht angemeldet'); }
  if (!res.ok) throw new Error(data.error ?? `Fehler ${res.status}`);
  return data;
}
let toastTimer;
function meldung(text, fehler = false) {
  const el = $('meldung');
  el.textContent = text; el.className = `meldung${fehler ? ' fehler' : ''}`; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, fehler ? 7000 : 3000);
}
const run = (fn) => async (...a) => { try { await fn(...a); } catch (e) { meldung(e.message, true); } };
function show(app) { $('app').hidden = !app; $('login').hidden = app; document.querySelector('.login-seite').hidden = app; }

// ---- Übersicht: „Das wartet auf dich“ und „Läuft gerade“
const live = { pages: null, stream: null };
function collectTodos() {
  const st = state; const out = [];
  if (!st) return out;
  const e = st.env;
  const missing = ['TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET', 'EVENTSUB_SECRET'].filter((k) => !e[k]);
  if (missing.length) out.push({ cls: 'fehler', text: `In der App (CasaOS) fehlen noch Werte: ${missing.join(', ')}`, go: 'einrichtung', knopf: 'Zur Einrichtung' });
  else if (!st.connectedAs) out.push({ cls: 'fehler', text: 'Twitch ist noch nicht mit dem Kanal verbunden.', go: 'einrichtung', knopf: 'Jetzt verbinden' });
  if (st.connectedAs && st.missingScopes.length) out.push({ cls: 'warn', text: `Dem Kanal fehlen Twitch-Berechtigungen (${st.missingScopes.join(', ')}). Bitte neu verbinden.`, go: 'einrichtung', knopf: 'Neu verbinden' });
  if (st.connectedAs && !st.botAs) out.push({ cls: 'warn', text: 'Kein Bot-Account verbunden: Der Bot schreibt dann unter dem Kanalnamen.', go: 'einrichtung', knopf: 'Bot verbinden' });
  if (st.revoked) out.push({ cls: 'fehler', text: `Twitch hat ein Abo widerrufen (${st.revoked}). Bitte abgleichen.`, go: 'einrichtung', knopf: 'Abgleichen' });
  else if (st.connectedAs && st.subscription && st.subscription !== 'enabled') out.push({ cls: 'warn', text: `Die Twitch-Webhooks sind nicht aktiv (${st.subscription}).`, go: 'einrichtung', knopf: 'Abgleichen' });
  if (st.connectedAs && !st.features.checkin && !st.features.points) out.push({ cls: 'info', text: 'Tipp: Check-in, Streak und Punkte sind noch ausgeschaltet.', go: 'checkin', knopf: 'Ansehen' });
  return out;
}
function renderDashboard() {
  if (!$('todos')) return;
  const todos = collectTodos();
  $('todos').innerHTML = todos.length
    ? `<section class="karte"><h2>Das wartet auf dich</h2>${todos.map((t, i) => `<div class="todo ${t.cls}"><span class="punkt ${t.cls === 'info' ? '' : t.cls}"></span><span class="todotext">${esc(t.text)}</span><button class="hell" data-nav="${t.go}">${esc(t.knopf)}</button></div>`).join('')}</section>`
    : '<section class="karte alles-gut"><h2>Alles in Ordnung ✅</h2><p class="leise">Twitch ist verbunden und die Webhooks laufen.</p></section>';
  const st = state; if (!st) return;
  const tiles = [
    ['pomodoro', '🍅', 'Timer', `<b id="liveTimer">bereit</b><small></small>`],
    ['pomodoro', '✅', 'Pomodoros heute', `<b>${st.pomodoro.done}${st.pomodoro.goal ? ` / ${st.pomodoro.goal}` : ''}</b><small>${st.pomodoro.goal ? 'Ziel für heute' : 'ohne Ziel'}</small>`],
    ['ziel', '✍️', 'Wörter heute', `<b>${fmtN(st.words.today)}${st.words.goal ? ` / ${fmtN(st.words.goal)}` : ''}</b><small>Tagesziel</small>`],
  ];
  if (live.pages) tiles.push(['ziel', '📖', 'Seiten heute', `<b>${fmtN(live.pages.today)}${live.pages.goal ? ` / ${fmtN(live.pages.goal)}` : ''}</b><small>Seitenziel</small>`]);
  if (live.stream) tiles.push(['ziel', '🕒', 'Streamzeit', `<b>${live.stream.startedAt ? `${live.stream.text} Std` : '–'}</b><small>${live.stream.startedAt ? (live.stream.quelle === 'twitch' ? 'von Twitch erkannt' : 'von Hand gestartet') : 'nicht gestartet'}</small>`]);
  if (st.features.checkin) tiles.push(['checkin', '🔥', 'Check-ins heute', `<b>${st.checkinsToday}</b><small>Besuche in diesem Stream</small>`]);
  if (st.modus === 'zimmer') tiles.push(['mitschreibende', '🪑', 'Am Tisch', `<b>${st.seated}</b><small>${st.communityHours} Std gemeinsam</small>`]);
  $('live').innerHTML = tiles.map(([page, icon, titel, inner]) => `<a class="kachel" href="#${page}" data-nav="${page}"><span class="ki">${icon}</span><span class="kt">${esc(titel)}</span>${inner}</a>`).join('');
  renderTimer();
  $('schnell').innerHTML = PAGES.filter((p) => p[0] !== 'start').map(([k, icon, label]) => `<a class="chip" href="#${k}" data-nav="${k}">${icon} ${esc(label)}</a>`).join('');
}

// ---- Anmeldung
$('anmelden').onclick = run(async () => { await api('POST', 'login', { password: $('passwort').value }); $('passwort').value = ''; await start(); });
$('passwort').onkeydown = (e) => { if (e.key === 'Enter') $('anmelden').click(); };
$('abmelden').onclick = run(async () => { await api('POST', 'logout'); show(false); });

// ---- Status
let state = null;
const punkt = (cls, text) => `<li><span class="punkt ${cls}"></span>${text}</li>`;
async function loadState() {
  state = await api('GET', 'state');
  const e = state.env;
  const envOk = e.TWITCH_CLIENT_ID && e.TWITCH_CLIENT_SECRET && e.EVENTSUB_SECRET;
  const rows = [
    envOk ? punkt('ok', 'Umgebungsvariablen gesetzt') : punkt('fehler', `In der Umgebung (Docker-App bzw. Netlify) fehlen: ${['TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET', 'EVENTSUB_SECRET'].filter((k) => !e[k]).join(', ')}`),
    state.connectedAs ? punkt(state.missingScopes.length ? 'warn' : 'ok', `Kanal verbunden als <b>${esc(state.connectedAs)}</b>${state.missingScopes.length ? ` – Berechtigungen fehlen (${esc(state.missingScopes.join(', '))}), bitte neu verbinden` : ''}`) : punkt('fehler', 'Kanal nicht verbunden'),
    state.botAs ? punkt(state.botMissingScopes.length ? 'warn' : 'ok', `Bot-Account verbunden als <b>${esc(state.botAs)}</b>${state.botMissingScopes.length ? ' – Berechtigungen fehlen, bitte neu verbinden' : ''}`) : punkt('warn', 'Kein Bot-Account verbunden – der Bot schreibt dann unter dem Kanalnamen'),
    state.subscription === 'enabled' ? punkt('ok', 'Chat-Webhook aktiv') : punkt(state.subscription ? 'warn' : 'fehler', `Webhooks: ${esc(state.subscriptionError ?? state.subscription ?? 'noch nicht eingerichtet')}`),
    state.revoked ? punkt('fehler', `Twitch hat ein Abo widerrufen (${esc(state.revoked)}) – bitte abgleichen`) : '',
  ];
  $('status').innerHTML = rows.join('');
  const u = state.urls;
  const urlRow = (label, url, hint = '') => `<div class="url"><b>${label}</b> <code>${esc(url)}</code><button class="hell" data-copy="${esc(url)}">Kopieren</button></div>${hint ? `<div class="leise">${hint}</div>` : ''}`;
  $('urls').innerHTML = urlRow('OBS-Overlay', u.overlay, 'Browser-Quelle 1920×1080, „Audio über OBS steuern“ aktivieren. Die Kamera in OBS <b>unter</b> das Overlay legen. Nur einzelne Teile: <code>?teile=uhr,woerter,tasks,musik,szene</code>')
    + urlRow('Rangliste', u.rangliste, 'Öffentliche Seite, z. B. als Link im Panel. Als Overlay in OBS: <code>?overlay</code> anhängen (durchsichtig, ohne Kopf).')
    + urlRow('Twitch-Weiterleitung', u.redirect, 'Diese Adresse muss in der Twitch-Entwickler-App als „OAuth Redirect URL“ stehen.')
    + urlRow('OBS-Dock Alles in einem', u.dockAlles, 'Ein einziges Dock mit Reitern oben: Pomodoro, Aufgaben, Design.')
    + urlRow('OBS-Dock Pomodoro', u.dockPomodoro, 'In OBS: Docks → Benutzerdefinierte Browser-Docks. Klein und schmal, mit Timer, Zähler, Wörtern und den Pomodoro-Einstellungen. Anleitung: <code>docs/obs-docks.md</code>.')
    + urlRow('OBS-Dock Aufgaben', u.dockAufgaben)
    + urlRow('OBS-Dock Design', u.dockDesign, 'Hintergrund, Wetter, Tageszeit, Kartenstil und Kamera-Rahmen per Klick umstellen.')
    + urlRow('Wörter-Schnittstelle', u.words, `Für ein Hilfsprogramm (Papyrus): <code>POST</code> mit <code>Authorization: Bearer &lt;INGEST_TOKEN&gt;</code> und <code>{"absolute": 4231}</code>. ${e.INGEST_TOKEN ? 'INGEST_TOKEN ist gesetzt.' : 'INGEST_TOKEN ist noch nicht gesetzt.'}`);
  for (const b of document.querySelectorAll('[data-copy]')) b.onclick = () => navigator.clipboard.writeText(b.dataset.copy).then(() => meldung('Kopiert'));
  renderTimer();
  renderWords(state.words);
  $('plaetze').textContent = `${state.seated} sitzen · Zimmer: ${state.communityHours} Std gemeinsame Arbeitszeit`;
  $('plaetze').hidden = state.modus !== 'zimmer'; $('zimmerKnoepfe').hidden = state.modus !== 'zimmer';
  $('pomoHeute').textContent = state.pomodoro.done; $('pomoZiel').textContent = state.pomodoro.goal || '–';
  renderDashboard();
}
$('abgleich').onclick = run(async () => {
  const r = await api('POST', 'setup');
  meldung(r.warnings?.length ? `Eingerichtet, aber: ${r.warnings.join(' · ')}` : `Eingerichtet${r.reward ? ` (Reward „${r.reward}“)` : ''}`, Boolean(r.warnings?.length));
  await loadState();
});

// ---- Timer
const pad = (n) => String(n).padStart(2, '0');
function renderTimer() {
  const t = state?.timer;
  const tile = (a, b) => { const el = $('liveTimer'); if (el) { el.textContent = a; el.nextElementSibling.textContent = b; } };
  if (!t || t.phase === 'idle') { $('timer').textContent = 'bereit'; $('timerInfo').textContent = ''; tile('bereit', 'Kein Timer läuft'); return; }
  const s = Math.max(0, Math.ceil((t.endsAt - Date.now()) / 1000));
  $('timer').textContent = `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
  $('timerInfo').textContent = t.phase === 'focus' ? 'Pomodoro läuft' : 'Pause';
  tile($('timer').textContent, $('timerInfo').textContent);
}
setInterval(renderTimer, 500);
setInterval(() => { if (!$('app').hidden) { loadState().catch(() => {}); loadStream().catch(() => {}); } }, 15000);
const minutes = () => ($('minuten').value ? Number($('minuten').value) : undefined);
$('fokus').onclick = run(async () => { await api('POST', 'timer/focus', { minutes: minutes() }); await loadState(); });
$('pause').onclick = run(async () => { await api('POST', 'timer/break', { minutes: minutes() }); await loadState(); });
$('stopp').onclick = run(async () => { await api('POST', 'timer/stop'); await loadState(); });
for (const [id, delta] of [['pomoMinus', -1], ['pomoPlus', 1]]) $(id).onclick = run(async () => { await api('POST', 'timer/count', { delta }); await loadState(); });

// ---- Landschaft (Jahreszeit, Tageszeit, Quelle) und Szene
const AUSWAHL = {
  jahreszeiten: ['jahreszeit', [['auto', 'Auto'], ['fruehling', 'Frühling'], ['sommer', 'Sommer'], ['herbst', 'Herbst'], ['winter', 'Winter']]],
  tageszeiten: ['tageszeit', [['auto', 'Auto'], ['morgen', 'Morgen'], ['mittag', 'Mittag'], ['abend', 'Abend'], ['nacht', 'Nacht']]],
  dSzene: ['hintergrund', [['landschaft', 'Landschaft mit Pavillon'], ['jahreszeiten', 'Jahreszeiten-Landschaft'], ['bild', 'Eigenes Bild'], ['zug', 'Zugabteil'], ['sitzecke', 'Sitzecke am Fenster'], ['stadt', 'Stadt'], ['see', 'See und Weitblick']]],
  dTageszeit: ['tageszeit', [['auto', 'Auto'], ['morgen', 'Morgen'], ['mittag', 'Mittag'], ['abend', 'Abend'], ['nacht', 'Nacht']]],
  dJahreszeit: ['jahreszeit', [['auto', 'Auto'], ['fruehling', 'Frühling'], ['sommer', 'Sommer'], ['herbst', 'Herbst'], ['winter', 'Winter']]],
  dWetter: ['wetter', [['klar', 'Klar'], ['wolkig', 'Wolkig'], ['regen', 'Regen'], ['gewitter', 'Gewitter'], ['schnee', 'Schnee'], ['nebel', 'Nebel']]],
  quellen: ['wachstumQuelle', [['ziel', 'Ziel-Karte'], ['zeit', 'Streamzeit'], ['woerter', 'Wörter'], ['pomodoro', 'Pomodoros'], ['kombi', 'Zeit + Ziel']]],
  zielArten: ['zielArt', [['woerter', 'Wörter schreiben'], ['seiten', 'Seiten lesen'], ['zeit', 'Streamzeit'], ['pomodoros', 'Pomodoros']]],
  tat: ['stefanieTaetigkeit', [['auto', 'Automatisch'], ['laptop', 'Am Laptop'], ['buch', 'Mit Buch']]],
};
function renderScenes(settings) {
  for (const [boxId, [key, opts]] of Object.entries(AUSWAHL)) {
    $(boxId).innerHTML = opts.map(([v, label]) => `<button data-v="${v}" class="${settings[key] === v ? 'aktiv' : ''}">${label}</button>`).join('');
    for (const b of $(boxId).querySelectorAll('button')) b.onclick = run(async () => { const r = await api('PUT', 'settings', { [key]: b.dataset.v }); current = r.settings; renderScenes(r.settings); renderFolds(r.settings); schedulePreview(0); meldung('Gespeichert'); });
  }
}

// ---- Wörter
function renderWords(w) { $('woerterHeute').textContent = new Intl.NumberFormat('de-DE').format(w.today); $('woerterZiel').textContent = new Intl.NumberFormat('de-DE').format(w.goal); }
const sendWords = (mode) => run(async () => { const v = $('woerterWert').value; if (mode !== 'reset' && v === '') throw new Error('Bitte eine Zahl eingeben'); renderWords(await api('POST', 'words', { mode, value: v })); $('woerterWert').value = ''; });
$('wAbs').onclick = sendWords('absolute'); $('wDelta').onclick = sendWords('delta'); $('wToday').onclick = sendWords('today'); $('wReset').onclick = sendWords('reset');

// ---- Ziele, Seiten, Streamzeit
const fmtN = (n) => new Intl.NumberFormat('de-DE').format(n);
function fillZiele(settings) {
  $('zielWoerter').value = settings.wordGoal; $('zielSeiten').value = settings.seitenGoal; $('zielStunden').value = settings.streamGoalMinutes / 60;
}
$('zieleSpeichern').onclick = run(async () => {
  const r = await api('PUT', 'settings', { wordGoal: Number($('zielWoerter').value), seitenGoal: Number($('zielSeiten').value), streamGoalMinutes: Math.round(Number($('zielStunden').value) * 60) });
  current = r.settings; fillZiele(r.settings); meldung('Ziele gespeichert'); await loadState();
});
async function loadPages() { const p = await api('GET', 'pages'); live.pages = p; renderDashboard(); $('seitenHeute').textContent = fmtN(p.today); $('seitenZiel').textContent = fmtN(p.goal); }
const sendPages = (mode) => run(async () => { const v = $('seitenWert').value; if (v === '') throw new Error('Bitte eine Zahl eingeben'); await api('POST', 'pages', { mode, value: v }); $('seitenWert').value = ''; await loadPages(); });
$('sSet').onclick = sendPages('set'); $('sPlus').onclick = sendPages('delta');
async function loadStream() {
  const s = await api('GET', 'stream'); live.stream = s; renderDashboard();
  $('streamText').textContent = s.startedAt ? `${s.text} Std von ${Math.floor(s.goalMinutes / 60)}:${String(s.goalMinutes % 60).padStart(2, '0')} (${s.quelle === 'twitch' ? 'von Twitch erkannt' : 'von Hand gestartet'})` : 'nicht gestartet';
}
$('streamStart').onclick = run(async () => { await api('POST', 'stream/start'); await loadStream(); });
$('streamStop').onclick = run(async () => { await api('POST', 'stream/stop'); await loadStream(); });

// ---- Stefanie im Pavillon
const STEFANIE_SLOTS = ['haut', 'haare', 'frisur', 'oberteil', 'kopf', 'gesicht', 'hals', 'tier', 'tisch', 'getraenk'];
const SLOT_NAMEN = { tisch: 'Schreibgerät (am Laptop)' };
const optionText = (slot, v) => ITEMS.find((i) => i.id === v && i.slot === slot)?.label ?? v;
function fillStefanie(settings) {
  const f = settings.stefanieFigur;
  $('stefanieFelder').innerHTML = STEFANIE_SLOTS.map((slot) => `<div class="feld"><label>${esc(SLOT_NAMEN[slot] ?? SLOTS[slot].label)}</label><select data-slot="${slot}">${slotValues(slot).map((v) => `<option value="${v}" ${f[slot] === v ? 'selected' : ''}>${esc(optionText(slot, v))}</option>`).join('')}</select></div>`).join('');
}
$('stefanieSpeichern').onclick = run(async () => {
  const figur = {};
  for (const el of $('stefanieFelder').querySelectorAll('[data-slot]')) figur[el.dataset.slot] = el.value;
  const r = await api('PUT', 'settings', { stefanieFigur: figur }); current = r.settings; fillStefanie(r.settings); meldung('Gespeichert – schau ins Overlay');
});

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
$('alleAufstehen').onclick = run(async () => { await api('DELETE', 'seats'); await loadState(); });

// ---- Einstellungen
const OPT = {
  szeneModus: [['wachstum', 'Landschaft (wächst mit dem Fortschritt)'], ['zimmer', 'Zimmer mit Tischen und Figuren der Zuschauer (pausiert)']],
  jahreszeit: [['auto', 'Automatisch (nach Datum)'], ['fruehling', 'Frühling'], ['sommer', 'Sommer'], ['herbst', 'Herbst'], ['winter', 'Winter']],
  stefanieTaetigkeit: [['auto', 'Automatisch (Laptop beim Fokus, Buch in der Pause)'], ['laptop', 'Immer am Laptop'], ['buch', 'Immer mit Buch']],
  tageszeit: [['auto', 'Automatisch (nach Uhrzeit)'], ['morgen', 'Morgengrauen'], ['mittag', 'Mittag'], ['abend', 'Abend'], ['nacht', 'Nacht (nur in den Szenen, in der Landschaft wie Abend)']],
  wetter: [['klar', 'Klar'], ['wolkig', 'Wolkig'], ['regen', 'Regen'], ['gewitter', 'Gewitter'], ['schnee', 'Schnee'], ['nebel', 'Nebel']],
  wachstumQuelle: [['ziel', 'Ziel-Karte'], ['zeit', 'Streamzeit'], ['woerter', 'Wörter des Tages'], ['pomodoro', 'Pomodoros des Tages'], ['kombi', 'Mittel aus Zeit und Ziel']],
  appearOn: [['sit', 'Per Chatbefehl !sitzen'], ['checkin', 'Per Kanalpunkte-Reward „Check-in“'], ['both', 'Beides']],
  kameraRahmen: [['holz', 'Holz mit Blättern (wie in der Landschaft)'], ['papier', 'Papier (cremefarben)'], ['glas', 'Glas (hell durchscheinend)'], ['keiner', 'Kein Rahmen (nur der Ausschnitt)']],
  kartenStil: [['papier', 'Papier (warme Karten, wie bisher)'], ['glas', 'Glas (durchsichtig und getönt)']],
  hintergrund: [['landschaft', 'Gemalte Landschaft mit Pavillon'], ['jahreszeiten', 'Jahreszeiten-Landschaft (Bilder von dir)'], ['bild', 'Eigenes Bild (Upload unten)'], ['zug', 'Zugabteil'], ['sitzecke', 'Sitzecke am Fenster'], ['stadt', 'Stadt'], ['see', 'See und Weitblick']],
  scene: Object.entries(SZENEN).map(([k, v]) => [k, v.label]),
};
const SCHEMA = [
  ['Darstellung', [
    ['szeneModus', 'Darstellung', 'select', 'Die Tische mit Figuren der Zuschauer sind pausiert und lassen sich hier wieder einschalten.'],
    ['jahreszeit', 'Jahreszeit', 'select'], ['tageszeit', 'Tageszeit', 'select'], ['wachstumQuelle', 'Landschaft wächst mit', 'select'], ['pavillonZeigen', 'Pavillon mit Stefanie zeigen', 'bool', 'Aus: die gemalte Landschaft hat keinen Pavillon und keine sitzende Stefanie. Der Pavillon ist nur ausgeblendet, nicht gelöscht.'], ['stefanieTaetigkeit', 'Stefanie im Pavillon', 'select'],
  ]],
  ['Pomodoro', [
    ['focusMinutes', 'Dauer eines Pomodoros (Minuten)', 'number'], ['breakMinutes', 'Kurze Pause (Minuten)', 'number'],
    ['longBreakMinutes', 'Lange Pause (Minuten)', 'number'], ['longBreakEvery', 'Lange Pause nach … Pomodoros (0 = nie)', 'number'],
    ['pomodoroGoal', 'Ziel pro Tag (Anzahl, 0 = ohne)', 'number'],
    ['autoBreak', 'Nach dem Pomodoro automatisch Pause', 'bool'], ['autoCycle', 'Nach der Pause automatisch nächster Pomodoro', 'bool'],
    ['announceSprint', 'Ansagen im Chat', 'bool'],
  ]],
  ['Module im Overlay', [
    ['moduleBlume', 'Blume wächst mit den Wörtern', 'bool', 'Vom Keimling bis zur Blüte, wenn das Tagesziel erreicht ist.'],
    ['moduleKerze', 'Kerze brennt mit dem Pomodoro', 'bool', 'Brennt während des Fokus herunter, in der Pause raucht sie, danach steht eine neue bereit.'],
    ['moduleBuecher', 'Bücherstapel wächst mit den Pomodoros', 'bool', 'Pro geschafftem Pomodoro kommt ein Buch dazu (bis 8).'],
    ['moduleDeko', 'Zimmer wächst mit der gemeinsamen Arbeitszeit', 'bool', 'Nur im Zimmer-Modus.'],
  ]],
  ['Tag und Zeit', [['timezone', 'Zeitzone', 'text'], ['dayRolloverHour', 'Neuer Stream-Tag ab (Uhr)', 'number', 'Streams nach Mitternacht zählen zum Vortag.']]],
  ['Chat', [
    ['chatCommands', 'Bot versteht Befehle', 'bool'], ['chatEnabled', 'Bot darf schreiben', 'bool'],
    ['commandPrefix', 'Befehlszeichen', 'text'], ['commandCooldown', 'Pause zwischen Info-Antworten (Sek.)', 'number'], ['maxTasks', 'Offene Aufgaben je Person', 'number'],
  ]],
  ['Chat-Texte', [
    ['sprintStartTemplate', 'Pomodoro-Start', 'area', '{minutes}'], ['breakTemplate', 'Kurze Pause', 'area', '{minutes}'], ['longBreakTemplate', 'Lange Pause', 'area', '{minutes} {n}'],
    ['sprintEndTemplate', 'Pomodoro geschafft', 'area', '{n} {ziel} {streamer}'], ['goalTemplate', 'Tagesziel erreicht', 'area', '{words}'],
  ]],
  ['Alerts', [
    ['alertsEnabled', 'Alerts aktivieren (Follow, Abo, Geschenk, Bits)', 'bool', 'Im Overlay klappt ein Buch auf und zeigt das Ereignis. Nach dem Einschalten wird automatisch bei Twitch angemeldet. Beim ersten Mal einmal unter „Einrichtung“ den Kanal neu verbinden, damit Twitch die neuen Berechtigungen erteilt.'],
    ['alertFollow', 'Neue Follower zeigen', 'bool'], ['alertSub', 'Abos und Abo-Jubiläen zeigen', 'bool'], ['alertGift', 'Verschenkte Abos zeigen', 'bool'], ['alertCheer', 'Bits zeigen', 'bool'],
    ['alertCheerMin', 'Bits erst ab dieser Menge zeigen', 'number'], ['alertSeconds', 'So lange bleibt das Buch offen (Sekunden)', 'number'],
    ['alertSoundVolume', 'Lautstärke der eigenen Töne (0 bis 100)', 'number'],
    ['alertChat', 'Danke im Chat schreiben (auch bei Raids)', 'bool', 'Der Bot antwortet im Chat. Braucht, dass der Chat-Bot verbunden ist.'],
  ]],
  ['Raids', [
    ['raidEnabled', 'Raids aktivieren', 'bool', 'Wenn jemand mit seiner Community zu dir raidet, klappt das Buch auf: mit Namen, Anzahl, zuletzt gespieltem Spiel und Profilbild.'],
    ['raidMinViewers', 'Raids erst ab dieser Zuschauerzahl zeigen', 'number'], ['raidSeconds', 'So lange bleibt das Buch bei einem Raid offen (Sekunden)', 'number'],
  ]],
  ['Alert-Texte (im Buch)', [
    ['followTitle', 'Follow: Überschrift', 'text', '{user}'], ['followMessage', 'Follow: Text', 'text', '{user}'],
    ['subTitle', 'Abo: Überschrift', 'text', '{user} {tier}'], ['subMessage', 'Abo: Text', 'text', '{user} {tier}'],
    ['resubTitle', 'Abo-Jubiläum: Überschrift', 'text', '{user} {tier} {months}'], ['resubMessage', 'Abo-Jubiläum: Text', 'text', '{user} {tier} {months}'],
    ['giftTitle', 'Geschenk: Überschrift', 'text', '{user} {tier} {total}'], ['giftMessage', 'Geschenk: Text', 'text', '{user} {tier} {total}'],
    ['cheerTitle', 'Bits: Überschrift', 'text', '{user} {bits}'], ['cheerMessage', 'Bits: Text', 'text', '{user} {bits}'],
    ['raidTitle', 'Raid: Überschrift', 'text', '{raider} {viewers} {raids} {visit} {game}'], ['raidMessage', 'Raid: Text', 'text', '{raider} {viewers} {raids} {visit} {game}'],
  ]],
  ['Alert-Chattexte', [
    ['followTemplate', 'Danke für den Follow', 'area', '{user}'], ['subTemplate', 'Danke für das Abo', 'area', '{user} {tier} {months}'],
    ['giftTemplate', 'Danke für verschenkte Abos', 'area', '{user} {tier} {total}'], ['cheerTemplate', 'Danke für Bits', 'area', '{user} {bits}'],
    ['raidTemplate', 'Willkommen, Raid', 'area', '{raider} {viewers} {raids} {visit} {game} {url}'],
  ]],
  ['Stream-Pause', [
    ['pauseEnabled', 'Stream-Pause einschalten (Chat-Befehle !auszeit und !zurueck)', 'bool', 'Nur Moderation und Streamerin dürfen die Befehle benutzen. Der Bot muss Befehle verstehen (Chat und Befehle).'],
    ['pauseDefaultText', 'Standardtext, wenn nach dem Befehl nichts steht', 'text'], ['pauseSubtitle', 'Zeile unter dem Pausentext', 'text'],
    ['pauseChat', 'Im Chat ankündigen', 'bool'],
    ['pauseStartTemplate', 'Chatnachricht beim Start', 'area', '{text} {minutes}'], ['pauseEndTemplate', 'Chatnachricht beim Ende', 'area'],
  ]],
  ['Alert-Video', [
    ['alertVideoAn', 'Das hochgeladene Video statt des gezeichneten Buchs zeigen', 'bool', 'Gilt nur, wenn oben ein Video hochgeladen ist. Ohne Video oder bei einem Fehler kommt das gezeichnete Buch.'],
    ['alertVideoKey', 'Magenta im Video durchsichtig machen', 'bool', 'Das Video hat einen einfarbig magentafarbenen Hintergrund (#FF00FF). Er wird ausgeschnitten, sodass nur das Buch zu sehen ist.'],
    ['alertVideoB', 'Breite auf dem Bildschirm (%)', 'number'], ['alertVideoY', 'Höhe der Mitte auf dem Bildschirm (%)', 'number'],
    ['alertVideoTX', 'Textfeld: von links (% des Videos)', 'number'], ['alertVideoTY', 'Textfeld: von oben (% des Videos)', 'number'],
    ['alertVideoTB', 'Textfeld: Breite (% des Videos)', 'number'], ['alertVideoTH', 'Textfeld: Höhe (% des Videos)', 'number'],
    ['alertVideoVon', 'Text erscheint ab (% der Videolänge)', 'number'], ['alertVideoBis', 'Text verschwindet bei (% der Videolänge)', 'number'],
    ['alertVideoLinks', 'Auch die linke Seite beschriften (Symbol, Art, Zahl)', 'bool', 'Links erscheinen zum Beispiel das Symbol und die Zahl (Bits, Monate, Zuschauer bei Raids), rechts der Text. Bei Raids steht links das Profilbild.'],
    ['alertVideoEnde', 'Alert endet bei (% der Videolänge)', 'number', 'Hat das Video am Ende noch eine ruhige Strecke mit geschlossenem Buch, endet der Alert hier früher. 100 = ganzes Video.'],
    ['alertVideoSchrift', 'Schriftgröße (%)', 'number'],
  ]],
  ['Eigene Befehle', [
    ['customCommandsEnabled', 'Eigene Befehle, Stichwörter und Erinnerungen einschalten', 'bool', 'Der Bot muss im Chat schreiben dürfen (Chat und Befehle). Beim Speichern wird bei Twitch automatisch angemeldet.'],
  ]],
  ['Zitate', [
    ['quoteEnabled', 'Zitate einschalten (!zitat, !addzitat, !delzitat)', 'bool', 'Hinzufügen und Löschen dürfen nur Moderation und Streamerin.'],
    ['quoteTemplate', 'Zitat im Chat', 'area', '{n} {text} {by} {date}'], ['quoteNoneTemplate', 'Wenn es kein Zitat gibt', 'area', '{user}'], ['quoteAddedTemplate', 'Wenn ein Zitat gespeichert wurde', 'area', '{n} {user}'],
  ]],
  ['Shoutout', [
    ['soEnabled', 'Shoutout einschalten (!so name)', 'bool', 'Nur Moderation und Streamerin. Der Bot schreibt eine Nachricht mit Link und zuletzt gespieltem Spiel (kein offizieller Twitch-Shoutout).'],
    ['soTemplate', 'Shoutout im Chat', 'area', '{name} {game} {url}'],
  ]],
  ['Streak-Retter', [
    ['streakRescueEnabled', 'Streak-Retter aktivieren (zweiter Kanalpunkte-Reward)', 'bool', 'Wer ein paar Streams verpasst hat, kann seine Besuchsserie mit Kanalpunkten retten. Braucht eingeschalteten Check-in. Der Reward wird beim Speichern automatisch bei Twitch angelegt.'],
    ['streakRewardTitle', 'Reward-Name', 'text'], ['streakRewardCost', 'Preis (Kanalpunkte)', 'number'], ['rescueMaxDays', 'Rettet höchstens so viele verpasste Streams', 'number', 'Eine Lücke bis zur Schonfrist verzeiht der Bot ohnehin. Gerettet werden nur Lücken der letzten 7 Stream-Tage.'],
    ['rescueTemplate', 'Chatnachricht bei erfolgreicher Rettung', 'area', '{user} {days} {streak}'],
    ['rescueNotNeededTemplate', 'Nachricht, wenn die Streak nicht in Gefahr ist (Punkte werden erstattet)', 'area', '{user}'],
    ['rescueTooLongTemplate', 'Nachricht, wenn die Lücke zu lang oder zu alt ist (Punkte werden erstattet)', 'area', '{user}'],
    ['rescueTitle', 'Buch im Overlay: Überschrift', 'text', '{user} {days} {streak}'], ['rescueMessage', 'Buch im Overlay: Text', 'text', '{user} {days} {streak}'],
  ]],
  ['Check-in und Streak', [
    ['checkinEnabled', 'Check-in aktivieren (Besuche und Streak zählen)', 'bool', 'Ein Kanalpunkte-Reward „Check-in“, einmal pro Stream-Tag. Der Reward wird beim Speichern automatisch bei Twitch angelegt.'],
    ['checkinRewardTitle', 'Check-in-Reward: Name', 'text'], ['checkinRewardCost', 'Check-in-Reward: Preis (Kanalpunkte)', 'number'],
    ['streakGrace', 'Schonfrist: so viele Streams darf man verpassen', 'number'],
    ['milestoneEnabled', 'Meilensteine feiern (goldenes Banner und eigener Chattext)', 'bool'],
    ['milestoneLevels', 'Meilensteine bei diesen Besuchen (mit Komma getrennt)', 'text'],
    ['visitTemplate', 'Chatnachricht beim Check-in', 'area', '{user} {count} {streak} {record}'],
    ['milestoneTemplate', 'Chatnachricht beim Meilenstein', 'area', '{user} {count} {streak} {record}'],
    ['visitDuplicateTemplate', 'Schon eingecheckt (Punkte kommen zurück)', 'area', '{user} {count} {streak} {record}'],
    ['streakCmdTemplate', 'Antwort auf !streak', 'area', '{user} {count} {streak} {record} {rank} {total}'],
    ['streakCmdNone', 'Antwort auf !streak ohne Check-in', 'area', '{user}'],
  ]],
  ['Punkte und Rangliste', [
    ['pointsEnabled', 'Punkte zählen (Chat, aktive Tage, Check-ins)', 'bool', 'Zählt den Twitch-Chat und zeigt die Monatsrangliste unter /rangliste.'],
    ['pointsWeightMsg', 'Punkte je Nachricht', 'number'], ['pointsWeightDay', 'Punkte je aktivem Tag', 'number'], ['pointsWeightCheckin', 'Punkte je Check-in-Tag', 'number'],
    ['pointsMsgCap', 'Gezählte Nachrichten pro Tag (höchstens)', 'number'], ['pointsMsgGap', 'Mindestabstand zwischen zwei gezählten Nachrichten (Sekunden)', 'number'],
    ['pointsRankSize', 'Plätze im Chat zeigen', 'number'],
    ['pointsRankTemplate', 'Antwort auf !rangliste', 'area', '{month} {list} {me} {n} {url}'],
    ['pointsRankEmpty', 'Antwort auf !rangliste ohne Punkte', 'area', '{month} {url}'],
    ['pointsMeTemplate', 'Antwort auf !punkte', 'area', '{user} {points} {month} {rank} {total} {url}'],
    ['pointsMeNone', 'Antwort auf !punkte ohne Punkte', 'area', '{user} {month}'],
  ]],
  ['Sicherung (nur Heimserver)', [
    ['backupAutoEnabled', 'Jede Nacht automatisch sichern', 'bool'], ['backupHour', 'Ab wann (Uhr)', 'number'], ['backupKeep', 'So viele Sicherungen behalten', 'number'],
  ]],
  ['Kartenstil', [
    ['kameraRahmen', 'Rahmen um das Kamerabild (Szenen, Jahreszeiten, eigenes Bild)', 'select', 'Das Kamerafenster liegt in OBS durchsichtig im Overlay, die Kamera kommt darunter. Position und Größe stellst du unter „Anordnung“ ein.'],
    ['kartenStil', 'Stil der Karten (Uhr, Ziel, To-Do, Musik, Banner)', 'select', 'Glas lässt das Bild dahinter verschwommen durchscheinen, getönt in der gewählten Farbe.'],
    ['glasFarbe', 'Glas: Farbton', 'color'],
    ['glasStaerke', 'Glas: Tönung (0 = klar, 90 = fast deckend)', 'range'],
    ['glasUnschaerfe', 'Glas: Unschärfe des Hintergrunds (Pixel)', 'range'],
  ]],
  ['Szenen (Ausblick und Wetter)', [
    ['wetter', 'Wetter in den Szenen', 'select', 'Gilt für Zugabteil, Sitzecke, Stadt und See. Im Chat ändern Moderatoren es mit „!wetter regen“.'],
    ['wind', 'Wind (0 bis 100)', 'range', 'Wie stark sich Bäume und Wasser bewegen und wie schräg der Regen fällt.'],
    ['kulisseTempo', 'Tempo des Zuges (0 bis 100)', 'range', 'Wie schnell die Landschaft am Zugfenster vorbeizieht.'],
  ]],
  ['Jahreszeiten-Landschaft', [
    ['jzWieseVon', 'Wiese: oberer Rand (% von oben)', 'range', 'Ab hier wachsen Blumen und landen Blätter.'],
    ['jzWieseBis', 'Wiese: unterer Rand (% von oben)', 'range'],
    ['jzBaumX', 'Baum: Mitte (% von links)', 'range', 'Von hier aus fallen Blätter und Blüten.'],
    ['jzStammBreite', 'Stammbereich ohne Blumen (% der Breite)', 'range'],
    ['jzKroneBreite', 'Krone: Breite (% der Bildbreite)', 'range'],
    ['jzKroneVon', 'Krone: Oberkante (% von oben)', 'range'],
    ['jzDichte', 'Wie viele Blumen wachsen (0 bis 100)', 'range'],
    ['jzFall', 'Wie viele Blätter und Blüten fallen (0 bis 100)', 'range'],
  ]],
  ['Hintergrund', [
    ['hintergrund', 'Was liegt hinter den Karten?', 'select', 'Mit einer Szene oder einem eigenen Bild ersetzt sie die gemalte Landschaft samt Pavillon und Modulen. Die Raumbilder der Szenen lädst du unten hoch.'],
  ]],
  ['Zimmer-Modus (pausiert)', [
    ['appearOn', 'Figur erscheint bei', 'select', 'Umschaltbar jederzeit. Der Reward wird beim Speichern automatisch bei Twitch abgeglichen.'],
    ['scene', 'Szene', 'select'], ['maxSeats', 'Plätze (1–10)', 'number'],
    ['seatIdleMinutes', 'Platz frei nach … Min ohne Chatnachricht', 'number'],
    ['unlocksEnabled', 'Freischaltungen (Ränge, Gegenstände, Zimmer-Deko)', 'bool', 'Aus: alle Gegenstände sind sofort frei.'],
    ['sitTemplate', 'Hinsetzen', 'area', '{user} {ort} {rank}'], ['sitAgainTemplate', 'Schon gesetzt', 'area', '{user} {ort}'], ['fullTemplate', 'Alles belegt', 'area', '{user}'],
    ['leaveTemplate', 'Aufstehen', 'area', '{user} {minutes} {total}'], ['notSeatedTemplate', 'Sitzt nicht', 'area', '{user} {sit}'], ['checkinTemplate', 'Check-in per Reward', 'area', '{user} {count} {ort} {rank}'],
    ['rankUpTemplate', 'Neuer Rang', 'area', '{user} {rank} {hours}'], ['unlockTemplate', 'Neuer Gegenstand', 'area', '{user} {item} {figur}'], ['decoTemplate', 'Zimmer wächst', 'area', '{deko}'],
  ]],
];
let current = null;
// Gruppen mit Haken als Erstem: Die Kopfzeile zeigt an/aus
const TOGGLE_GROUPS = new Set(['Eigene Befehle', 'Zitate', 'Shoutout', 'Streak-Retter', 'Stream-Pause', 'Alerts', 'Raids', 'Check-in und Streak', 'Punkte und Rangliste', 'Sicherung (nur Heimserver)']);
// Änderungen an diesen Werten gleichen Reward und Webhooks bei Twitch gleich mit ab
const SYNC_KEYS = ['customCommandsEnabled', 'streakRescueEnabled', 'streakRewardTitle', 'streakRewardCost', 'alertsEnabled', 'raidEnabled', 'checkinEnabled', 'pointsEnabled', 'appearOn', 'checkinRewardTitle', 'checkinRewardCost', 'chatCommands', 'funktionenAus'];
const openFolds = new Set();
const RANGE = { glasStaerke: [0, 90], glasUnschaerfe: [0, 60], wind: [0, 100], kulisseTempo: [0, 100], jzWieseVon: [40, 99], jzWieseBis: [41, 100], jzBaumX: [0, 100], jzStammBreite: [0, 80], jzKroneBreite: [10, 100], jzKroneVon: [0, 60], jzDichte: [0, 100], jzFall: [0, 100] };

function fieldHtml([key, label, type, hint], settings) {
  const v = settings[key];
  const input = type === 'select' ? `<select data-k="${key}">${OPT[key].map(([val, text]) => `<option value="${val}" ${val === v ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select>`
    : type === 'bool' ? `<input type="checkbox" data-k="${key}" ${v ? 'checked' : ''}>`
      : type === 'number' ? `<input type="number" data-k="${key}" value="${esc(v)}">`
        : type === 'area' ? `<textarea data-k="${key}" maxlength="300">${esc(v)}</textarea>`
          : `<input data-k="${key}" value="${esc(v)}">`;
  return `<div class="feld ${type === 'area' ? 'breit' : ''} ${type === 'bool' ? 'haken' : ''}"><label>${type === 'bool' ? input : ''}${esc(label)}</label>${type === 'bool' ? '' : input}${hint ? `<div class="hinweis">${type === 'area' ? 'Platzhalter: ' : ''}${esc(hint)}</div>` : ''}</div>`;
}
function groupHtml([titel, felder], settings) {
  const toggle = TOGGLE_GROUPS.has(titel) ? felder[0] : null;
  const on = toggle && settings[toggle[0]];
  const badge = toggle ? `<span class="badge ${on ? 'an' : 'aus'}">${on ? 'an' : 'aus'}</span>` : '';
  return `<details class="fold" data-group="${esc(titel)}" ${openFolds.has(titel) ? 'open' : ''}><summary><span>${esc(titel)}</span>${badge}</summary><div class="felder">${felder.map((f) => fieldHtml(f, settings)).join('')}</div></details>`;
}
function renderFolds(settings) {
  for (const d of document.querySelectorAll('details.fold[open]')) openFolds.add(d.dataset.group);
  for (const box of document.querySelectorAll('[data-schema]')) {
    const groups = box.dataset.schema.split('|').map((n) => SCHEMA.find((g) => g[0] === n)).filter(Boolean);
    box.innerHTML = `<h2 class="zwischen">Einstellungen und Texte</h2>${groups.map((g) => groupHtml(g, settings)).join('')}<div class="reihe"><button class="gruen" data-save>Speichern</button></div>`;
    for (const d of box.querySelectorAll('details.fold')) d.ontoggle = () => (d.open ? openFolds.add(d.dataset.group) : openFolds.delete(d.dataset.group));
    box.querySelector('[data-save]').onclick = run(() => saveFolds(box));
  }
}
async function saveFolds(box) {
  const body = {};
  for (const el of box.querySelectorAll('[data-k]')) body[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.type === 'number' || el.type === 'range' ? Number(el.value) : el.value;
  const before = current;
  const { settings } = await api('PUT', 'settings', body);
  current = settings; renderScenes(settings); renderFolds(settings);
  meldung('Gespeichert');
  if (before && SYNC_KEYS.some((k) => before[k] !== settings[k])) await syncTwitch();
  await loadState();
}
// Reward und Webhooks bei Twitch abgleichen (sonst nur über den Knopf unter „Einrichtung“)
async function syncTwitch() {
  try {
    const r = await api('POST', 'setup');
    meldung(r.warnings?.length ? `Gespeichert, Twitch-Abgleich mit Hinweis: ${r.warnings.join(' · ')}` : `Gespeichert und bei Twitch abgeglichen${r.reward ? ` (Reward „${r.reward}“)` : ''}`, Boolean(r.warnings?.length));
  } catch (e) { meldung(`Gespeichert, aber der Twitch-Abgleich ging nicht: ${e.message}`, true); }
}

async function loadSettings() {
  const { settings } = await api('GET', 'settings');
  current = settings;
  renderFolds(settings);
  renderScenes(settings);
  fillMusik(settings); fillZiele(settings); fillStefanie(settings);
  loadPages().catch(() => {}); loadStream().catch(() => {});
  if (!layoutState) loadLayout(settings.layout);
}

document.addEventListener('input', (e) => { if (e.target.type === 'range' && e.target.nextElementSibling?.tagName === 'OUTPUT') e.target.nextElementSibling.textContent = e.target.value; });

// ---- Mitschreibende
const fmtMin = (m) => (m < 60 ? `${m} Min` : `${Math.floor(m / 60)} Std ${m % 60} Min`);
async function loadUsers() {
  const { users } = await api('GET', 'users');
  $('users').innerHTML = users.length ? users.map((u) => `<tr><td>${esc(u.name)}</td><td>${esc(u.rank)}</td><td>${fmtMin(u.minutes)}</td><td>${u.sprints}</td><td>${u.words}</td><td>${u.visits}</td><td><button class="hell" data-del="${esc(u.id)}">Löschen</button></td></tr>`).join('') : '<tr><td colspan="7" class="leise">Noch niemand</td></tr>';
  for (const b of $('users').querySelectorAll('[data-del]')) b.onclick = run(async () => { if (confirm('Person samt Arbeitszeit löschen?')) { await api('DELETE', `users/${b.dataset.del}`); await loadUsers(); } });
}
$('usersLaden').onclick = run(loadUsers);

// ---- Tests
for (const b of document.querySelectorAll('[data-test]')) b.onclick = run(async () => { await api('POST', `test/${b.dataset.test}`, { count: 8 }); meldung('Erledigt – schau ins Overlay'); await loadState(); });
for (const b of document.querySelectorAll('[data-event]')) b.onclick = run(async () => { await api('POST', 'test/event', { kind: b.dataset.event }); meldung('Gesendet – schau ins Overlay'); });

// ---- Musik
const MUSIK_OPT = [['aus', 'Aus'], ['lokal', 'Lokal (Adresse, z. B. Tuna)'], ['server', 'Server (Chat, von Hand, Hilfsprogramm)']];
function fillMusik(settings) {
  $('musikQuelleSel').innerHTML = MUSIK_OPT.map(([v, t]) => `<option value="${v}" ${settings.musikQuelle === v ? 'selected' : ''}>${esc(t)}</option>`).join('');
  $('musikUrlFeld').value = settings.musikUrl;
  musikStatus().catch(() => {});
}
async function musikStatus() {
  const { musik } = await api('GET', 'musik');
  $('musikStatus').textContent = musik ? `Von Hand oder per Schnittstelle gesetzt: ${musik.title}${musik.artist ? ` – ${musik.artist}` : ''}` : 'Über den Server ist gerade nichts gesetzt.';
}
$('musikSpeichern').onclick = run(async () => { const r = await api('PUT', 'settings', { musikQuelle: $('musikQuelleSel').value, musikUrl: $('musikUrlFeld').value }); current = r.settings; meldung('Gespeichert – schau ins Overlay'); });
$('musikSetzen').onclick = run(async () => {
  const [title, artist = ''] = $('musikText').value.split(/\s+[-–]\s+/);
  await api('POST', 'musik', { title, artist }); $('musikText').value = ''; await musikStatus();
  meldung('Gesetzt (zeigt nur, wenn die Anzeige auf „Server“ steht)');
});
$('musikLoeschen').onclick = run(async () => { await api('DELETE', 'musik'); await musikStatus(); });

// ---- Anordnung: Karten, Module und Kamerafenster per Ziehen verschieben
const BOXEN = {
  uhr: { label: 'Uhr + Pomodoro', w: 366, h: 300 }, woerter: { label: 'Wörter', w: 366, h: 215 }, tasks: { label: 'To-Do', w: 366, h: 210 }, musik: { label: 'Musik', w: 380, h: 110 },
  kamera: { label: 'Kamera' },
  blume: { label: 'Blume', w: 210, h: 270, modul: true }, kerze: { label: 'Kerze', w: 150, h: 220, modul: true }, buecher: { label: 'Bücher', w: 230, h: 210, modul: true },
};
let layoutState = null, gewaehlt = null, editScale = 0.5, sendFrame = 0;
function geom(id) {
  const b = BOXEN[id], l = layoutState[id];
  if (id === 'kamera') return { x: l.x - 22, y: l.y - 22, w: l.w + 44, h: l.w + 44 };
  if (b.modul) return { x: l.x - (b.w * l.s) / 2, y: l.y - (b.h - 30) * l.s, w: b.w * l.s, h: b.h * l.s };
  return { x: l.x, y: l.y, w: b.w * l.s, h: b.h * l.s };
}
function pushLayout() {
  cancelAnimationFrame(sendFrame);
  sendFrame = requestAnimationFrame(() => $('editorFrame').contentWindow?.postMessage({ type: 'layout', layout: layoutState }, location.origin));
}
function renderBoxen() {
  const box = $('editorBoxen');
  if (!box.children.length) {
    for (const id of Object.keys(BOXEN)) {
      const el = document.createElement('div');
      el.className = 'ebox'; el.dataset.id = id; el.textContent = BOXEN[id].label;
      el.onpointerdown = (e) => startDrag(e, id, el);
      box.append(el);
    }
  }
  for (const el of box.children) {
    const id = el.dataset.id, g = geom(id);
    el.style.left = `${g.x * editScale}px`; el.style.top = `${g.y * editScale}px`; el.style.width = `${g.w * editScale}px`; el.style.height = `${g.h * editScale}px`;
    el.classList.toggle('aktiv', id === gewaehlt); el.classList.toggle('aus', !layoutState[id].on);
  }
}
function startDrag(e, id, el) {
  e.preventDefault(); select(id);
  const l = layoutState[id], sx = e.clientX, sy = e.clientY, x0 = l.x, y0 = l.y;
  el.setPointerCapture(e.pointerId);
  el.onpointermove = (m) => {
    layoutState[id].x = Math.round((x0 + (m.clientX - sx) / editScale) / 4) * 4;
    layoutState[id].y = Math.round((y0 + (m.clientY - sy) / editScale) / 4) * 4;
    layoutState = normalizeLayout(layoutState); renderBoxen(); pushLayout();
  };
  el.onpointerup = () => { el.onpointermove = null; el.onpointerup = null; };
}
function select(id) {
  gewaehlt = id;
  const l = layoutState[id];
  $('editorName').textContent = BOXEN[id].label;
  $('edAn').checked = l.on; $('edAn').disabled = false;
  $('edGroesse').hidden = id === 'kamera'; $('edGroesse').parentElement.hidden = id === 'kamera';
  if (id !== 'kamera') $('edGroesse').value = l.s;
  $('edKamera').hidden = id !== 'kamera';
  if (id === 'kamera') $('edW').value = l.w;
  renderBoxen();
}
function fitEditor() {
  editScale = $('editor').clientWidth / 1920;
  $('editorFrame').style.transform = `scale(${editScale})`;
  if (layoutState) renderBoxen();
}
function loadLayout(layout) {
  layoutState = normalizeLayout(layout);
  if (!$('editorFrame').src) { $('editorFrame').src = '/overlay.html?editor=1&vorschau=1&kamera=1&ton=aus'; $('editorFrame').onload = pushLayout; }
  fitEditor(); renderBoxen(); pushLayout();
}
addEventListener('resize', fitEditor);
const edChange = () => { if (!gewaehlt) return; const l = layoutState[gewaehlt]; l.on = $('edAn').checked; if (gewaehlt !== 'kamera') l.s = Number($('edGroesse').value); else { l.w = Number($('edW').value); l.h = l.w; } layoutState = normalizeLayout(layoutState); renderBoxen(); pushLayout(); };
for (const id of ['edAn', 'edGroesse', 'edW']) $(id).oninput = edChange;
$('layoutSpeichern').onclick = run(async () => { const r = await api('PUT', 'settings', { layout: layoutState }); current = r.settings; layoutState = normalizeLayout(r.settings.layout); renderBoxen(); meldung('Anordnung gespeichert'); });
$('layoutZurueck').onclick = () => { layoutState = normalizeLayout(structuredClone(DEFAULT_LAYOUT)); if (gewaehlt) select(gewaehlt); else renderBoxen(); pushLayout(); meldung('Standard geladen – noch speichern'); };
$('layoutLaden').onclick = run(async () => { const { settings } = await api('GET', 'settings'); layoutState = normalizeLayout(settings.layout); if (gewaehlt) select(gewaehlt); else renderBoxen(); pushLayout(); });

// ---- System: Update und Sicherung
const fmtDate = (iso) => new Date(iso).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
async function loadSystem() {
  const u = await api('GET', 'update');
  $('version').textContent = u.commit ? `Version ${u.commit.slice(0, 7)}${u.builtAt ? ` (gebaut ${fmtDate(u.builtAt)})` : ''}` : 'Version unbekannt (lokal gestartet)';
  $('updateHinweis').textContent = u.configured ? '' : 'Der Update-Knopf ist noch nicht eingerichtet (WATCHTOWER_URL und WATCHTOWER_TOKEN in der App, siehe docs/casaos.md).';
  const b = await api('GET', 'backup/status');
  $('sicherungStatus').textContent = !b.available ? 'Automatische Sicherung gibt es nur auf dem Heimserver. Der Download oben geht immer.'
    : `${b.enabled ? `Jede Nacht ab ${b.hour} Uhr, es bleiben ${b.keep}.` : 'Automatische Sicherung ist aus.'} ${b.lastOk ? `Letzte: ${fmtDate(b.lastOk)}.` : 'Noch keine Sicherung.'} ${b.lastError ? `Fehler: ${b.lastError}` : ''} Ordner: ${b.dir}`;
}
$('updatePruefen').onclick = run(async () => {
  const r = await api('POST', 'update');
  if (r.started) { meldung('Update läuft – die Seite ist gleich kurz weg'); setTimeout(() => location.reload(), 30_000); } else meldung('Bereits aktuell');
});
$('sichernJetzt').onclick = run(async () => { const r = await api('POST', 'backup/now'); meldung(r.ok ? `Gesichert: ${r.name}` : r.error, !r.ok); await loadSystem(); });
$('restoreDatei').onchange = run(async (e) => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file || !confirm('Alle Besucher, Einstellungen und Punkte werden durch die Sicherung ersetzt. Wirklich wiederherstellen?')) return;
  const r = await api('POST', 'backup', { backup: JSON.parse(await file.text()), confirm: true });
  meldung(`${r.restored} Einträge wiederhergestellt – bitte Twitch neu verbinden`); await start();
});

// ---- Live-Vorschau: das echte Overlay, mit den noch nicht gespeicherten Einstellungen
// Der Server rechnet den Stand aus (POST /api/admin/preview), die Seite schickt ihn an den Rahmen. Gespeichert wird weiterhin mit „Speichern“.
let activePage = 'start';
let previewTimer = 0, previewBusy = false, previewAgain = false, previewProgress = null; // Fortschritt nur zum Ausprobieren in der Vorschau
const PREVIEW_KEYS = ['kameraRahmen', 'videoZug', 'videoSitzecke', 'videoStadt', 'videoSee', 'pavillonZeigen', 'jahreszeit', 'tageszeit', 'wachstumQuelle', 'zielArt', 'stefanieTaetigkeit', 'szeneModus', 'scene', 'moduleBlume', 'moduleKerze', 'moduleBuecher', 'moduleDeko', 'pomodoroGoal', 'focusMinutes', 'kartenStil', 'glasFarbe', 'glasStaerke', 'glasUnschaerfe', 'hintergrund', 'wetter', 'wind', 'kulisseTempo', 'jzWieseVon', 'jzWieseBis', 'jzBaumX', 'jzStammBreite', 'jzKroneBreite', 'jzKroneVon', 'jzDichte', 'jzFall', 'musikQuelle', 'musikUrl', 'wordGoal', 'seitenGoal', 'streamGoalMinutes', 'unlocksEnabled'];
function collectDraft() {
  const d = {};
  for (const el of document.querySelectorAll('[data-k]')) {
    const k = el.dataset.k;
    if (!PREVIEW_KEYS.includes(k)) continue;
    if (el.type === 'checkbox') d[k] = el.checked;
    else if (el.type === 'number' || el.type === 'range') { if (el.value !== '' && Number.isFinite(Number(el.value))) d[k] = Number(el.value); }
    else d[k] = el.value;
  }
  const fig = {};
  for (const el of document.querySelectorAll('#stefanieFelder [data-slot]')) fig[el.dataset.slot] = el.value;
  if (Object.keys(fig).length) d.stefanieFigur = fig;
  if ($('musikQuelleSel').value) { d.musikQuelle = $('musikQuelleSel').value; d.musikUrl = $('musikUrlFeld').value; }
  for (const [id, key, mul] of [['zielWoerter', 'wordGoal', 1], ['zielSeiten', 'seitenGoal', 1], ['zielStunden', 'streamGoalMinutes', 60]]) {
    const v = $(id).value; if (v !== '' && Number.isFinite(Number(v))) d[key] = Math.round(Number(v) * mul);
  }
  for (const [boxId, [key]] of Object.entries(AUSWAHL)) { const a = $(boxId).querySelector('button.aktiv'); if (a && !(key in d)) d[key] = a.dataset.v; }
  if (layoutState) d.layout = layoutState;
  return d;
}
const previewTarget = () => (activePage === 'anordnung' ? $('editorFrame') : PREVIEW_PAGES.includes(activePage) ? $('vorschauFrame') : null);
async function refreshPreview() {
  const frame = previewTarget();
  if (!frame?.src || !frame.contentWindow) return;
  if (previewBusy) { previewAgain = true; return; }
  previewBusy = true;
  try {
    const view = await api('POST', 'preview', { draft: collectDraft(), progress: previewProgress });
    frame.contentWindow.postMessage({ type: 'view', view }, location.origin);
  } catch { /* ungültige Eingabe (z. B. halb getippte Zahl): die Vorschau bleibt, wie sie war */ }
  previewBusy = false;
  if (previewAgain) { previewAgain = false; schedulePreview(150); }
}
function schedulePreview(ms = 300) { clearTimeout(previewTimer); previewTimer = setTimeout(refreshPreview, ms); }
addEventListener('message', (e) => { if (e.origin === location.origin && e.data?.type === 'overlay-ready') schedulePreview(0); });
for (const ev of ['input', 'change']) document.addEventListener(ev, (e) => { if (e.target.closest?.('.inhalt')) schedulePreview(); });
setInterval(() => { if (!document.hidden && previewTarget()) refreshPreview(); }, 5000); // Timer, Wörter und Musik laufen mit

function fitVorschau() {
  const w = $('vorschauRahmen').clientWidth;
  if (w) { $('vorschauRahmen').style.height = `${(w * 9) / 16}px`; $('vorschauFrame').style.transform = `scale(${w / 1920})`; }
}
new ResizeObserver(fitVorschau).observe($('vorschauRahmen'));
try { const z = localStorage.getItem('vorschauZu'); if (z === '1' || (z === null && innerWidth <= 820)) { $('vorschauBox').classList.add('zu'); $('vorschauZu').textContent = '+'; } } catch { /* ohne Speicher */ } // am Handy zuerst eingeklappt, damit sie nichts verdeckt
$('vorschauZu').onclick = () => {
  const zu = $('vorschauBox').classList.toggle('zu');
  try { localStorage.setItem('vorschauZu', zu ? '1' : '0'); } catch { /* ohne Speicher */ }
  $('vorschauZu').textContent = zu ? '+' : '–';
  if (!zu) { fitVorschau(); schedulePreview(0); }
};
function onPageShow(key) {
  activePage = key;
  const mit = PREVIEW_PAGES.includes(key);
  $('vorschauBox').hidden = !mit;
  document.body.classList.toggle('mit-vorschau', mit);
  if (mit && !$('vorschauFrame').src) $('vorschauFrame').src = '/overlay.html?editor=1&vorschau=1&kamera=1&ton=aus';
  if (mit) fitVorschau();
  if (key === 'anordnung' && layoutState) fitEditor();
  if (mit || key === 'anordnung') schedulePreview(0);
}

// ---- Design: Farbvorschläge und eigenes Hintergrundbild
const GLAS_FARBEN = [['Meerblau', '#3b6f94'], ['Dämmerung', '#5b4a8f'], ['Salbei', '#4f7d68'], ['Rosé', '#a35a78'], ['Bernstein', '#a8722f'], ['Schiefer', '#2d3b4a'], ['Nebel', '#9fb4c4']];
$('glasFarben').innerHTML = GLAS_FARBEN.map(([n, c]) => `<button type="button" class="farbe" data-c="${c}" title="${n}"><i style="background:${c}"></i>${n}</button>`).join('');
for (const b of $('glasFarben').querySelectorAll('button')) b.onclick = () => {
  const farbe = document.querySelector('[data-k="glasFarbe"]'), stil = document.querySelector('[data-k="kartenStil"]');
  if (!farbe) return;
  farbe.value = b.dataset.c; if (stil) stil.value = 'glas';
  farbe.dispatchEvent(new Event('input', { bubbles: true }));
};
async function loadBg() {
  const b = await api('GET', 'hintergrund');
  $('bgStatus').textContent = b.vorhanden ? `Bild vorhanden (${Math.round(b.size / 1024)} KB).` : 'Noch kein Bild hochgeladen.';
  $('bgVorschau').innerHTML = b.vorhanden ? `<img src="/api/overlay-bg?v=${b.version}" alt="Hintergrundbild">` : '<span class="leise">Noch kein Bild</span>';
  $('bgLoeschen').disabled = !b.vorhanden;
}
// Bild im Browser verkleinern (höchstens 1920×1080), damit der Upload klein bleibt
async function shrinkImage(file, quality = 0.86) {
  const bmp = await createImageBitmap(file);
  const f = Math.min(1, 1920 / bmp.width, 1080 / bmp.height);
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * f); c.height = Math.round(bmp.height * f);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', quality);
}
$('bgDatei').onchange = run(async (e) => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Bitte ein Bild als JPG, PNG oder WebP wählen');
  await api('POST', 'hintergrund', { data: await shrinkImage(file) });
  const r = await api('PUT', 'settings', { hintergrund: 'bild' });
  current = r.settings; renderFolds(r.settings);
  await loadBg(); schedulePreview(0);
  meldung('Bild hochgeladen und als Hintergrund eingestellt');
});
$('bgLoeschen').onclick = run(async () => {
  if (!confirm('Das Hintergrundbild entfernen? Danach ist wieder die Landschaft zu sehen.')) return;
  await api('DELETE', 'hintergrund');
  const { settings } = await api('GET', 'settings'); current = settings; renderFolds(settings);
  await loadBg(); schedulePreview(0); meldung('Bild entfernt');
});


// ---- Szenen: Raumbilder (Bild mit Fenster in Magenta) hochladen
const RAUM_SZENEN = [['zug', 'Zugabteil'], ['sitzecke', 'Sitzecke am Fenster'], ['stadt', 'Stadt'], ['see', 'See und Weitblick']];
async function loadRaeume() {
  const { raeume } = await api('GET', 'hintergrund/raum');
  $('raeume').innerHTML = RAUM_SZENEN.map(([k, label]) => `<div class="raum"><b>${label}</b>
    <div class="bg-vorschau">${raeume[k] ? `<img src="/api/overlay-bg?plate=${k}&v=${raeume[k]}" alt="Raumbild ${label}">` : '<span class="leise">Einfacher Raum (kein eigenes Bild)</span>'}</div>
    <div class="reihe"><label class="knopf hell" for="raum-${k}">Raumbild wählen …</label><input type="file" id="raum-${k}" data-raum="${k}" accept="image/jpeg,image/png,image/webp" hidden>${raeume[k] ? `<button class="hell" data-weg="${k}">Entfernen</button>` : ''}</div></div>`).join('');
  for (const inp of $('raeume').querySelectorAll('[data-raum]')) inp.onchange = run(async (e) => {
    const file = e.target.files[0]; const k = inp.dataset.raum; e.target.value = '';
    if (!file) return;
    await api('POST', `hintergrund/raum/${k}`, { data: await shrinkImage(file, 0.92) });
    const r = await api('PUT', 'settings', { hintergrund: k });
    current = r.settings; renderScenes(r.settings); renderFolds(r.settings);
    await loadRaeume(); schedulePreview(0); meldung('Raumbild hochgeladen, die Szene ist ausgewählt');
  });
  for (const b of $('raeume').querySelectorAll('[data-weg]')) b.onclick = run(async () => { await api('DELETE', `hintergrund/raum/${b.dataset.weg}`); await loadRaeume(); schedulePreview(0); meldung('Raumbild entfernt'); });
}

// ---- Videos als Ausblick (Szene × Tageszeit)
const VIDEO_ZEITEN = [['morgen', 'Morgen'], ['mittag', 'Mittag'], ['abend', 'Abend'], ['nacht', 'Nacht']];
const mb = (b) => `${(b / 1048576).toFixed(1).replace('.', ',')} MB`;
async function loadVideos() {
  let res, data;
  try { res = await fetch('/api/admin/video', { cache: 'no-store' }); data = await res.json(); } catch { data = null; }
  if (!res?.ok || !data?.videos) { $('videos').innerHTML = `<span class="leise">${esc(data?.error ?? 'Die Videos konnten nicht geladen werden. Bitte die Seite neu laden und, falls es bleibt, neu anmelden.')}</span>`; return; }
  $('videos').innerHTML = `<table><thead><tr><th>Szene</th>${VIDEO_ZEITEN.map(([, l]) => `<th>${l}</th>`).join('')}</tr></thead><tbody>${RAUM_SZENEN.map(([k, label]) => `<tr><td><b>${label}</b></td>${VIDEO_ZEITEN.map(([z]) => {
    const v = data.videos[k]?.[z];
    return `<td>${v ? `<span class="video-da">✓ ${mb(v.size)}</span><br>` : ''}<label class="knopf hell klein" for="vid-${k}-${z}">${v ? 'Ersetzen' : 'Video wählen'}</label><input type="file" id="vid-${k}-${z}" data-s="${k}" data-z="${z}" accept="video/mp4,video/webm" hidden>${v ? `<button class="hell klein" data-weg-s="${k}" data-weg-z="${z}">Entfernen</button>` : ''}</td>`;
  }).join('')}</tr>`).join('')}</tbody></table>`;
  const WAHL_KEY = { zug: 'videoZug', sitzecke: 'videoSitzecke', stadt: 'videoStadt', see: 'videoSee' };
  const BIB = ['b1', 'b2', 'b3'];
  $('videoBib').innerHTML = `<table><thead><tr><th>Szene</th><th>Läuft gerade</th>${BIB.map((_, i) => `<th>Platz ${i + 1}</th>`).join('')}</tr></thead><tbody>${RAUM_SZENEN.map(([k, label]) => {
    const wahl = current?.[WAHL_KEY[k]] ?? 'zeit';
    const opts = [['zeit', 'Nach Tageszeit'], ...BIB.map((z, i) => [z, `Platz ${i + 1}${data.videos[k]?.[z] ? `: ${data.videos[k][z].name || 'ohne Namen'}` : ' (leer)'}`]), ['aus', 'Kein Video (gezeichnete Landschaft)']];
    return `<tr><td><b>${label}</b></td><td><select data-wahl="${k}">${opts.map(([v, l]) => `<option value="${v}"${v === wahl ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></td>${BIB.map((z) => {
      const v = data.videos[k]?.[z];
      return `<td>${v ? `<b>${esc(v.name || 'ohne Namen')}</b> <span class="video-da">✓ ${mb(v.size)}</span><br>` : ''}<label class="knopf hell klein" for="vid-${k}-${z}">${v ? 'Ersetzen' : 'Video wählen'}</label><input type="file" id="vid-${k}-${z}" data-s="${k}" data-z="${z}" accept="video/mp4,video/webm" hidden>${v ? `<button class="hell klein" data-weg-s="${k}" data-weg-z="${z}">Entfernen</button>` : ''}</td>`;
    }).join('')}</tr>`;
  }).join('')}</tbody></table>`;
  for (const sel of $('videoBib').querySelectorAll('select[data-wahl]')) sel.onchange = run(async () => {
    const st = await api('PUT', 'settings', { [WAHL_KEY[sel.dataset.wahl]]: sel.value, hintergrund: sel.dataset.wahl });
    current = st.settings; renderScenes(st.settings); renderFolds(st.settings); schedulePreview(0); meldung('Gespeichert');
  });
  for (const inp of document.querySelectorAll('#videos input[type=file], #videoBib input[type=file]')) inp.onchange = run(async (e) => {
    const file = e.target.files[0]; const s = inp.dataset.s, z = inp.dataset.z; e.target.value = '';
    if (!file) return;
    $('videoStatus').textContent = `Lädt hoch: ${file.name} (${mb(file.size)}) …`;
    let r, d = {};
    try { r = await fetch(`/api/admin/video?s=${s}&z=${z}&n=${encodeURIComponent(file.name)}`, { method: 'PUT', headers: { 'x-upload': '1', 'content-type': file.type || 'video/mp4' }, body: file }); d = await r.json().catch(() => ({})); } catch { r = null; }
    $('videoStatus').textContent = '';
    if (!r) throw new Error('Das Hochladen ist abgebrochen. Ist das Video größer als 100 MB, oder war die Verbindung weg?');
    if (!r.ok) throw new Error(d.error ?? `Fehler ${r.status} beim Hochladen`);
    const bib = BIB.includes(z);
    const st = await api('PUT', 'settings', bib ? { hintergrund: s, [WAHL_KEY[s]]: z } : { hintergrund: s, tageszeit: z });
    current = st.settings; renderScenes(st.settings); renderFolds(st.settings);
    await loadVideos(); schedulePreview(0); meldung(bib ? 'Video in der Bibliothek abgelegt und ausgewählt' : 'Video hochgeladen, Szene und Tageszeit sind ausgewählt');
  });
  for (const b of document.querySelectorAll('#videos [data-weg-s], #videoBib [data-weg-s]')) b.onclick = run(async () => { await fetch(`/api/admin/video?s=${b.dataset.wegS}&z=${b.dataset.wegZ}`, { method: 'DELETE', headers: { 'x-upload': '1' } }); await loadVideos(); schedulePreview(0); meldung('Video entfernt'); });
}

// ---- Startbildschirm: Vorlauf starten, verlängern, beenden, Texte, Sprüche und Hintergrund
let ssData = null;
const ssSet = (id, val) => { if (document.activeElement !== $(id)) $(id).value = val ?? ''; };
function renderSs() {
  const { config: c, state: s } = ssData;
  $('ssUrl').textContent = `${location.origin}/startscreen`; $('ssUrl2').textContent = `${location.origin}/startscreen?bg=0`;
  ssSet('ssMin', c.minutes); ssSet('ssRot', c.rotateSeconds); ssSet('ssTitle', c.title); ssSet('ssSub', c.subtitle); ssSet('ssEnd', c.endText); ssSet('ssFacts', c.anecdotes);
  $('ssProg').checked = c.showProgress;
  const bg = c.bgName ? `Hintergrund: ${esc(c.bgName)}${c.bgKind === 'html' ? ' (animierte HTML-Datei)' : ''}` : 'Hintergrund: der eingebaute Abend';
  const left = s.active ? Math.round((s.until - Date.now()) / 60_000) : 0;
  $('ssInfo').innerHTML = `${bg}. ${s.active ? (left > 0 ? `<b>Läuft:</b> noch etwa ${left} Min bis ${new Date(s.until).toLocaleTimeString('de-DE', { timeStyle: 'short' })} Uhr.` : '<b>Läuft:</b> Zeit ist um, der Schlusstext steht. „Beenden“ blendet ihn aus.') : 'Gerade ausgeblendet.'}`;
  $('ssStart').textContent = s.active ? `Neu starten (${c.minutes} Min)` : `Startbildschirm starten (${c.minutes} Min)`;
  $('ssStop').disabled = !s.active; $('ssPlus').disabled = !s.active; $('ssBgReset').disabled = !c.bgName;
}
const ssForm = () => ({ minutes: $('ssMin').value, rotateSeconds: $('ssRot').value, title: $('ssTitle').value, subtitle: $('ssSub').value, endText: $('ssEnd').value, showProgress: $('ssProg').checked, anecdotes: $('ssFacts').value });
async function loadSs() { ssData = await api('GET', 'startscreen'); renderSs(); }
$('ssSave').onclick = run(async () => { ssData = await api('PUT', 'startscreen', ssForm()); renderSs(); meldung('Gespeichert ✓'); });
$('ssStart').onclick = run(async () => { await api('PUT', 'startscreen', ssForm()); ssData = await api('POST', 'startscreen/start', { minutes: $('ssMin').value }); renderSs(); meldung('Startbildschirm läuft ✓'); });
$('ssPlus').onclick = run(async () => { ssData = await api('POST', 'startscreen/extend', { minutes: 5 }); renderSs(); meldung('5 Minuten dazu ✓'); });
$('ssStop').onclick = run(async () => { ssData = await api('POST', 'startscreen/stop', {}); renderSs(); meldung('Ausgeblendet ✓'); });
$('ssDefault').onclick = run(async () => { if (!confirm('Die Liste durch die Beispiel-Sprüche ersetzen? (Erst mit „Texte speichern“ gilt es.)')) return; $('ssFacts').value = ssData.defaultAnecdotes; });
$('ssCopy').onclick = () => navigator.clipboard.writeText(`${location.origin}/startscreen`).then(() => meldung('Kopiert'));
$('ssBgReset').onclick = run(async () => { if (!confirm('Eigenen Hintergrund entfernen und wieder den eingebauten Abend zeigen?')) return; ssData = await api('DELETE', 'startscreen/bg', {}); renderSs(); meldung('Eingebauter Hintergrund aktiv ✓'); });
$('ssBg').onchange = async (e) => { // Auswählen lädt gleich hoch; große Bilder werden vorher im Browser verkleinert
  const file = e.target.files[0]; e.target.value = ''; if (!file) return;
  const err = (m) => { $('ssErr').textContent = m ? `⚠️ ${m}` : ''; };
  try {
    err(`Lade „${file.name}“ (${mb(file.size)}) hoch …`);
    const isHtmlFile = /\.html?$/i.test(file.name) || file.type === 'text/html';
    let data;
    if (!isHtmlFile && file.type !== 'image/gif' && file.type.startsWith('image/') && file.size > 800_000) data = await shrinkImage(file, 0.9);
    else data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('Die Datei konnte nicht gelesen werden')); r.readAsDataURL(file); });
    ssData = await api('POST', 'startscreen/bg', { name: file.name, data }); renderSs(); err(''); meldung('Hintergrund hochgeladen ✓');
  } catch (x) { err(`Hochladen von „${file.name}“ hat nicht geklappt: ${x.message}`); }
};

// ---- Stream-Pause: von Hand starten und beenden
let pauseData = null;
function renderPause(liste = true) {
  const s = pauseData.state;
  $('pauseUrl').textContent = `${location.origin}/pause`;
  $('pauseText').placeholder = pauseData.defaultText;
  $('pauseInfo').innerHTML = s.active ? `<b>Pause läuft:</b> „${esc(s.text)}“ seit ${new Date(s.startedAt).toLocaleTimeString('de-DE', { timeStyle: 'short' })} Uhr.` : 'Gerade läuft keine Pause.';
  $('pauseStart').textContent = s.active ? 'Text ändern' : 'Pause starten';
  $('pauseStop').disabled = !s.active;
  if (liste) renderPauseListe();
}
async function loadPause() { pauseData = await api('GET', 'pause'); renderPause(); }
$('pauseStart').onclick = run(async () => { pauseData = await api('POST', 'pause/start', { text: $('pauseText').value, minutes: $('pauseMin').value }); renderPause(false); meldung('Pause läuft ✓'); });
$('pauseStop').onclick = run(async () => { pauseData = await api('POST', 'pause/stop', {}); renderPause(false); meldung('Pause beendet ✓'); });
// Eigene Pausen: Zeilen mit Befehl, Text, Minuten, Emoji und Bild
const pauseRows = () => [...$('pauseListe').querySelectorAll('.pausezeile')].map((r) => ({ id: r.dataset.id || '', word: r.querySelector('[data-f=word]').value, text: r.querySelector('[data-f=text]').value, minutes: r.querySelector('[data-f=minutes]').value, emoji: r.querySelector('[data-f=emoji]').value }));
function pauseRowHtml(p, i) {
  const vorschau = p.icon ? `<img src="/api/pause-icon?id=${esc(p.id)}&v=${p.icon}" alt="" style="width:44px;height:44px;object-fit:contain">` : p.emoji ? `<span style="font-size:34px;line-height:44px">${esc(p.emoji)}</span>` : '<span style="font-size:30px;line-height:44px">☕</span>';
  return `<div class="pausezeile reihe" data-id="${esc(p.id ?? '')}" data-i="${i}" style="align-items:center;border-bottom:1px solid var(--rand,#bba98a);padding:8px 0">
    <div style="width:48px;text-align:center">${vorschau}</div>
    <span class="leise">${esc(pauseData.prefix)}</span><input data-f="word" type="text" maxlength="20" placeholder="kaffee" value="${esc(p.word ?? '')}" style="width:120px">
    <input data-f="text" type="text" maxlength="80" placeholder="Kaffeepause" value="${esc(p.text ?? '')}" style="flex:1;min-width:150px">
    <input data-f="minutes" type="number" min="0" max="240" placeholder="Min." value="${esc(p.minutes ?? 0)}" style="width:80px" title="Minuten (0 = bis zum Beenden)">
    <input data-f="emoji" type="text" maxlength="4" placeholder="Emoji" value="${esc(p.emoji ?? '')}" style="width:80px" title="Emoji als Icon (wenn kein Bild hochgeladen ist)">
    <label class="knopf hell klein" for="pauseBild${i}">Bild</label><input type="file" id="pauseBild${i}" data-bild="${i}" accept="image/png,image/jpeg,image/webp" hidden>${p.icon ? `<button class="hell klein" data-bildweg="${i}" type="button">Bild weg</button>` : ''}
    <button class="hell klein" data-start="${i}" type="button">Starten</button><button class="hell klein" data-weg="${i}" type="button">Entfernen</button></div>`;
}
function renderPauseListe(rows = pauseData.presets) {
  $('pauseListe').innerHTML = rows.length ? rows.map(pauseRowHtml).join('') : '<p class="leise">Noch keine eigenen Pausen.</p>';
  $('pauseNeu').disabled = rows.length >= pauseData.max;
}
async function speicherePausen() { pauseData = await api('PUT', 'pause/presets', { presets: pauseRows() }); renderPause(); }
$('pauseNeu').onclick = () => { const rows = [...pauseRows(), { id: '', word: '', text: '', minutes: 0, emoji: '' }]; renderPauseListe(rows.map((r, i) => ({ ...(pauseData.presets.find((p) => p.id === r.id) ?? {}), ...r }))); };
$('pauseSpeichern').onclick = run(async () => { await speicherePausen(); meldung('Pausen gespeichert ✓'); });
$('pauseListe').onclick = run(async (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.weg !== undefined) { const rows = pauseRows(); rows.splice(Number(b.dataset.weg), 1); renderPauseListe(rows.map((r) => ({ ...(pauseData.presets.find((p) => p.id === r.id) ?? {}), ...r }))); return; }
  if (b.dataset.start !== undefined) { await speicherePausen(); const p = pauseData.presets[Number(b.dataset.start)]; pauseData = await api('POST', 'pause/start', { preset: p.id }); renderPause(); meldung(`Pause „${p.text}“ läuft ✓`); return; }
  if (b.dataset.bildweg !== undefined) { await speicherePausen(); pauseData = await api('DELETE', `pause/icon/${pauseData.presets[Number(b.dataset.bildweg)].id}`); renderPause(); meldung('Bild entfernt'); }
});
$('pauseListe').onchange = run(async (e) => {
  const inp = e.target.closest('[data-bild]'); if (!inp) return;
  const file = inp.files[0]; inp.value = ''; if (!file) return;
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Bitte ein Bild als PNG, JPG oder WebP wählen');
  const i = Number(inp.dataset.bild);
  const bmp = await createImageBitmap(file), f = Math.min(1, 256 / bmp.width, 256 / bmp.height); // klein halten, durchsichtige Ränder bleiben (PNG)
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bmp.width * f)); c.height = Math.max(1, Math.round(bmp.height * f));
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  await speicherePausen(); // erst speichern: das Bild gehört zu einer gespeicherten Pause
  pauseData = await api('POST', `pause/icon/${pauseData.presets[i].id}`, { data: c.toDataURL('image/png') }); renderPause(); meldung('Bild hochgeladen ✓');
});
$('pauseCopy').onclick = () => navigator.clipboard.writeText(`${location.origin}/pause`).then(() => meldung('Kopiert'));

// ---- Eigene Chat-Befehle und Zitate
let cmdData = null;
const ROLLEN = [['all', 'alle'], ['sub', 'Abos und mehr'], ['vip', 'VIPs und mehr'], ['mod', 'Moderation'], ['owner', 'nur Streamerin']];
const ARTEN = [['command', 'Befehl'], ['keyword', 'Stichwort'], ['timer', 'Erinnerung']];
const cmdRows = () => [...$('cmdListe').querySelectorAll('.cmdzeile')].map((r) => { const g = (f) => r.querySelector(`[data-f=${f}]`); return { id: r.dataset.id || '', enabled: g('enabled').checked, type: g('type').value, word: g('word').value, minutes: g('minutes').value, minMessages: g('minMessages').value, role: g('role').value, cooldown: g('cooldown').value, text: g('text').value, bookTitle: g('bookTitle').value, bookText: g('bookText').value, name: '' }; });
function cmdRowHtml(c) {
  const opt = (list, v) => list.map(([k, l]) => `<option value="${k}"${k === v ? ' selected' : ''}>${esc(l)}</option>`).join('');
  const timer = c.type === 'timer';
  return `<div class="cmdzeile" data-id="${esc(c.id ?? '')}" style="border-bottom:1px solid var(--rand,#bba98a);padding:10px 0">
    <div class="reihe" style="align-items:center"><label title="aktiv"><input data-f="enabled" type="checkbox"${c.enabled !== false ? ' checked' : ''}></label>
      <select data-f="type">${opt(ARTEN, c.type ?? 'command')}</select>
      <span class="cmdwort" ${timer ? 'hidden' : ''}><span class="leise">${c.type === 'keyword' ? '' : esc(cmdData.prefix)}</span><input data-f="word" type="text" maxlength="40" placeholder="${c.type === 'keyword' ? 'Stichwort' : 'ant'}" value="${esc(c.word ?? '')}" style="width:150px"></span>
      <span class="cmdtimer" ${timer ? '' : 'hidden'}>alle <input data-f="minutes" type="number" min="5" max="720" value="${esc(c.minutes || 20)}" style="width:70px"> Min., wenn mind. <input data-f="minMessages" type="number" min="1" max="100" value="${esc(c.minMessages || 3)}" style="width:60px"> Nachrichten</span>
      <label>darf <select data-f="role">${opt(ROLLEN, c.role ?? 'all')}</select></label>
      <label>Wartezeit <input data-f="cooldown" type="number" min="0" max="86400" value="${esc(c.cooldown ?? 10)}" style="width:80px"> s</label></div>
    <div class="reihe" style="align-items:center"><input data-f="text" type="text" maxlength="450" placeholder="Antwort im Chat" value="${esc(c.text ?? '')}" style="flex:2;min-width:240px">
      <input data-f="bookTitle" type="text" maxlength="60" placeholder="Buch: Überschrift (optional)" value="${esc(c.bookTitle ?? '')}" style="flex:1;min-width:150px"><input data-f="bookText" type="text" maxlength="200" placeholder="Buch: Text (optional)" value="${esc(c.bookText ?? '')}" style="flex:1;min-width:150px">
      <button class="hell klein" data-test="${esc(c.id ?? '')}" type="button">Ausprobieren</button><button class="hell klein" data-weg="1" type="button">Entfernen</button></div></div>`;
}
function renderCmds(list = cmdData.commands) {
  $('cmdListe').innerHTML = list.length ? list.map(cmdRowHtml).join('') : '<p class="leise">Noch keine eigenen Befehle.</p>';
  $('cmdNeu').disabled = list.length >= cmdData.max;
  for (const r of $('cmdListe').querySelectorAll('.cmdzeile')) r.querySelector('[data-f=type]').onchange = (e) => { const t = e.target.value; r.querySelector('.cmdwort').hidden = t === 'timer'; r.querySelector('.cmdtimer').hidden = t !== 'timer'; };
}
async function loadCmds() { cmdData = await api('GET', 'commands'); renderCmds(); }
$('cmdNeu').onclick = () => { renderCmds([...cmdRows().map((r) => ({ ...r })), { id: '', enabled: true, type: 'command', word: '', text: '', cooldown: 10, role: 'all' }]); };
$('cmdSpeichern').onclick = run(async () => { cmdData = await api('PUT', 'commands', { commands: cmdRows() }); renderCmds(); meldung('Befehle gespeichert ✓'); });
$('cmdListe').onclick = run(async (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.weg) { b.closest('.cmdzeile').remove(); $('cmdNeu').disabled = false; return; }
  if (b.dataset.test !== undefined) {
    if (!b.dataset.test) throw new Error('Bitte erst „Befehle speichern“, dann kannst du ihn ausprobieren');
    const r = await api('POST', `commands/test/${b.dataset.test}`, {});
    $('cmdStatus').textContent = `So sähe die Antwort aus: ${r.text || '(keine Chat-Antwort)'}${r.bookTitle || r.bookText ? ` · Buch im Overlay: ${r.bookTitle} ${r.bookText}` : ''}`;
  }
});
async function loadQuotes() {
  const { quotes } = await api('GET', 'quotes');
  $('zitatListe').innerHTML = quotes.length ? `<table><thead><tr><th>Nr.</th><th>Zitat</th><th>Von</th><th>Datum</th><th></th></tr></thead><tbody>${quotes.map((q) => `<tr><td>#${q.n}</td><td>${esc(q.text)}</td><td>${esc(q.by)}</td><td>${esc(q.date.split('-').reverse().join('.'))}</td><td><button class="hell klein" data-qweg="${q.n}" type="button">Löschen</button></td></tr>`).join('')}</tbody></table>` : '<p class="leise">Noch keine Zitate.</p>';
  for (const b of $('zitatListe').querySelectorAll('[data-qweg]')) b.onclick = run(async () => { if (!confirm(`Zitat #${b.dataset.qweg} löschen?`)) return; await api('DELETE', `quotes/${b.dataset.qweg}`); await loadQuotes(); meldung('Zitat gelöscht'); });
}
$('zitatAdd').onclick = run(async () => { await api('POST', 'quotes', { text: $('zitatText').value, by: 'Admin' }); $('zitatText').value = ''; await loadQuotes(); meldung('Zitat gespeichert ✓'); });

// ---- Eigene Töne für die Alerts
let soundAudio = null;
async function loadSounds() {
  const box = $('soundListe'); if (!box) return;
  const d = await api('GET', 'sounds');
  box.innerHTML = `<table><thead><tr><th>Alert</th><th>Eigener Ton</th><th></th></tr></thead><tbody>${d.slots.map((s) => `<tr><td><b>${esc(s.label)}</b></td><td>${s.version ? `<b>${esc(s.name)}</b> <span class="video-da">✓ ${Math.max(1, Math.round(s.size / 1000))} KB</span>` : '<span class="leise">Standard-Klang</span>'}</td><td>
    <label class="knopf hell klein" for="snd-${s.id}">${s.version ? 'Ersetzen' : 'Ton wählen'}</label><input type="file" id="snd-${s.id}" data-snd="${s.id}" accept="audio/mpeg,audio/wav,audio/ogg,.mp3,.wav,.ogg" hidden>
    ${s.version ? `<button class="hell klein" data-hoer="${s.id}" data-v="${s.version}" type="button">▶ Anhören</button><button class="hell klein" data-sndweg="${s.id}" type="button">Entfernen</button>` : ''}
    <button class="hell klein" data-sndtest="${s.id}" type="button">Alert ausprobieren</button></td></tr>`).join('')}</tbody></table>`;
  for (const inp of box.querySelectorAll('[data-snd]')) inp.onchange = run(async (e) => {
    const file = e.target.files[0]; e.target.value = ''; if (!file) return;
    if (file.size > d.maxKb * 1000) throw new Error(`Die Datei ist zu groß (höchstens ${d.maxKb} KB)`);
    const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('Die Datei konnte nicht gelesen werden')); r.readAsDataURL(file); });
    await api('POST', `sounds/${inp.dataset.snd}`, { name: file.name, data }); await loadSounds(); meldung('Ton gespeichert ✓');
  });
  for (const b of box.querySelectorAll('[data-sndweg]')) b.onclick = run(async () => { await api('DELETE', `sounds/${b.dataset.sndweg}`); await loadSounds(); meldung('Ton entfernt'); });
  for (const b of box.querySelectorAll('[data-hoer]')) b.onclick = () => { soundAudio?.pause(); soundAudio = new Audio(`/api/alert-sound?slot=${b.dataset.hoer}&v=${b.dataset.v}`); soundAudio.volume = Math.min(1, Math.max(0, (current?.alertSoundVolume ?? 80) / 100)); soundAudio.play().catch(() => meldung('Der Ton lässt sich hier nicht abspielen')); };
  const TEST = { follow: 'follow', sub: 'sub', resub: 'resub', gift: 'gift', cheer: 'cheer', raid: 'raid', rescue: 'rescue' };
  for (const b of box.querySelectorAll('[data-sndtest]')) b.onclick = run(async () => { await api('POST', 'test/event', { kind: TEST[b.dataset.sndtest] }); meldung('Gesendet – schau und hör ins Overlay'); });
}

// ---- Alert-Video (Buch, das aufklappt): ein Video, auf dessen Seite der Bot den Text einblendet
async function loadAlertVideo() {
  const box = $('alertVideo'); if (!box) return;
  let res, data;
  try { res = await fetch('/api/admin/video', { cache: 'no-store' }); data = await res.json(); } catch { data = null; }
  if (!res?.ok || !data?.videos) { box.innerHTML = `<span class="leise">${esc(data?.error ?? 'Das Video konnte nicht geladen werden.')}</span>`; return; }
  const v = data.videos.alert?.buch;
  box.innerHTML = `${v ? `<p><b>${esc(v.name || 'Video')}</b> <span class="video-da">✓ ${mb(v.size)}</span></p>` : '<p class="leise">Noch kein Video hochgeladen: das Overlay zeigt das gezeichnete Buch.</p>'}<div class="reihe"><label class="knopf hell" for="alertVid">${v ? 'Video ersetzen' : 'Video wählen'}</label><input type="file" id="alertVid" accept="video/mp4,video/webm" hidden>${v ? '<button class="hell" id="alertVidWeg" type="button">Entfernen</button>' : ''}</div>`;
  $('alertVid').onchange = run(async (e) => {
    const file = e.target.files[0]; e.target.value = ''; if (!file) return;
    $('alertVidStatus').textContent = `Lädt hoch: ${file.name} (${mb(file.size)}) …`;
    let r, d = {};
    try { r = await fetch(`/api/admin/video?s=alert&z=buch&n=${encodeURIComponent(file.name)}`, { method: 'PUT', headers: { 'x-upload': '1', 'content-type': file.type || 'video/mp4' }, body: file }); d = await r.json().catch(() => ({})); } catch { r = null; }
    $('alertVidStatus').textContent = '';
    if (!r) throw new Error('Das Hochladen ist abgebrochen. Ist das Video größer als 100 MB, oder war die Verbindung weg?');
    if (!r.ok) throw new Error(d.error ?? `Fehler ${r.status} beim Hochladen`);
    await loadAlertVideo(); meldung('Video hochgeladen. Mit den Knöpfen oben ausprobieren.');
  });
  if (v) $('alertVidWeg').onclick = run(async () => { await fetch('/api/admin/video?s=alert&z=buch', { method: 'DELETE', headers: { 'x-upload': '1' } }); await loadAlertVideo(); meldung('Video entfernt'); });
}

// ---- Jahreszeiten-Landschaft: acht Landschaftsbilder und drei Blätter mit Kleinteilen hochladen
const JZ_SLOTS = [['fruehlingA', 'Frühling · Anfang'], ['fruehlingB', 'Frühling · Ende'], ['sommerA', 'Sommer · Anfang'], ['sommerB', 'Sommer · Ende'], ['herbstA', 'Herbst · Anfang'], ['herbstB', 'Herbst · Ende'], ['winterA', 'Winter · Anfang'], ['winterB', 'Winter · Ende'], ['blumen', 'Blumen (Blatt)'], ['blaetter', 'Herbstblätter (Blatt)'], ['bluete', 'Blüten (Blatt)']];
async function loadJz() {
  const { slots } = await api('GET', 'hintergrund/jz');
  const da = JZ_SLOTS.filter(([k]) => slots[k]).length, bilder = JZ_SLOTS.filter(([k]) => k.endsWith('A') || k.endsWith('B')), fehlt = bilder.filter(([k]) => !slots[k]).map(([, l]) => l);
  $('jzStatus').textContent = da === 0 ? 'Noch keine Bilder hochgeladen: solange sieht man die alte Landschaft mit Pavillon. Lade die Bilder unten hoch (jedes Bild in seinen Platz).' : fehlt.length ? `${da} von ${JZ_SLOTS.length} Bildern da. Für Jahreszeiten ohne Bilder zeigt der Bot die alte Landschaft. Es fehlen: ${fehlt.join(', ')}.` : `Alle ${JZ_SLOTS.length} Bilder sind da.`;
  $('jzSlots').innerHTML = JZ_SLOTS.map(([k, label]) => `<div class="raum"><b>${label}</b><div class="bg-vorschau jz-vorschau">${slots[k] ? `<img src="/api/overlay-bg?jz=${k}&v=${slots[k]}" alt="${label}">` : '<span class="leise">fehlt noch</span>'}</div><div class="reihe"><label class="knopf hell klein" for="jz-${k}">${slots[k] ? 'Ersetzen' : 'Bild wählen'}</label><input type="file" id="jz-${k}" data-jz="${k}" accept="image/jpeg,image/png,image/webp" hidden>${slots[k] ? `<button class="hell klein" data-jzweg="${k}">Entfernen</button>` : ''}</div></div>`).join('');
  for (const inp of $('jzSlots').querySelectorAll('[data-jz]')) inp.onchange = run(async (e) => {
    const file = e.target.files[0]; const k = inp.dataset.jz; e.target.value = '';
    if (!file) return;
    await api('POST', `hintergrund/jz/${k}`, { data: await shrinkImage(file, 0.92) });
    const r = await api('PUT', 'settings', { hintergrund: 'jahreszeiten' });
    current = r.settings; renderScenes(r.settings); renderFolds(r.settings);
    await loadJz(); schedulePreview(0); meldung('Bild hochgeladen, die Jahreszeiten-Landschaft ist ausgewählt');
  });
  for (const b of $('jzSlots').querySelectorAll('[data-jzweg]')) b.onclick = run(async () => { await api('DELETE', `hintergrund/jz/${b.dataset.jzweg}`); await loadJz(); schedulePreview(0); meldung('Bild entfernt'); });
}
$('jzFortschritt').oninput = () => { previewProgress = Number($('jzFortschritt').value) / 100; $('jzFortschrittWert').textContent = `${$('jzFortschritt').value} %`; schedulePreview(150); };
$('jzFortschrittAus').onclick = () => { previewProgress = null; $('jzFortschritt').value = 0; $('jzFortschrittWert').textContent = 'echter Stand'; schedulePreview(0); };

// ---- Funktionen an- und abwählen (System)
let funktionen = [];
function wendeFunktionenAn() { setHiddenPages(funktionen.filter((f) => !f.on).flatMap((f) => f.pages)); }
function renderFunktionen() {
  $('funktionenListe').innerHTML = funktionen.map((f) => `<div class="feld"><label><input type="checkbox" data-fn="${esc(f.id)}"${f.on ? ' checked' : ''}> ${esc(f.label)}</label><div class="hinweis">${esc(f.hint)}</div></div>`).join('');
  for (const box of $('funktionenListe').querySelectorAll('[data-fn]')) box.onchange = run(async () => {
    const aus = funktionen.map((f) => (f.id === box.dataset.fn ? !box.checked : !f.on)).map((a, i) => (a ? funktionen[i].id : null)).filter(Boolean);
    await api('PUT', 'settings', { funktionenAus: aus.join(',') });
    await ladeFunktionen();
    await loadSettings();
    await syncTwitch(); // Rewards und Webhooks passend zu ein/aus nachziehen
    await loadState();
  });
}
async function ladeFunktionen() { funktionen = (await api('GET', 'funktionen')).items; wendeFunktionenAn(); renderFunktionen(); }

let navReady = false;
async function start() {
  await loadState(); // ohne Anmeldung bricht das hier ab und zeigt den Login
  show(true);
  await ladeFunktionen().catch(() => {});
  if (!navReady) { navReady = true; initNav({ onShow: onPageShow }); }
  await Promise.all([loadSettings(), loadTasks(), loadUsers()]);
  loadSystem().catch(() => {}); loadBg().catch(() => {}); loadRaeume().catch(() => {}); loadVideos().catch(() => {}); loadJz().catch(() => {}); loadAlertVideo().catch(() => {}); loadPause().catch(() => {}); loadSs().catch(() => {}); loadSounds().catch(() => {}); loadCmds().catch(() => {}); loadQuotes().catch(() => {});
  if (new URLSearchParams(location.search).has('verbunden')) { history.replaceState(null, '', '/admin/'); meldung('Verbunden – jetzt auf „Reward & Webhooks abgleichen“ klicken'); showPage('einrichtung'); }
}
start().catch(() => show(false));
