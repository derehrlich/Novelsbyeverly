import { ITEMS, SLOTS, SZENEN, slotValues } from '../js/katalog.mjs';
import { DEFAULT_LAYOUT, normalizeLayout } from '../js/layout.mjs';

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
function show(app) { $('app').hidden = !app; $('login').hidden = app; }

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
    envOk ? punkt('ok', 'Umgebungsvariablen gesetzt') : punkt('fehler', `In Netlify fehlen: ${['TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET', 'EVENTSUB_SECRET'].filter((k) => !e[k]).join(', ')}`),
    state.connectedAs ? punkt(state.missingScopes.length ? 'warn' : 'ok', `Kanal verbunden als <b>${esc(state.connectedAs)}</b>${state.missingScopes.length ? ` – Berechtigungen fehlen (${esc(state.missingScopes.join(', '))}), bitte neu verbinden` : ''}`) : punkt('fehler', 'Kanal nicht verbunden'),
    state.botAs ? punkt(state.botMissingScopes.length ? 'warn' : 'ok', `Bot-Account verbunden als <b>${esc(state.botAs)}</b>${state.botMissingScopes.length ? ' – Berechtigungen fehlen, bitte neu verbinden' : ''}`) : punkt('warn', 'Kein Bot-Account verbunden – der Bot schreibt dann unter dem Kanalnamen'),
    state.subscription === 'enabled' ? punkt('ok', 'Chat-Webhook aktiv') : punkt(state.subscription ? 'warn' : 'fehler', `Webhooks: ${esc(state.subscriptionError ?? state.subscription ?? 'noch nicht eingerichtet')}`),
    state.revoked ? punkt('fehler', `Twitch hat ein Abo widerrufen (${esc(state.revoked)}) – bitte abgleichen`) : '',
  ];
  $('status').innerHTML = rows.join('');
  const u = state.urls;
  const urlRow = (label, url, hint = '') => `<div class="url"><b>${label}</b> <code>${esc(url)}</code><button class="hell" data-copy="${esc(url)}">Kopieren</button></div>${hint ? `<div class="leise">${hint}</div>` : ''}`;
  $('urls').innerHTML = urlRow('OBS-Overlay', u.overlay, 'Browser-Quelle 1920×1080, „Audio über OBS steuern“ aktivieren. Die Kamera in OBS <b>unter</b> das Overlay legen. Nur einzelne Teile: <code>?teile=uhr,woerter,tasks,musik,szene</code>')
    + urlRow('Gaming-Overlay', u.gaming, 'Zusätzliche Browser-Quelle 1920×1080 für Gaming. Kamerafenster und Deathcounter stellst du unten bei „Gaming-Szene“ ein. Spiel (16:9) in OBS ganz unten, die Kamera <b>darüber</b>, beide unter dem Overlay.')
    + urlRow('Twitch-Weiterleitung', u.redirect, 'Diese Adresse muss in der Twitch-Entwickler-App als „OAuth Redirect URL“ stehen.')
    + urlRow('Wörter-Schnittstelle', u.words, `Für ein Hilfsprogramm (Papyrus): <code>POST</code> mit <code>Authorization: Bearer &lt;INGEST_TOKEN&gt;</code> und <code>{"absolute": 4231}</code>. ${e.INGEST_TOKEN ? 'INGEST_TOKEN ist gesetzt.' : 'INGEST_TOKEN ist noch nicht gesetzt.'}`);
  $('todeUrl').textContent = u.tode;
  for (const b of document.querySelectorAll('[data-copy]')) b.onclick = () => navigator.clipboard.writeText(b.dataset.copy).then(() => meldung('Kopiert'));
  renderTimer();
  renderWords(state.words);
  $('plaetze').textContent = `${state.seated} sitzen · Zimmer: ${state.communityHours} Std gemeinsame Arbeitszeit`;
  $('plaetze').hidden = state.modus !== 'zimmer'; $('zimmerKnoepfe').hidden = state.modus !== 'zimmer';
  $('pomoHeute').textContent = state.pomodoro.done; $('pomoZiel').textContent = state.pomodoro.goal || '–';
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
  if (!t || t.phase === 'idle') { $('timer').textContent = 'bereit'; $('timerInfo').textContent = ''; return; }
  const s = Math.max(0, Math.ceil((t.endsAt - Date.now()) / 1000));
  $('timer').textContent = `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
  $('timerInfo').textContent = t.phase === 'focus' ? 'Pomodoro läuft' : 'Pause';
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
  tageszeiten: ['tageszeit', [['auto', 'Auto'], ['morgen', 'Morgengrauen'], ['mittag', 'Mittag'], ['abend', 'Abend']]],
  quellen: ['wachstumQuelle', [['ziel', 'Ziel-Karte'], ['zeit', 'Streamzeit'], ['woerter', 'Wörter'], ['pomodoro', 'Pomodoros'], ['kombi', 'Zeit + Ziel']]],
  zielArten: ['zielArt', [['woerter', 'Wörter schreiben'], ['seiten', 'Seiten lesen'], ['zeit', 'Streamzeit'], ['pomodoros', 'Pomodoros']]],
  tat: ['stefanieTaetigkeit', [['auto', 'Automatisch'], ['laptop', 'Am Laptop'], ['buch', 'Mit Buch']]],
};
function renderScenes(settings) {
  for (const [boxId, [key, opts]] of Object.entries(AUSWAHL)) {
    $(boxId).innerHTML = opts.map(([v, label]) => `<button data-v="${v}" class="${settings[key] === v ? 'aktiv' : ''}">${label}</button>`).join('');
    for (const b of $(boxId).querySelectorAll('button')) b.onclick = run(async () => { const r = await api('PUT', 'settings', { [key]: b.dataset.v }); current = r.settings; renderScenes(r.settings); meldung('Gespeichert – schau ins Overlay'); });
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
async function loadPages() { const p = await api('GET', 'pages'); $('seitenHeute').textContent = fmtN(p.today); $('seitenZiel').textContent = fmtN(p.goal); }
const sendPages = (mode) => run(async () => { const v = $('seitenWert').value; if (v === '') throw new Error('Bitte eine Zahl eingeben'); await api('POST', 'pages', { mode, value: v }); $('seitenWert').value = ''; await loadPages(); });
$('sSet').onclick = sendPages('set'); $('sPlus').onclick = sendPages('delta');
async function loadStream() {
  const s = await api('GET', 'stream');
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
  tageszeit: [['auto', 'Automatisch (nach Uhrzeit)'], ['morgen', 'Morgengrauen'], ['mittag', 'Mittag'], ['abend', 'Abend']],
  wachstumQuelle: [['ziel', 'Ziel-Karte'], ['zeit', 'Streamzeit'], ['woerter', 'Wörter des Tages'], ['pomodoro', 'Pomodoros des Tages'], ['kombi', 'Mittel aus Zeit und Ziel']],
  appearOn: [['sit', 'Per Chatbefehl !sitzen'], ['checkin', 'Per Kanalpunkte-Reward „Check-in“'], ['both', 'Beides']],
  gamingDesign: [['gemuetlich', 'Gemütlich (Landschaft, Holzrahmen)'], ['glas', 'Glas (schlicht, durchscheinend, an Apple angelehnt)']],
  gamingHintergrund: [['design', 'Landschaft bzw. Glasverlauf (je nach Design)'], ['obs', 'Unscharfes Spielbild (Rand durchsichtig, Unschärfe in OBS)']],
  gamingTodePos: [['oben-links', 'Oben links'], ['oben-mitte', 'Oben Mitte'], ['oben-rechts', 'Oben rechts'], ['unten-links', 'Unten links'], ['unten-mitte', 'Unten Mitte'], ['unten-rechts', 'Unten rechts']],
  scene: Object.entries(SZENEN).map(([k, v]) => [k, v.label]),
};
const SCHEMA = [
  ['Darstellung', [
    ['szeneModus', 'Darstellung', 'select', 'Die Tische mit Figuren der Zuschauer sind pausiert und lassen sich hier wieder einschalten.'],
    ['jahreszeit', 'Jahreszeit', 'select'], ['tageszeit', 'Tageszeit', 'select'], ['wachstumQuelle', 'Landschaft wächst mit', 'select'], ['stefanieTaetigkeit', 'Stefanie im Pavillon', 'select'],
  ]],
  ['Gaming-Szene (/gaming)', [
    ['gamingDesign', 'Design', 'select', 'Glas: ruhiger Farbverlauf nach Tageszeit, durchscheinende Rahmen mit feiner Lichtkante, Deathcounter als Glaskapsel.'],
    ['gamingHintergrund', 'Hintergrund am Rand', 'select', 'Unscharfes Spielbild: In OBS die Spielaufnahme kopieren („Als Referenz einfügen“), auf Vollbild ziehen (Strg+F), Filter „Unschärfe“ hinzufügen und diese Kopie UNTER das scharfe Spiel legen. Reihenfolge von unten: unscharfe Kopie, Spiel, Kamera, Overlay.'],
    ['gamingAbdunkeln', 'Rand abdunkeln in % (nur bei unscharfem Spielbild, 0–80)', 'number'],
    ['gamingKameraOL', 'Kamerafenster oben links', 'bool', 'Nicht angehakte Fenster fehlen ganz. Das Kamerabild ist quadratisch und ragt über die Ecke des Spielrahmens.'],
    ['gamingKameraOR', 'Kamerafenster oben rechts', 'bool'], ['gamingKameraUL', 'Kamerafenster unten links', 'bool'], ['gamingKameraUR', 'Kamerafenster unten rechts', 'bool'],
    ['gamingKameraGroesse', 'Kamera: Seitenlänge in Pixeln (160–700)', 'number'],
    ['gamingTode', 'Deathcounter anzeigen', 'bool', 'Steuerung im Chat (!tod), per Hotkey oder oben bei „Gaming-Szene“.'],
    ['gamingTodeLabel', 'Deathcounter: Beschriftung', 'text'], ['gamingTodePos', 'Deathcounter: Position im Spielfenster', 'select', 'Steht in derselben Ecke ein Kamerafenster, rückt die Karte daneben.'],
    ['gamingTodeSekunden', 'Deathcounter blendet nach … Sekunden aus (0 = bleibt sichtbar)', 'number', 'Er erscheint bei jedem Zählen, bei !tode und mit „Einblenden“ im Admin und verschwindet nach dieser Zeit wieder.'],
    ['gamingTodeChat', 'Bot schreibt die Zahl bei jeder Änderung in den Chat', 'bool'],
    ['gamingTodeTemplate', 'Chat-Text', 'area', '{n} {label}'],
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
  ['Zimmer-Modus (pausiert)', [
    ['appearOn', 'Figur erscheint bei', 'select', 'Umschaltbar jederzeit. Bei Reward oder „Beides“ danach auf „Reward & Webhooks abgleichen“ klicken.'],
    ['scene', 'Szene', 'select'], ['maxSeats', 'Plätze (1–10)', 'number'],
    ['seatIdleMinutes', 'Platz frei nach … Min ohne Chatnachricht', 'number'],
    ['unlocksEnabled', 'Freischaltungen (Ränge, Gegenstände, Zimmer-Deko)', 'bool', 'Aus: alle Gegenstände sind sofort frei.'],
    ['checkinRewardTitle', 'Check-in-Reward: Name', 'text'], ['checkinRewardCost', 'Check-in-Reward: Preis', 'number'],
    ['sitTemplate', 'Hinsetzen', 'area', '{user} {ort} {rank}'], ['sitAgainTemplate', 'Schon gesetzt', 'area', '{user} {ort}'], ['fullTemplate', 'Alles belegt', 'area', '{user}'],
    ['leaveTemplate', 'Aufstehen', 'area', '{user} {minutes} {total}'], ['notSeatedTemplate', 'Sitzt nicht', 'area', '{user} {sit}'], ['checkinTemplate', 'Check-in per Reward', 'area', '{user} {count} {ort} {rank}'],
    ['rankUpTemplate', 'Neuer Rang', 'area', '{user} {rank} {hours}'], ['unlockTemplate', 'Neuer Gegenstand', 'area', '{user} {item} {figur}'], ['decoTemplate', 'Zimmer wächst', 'area', '{deko}'],
  ]],
];
let current = null;

async function loadSettings() {
  const { settings } = await api('GET', 'settings');
  current = settings;
  $('formular').innerHTML = SCHEMA.map(([titel, felder]) => `<h3>${titel}</h3><div class="felder">${felder.map(([key, label, type, hint]) => {
    const v = settings[key];
    const input = type === 'select' ? `<select data-k="${key}">${OPT[key].map(([val, text]) => `<option value="${val}" ${val === v ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select>`
      : type === 'bool' ? `<input type="checkbox" data-k="${key}" ${v ? 'checked' : ''}>`
        : type === 'number' ? `<input type="number" data-k="${key}" value="${esc(v)}">`
          : type === 'area' ? `<textarea data-k="${key}" maxlength="300">${esc(v)}</textarea>`
            : `<input data-k="${key}" value="${esc(v)}">`;
    return `<div class="feld ${type === 'area' ? 'breit' : ''}"><label>${esc(label)}</label>${input}${hint ? `<div class="hinweis">${type === 'area' ? 'Platzhalter: ' : ''}${esc(hint)}</div>` : ''}</div>`;
  }).join('')}</div>`).join('');
  renderScenes(settings);
  fillMusik(settings); fillZiele(settings); fillStefanie(settings);
  loadPages().catch(() => {}); loadStream().catch(() => {}); loadTode().catch(() => {});
  if (!layoutState) loadLayout(settings.layout);
}
$('speichern').onclick = run(async () => {
  const body = {};
  for (const el of $('formular').querySelectorAll('[data-k]')) body[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value;
  const { settings } = await api('PUT', 'settings', body);
  current = settings; renderScenes(settings);
  meldung('Gespeichert');
});

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
  if (!$('editorFrame').src) { $('editorFrame').src = '/overlay.html?editor=1&kamera=1&ton=aus'; $('editorFrame').onload = pushLayout; }
  fitEditor(); renderBoxen(); pushLayout();
}
addEventListener('resize', fitEditor);
const edChange = () => { if (!gewaehlt) return; const l = layoutState[gewaehlt]; l.on = $('edAn').checked; if (gewaehlt !== 'kamera') l.s = Number($('edGroesse').value); else { l.w = Number($('edW').value); l.h = l.w; } layoutState = normalizeLayout(layoutState); renderBoxen(); pushLayout(); };
for (const id of ['edAn', 'edGroesse', 'edW']) $(id).oninput = edChange;
$('layoutSpeichern').onclick = run(async () => { const r = await api('PUT', 'settings', { layout: layoutState }); current = r.settings; layoutState = normalizeLayout(r.settings.layout); renderBoxen(); meldung('Anordnung gespeichert'); });
$('layoutZurueck').onclick = () => { layoutState = normalizeLayout(structuredClone(DEFAULT_LAYOUT)); if (gewaehlt) select(gewaehlt); else renderBoxen(); pushLayout(); meldung('Standard geladen – noch speichern'); };
$('layoutLaden').onclick = run(async () => { const { settings } = await api('GET', 'settings'); layoutState = normalizeLayout(settings.layout); if (gewaehlt) select(gewaehlt); else renderBoxen(); pushLayout(); });

async function start() {
  await loadState(); // ohne Anmeldung bricht das hier ab und zeigt den Login
  show(true);
  await Promise.all([loadSettings(), loadTasks(), loadUsers()]);
  if (new URLSearchParams(location.search).has('verbunden')) { history.replaceState(null, '', '/admin/'); meldung('Verbunden – jetzt auf „Reward & Webhooks abgleichen“ klicken'); }
}
start().catch(() => show(false));

// ---- Gaming-Szene: Deathcounter von Hand bedienen
async function loadTode() { const r = await api('GET', 'tode'); $('todeZahl').textContent = r.n; }
const todeAktion = (aktion, wert) => run(async () => { const r = await api('POST', 'tode', { aktion, wert }); $('todeZahl').textContent = r.n; });
$('todePlus').onclick = todeAktion('plus'); $('todeMinus').onclick = todeAktion('minus');
$('todeZeigen').onclick = todeAktion('zeigen');
$('todeReset').onclick = run(async () => { if (confirm('Deathcounter auf 0 setzen?')) { const r = await api('POST', 'tode', { aktion: 'reset' }); $('todeZahl').textContent = r.n; } });
$('todeSetzen').onclick = run(async () => { const r = await api('POST', 'tode', { aktion: 'set', wert: $('todeWert').value }); $('todeZahl').textContent = r.n; $('todeWert').value = ''; });
loadTode().catch(() => {});
