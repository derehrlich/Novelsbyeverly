import { SZENEN } from '../js/katalog.mjs';

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
  $('urls').innerHTML = urlRow('OBS-Overlay', u.overlay, 'Browser-Quelle 1920×1080, „Audio über OBS steuern“ aktivieren. Nur einzelne Teile: <code>?teile=uhr,woerter,tasks,szene</code>')
    + urlRow('Twitch-Weiterleitung', u.redirect, 'Diese Adresse muss in der Twitch-Entwickler-App als „OAuth Redirect URL“ stehen.')
    + urlRow('Wörter-Schnittstelle', u.words, `Für ein späteres Hilfsprogramm: <code>POST</code> mit <code>Authorization: Bearer &lt;INGEST_TOKEN&gt;</code> und <code>{"absolute": 4231}</code>. ${e.INGEST_TOKEN ? 'INGEST_TOKEN ist gesetzt.' : 'INGEST_TOKEN ist noch nicht gesetzt.'}`);
  for (const b of document.querySelectorAll('[data-copy]')) b.onclick = () => navigator.clipboard.writeText(b.dataset.copy).then(() => meldung('Kopiert'));
  renderTimer();
  renderWords(state.words);
  $('plaetze').textContent = `${state.seated} sitzen · Zimmer: ${state.communityHours} Std gemeinsame Arbeitszeit`;
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
  $('timerInfo').textContent = `${t.phase === 'focus' ? 'Fokus' : 'Pause'} · Runde ${t.round}`;
}
setInterval(renderTimer, 500);
setInterval(() => { if (!$('app').hidden) loadState().catch(() => {}); }, 15000);
const minutes = () => ($('minuten').value ? Number($('minuten').value) : undefined);
$('fokus').onclick = run(async () => { await api('POST', 'timer/focus', { minutes: minutes() }); await loadState(); });
$('pause').onclick = run(async () => { await api('POST', 'timer/break', { minutes: minutes() }); await loadState(); });
$('stopp').onclick = run(async () => { await api('POST', 'timer/stop'); await loadState(); });

// ---- Szene
async function renderScenes(current) {
  $('szenen').innerHTML = Object.entries(SZENEN).map(([k, v]) => `<button data-s="${k}" class="${k === current ? 'aktiv' : ''}">${v.label}</button>`).join('');
  for (const b of $('szenen').querySelectorAll('button')) b.onclick = run(async () => { await api('POST', 'seats/scene', { scene: b.dataset.s }); await loadSettings(); meldung(`Szene: ${SZENEN[b.dataset.s].label}`); });
}

// ---- Wörter
function renderWords(w) { $('woerterHeute').textContent = new Intl.NumberFormat('de-DE').format(w.today); $('woerterZiel').textContent = new Intl.NumberFormat('de-DE').format(w.goal); }
const sendWords = (mode) => run(async () => { const v = $('woerterWert').value; if (mode !== 'reset' && v === '') throw new Error('Bitte eine Zahl eingeben'); renderWords(await api('POST', 'words', { mode, value: v })); $('woerterWert').value = ''; });
$('wAbs').onclick = sendWords('absolute'); $('wDelta').onclick = sendWords('delta'); $('wToday').onclick = sendWords('today'); $('wReset').onclick = sendWords('reset');

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
  appearOn: [['sit', 'Per Chatbefehl !sitzen'], ['checkin', 'Per Kanalpunkte-Reward „Check-in“'], ['both', 'Beides']],
  scene: Object.entries(SZENEN).map(([k, v]) => [k, v.label]),
};
const SCHEMA = [
  ['Figuren', [
    ['appearOn', 'Figur erscheint bei', 'select', 'Umschaltbar jederzeit. Bei Reward oder „Beides“ danach auf „Reward & Webhooks abgleichen“ klicken.'],
    ['scene', 'Szene', 'select'], ['maxSeats', 'Plätze (1–10)', 'number'],
    ['seatIdleMinutes', 'Platz frei nach … Min ohne Chatnachricht', 'number'],
    ['unlocksEnabled', 'Freischaltungen (Ränge, Gegenstände, Zimmer-Deko)', 'bool', 'Aus: alle Gegenstände sind sofort frei.'],
  ]],
  ['Sprints und Wörter', [
    ['focusMinutes', 'Fokus (Minuten)', 'number'], ['breakMinutes', 'Pause (Minuten)', 'number'],
    ['autoBreak', 'Nach dem Fokus automatisch Pause', 'bool'], ['autoCycle', 'Nach der Pause automatisch nächste Runde', 'bool'],
    ['wordGoal', 'Tagesziel (Wörter, 0 = aus)', 'number'], ['announceSprint', 'Sprint-Ansagen im Chat', 'bool'],
  ]],
  ['Tag und Zeit', [['timezone', 'Zeitzone', 'text'], ['dayRolloverHour', 'Neuer Stream-Tag ab (Uhr)', 'number', 'Streams nach Mitternacht zählen zum Vortag.']]],
  ['Check-in-Reward', [['checkinRewardTitle', 'Name', 'text'], ['checkinRewardCost', 'Preis (Kanalpunkte)', 'number']]],
  ['Chat', [
    ['chatCommands', 'Bot versteht Befehle', 'bool'], ['chatEnabled', 'Bot darf schreiben', 'bool'],
    ['commandPrefix', 'Befehlszeichen', 'text'], ['commandCooldown', 'Pause zwischen Info-Antworten (Sek.)', 'number'], ['maxTasks', 'Offene Aufgaben je Person', 'number'],
  ]],
  ['Chat-Texte', [
    ['sitTemplate', 'Hinsetzen', 'area', '{user} {ort} {rank}'], ['sitAgainTemplate', 'Schon gesetzt', 'area', '{user} {ort}'], ['fullTemplate', 'Alles belegt', 'area', '{user}'],
    ['leaveTemplate', 'Aufstehen', 'area', '{user} {minutes} {total}'], ['notSeatedTemplate', 'Sitzt nicht', 'area', '{user} {sit}'], ['checkinTemplate', 'Check-in per Reward', 'area', '{user} {count} {ort} {rank}'],
    ['sprintStartTemplate', 'Sprint-Start', 'area', '{minutes}'], ['breakTemplate', 'Pause', 'area', '{minutes}'], ['sprintEndTemplate', 'Sprint-Ende', 'area', '{writers} {streamer}'],
    ['rankUpTemplate', 'Neuer Rang', 'area', '{user} {rank} {hours}'], ['unlockTemplate', 'Neuer Gegenstand', 'area', '{user} {item} {figur}'], ['decoTemplate', 'Zimmer wächst', 'area', '{deko}'], ['goalTemplate', 'Tagesziel erreicht', 'area', '{words}'],
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
  renderScenes(settings.scene);
}
$('speichern').onclick = run(async () => {
  const body = {};
  for (const el of $('formular').querySelectorAll('[data-k]')) body[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value;
  const { settings } = await api('PUT', 'settings', body);
  current = settings; renderScenes(settings.scene);
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

async function start() {
  await loadState(); // ohne Anmeldung bricht das hier ab und zeigt den Login
  show(true);
  await Promise.all([loadSettings(), loadTasks(), loadUsers()]);
  if (new URLSearchParams(location.search).has('verbunden')) { history.replaceState(null, '', '/admin/'); meldung('Verbunden – jetzt auf „Reward & Webhooks abgleichen“ klicken'); }
}
start().catch(() => show(false));
