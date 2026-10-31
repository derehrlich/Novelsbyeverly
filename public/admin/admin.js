import { SZENEN } from '../js/katalog.mjs';
import { DEFAULT_LAYOUT, normalizeLayout } from '../js/layout.mjs';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

async function api(method, path, body) {
  const res = await fetch(`/api/admin/${path}`, { method, headers: method === 'GET' ? {} : { 'content-type': 'application/json' }, body: method === 'GET' ? undefined : JSON.stringify(body ?? {}) });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== 'login') { show(false); throw new Error('Nicht angemeldet'); }
  if (!res.ok) throw new Error(data.error ?? `Fehler ${res.status}`);
  return data;
}
let toastTimer;
function meldung(text, fehler = false) {
  const el = $('meldung');
  el.textContent = text; el.className = `meldung${fehler ? ' fehler' : ''}`; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, fehler ? 7000 : 2500);
}
const run = (fn) => async (...a) => { try { await fn(...a); } catch (e) { meldung(e.message, true); } };
function show(app) { $('app').hidden = !app; $('login').hidden = app; }
const fmtN = (n) => new Intl.NumberFormat('de-DE').format(n);

// ---- Bereiche (Seitenleiste)
const TABS = ['start', 'overlay', 'ziele', 'twitch', 'einstellungen', 'community', 'system'];
function showTab(name) {
  const tab = TABS.includes(name) ? name : 'start';
  for (const t of TABS) $(`seite-${t}`).hidden = t !== tab;
  for (const b of document.querySelectorAll('#nav [data-tab]')) b.classList.toggle('aktiv', b.dataset.tab === tab);
  if (tab === 'overlay') fitEditor();
  if (tab === 'system') loadSystem().catch(() => {});
  if (tab === 'community') loadUsers().catch(() => {});
  scrollTo(0, 0);
}
for (const b of document.querySelectorAll('#nav [data-tab]')) b.onclick = () => { location.hash = b.dataset.tab; };
addEventListener('hashchange', () => showTab(location.hash.slice(1)));

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
  const rows = [
    e.TWITCH_CLIENT_ID ? punkt('ok', 'Twitch-App eingetragen') : punkt('fehler', 'Twitch-Client-ID fehlt – <a href="#twitch">eintragen</a>'),
    state.connectedAs ? punkt(state.missingScopes.length ? 'warn' : 'ok', `Kanal verbunden als <b>${esc(state.connectedAs)}</b>${state.missingScopes.length ? ` – Berechtigungen fehlen (${esc(state.missingScopes.join(', '))}), bitte neu verbinden` : ''}`) : punkt('fehler', 'Kanal nicht verbunden'),
    state.botAs ? punkt(state.botMissingScopes.length ? 'warn' : 'ok', `Bot-Account verbunden als <b>${esc(state.botAs)}</b>${state.botMissingScopes.length ? ' – Berechtigungen fehlen, bitte neu verbinden' : ''}`) : punkt('warn', 'Kein Bot-Account – der Bot schreibt unter dem Kanalnamen'),
    (() => { const v = state.eventsub; if (!v) return ''; if (v.state === 'verbunden') return punkt(v.warnings.length ? 'warn' : 'ok', `Verbindung zu Twitch steht${v.warnings.length ? ` – ${esc(v.warnings.join(' · '))}` : ''}`); return punkt(v.state === 'nicht verbunden' ? 'warn' : 'fehler', `Verbindung zu Twitch: ${esc(v.state)}${v.error ? ` (${esc(v.error)})` : ''}`); })(),
    state.revoked ? punkt('fehler', `Twitch hat ein Abo widerrufen (${esc(state.revoked)}) – bitte abgleichen`) : '',
  ].join('');
  $('status').innerHTML = rows; $('status2').innerHTML = rows;
  $('hinweisTwitch').hidden = Boolean(e.TWITCH_CLIENT_ID);
  const u = state.urls;
  const urlRow = (label, url, hint = '') => `<div class="url"><b>${label}</b> <code>${esc(url)}</code><button class="hell" data-copy="${esc(url)}">Kopieren</button></div>${hint ? `<div class="leise">${hint}</div>` : ''}`;
  $('urls').innerHTML = urlRow('OBS-Overlay', u.overlay, 'Browser-Quelle 1920×1080, „Audio über OBS steuern“ aktivieren. Die Kamera in OBS <b>unter</b> das Overlay legen. Nur einzelne Teile: <code>?teile=uhr,woerter,tasks,musik,szene</code>')
    + urlRow('Wörter-Schnittstelle', u.words, `Für ein Hilfsprogramm (Papyrus): <code>POST</code> mit <code>Authorization: Bearer &lt;INGEST_TOKEN&gt;</code> und <code>{"absolute": 4231}</code>. ${e.INGEST_TOKEN ? 'INGEST_TOKEN ist gesetzt.' : 'INGEST_TOKEN ist noch nicht gesetzt (Umgebungsvariable im Container).'}`);
  for (const b of document.querySelectorAll('[data-copy]')) b.onclick = () => navigator.clipboard.writeText(b.dataset.copy).then(() => meldung('Kopiert'));
  renderTimer();
  renderWords(state.words);
  $('plaetze').textContent = `${state.seated} sitzen · Zimmer: ${state.communityHours} Std gemeinsame Arbeitszeit`;
  $('plaetze').hidden = state.modus !== 'zimmer';
  $('pomoHeute').textContent = state.pomodoro.done; $('pomoZiel').textContent = state.pomodoro.goal || '–';
}

// ---- Twitch-App (Client-ID und Secret)
async function loadApp() {
  const a = await api('GET', 'twitch-app');
  $('appId').value = a.clientId;
  $('appSecret').value = '';
  $('appSecret').placeholder = a.hasSecret ? '•••••••••• (gespeichert)' : 'leer lassen bei „Public“';
  $('appSecretHinweis').textContent = a.hasSecret ? `Ein Secret ist gespeichert${a.secretSource === 'env' ? ' (aus der Umgebungsvariable des Containers)' : ''}. Leer lassen, um es zu behalten.` : 'Kein Secret gesetzt.';
  $('appSecretWeg').hidden = a.secretSource !== 'admin';
  $('appStatus').textContent = a.idSource === 'env' ? 'Die Client-ID kommt aus der Umgebungsvariable des Containers. Was du hier speicherst, hat Vorrang.' : '';
  $('appStatus').className = 'leise';
}
$('appSpeichern').onclick = run(async () => {
  const body = { clientId: $('appId').value };
  if ($('appSecret').value.trim()) body.clientSecret = $('appSecret').value;
  const r = await api('PUT', 'twitch-app', body);
  await loadApp(); await loadState();
  meldung(r.disconnected ? 'Gespeichert. Die Client-ID hat sich geändert – bitte Kanal und Bot neu verbinden.' : 'Gespeichert');
});
$('appSecretWeg').onclick = run(async () => { if (!confirm('Gespeichertes Secret entfernen?')) return; await api('PUT', 'twitch-app', { clearSecret: true }); await loadApp(); meldung('Secret entfernt'); });
$('appPruefen').onclick = run(async () => {
  $('appStatus').textContent = 'Prüfe …'; $('appStatus').className = 'leise';
  const r = await api('POST', 'twitch-app/test');
  $('appStatus').textContent = r.message; $('appStatus').className = r.ok ? 'leise ok' : 'leise fehler';
});

// ---- Mit Twitch verbinden (Code auf twitch.tv/activate bestätigen)
let geraet = null;
async function verbinden(role) {
  const d = await fetch('/api/auth/device/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ role }) }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? `Fehler ${r.status}`); return j; });
  geraet = d;
  const box = $('geraet'); box.hidden = false;
  box.innerHTML = `<p><b>${role === 'bot' ? 'Bot-Account' : 'Kanal'} verbinden:</b> Öffne <a href="${esc(d.verification_uri)}" target="_blank" rel="noopener">${esc(d.verification_uri)}</a>, gib den Code <code class="code">${esc(d.user_code)}</code> ein und bestätige. ${role === 'bot' ? 'Melde dich dort mit dem <b>Bot-Konto</b> an (privates Fenster).' : ''} Diese Seite wartet darauf.</p>`;
  const stop = Date.now() + d.expires_in * 1000;
  while (geraet === d && Date.now() < stop) {
    await new Promise((r) => setTimeout(r, d.interval * 1000));
    if (geraet !== d) return;
    const res = await fetch('/api/auth/device/poll', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ role, device_code: d.device_code }) });
    const j = await res.json();
    if (j.pending) continue;
    box.hidden = true; geraet = null;
    if (!res.ok) throw new Error(j.error ?? `Fehler ${res.status}`);
    meldung(`Verbunden als ${j.login}`); await loadState(); return;
  }
  if (geraet === d) { box.hidden = true; geraet = null; throw new Error('Der Code ist abgelaufen, bitte noch einmal starten'); }
}
$('verbindeKanal').onclick = run(() => verbinden('broadcaster'));
$('verbindeBot').onclick = run(() => verbinden('bot'));
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
setInterval(() => { if (!$('app').hidden) { loadState().catch(() => {}); loadStream().catch(() => {}); loadPages().catch(() => {}); } }, 15000);
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
  modi: ['szeneModus', [['wachstum', 'Wachsende Landschaft'], ['fenster', 'Fenster-Ansicht'], ['zimmer', 'Zimmer mit Figuren (pausiert)']]],
  fensterOrte: ['fensterOrt', [['lese', 'Gemütliche Leseecke'], ['arbeit', 'Arbeitsplatz']]],
  fensterBlicke: ['fensterBlick', [['stadt', 'Stadt'], ['landschaft', 'Landschaft'], ['wald', 'Wald'], ['see', 'See']]],
  fensterWetter: ['fensterWetter', [['auto', 'Auto (Winter: Schnee)'], ['klar', 'Klar'], ['regen', 'Regen'], ['schnee', 'Schnee']]],
};
function renderScenes(settings) {
  for (const [boxId, [key, opts]] of Object.entries(AUSWAHL)) {
    $(boxId).innerHTML = opts.map(([v, label]) => `<button data-v="${v}" class="${settings[key] === v ? 'aktiv' : ''}">${label}</button>`).join('');
    for (const b of $(boxId).querySelectorAll('button')) b.onclick = run(async () => { const r = await api('PUT', 'settings', { [key]: b.dataset.v }); current = r.settings; renderScenes(r.settings); meldung('Gespeichert'); });
  }
}

// ---- Wörter
function renderWords(w) { $('woerterHeute').textContent = new Intl.NumberFormat('de-DE').format(w.today); $('woerterZiel').textContent = new Intl.NumberFormat('de-DE').format(w.goal); }
const sendWords = (mode) => run(async () => { const v = $('woerterWert').value; if (mode !== 'reset' && v === '') throw new Error('Bitte eine Zahl eingeben'); renderWords(await api('POST', 'words', { mode, value: v })); $('woerterWert').value = ''; });
$('wAbs').onclick = sendWords('absolute'); $('wDelta').onclick = sendWords('delta'); $('wToday').onclick = sendWords('today'); $('wReset').onclick = sendWords('reset');

// ---- Ziele, Seiten, Streamzeit
function fillZiele(settings) {
  $('zielWoerter').value = settings.wordGoal; $('zielSeiten').value = settings.seitenGoal; $('zielStunden').value = settings.streamGoalMinutes / 60;
}
for (const id of ['zielWoerter', 'zielSeiten', 'zielStunden']) {
  $(id).onchange = run(async () => {
    const r = await api('PUT', 'settings', { wordGoal: Number($('zielWoerter').value), seitenGoal: Number($('zielSeiten').value), streamGoalMinutes: Math.round(Number($('zielStunden').value) * 60) });
    current = r.settings; fillZiele(r.settings); meldung('Gespeichert'); await loadState();
  });
}
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

// ---- Einstellungen: jedes Feld wird beim Ändern sofort gespeichert
const OPT = {
  appearOn: [['sit', 'Per Chatbefehl !sitzen'], ['checkin', 'Per Kanalpunkte-Reward „Check-in“'], ['both', 'Beides']],
  scene: Object.entries(SZENEN).map(([k, v]) => [k, v.label]),
};
const SCHEMA = {
  formModule: [
    ['moduleBlume', 'Blume wächst mit den Wörtern', 'bool', 'Vom Keimling bis zur Blüte, wenn das Tagesziel erreicht ist.'],
    ['moduleKerze', 'Kerze brennt mit dem Pomodoro', 'bool', 'Brennt während des Fokus herunter, in der Pause raucht sie.'],
    ['moduleBuecher', 'Bücherstapel wächst mit den Pomodoros', 'bool', 'Pro geschafftem Pomodoro kommt ein Buch dazu (bis 8).'],
    ['moduleDeko', 'Zimmer wächst mit der gemeinsamen Arbeitszeit', 'bool', 'Nur im Zimmer-Modus.'],
  ],
  formPomodoro: [
    ['focusMinutes', 'Dauer eines Pomodoros (Minuten)', 'number'], ['breakMinutes', 'Kurze Pause (Minuten)', 'number'],
    ['longBreakMinutes', 'Lange Pause (Minuten)', 'number'], ['longBreakEvery', 'Lange Pause nach … Pomodoros (0 = nie)', 'number'],
    ['pomodoroGoal', 'Ziel pro Tag (Anzahl, 0 = ohne)', 'number'],
    ['autoBreak', 'Nach dem Pomodoro automatisch Pause', 'bool'], ['autoCycle', 'Nach der Pause automatisch nächster Pomodoro', 'bool'],
    ['announceSprint', 'Ansagen im Chat', 'bool'],
  ],
  formZeit: [['timezone', 'Zeitzone', 'text'], ['dayRolloverHour', 'Neuer Stream-Tag ab (Uhr)', 'number', 'Streams nach Mitternacht zählen zum Vortag.']],
  formChat: [
    ['chatCommands', 'Bot versteht Befehle', 'bool'], ['chatEnabled', 'Bot darf schreiben', 'bool'],
    ['commandPrefix', 'Befehlszeichen', 'text'], ['commandCooldown', 'Pause zwischen Info-Antworten (Sek.)', 'number'], ['maxTasks', 'Offene Aufgaben je Person', 'number'],
  ],
  formTexte: [
    ['sprintStartTemplate', 'Pomodoro-Start', 'area', '{minutes}'], ['breakTemplate', 'Kurze Pause', 'area', '{minutes}'], ['longBreakTemplate', 'Lange Pause', 'area', '{minutes} {n}'],
    ['sprintEndTemplate', 'Pomodoro geschafft', 'area', '{n} {ziel} {streamer}'], ['goalTemplate', 'Tagesziel erreicht', 'area', '{words}'],
  ],
  formZimmer: [
    ['appearOn', 'Figur erscheint bei', 'select', 'Bei Reward oder „Beides“ danach unter „Twitch & Chat“ auf „Reward & Verbindung abgleichen“ klicken.'],
    ['scene', 'Szene', 'select'], ['maxSeats', 'Plätze (1–10)', 'number'],
    ['seatIdleMinutes', 'Platz frei nach … Min ohne Chatnachricht', 'number'],
    ['unlocksEnabled', 'Freischaltungen (Ränge, Gegenstände, Zimmer-Deko)', 'bool', 'Aus: alle Gegenstände sind sofort frei.'],
    ['checkinRewardTitle', 'Check-in-Reward: Name', 'text'], ['checkinRewardCost', 'Check-in-Reward: Preis', 'number'],
    ['sitTemplate', 'Hinsetzen', 'area', '{user} {ort} {rank}'], ['sitAgainTemplate', 'Schon gesetzt', 'area', '{user} {ort}'], ['fullTemplate', 'Alles belegt', 'area', '{user}'],
    ['leaveTemplate', 'Aufstehen', 'area', '{user} {minutes} {total}'], ['notSeatedTemplate', 'Sitzt nicht', 'area', '{user} {sit}'], ['checkinTemplate', 'Check-in per Reward', 'area', '{user} {count} {ort} {rank}'],
    ['rankUpTemplate', 'Neuer Rang', 'area', '{user} {rank} {hours}'], ['unlockTemplate', 'Neuer Gegenstand', 'area', '{user} {item} {figur}'], ['decoTemplate', 'Zimmer wächst', 'area', '{deko}'],
  ],
};
let current = null;

async function loadSettings() {
  const { settings } = await api('GET', 'settings');
  current = settings;
  for (const [target, felder] of Object.entries(SCHEMA)) {
    $(target).innerHTML = felder.map(([key, label, type, hint]) => {
      const v = settings[key];
      const input = type === 'select' ? `<select data-k="${key}">${OPT[key].map(([val, text]) => `<option value="${val}" ${val === v ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select>`
        : type === 'bool' ? `<input type="checkbox" data-k="${key}" ${v ? 'checked' : ''}>`
          : type === 'number' ? `<input type="number" data-k="${key}" value="${esc(v)}">`
            : type === 'area' ? `<textarea data-k="${key}" maxlength="300">${esc(v)}</textarea>`
              : `<input data-k="${key}" value="${esc(v)}">`;
      return type === 'bool'
        ? `<div class="feld schalter"><label><input type="checkbox" data-k="${key}" ${v ? 'checked' : ''}> ${esc(label)}</label>${hint ? `<div class="hinweis">${esc(hint)}</div>` : ''}</div>`
        : `<div class="feld ${type === 'area' ? 'breit' : ''}"><label>${esc(label)}</label>${input}${hint ? `<div class="hinweis">${type === 'area' ? 'Platzhalter: ' : ''}${esc(hint)}</div>` : ''}</div>`;
    }).join('');
  }
  renderScenes(settings);
  fillMusik(settings); fillZiele(settings);
  loadPages().catch(() => {}); loadStream().catch(() => {});
  if (!layoutState) loadLayout(settings.layout);
}
document.addEventListener('change', run(async (e) => {
  const el = e.target;
  if (!el.dataset?.k) return;
  try {
    const value = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value;
    const { settings } = await api('PUT', 'settings', { [el.dataset.k]: value });
    current = settings; renderScenes(settings);
    meldung('Gespeichert');
  } catch (err) { await loadSettings(); throw err; } // Fehler: Feld zeigt wieder den gespeicherten Wert
}));

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

$('alleAufstehen').onclick = run(async () => { await api('DELETE', 'seats'); await loadState(); meldung('Erledigt'); });

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
for (const id of ['musikQuelleSel', 'musikUrlFeld']) $(id).onchange = run(async () => { const r = await api('PUT', 'settings', { musikQuelle: $('musikQuelleSel').value, musikUrl: $('musikUrlFeld').value }); current = r.settings; meldung('Gespeichert'); });
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
let saveTimer;
function saveLayoutSoon() {
  $('layoutStatus').textContent = 'Speichert …';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(run(async () => {
    const r = await api('PUT', 'settings', { layout: layoutState });
    current = r.settings; $('layoutStatus').textContent = 'Gespeichert ✓';
  }), 500);
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
    layoutState = normalizeLayout(layoutState); renderBoxen(); pushLayout(); saveLayoutSoon();
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
const edChange = () => { if (!gewaehlt) return; const l = layoutState[gewaehlt]; l.on = $('edAn').checked; if (gewaehlt !== 'kamera') l.s = Number($('edGroesse').value); else { l.w = Number($('edW').value); l.h = l.w; } layoutState = normalizeLayout(layoutState); renderBoxen(); pushLayout(); saveLayoutSoon(); };
for (const id of ['edAn', 'edGroesse', 'edW']) $(id).oninput = edChange;
$('layoutZurueck').onclick = () => { layoutState = normalizeLayout(structuredClone(DEFAULT_LAYOUT)); if (gewaehlt) select(gewaehlt); else renderBoxen(); pushLayout(); saveLayoutSoon(); meldung('Standard-Anordnung geladen'); };

// ---- System: Sicherung, Wiederherstellung, Update
const fmtSize = (b) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`);
const fmtDate = (ms) => new Date(ms).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
async function loadSystem() {
  const i = await api('GET', 'system/info');
  $('sysVersion').textContent = `Version ${i.version}`;
  $('sysQuelle').textContent = i.quelle === 'update' ? '(eingespieltes Update)' : '(eingebaute Version)';
  $('updateWegBox').hidden = !i.updateDa;
  $('sysDaten').textContent = `${i.daten.dateien} Dateien, ${fmtSize(i.daten.bytes)} · Node ${i.node}`;
  $('autoSicherungen').innerHTML = i.sicherungen.length ? `<table>${i.sicherungen.map((s) => `<tr><td>${esc(fmtDate(s.at))}</td><td>${esc(s.name.replace(/^auto-|\.zip$/g, ''))}</td><td>${fmtSize(s.size)}</td><td class="aktionen"><a class="knopf hell klein" href="/api/admin/system/backups/${encodeURIComponent(s.name)}">⬇</a> <button class="hell klein" data-restore="${esc(s.name)}">Wiederherstellen</button> <button class="hell klein" data-delbackup="${esc(s.name)}">✕</button></td></tr>`).join('')}</table>` : 'Noch keine.';
  for (const b of $('autoSicherungen').querySelectorAll('[data-restore]')) b.onclick = run(async () => {
    if (!confirm(`Stand „${b.dataset.restore}“ wiederherstellen? Der jetzige Stand wird vorher gesichert.`)) return;
    await api('POST', 'system/restore', { name: b.dataset.restore }); meldung('Wiederhergestellt'); await reloadAll();
  });
  for (const b of $('autoSicherungen').querySelectorAll('[data-delbackup]')) b.onclick = run(async () => { await api('DELETE', `system/backups/${b.dataset.delbackup}`); await loadSystem(); });
}
$('sichZugang').onchange = () => { $('sichLaden').href = `/api/admin/system/backup${$('sichZugang').checked ? '' : '?zugang=0'}`; };

async function uploadZip(path, file) {
  if (!file) throw new Error('Bitte zuerst eine ZIP-Datei auswählen');
  const res = await fetch(`/api/admin/system/${path}`, { method: 'POST', headers: { 'content-type': 'application/zip' }, body: file });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { show(false); throw new Error('Nicht angemeldet'); }
  if (!res.ok) throw new Error(data.error ?? `Fehler ${res.status}`);
  return data;
}
async function reloadAll() {
  layoutState = null;
  await Promise.all([loadState(), loadSettings(), loadTasks(), loadUsers(), loadApp(), loadSystem()]);
}
$('restoreStart').onclick = run(async () => {
  const file = $('restoreDatei').files[0];
  if (!file) throw new Error('Bitte zuerst eine Sicherungs-ZIP auswählen');
  if (!confirm('Alle aktuellen Daten werden durch die Sicherung ersetzt. Vorher legt der Server automatisch eine Sicherung des jetzigen Stands an. Fortfahren?')) return;
  $('restoreStatus').textContent = 'Spiele ein …';
  try {
    const r = await uploadZip('restore', file);
    $('restoreStatus').textContent = `Wiederhergestellt: ${r.files} Dateien${r.created ? ` (Sicherung vom ${fmtDate(Date.parse(r.created))})` : ''}. Der vorherige Stand liegt als ${r.before} bereit.`;
    $('restoreDatei').value = '';
    meldung('Wiederhergestellt'); await reloadAll();
  } catch (e) { $('restoreStatus').textContent = ''; throw e; }
});

async function waitForRestart() {
  await new Promise((r) => setTimeout(r, 2000));
  for (let i = 0; i < 40; i += 1) {
    try { const r = await fetch('/healthz', { cache: 'no-store' }); if (r.ok) { location.reload(); return; } } catch { /* Server startet noch */ }
    await new Promise((r) => setTimeout(r, 1500));
  }
  $('updateStatus').textContent = 'Der Server antwortet nicht. Läuft er ohne Docker, bitte von Hand neu starten.';
}
$('updateStart').onclick = run(async () => {
  const file = $('updateDatei').files[0];
  if (!file) throw new Error('Bitte zuerst die Update-ZIP auswählen');
  if (!confirm('Update einspielen? Der Server prüft die ZIP, sichert deine Daten und startet neu.')) return;
  $('updateStatus').textContent = 'Prüfe und installiere …';
  try {
    const r = await uploadZip('update', file);
    $('updateStatus').textContent = `Version ${r.version} installiert (${r.files} Dateien). Server startet neu …`;
    await waitForRestart();
  } catch (e) { $('updateStatus').textContent = ''; throw e; }
});
$('updateWeg').onclick = run(async () => {
  if (!confirm('Das eingespielte Update entfernen und mit der eingebauten Version neu starten? Deine Daten bleiben erhalten.')) return;
  await api('POST', 'system/update-remove');
  $('updateStatus').textContent = 'Update entfernt. Server startet neu …';
  await waitForRestart();
});

async function start() {
  await loadState(); // ohne Anmeldung bricht das hier ab und zeigt den Login
  show(true);
  showTab(location.hash.slice(1));
  await Promise.all([loadSettings(), loadTasks(), loadUsers(), loadApp()]);
}
start().catch(() => show(false));
