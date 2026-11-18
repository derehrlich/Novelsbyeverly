import { ITEMS, SLOTS, SZENEN, slotValues } from '../js/katalog.mjs';
import { DEFAULT_LAYOUT, normalizeLayout } from '../js/layout.mjs';
import { initNav, PAGES, PREVIEW_PAGES, showPage } from './nav.js';

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
  dSzene: ['hintergrund', [['landschaft', 'Landschaft mit Pavillon'], ['bild', 'Eigenes Bild'], ['zug', 'Zugabteil'], ['sitzecke', 'Sitzecke am Fenster'], ['stadt', 'Stadt'], ['see', 'See und Weitblick']]],
  dTageszeit: ['tageszeit', [['auto', 'Auto'], ['morgen', 'Morgen'], ['mittag', 'Mittag'], ['abend', 'Abend'], ['nacht', 'Nacht']]],
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
  kartenStil: [['papier', 'Papier (warme Karten, wie bisher)'], ['glas', 'Glas (durchsichtig und getönt)']],
  hintergrund: [['landschaft', 'Gemalte Landschaft mit Pavillon'], ['bild', 'Eigenes Bild (Upload unten)'], ['zug', 'Zugabteil'], ['sitzecke', 'Sitzecke am Fenster'], ['stadt', 'Stadt'], ['see', 'See und Weitblick']],
  scene: Object.entries(SZENEN).map(([k, v]) => [k, v.label]),
};
const SCHEMA = [
  ['Darstellung', [
    ['szeneModus', 'Darstellung', 'select', 'Die Tische mit Figuren der Zuschauer sind pausiert und lassen sich hier wieder einschalten.'],
    ['jahreszeit', 'Jahreszeit', 'select'], ['tageszeit', 'Tageszeit', 'select'], ['wachstumQuelle', 'Landschaft wächst mit', 'select'], ['stefanieTaetigkeit', 'Stefanie im Pavillon', 'select'],
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
const TOGGLE_GROUPS = new Set(['Check-in und Streak', 'Punkte und Rangliste', 'Sicherung (nur Heimserver)']);
// Änderungen an diesen Werten gleichen Reward und Webhooks bei Twitch gleich mit ab
const SYNC_KEYS = ['checkinEnabled', 'pointsEnabled', 'appearOn', 'checkinRewardTitle', 'checkinRewardCost', 'chatCommands'];
const openFolds = new Set();
const RANGE = { glasStaerke: [0, 90], glasUnschaerfe: [0, 60], wind: [0, 100], kulisseTempo: [0, 100] };

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
let previewTimer = 0, previewBusy = false, previewAgain = false;
const PREVIEW_KEYS = ['jahreszeit', 'tageszeit', 'wachstumQuelle', 'zielArt', 'stefanieTaetigkeit', 'szeneModus', 'scene', 'moduleBlume', 'moduleKerze', 'moduleBuecher', 'moduleDeko', 'pomodoroGoal', 'focusMinutes', 'kartenStil', 'glasFarbe', 'glasStaerke', 'glasUnschaerfe', 'hintergrund', 'wetter', 'wind', 'kulisseTempo', 'musikQuelle', 'musikUrl', 'wordGoal', 'seitenGoal', 'streamGoalMinutes', 'unlocksEnabled'];
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
    const view = await api('POST', 'preview', { draft: collectDraft() });
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
  for (const inp of $('videos').querySelectorAll('input[type=file]')) inp.onchange = run(async (e) => {
    const file = e.target.files[0]; const s = inp.dataset.s, z = inp.dataset.z; e.target.value = '';
    if (!file) return;
    $('videoStatus').textContent = `Lädt hoch: ${file.name} (${mb(file.size)}) …`;
    let r, d = {};
    try { r = await fetch(`/api/admin/video?s=${s}&z=${z}`, { method: 'PUT', headers: { 'x-upload': '1', 'content-type': file.type || 'video/mp4' }, body: file }); d = await r.json().catch(() => ({})); } catch { r = null; }
    $('videoStatus').textContent = '';
    if (!r) throw new Error('Das Hochladen ist abgebrochen. Ist das Video größer als 100 MB, oder war die Verbindung weg?');
    if (!r.ok) throw new Error(d.error ?? `Fehler ${r.status} beim Hochladen`);
    const st = await api('PUT', 'settings', { hintergrund: s, tageszeit: z });
    current = st.settings; renderScenes(st.settings); renderFolds(st.settings);
    await loadVideos(); schedulePreview(0); meldung('Video hochgeladen, Szene und Tageszeit sind ausgewählt');
  });
  for (const b of $('videos').querySelectorAll('[data-weg-s]')) b.onclick = run(async () => { await fetch(`/api/admin/video?s=${b.dataset.wegS}&z=${b.dataset.wegZ}`, { method: 'DELETE', headers: { 'x-upload': '1' } }); await loadVideos(); schedulePreview(0); meldung('Video entfernt'); });
}

let navReady = false;
async function start() {
  await loadState(); // ohne Anmeldung bricht das hier ab und zeigt den Login
  show(true);
  if (!navReady) { navReady = true; initNav({ onShow: onPageShow }); }
  await Promise.all([loadSettings(), loadTasks(), loadUsers()]);
  loadSystem().catch(() => {}); loadBg().catch(() => {}); loadRaeume().catch(() => {}); loadVideos().catch(() => {});
  if (new URLSearchParams(location.search).has('verbunden')) { history.replaceState(null, '', '/admin/'); meldung('Verbunden – jetzt auf „Reward & Webhooks abgleichen“ klicken'); showPage('einrichtung'); }
}
start().catch(() => show(false));
