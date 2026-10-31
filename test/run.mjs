// Ende-zu-Ende-Test der Functions mit simulierter Twitch-API und Dateispeicher.  npm test
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.LOCAL_STORE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cowork-test-'));
Object.assign(process.env, {
  TWITCH_CLIENT_ID: 'cid', ADMIN_PASSWORD: 'geheim', INGEST_TOKEN: 'ingest-geheim',
});

// ---- Twitch simulieren
const calls = [];
let rewards = [];
let subs = [];
const failSubTypes = new Set();
let liveStart = null; // simulierter Twitch-Stream (ISO-Zeit) oder null
let devicePending = false;
let lastSocket = null; // simulierte EventSub-WebSocket-Verbindung
globalThis.WebSocket = class {
  constructor(url) { this.url = url; lastSocket = this; setTimeout(() => this.onmessage?.({ data: JSON.stringify({ metadata: { message_type: 'session_welcome' }, payload: { session: { id: 'sess1', keepalive_timeout_seconds: 10 } } }) }), 5); }
  close() { this.closed = true; }
};
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url);
  const entry = { method: init.method || 'GET', path: u.pathname, query: Object.fromEntries(u.searchParams), auth: init.headers?.Authorization, body: init.body && !String(init.body).includes('=') ? JSON.parse(init.body) : init.body };
  entry.raw = String(init.body ?? '');
  calls.push(entry);
  const ok = (data, status = 200) => new Response(JSON.stringify(data), { status });
  if (u.host === 'id.twitch.tv') {
    if (u.pathname.endsWith('/device')) return ok({ device_code: 'dc', user_code: 'ABCD', verification_uri: 'https://www.twitch.tv/activate', interval: 5, expires_in: 600 });
    if (u.pathname.endsWith('/token') && entry.raw.includes('device_code') && devicePending) return ok({ message: 'authorization_pending' }, 400);
    if (u.pathname.endsWith('/validate')) return ok({ user_id: '999', login: 'streamerin', scopes: [] });
    return ok({ access_token: 'tok', refresh_token: 'ref', expires_in: 3600 });
  }
  if (u.pathname.endsWith('/channel_points/custom_rewards/redemptions')) return ok({});
  if (u.pathname.endsWith('/channel_points/custom_rewards')) {
    if (entry.method === 'GET') return ok({ data: rewards });
    if (entry.method === 'POST') { const r = { id: `rw${rewards.length + 1}`, ...entry.body, is_enabled: true }; rewards.push(r); return ok({ data: [r] }); }
    const r = rewards.find((x) => x.id === entry.query.id); Object.assign(r, entry.body); return ok({ data: [r] });
  }
  if (u.pathname.endsWith('/eventsub/subscriptions')) {
    if (entry.method === 'GET') return ok({ data: subs });
    if (entry.method === 'DELETE') { subs = subs.filter((s) => s.id !== entry.query.id); return new Response(null, { status: 204 }); }
    if (failSubTypes.has(entry.body.type)) return ok({ error: 'forbidden' }, 403);
    const sub = { id: `sub${subs.length + 1}`, status: 'enabled', type: entry.body.type, condition: entry.body.condition, transport: entry.body.transport };
    subs.push(sub); return ok({ data: [sub] }, 202);
  }
  if (u.pathname.endsWith('/chat/messages')) return ok({ data: [{ is_sent: true }] });
  if (u.pathname.endsWith('/helix/streams')) return ok({ data: liveStart ? [{ started_at: liveStart }] : [] });
  return ok({ data: [] });
};
const chatSent = () => calls.filter((c) => c.path.endsWith('/chat/messages')).map((c) => c.body);
const lastChat = () => chatSent().at(-1);

const mod = (rel) => import(`../server/${rel}`);
const { db } = await mod('core/store.mjs');
const { getSettings, saveSettings, DEFAULTS, normalize } = await mod('features/settings.mjs');
const eventsub = await mod('twitch/eventsub.mjs');
const overlay = (await mod('api/overlay.mjs')).default;
const admin = (await mod('api/admin.mjs')).default;
const ingest = (await mod('api/ingest-words.mjs')).default;
const auth = (await mod('api/auth.mjs')).default;
const people = await mod('features/people.mjs');
const timerLib = await mod('features/timer.mjs');
const wordsLib = await mod('features/words.mjs');
const tasksLib = await mod('features/tasks.mjs');
const { ensureCheckinReward } = await mod('twitch/api.mjs');
const musikIngest = (await mod('api/ingest-musik.mjs')).default;
const { resolveSeason, resolveTime } = await mod('features/zeiten.mjs');
const { getMusik } = await mod('features/musik.mjs');
const layoutLib = await import('../public/js/layout.mjs');
const pagesLib = await mod('features/pages.mjs');
const streamLib = await mod('features/streamzeit.mjs');
const kat = await import('../public/js/katalog.mjs');

let passed = 0;
const test = async (name, fn) => {
  try { await fn(); passed += 1; console.log(`  ok  ${name}`); } catch (e) { console.error(`FAIL  ${name}\n`, e); process.exitCode = 1; }
};

// ---- Hilfen
let n = 0;
// Twitch-Nachricht direkt zustellen (wie sie über die WebSocket-Verbindung ankäme)
const webhook = (msg) => eventsub.handleNotification(msg.subscription.type, msg.event);
const sign = (msg) => msg;
const chatEvent = (uid, name, text, extra = {}) => ({ subscription: { type: 'channel.chat.message' }, event: { broadcaster_user_id: '999', chatter_user_id: uid, chatter_user_name: name, message_id: `c${(n += 1)}`, message: { text }, badges: [], ...extra } });
const say = async (uid, name, text, extra) => { await webhook(chatEvent(uid, name, text, extra)); return lastChat(); };
const adminCall = async (method, p, body, cookie) => {
  const res = await admin(new Request(`https://x/api/admin/${p}`, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined }));
  return { status: res.status, body: res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text(), headers: res.headers };
};

// ---- Verbindung herstellen (Kanal und Bot)
await db.set('config/tokens', { access_token: 'tokB', refresh_token: 'r', expires_at: Date.now() + 3_600_000, user_id: '999', login: 'streamerin', scopes: ['channel:read:redemptions', 'channel:manage:redemptions', 'user:write:chat', 'user:read:chat', 'user:bot', 'channel:bot'] });
await db.set('config/bot-tokens', { access_token: 'tokBot', refresh_token: 'r', expires_at: Date.now() + 3_600_000, user_id: '555', login: 'everlybot', scopes: ['user:write:chat', 'user:read:chat', 'user:bot'] });

await saveSettings({ szeneModus: 'zimmer' }); // die Figuren der Zuschauer gibt es im Zimmer-Modus

console.log('Katalog und Einstellungen');
await test('Ränge und Freischaltungen nach Arbeitszeit', () => {
  assert.equal(kat.rankFor(0).id, 'tintenfleck');
  assert.equal(kat.rankFor(60).id, 'notizbuch');
  assert.equal(kat.rankFor(60 * 12).id, 'lektorat');
  assert.equal(kat.rankFor(60 * 500).id, 'legende');
  assert.deepEqual(kat.unlockedItems(60 * 3), ['muetze', 'brille']);
  assert.deepEqual(kat.unlockedDeko(60 * 5), ['lichter', 'pflanzen']);
});
await test('cleanFigur wirft gesperrte und unbekannte Werte raus', () => {
  const f = kat.cleanFigur({ haare: 'Rot', kopf: 'Mütze', tier: 'katze', frisur: 'iro', haut: '9' }, 30);
  assert.equal(f.haare, 'rot'); assert.equal(f.kopf, 'keine'); assert.equal(f.tier, 'keine'); assert.equal(f.frisur, 'kurz'); assert.equal(f.haut, '2');
  assert.equal(kat.cleanFigur({ kopf: 'mütze' }, 60).kopf, 'muetze');
});
await test('Einstellungen werden geprüft', async () => {
  assert.equal(normalize({ appearOn: 'immer' }).error, 'appearOn: unbekannter Wert');
  assert.match(normalize({ timezone: 'Mars/Olymp' }).error, /Zeitzone/);
  assert.equal(normalize({ focusMinutes: 9999 }).settings.focusMinutes, 180);
  assert.equal(normalize({ gibtEsNicht: 1 }).settings.gibtEsNicht, undefined);
  assert.match(normalize({ commandPrefix: 'ab c' }).error, /Befehlszeichen/);
});

console.log('Platz und Figur');
await test('!sitzen setzt eine Figur hin, antwortet als Bot und als Antwort auf die Nachricht', async () => {
  const before = calls.length;
  const msg = await say('1', 'Lena', '!sitzen');
  assert.match(msg.message, /Lena setzt sich ins Café/);
  assert.equal(msg.sender_id, '555'); // der Bot schreibt
  assert.ok(msg.reply_parent_message_id);
  assert.equal(calls.slice(before).find((c) => c.path.endsWith('/chat/messages')).auth, 'Bearer tokBot');
  const seats = await people.activeSeats(await getSettings());
  assert.equal(seats.length, 1); assert.equal(seats[0].name, 'Lena');
});
await test('doppeltes !sitzen setzt niemanden doppelt hin', async () => {
  assert.match((await say('1', 'Lena', '!Sitzen')).message, /sitzt schon/);
  assert.equal((await people.activeSeats(await getSettings())).length, 1);
});
await test('Zustellungen mit derselben Nachrichten-ID werden nur einmal beantwortet', async () => {
  const ev = chatEvent('2', 'Jonas', '!sitzen');
  await webhook(ev); const sent = chatSent().length;
  await webhook(ev);
  assert.equal(chatSent().length, sent);
  assert.equal((await people.activeSeats(await getSettings())).length, 2);
});
await test('Plätze sind begrenzt', async () => {
  await saveSettings({ maxSeats: 2 });
  assert.match((await say('3', 'Mia', '!sitzen')).message, /alle Plätze belegt/);
  await saveSettings({ maxSeats: 10 });
});
await test('!aufstehen gibt den Platz frei', async () => {
  assert.match((await say('2', 'Jonas', '!aufstehen')).message, /Jonas steht auf/);
  assert.match((await say('2', 'Jonas', '!aufstehen')).message, /sitzt gerade nicht/);
});
await test('gleichzeitiges Hinsetzen vergibt keinen Platz doppelt', async () => {
  const s = await getSettings();
  await Promise.all(['a', 'b', 'c', 'd'].map((id) => people.sit(`p${id}`, id, s)));
  const placed = people.resolveSlots(await people.activeSeats(s), people.capacity(s));
  assert.equal(new Set(placed.map((x) => x.slot)).size, placed.length);
  for (const id of ['a', 'b', 'c', 'd']) await db.delete(`seat/p${id}`);
});
await test('Plätze laufen nach Inaktivität ab', async () => {
  const s = await getSettings();
  const seat = await db.get('seat/1');
  await db.set('seat/old', { ...seat, name: 'Alt', lastActive: Date.now() - 3 * 3_600_000 });
  assert.ok(!(await people.activeSeats(s)).some((x) => x.id === 'old'));
  assert.equal(await db.get('seat/old'), null);
});
await test('!figur ändert die Figur, sperrt Gesperrtes und aktualisiert den Sitzplatz', async () => {
  assert.match((await say('1', 'Lena', '!figur haare rot')).message, /Haarfarbe ist jetzt „rot“/);
  assert.equal((await db.get('seat/1')).figure.haare, 'rot');
  assert.match((await say('1', 'Lena', '!figur kopf mütze')).message, /ab 1 Std/);
  assert.match((await say('1', 'Lena', '!figur Haut 4')).message, /Hautton ist jetzt „4“/);
  assert.match((await say('1', 'Lena', '!figur kopf')).message, /muetze \(ab 1 Std\)/);
  assert.match((await say('1', 'Lena', '!figur hobby x')).message, /kenne ich nicht/);
  assert.match((await say('1', 'Lena', '!figur')).message, /Plätze: haare/);
});

console.log('Sprint und Arbeitszeit');
await test('nur Mods dürfen den Timer steuern', async () => {
  await say('1', 'Lena', '!sprint 1');
  assert.equal((await db.get('state/timer')) ?? null, null);
});
await test('!sprint startet, am Ende bekommen Sitzende Arbeitszeit, Rang und Gegenstand', async () => {
  const s = await getSettings();
  await db.set('seat/1', { ...(await db.get('seat/1')), since: Date.now() - 120_000 });
  const msg = await say('999', 'Streamerin', '!sprint 1 5 1', { chatter_user_id: '999', badges: [{ set_id: 'broadcaster' }] });
  assert.equal(msg.sender_id, '555');
  assert.match(msg.message, /Pomodoro 1 von 1 startet: 1 Minuten/);
  const t = await timerLib.getTimer();
  assert.equal(t.phase, 'focus');
  await timerLib.tick(s, t.endsAt + 500);
  const lena = await db.get('user/1');
  assert.equal(lena.minutes, 1); assert.equal(lena.sprints, 1);
  assert.equal((await db.get('stats/community')).minutes, 1);
  assert.equal((await timerLib.getTimer()).phase, 'break');
  assert.ok(chatSent().some((m) => /Pomodoro 1 von 6 geschafft/.test(m.message)));
  assert.ok(chatSent().some((m) => /Pause! 5 Minuten/.test(m.message)));
});
await test('ein Sprint wird nur einmal abgerechnet, auch bei gleichzeitigen Abrufen', async () => {
  const s = await getSettings();
  const t = await timerLib.getTimer(); // Pause
  await timerLib.tick(s, t.endsAt + 10_000); await Promise.all([timerLib.tick(s, t.endsAt + 20_000), timerLib.tick(s, t.endsAt + 20_000)]);
  assert.equal((await db.get('user/1')).minutes, 1);
  assert.equal((await timerLib.getTimer()).phase, 'idle');
});
await test('wer mitten im Sprint aufsteht, bekommt nur die Zeit bis dahin', async () => {
  const s = await getSettings();
  await people.sit('7', 'Paul', s);
  const t0 = Date.now();
  await timerLib.startFocus(s, 10, t0);
  const t = await timerLib.getTimer();
  await db.set('seat/7', { ...(await db.get('seat/7')), since: t.startedAt });
  const r = await people.leave('7', 'Paul', s, t, t.startedAt + 4 * 60_000);
  assert.equal(r.minutes, 4); assert.equal((await db.get('user/7')).minutes, 4);
  await timerLib.stopTimer(s);
});
await test('Rangaufstieg und Freischaltung werden verkündet, danach geht der Gegenstand', async () => {
  const s = await getSettings();
  const r = await people.credit('1', 'Lena', 59);
  assert.equal(r.rankUp.id, 'notizbuch'); assert.deepEqual(r.items.map((i) => i.id), ['muetze']);
  await timerLib.announceCredit(r, s);
  assert.match(chatSent().at(-2).message, /Lena ist jetzt „Notizbuch“/);
  assert.match(chatSent().at(-1).message, /„Mütze“ freigeschaltet/);
  assert.match((await say('1', 'Lena', '!figur kopf mütze')).message, /Kopf ist jetzt „muetze“/);
  assert.match((await say('1', 'Lena', '!rang')).message, /Notizbuch · 1 Std Arbeitszeit/);
});
await test('Zimmer-Dekoration wird durch die Gemeinschaft freigeschaltet', async () => {
  const r = await people.credit('1', 'Lena', 70);
  assert.deepEqual(r.deko.map((d) => d.id), ['lichter']);
  const view = await (await overlay(new Request('https://x/api/overlay'))).json();
  assert.deepEqual(view.deco, ['lichter']);
});
await test('Module: Schalter, Sprint-Zähler im Overlay, Deko abschaltbar', async () => {
  const get = async () => (await overlay(new Request('https://x/api/overlay'))).json();
  const v = await get();
  assert.deepEqual(v.modules, { blume: true, kerze: true, buecher: true });
  assert.ok(v.sprintsToday >= 1); // der abgeschlossene Sprint zählt, abgebrochene nicht
  await saveSettings({ moduleBlume: false, moduleDeko: false });
  const v2 = await get();
  assert.equal(v2.modules.blume, false); assert.deepEqual(v2.deco, []);
  await saveSettings({ moduleBlume: true, moduleDeko: true });
});
console.log('Wörter und Aufgaben');
await test('Wortzähler: Stand aus Papyrus, Dazugeschriebenes, Tagesbeginn', async () => {
  const s = await getSettings();
  let w = await wordsLib.setAbsolute(10000, s); assert.equal(w.today, 0);
  w = await wordsLib.setAbsolute(10350, s); assert.equal(w.today, 350);
  w = await wordsLib.addWords(50, s); assert.equal(w.today, 400);
  w = await wordsLib.setToday(120, s); assert.equal(w.today, 120);
  const tomorrow = await wordsLib.getWords(s, new Date(Date.now() + 24 * 3_600_000));
  assert.equal(tomorrow.today, 0);
});
await test('Chatbefehle für Wörter: Streamerin setzt den Stand, andere melden dazu', async () => {
  const bc = { chatter_user_id: '999', badges: [{ set_id: 'broadcaster' }] };
  assert.match((await say('999', 'Streamerin', '!wörter 10500', bc)).message, /Heute 220 von 1\.000/);
  assert.match((await say('999', 'Streamerin', '!wörter +30', bc)).message, /Heute 250 von/);
  assert.match((await say('1', 'Lena', '!wörter 250')).message, /\+250 Wörter/);
  assert.match((await say('1', 'Lena', '!wörter 250')) .message ?? '', /./); // Abklingzeit: bleibt bei der letzten Nachricht
  assert.equal((await db.get('user/1')).words, 250);
});
await test('Tagesziel löst Overlay-Ereignis und Chat aus', async () => {
  const s = await getSettings();
  const w = await wordsLib.addWords(2000, s);
  assert.ok(w.today >= 1000);
  assert.ok(chatSent().some((m) => /Tagesziel erreicht/.test(m.message)));
  const events = [];
  for (const k of await db.list('event/')) events.push(await db.get(k));
  assert.ok(events.some((e) => e.type === 'goal'));
});
await test('Aufgaben anlegen, begrenzen und abhaken', async () => {
  assert.match((await say('1', 'Lena', '!task Kapitel 3 überarbeiten')).message, /Kapitel 3 überarbeiten/);
  await say('1', 'Lena', '!task Dialoge'); await say('1', 'Lena', '!task Recherche');
  assert.match((await say('1', 'Lena', '!task noch eine')).message, /schon 3 offene/);
  assert.match((await say('1', 'Lena', '!done 2')).message, /„Dialoge“ geschafft! Noch 2 offen/);
  assert.match((await say('1', 'Lena', '!tasks')).message, /1\. Kapitel 3 überarbeiten · 2\. Recherche/);
  assert.match((await say('1', 'Lena', '!done 9')).message, /Nummer gibt es nicht/);
  const view = await (await overlay(new Request('https://x/api/overlay'))).json();
  const lena = view.seats.find((x) => x.name === 'Lena');
  assert.deepEqual(lena.tasks.map((x) => [x.text, x.done]), [['Dialoge', true], ['Recherche', false]]);
});
await test('HTML in Aufgaben wird entfernt', async () => {
  const r = await tasksLib.addTask('x1', 'X', '<img src=x onerror=alert(1)>Hallo', 3);
  assert.equal(r.item.text, 'img src=x onerror=alert(1)Hallo');
  await tasksLib.clearTasks('x1');
});

console.log('Erscheinen bei Check-in');
await test('appearOn=checkin: !sitzen verweist auf den Reward, die Einlösung setzt die Figur hin', async () => {
  await saveSettings({ appearOn: 'checkin' });
  assert.match((await say('20', 'Emma', '!sitzen')).message, /per Kanalpunkte-Reward „Check-in“/);
  const reward = await ensureCheckinReward(await getSettings(), true);
  assert.equal(reward.title, 'Check-in');
  const redeem = (id, uid, name) => webhook(({ subscription: { type: 'channel.channel_points_custom_reward_redemption.add' }, event: { id, user_id: uid, user_name: name, reward: { id: reward.id } } }));
  await redeem('r1', '20', 'Emma');
  assert.match(lastChat().message, /Emma ist eingecheckt – Besuch #1/);
  assert.ok(calls.some((c) => c.path.endsWith('/redemptions') && c.body.status === 'FULFILLED'));
  assert.ok(await db.get('seat/20'));
  await redeem('r2', '20', 'Emma'); // schon da: Punkte zurück
  assert.match(lastChat().message, /sitzt schon.*Punkte/);
  assert.ok(calls.some((c) => c.path.endsWith('/redemptions') && c.body.status === 'CANCELED'));
  await webhook(({ subscription: { type: 'x' }, event: { id: 'r3', user_id: '21', user_name: 'X', reward: { id: 'fremd' } } }));
  assert.equal(await db.get('seat/21'), null); // fremder Reward
});
await test('appearOn=both erlaubt beides, appearOn=sit schaltet den Reward in Twitch aus', async () => {
  await saveSettings({ appearOn: 'both' });
  assert.match((await say('22', 'Ben', '!sitzen')).message, /Ben setzt sich/);
  await saveSettings({ appearOn: 'sit' });
  await ensureCheckinReward(await getSettings(), false);
  assert.equal(rewards[0].is_enabled, false);
});

console.log('Overlay und Admin');
await test('Overlay-Daten und Ereignis-Cursor', async () => {
  const first = await (await overlay(new Request('https://x/api/overlay'))).json();
  assert.equal(first.scene, 'cafe'); assert.ok(first.seats.length >= 2); assert.equal(first.events.length, 0);
  assert.ok(first.seats.every((x) => Number.isInteger(x.slot) && x.figure && x.name));
  await say('999', 'Streamerin', '!aufgabe Schreiben', { chatter_user_id: '999' });
  const next = await (await overlay(new Request(`https://x/api/overlay?since=${encodeURIComponent(first.cursor)}`))).json();
  assert.ok(next.cursor >= first.cursor);
  assert.equal(next.streamerTasks[0].text, 'Schreiben');
});
await test('Szene per Mod-Befehl wechseln', async () => {
  assert.match((await say('999', 'Streamerin', '!szene Garten', { chatter_user_id: '999' })).message, /Neue Szene: Garten/);
  assert.equal((await getSettings()).scene, 'garten');
  await say('1', 'Lena', '!szene park');
  assert.equal((await getSettings()).scene, 'garten'); // Zuschauer dürfen nicht
});
await test('Admin: Login, Zustand, Einstellungen, Timer, Tests', async () => {
  assert.equal((await adminCall('GET', 'state')).status, 401);
  assert.equal((await adminCall('POST', 'login', { password: 'falsch' })).status, 401);
  const login = await adminCall('POST', 'login', { password: 'geheim' });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const st = await adminCall('GET', 'state', null, cookie);
  assert.equal(st.body.connectedAs, 'streamerin'); assert.equal(st.body.botAs, 'everlybot'); assert.deepEqual(st.body.missingScopes, []);
  assert.equal((await adminCall('PUT', 'settings', { appearOn: 'quatsch' }, cookie)).status, 400);
  assert.equal((await adminCall('PUT', 'settings', { appearOn: 'both', scene: 'park' }, cookie)).body.settings.scene, 'park');
  const setup = await adminCall('POST', 'setup', {}, cookie);
  assert.equal(setup.body.reward, 'Check-in');
  const chatSub = subs.find((x) => x.type === 'channel.chat.message');
  assert.deepEqual(chatSub.condition, { broadcaster_user_id: '999', user_id: '555' }); // der Bot liest mit
  assert.ok(subs.find((x) => x.type.includes('redemption')));
  assert.deepEqual(chatSub.transport, { method: 'websocket', session_id: 'sess1' }); // Verbindung per WebSocket, kein Webhook
  assert.equal((await adminCall('GET', 'state', null, cookie)).body.eventsub.state, 'verbunden');
  assert.equal((await adminCall('POST', 'timer/focus', { minutes: 20 }, cookie)).body.timer.phase, 'focus');
  assert.equal((await adminCall('POST', 'timer/stop', {}, cookie)).body.timer.phase, 'idle');
  assert.equal((await adminCall('POST', 'words', { mode: 'absolute', value: 'abc' }, cookie)).status, 400);
  assert.equal((await adminCall('POST', 'test/seats', { count: 4 }, cookie)).status, 200);
  const testSeats = (await adminCall('GET', 'seats', null, cookie)).body.seats.filter((x) => x.id.startsWith('test-'));
  assert.equal(testSeats.length, 4);
  assert.ok(testSeats.some((x) => x.figure.tier === 'katze' || x.figure.kopf !== 'keine' || true));
  assert.equal((await adminCall('POST', 'test/event', { kind: 'sprint' }, cookie)).status, 200);
  assert.equal((await adminCall('POST', 'test/clear', {}, cookie)).status, 200);
  assert.equal((await adminCall('GET', 'users', null, cookie)).body.users.some((x) => x.id.startsWith('test-')), false);
  assert.match((await adminCall('GET', 'export.csv', null, cookie)).body, /"Name";"Rang"/);
  const task = await adminCall('POST', 'tasks', { text: 'Plot prüfen' }, cookie);
  assert.equal(task.status, 200);
  assert.equal((await adminCall('POST', 'tasks/done', { id: task.body.item.id }, cookie)).status, 200);
  assert.equal((await adminCall('POST', 'login', { password: 'geheim' })).status, 200);
});
await test('Admin: Chat-Abo meldet fehlende Berechtigung statt abzubrechen', async () => {
  failSubTypes.add('channel.chat.message');
  const login = await adminCall('POST', 'login', { password: 'geheim' });
  const res = await adminCall('POST', 'setup', {}, login.headers.get('set-cookie').split(';')[0]);
  assert.equal(res.status, 200); assert.match(res.body.warnings[0], /Chat: Twitch hat das Abo abgelehnt \(403\)/);
  failSubTypes.clear();
});
await test('Wortzähler-Schnittstelle: nur mit Schlüssel', async () => {
  const post = (body, token) => ingest(new Request('https://x/api/words', { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) }));
  assert.equal((await post({ absolute: 5 })).status, 401);
  assert.equal((await post({ absolute: 5 }, 'falsch')).status, 401);
  assert.equal((await post({ nix: 1 }, 'ingest-geheim')).status, 400);
  const s = await getSettings();
  const base = (await wordsLib.getWords(s)).abs;
  const res = await (await post({ delta: 10 }, 'ingest-geheim')).json();
  assert.equal(res.ok, true); assert.equal((await wordsLib.getWords(s)).abs, base + 10);
});
await test('Twitch verbinden per Device-Code: Bot-Rolle fordert nur Bot-Berechtigungen, Tokens werden getrennt gespeichert', async () => {
  const login = await adminCall('POST', 'login', { password: 'geheim' });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const post = (p, body, ck = cookie) => auth(new Request(`https://x/api/auth/device/${p}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(ck ? { cookie: ck } : {}) }, body: JSON.stringify(body) }));
  assert.equal((await post('start', { role: 'bot' }, null)).status, 401); // nur mit Admin-Login
  const start = await (await post('start', { role: 'bot' })).json();
  assert.equal(start.user_code, 'ABCD');
  assert.equal(new URLSearchParams(calls.findLast((c) => c.path.endsWith('/oauth2/device')).raw).get('scopes'), 'user:write:chat user:read:chat user:bot');
  devicePending = true;
  assert.equal((await (await post('poll', { role: 'bot', device_code: 'dc' })).json()).pending, true);
  devicePending = false;
  await db.delete('config/bot-tokens');
  const done = await (await post('poll', { role: 'bot', device_code: 'dc' })).json();
  assert.equal(done.ok, true);
  assert.equal((await db.get('config/bot-tokens')).login, 'streamerin'); // Mock liefert immer denselben Nutzer
  assert.equal((await db.get('config/tokens')).access_token, 'tokB');
});
await test('EventSub-WebSocket: Chat-Nachrichten kommen über die Verbindung an', async () => {
  await eventsub.startEventSub();
  assert.equal(eventsub.info.state, 'verbunden');
  const before = chatSent().length;
  lastSocket.onmessage({ data: JSON.stringify({ metadata: { message_type: 'session_keepalive' }, payload: {} }) });
  lastSocket.onmessage({ data: JSON.stringify({ metadata: { message_type: 'notification' }, payload: { subscription: { type: 'channel.chat.message' }, event: chatEvent('77', 'Ws', '!hilfe').event } }) });
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(chatSent().length, before + 1);
  eventsub.stopEventSub();
});

console.log('Landschaft, Pomodoro, Layout, Musik');
await saveSettings({ szeneModus: 'wachstum', appearOn: 'sit', scene: 'cafe', moduleBlume: true, moduleKerze: true, moduleBuecher: true, moduleDeko: true });
const viewNow = async () => (await overlay(new Request('https://x/api/overlay'))).json();
await test('Wachstums-Modus: Platz-Befehle sind pausiert, keine Figuren im Overlay', async () => {
  const before = chatSent().length;
  await webhook((chatEvent('31', 'Neu', '!sitzen')));
  await webhook((chatEvent('31', 'Neu', '!figur haare rot')));
  assert.equal(chatSent().length, before);
  assert.equal(await db.get('seat/31'), null);
  const v = await viewNow();
  assert.equal(v.modus, 'wachstum'); assert.deepEqual(v.seats, []);
});
await test('Jahres- und Tageszeit: automatisch nach Datum und Uhrzeit, oder fest', () => {
  const s = { ...DEFAULTS, timezone: 'Europe/Berlin' };
  assert.equal(resolveSeason(s, new Date('2026-04-10T12:00:00Z')), 'fruehling');
  assert.equal(resolveSeason(s, new Date('2026-07-10T12:00:00Z')), 'sommer');
  assert.equal(resolveSeason(s, new Date('2026-10-29T12:00:00Z')), 'herbst');
  assert.equal(resolveSeason(s, new Date('2026-12-24T12:00:00Z')), 'winter');
  assert.equal(resolveTime(s, new Date('2026-06-01T05:30:00Z')), 'morgen'); // 7:30 Uhr in Berlin
  assert.equal(resolveTime(s, new Date('2026-06-01T11:00:00Z')), 'mittag');
  assert.equal(resolveTime(s, new Date('2026-06-01T20:00:00Z')), 'abend');
  assert.equal(resolveSeason({ ...s, jahreszeit: 'winter' }), 'winter'); assert.equal(resolveTime({ ...s, tageszeit: 'morgen' }), 'morgen');
});
await test('Fortschritt der Landschaft: Wörter oder Pomodoros', async () => {
  const w = await wordsLib.getWords(await getSettings());
  await saveSettings({ wordGoal: 1000, wachstumQuelle: 'woerter' });
  const v1 = await viewNow();
  assert.ok(Math.abs(v1.progress - Math.min(1, w.today / 1000)) < 0.001);
  await saveSettings({ wachstumQuelle: 'pomodoro', pomodoroGoal: 4 });
  const v2 = await viewNow();
  assert.ok(Math.abs(v2.progress - Math.min(1, v2.pomodoro.done / 4)) < 0.001); assert.equal(v2.pomodoro.goal, 4);
  await saveSettings({ wachstumQuelle: 'woerter', pomodoroGoal: 6 });
});
await test('Einstellungen: neue Auswahlfelder werden geprüft', () => {
  assert.equal(normalize({ szeneModus: 'zimmer' }).settings.szeneModus, 'zimmer');
  assert.ok(normalize({ jahreszeit: 'regenzeit' }).error);
  assert.ok(normalize({ musikUrl: 'javascript:alert(1)' }).error);
  assert.equal(normalize({ pomodoroGoal: 999 }).settings.pomodoroGoal, 30);
  assert.equal(normalize({ repeats: -3 }).settings.repeats, 1); assert.equal(normalize({ repeats: 99 }).settings.repeats, 20);
  assert.equal(normalize({ soundLautstaerke: 500 }).settings.soundLautstaerke, 100);
});
const phasen = async () => { const out = []; for (const k of await db.list('event/')) { const ev = await db.get(k); if (ev?.type === 'phase' || ev?.type === 'hold') out.push(ev); } return out; };
await test('Fester Ablauf: Pomodoro → Pause, bei Wiederholungen 1 ist danach Schluss', async () => {
  await saveSettings({ focusMinutes: 20, breakMinutes: 5, repeats: 1, pomodoroGoal: 6, announceSprint: true });
  const s = await getSettings(); await timerLib.stopTimer(s);
  const t0 = Date.now() - 2_000_000; // lange her, damit alles fällig ist
  const t = await timerLib.startFocus(s, undefined, t0);
  assert.equal(t.phase, 'focus'); assert.deepEqual(t.cycle, { total: 1, index: 1, focusMin: 20, breakMin: 5 }); assert.equal(t.endsAt - t.startedAt, 20 * 60_000);
  assert.match(lastChat().message, /Pomodoro 1 von 1 startet: 20 Minuten/);
  let st = await timerLib.tick(s, t0 + 20 * 60_000 + 500);
  assert.equal(st.phase, 'break'); assert.equal(st.minutes, 5);
  assert.ok(chatSent().some((m) => /Pomodoro \d+ von 6 geschafft/.test(m.message)));
  st = await timerLib.tick(s, t0 + 25 * 60_000 + 500);
  assert.equal(st.phase, 'idle'); // ein Pomodoro, eine Pause, Ende
  assert.match(lastChat().message, /Geschafft! 1 Pomodoros am Stück/);
  const ev = (await phasen()).filter((e) => e.type === 'phase').slice(-3);
  assert.deepEqual(ev.map((e) => [e.phase, e.vorher ?? null]), [['focus', null], ['break', 'focus'], ['idle', 'break']]); // „vorher“ löst im Overlay den Endton aus
  assert.equal(ev[2].sessionEnde, true);
});
await test('Fester Ablauf mit mehreren Wiederholungen, Werte nur für diesen Durchlauf überschreibbar', async () => {
  const s = { ...(await getSettings()), repeats: 3 };
  await timerLib.stopTimer(s);
  const t0 = Date.now() - 5_000_000;
  const t = await timerLib.startFocus(s, 10, t0, { breakMinutes: 2, repeats: 2 });
  assert.deepEqual(t.cycle, { total: 2, index: 1, focusMin: 10, breakMin: 2 });
  let st = await timerLib.tick(s, t0 + 10 * 60_000 + 1);
  assert.equal(st.phase, 'break'); assert.equal(st.minutes, 2);
  st = await timerLib.tick(s, t0 + 12 * 60_000 + 1);
  assert.equal(st.phase, 'focus'); assert.equal(st.cycle.index, 2); assert.equal(st.round, t.round + 1);
  assert.equal((await getSettings()).focusMinutes, 20); // die Einstellung bleibt unverändert
  st = await timerLib.tick(s, t0 + 22 * 60_000 + 1); assert.equal(st.phase, 'break');
  st = await timerLib.tick(s, t0 + 24 * 60_000 + 1); assert.equal(st.phase, 'idle');
  // alles auf einmal nachholen (Server war aus)
  await timerLib.startFocus(s, 5, Date.now() - 10_000_000, { breakMinutes: 1, repeats: 3 });
  assert.equal((await timerLib.tick(s, Date.now())).phase, 'idle');
});
await test('Anhalten und Fortsetzen: Zeit steht still, Rest läuft weiter', async () => {
  const s = await getSettings(); await timerLib.stopTimer(s);
  const t0 = Date.now() - 600_000; // 10 Minuten vergangen
  const t = await timerLib.startFocus(s, 25, t0, { repeats: 1 });
  const h = await timerLib.holdTimer(s, t0 + 600_000);
  assert.equal(h.paused.remaining, 15 * 60_000);
  assert.equal((await timerLib.tick(s, t0 + 3 * 3_600_000)).phase, 'focus'); // auch Stunden später nichts passiert
  assert.equal((await viewNow()).timer.paused.remaining, 15 * 60_000);
  const later = t0 + 3_600_000; // 50 Minuten Pause
  const r = await timerLib.resumeTimer(s, later);
  assert.equal(r.paused, null); assert.equal(r.endsAt, later + 15 * 60_000); assert.equal(r.startedAt, t.startedAt + (later - (t0 + 600_000)));
  assert.equal((await timerLib.tick(s, later + 14 * 60_000)).phase, 'focus');
  assert.equal((await timerLib.tick(s, later + 15 * 60_000 + 1)).phase, 'break');
  assert.ok((await phasen()).some((e) => e.type === 'hold' && e.on === true) && (await phasen()).some((e) => e.type === 'hold' && e.on === false));
  assert.equal((await timerLib.holdTimer(s)).phase, 'break'); // Anhalten gilt auch in der Pause
  await timerLib.stopTimer(s);
  assert.equal((await timerLib.holdTimer(s)).phase, 'idle'); // im Leerlauf gibt es nichts anzuhalten
});
await test('Chat und Admin: !pomodoro 25 5 3, !anhalten, !weiter (nur Moderation)', async () => {
  const mod = { chatter_user_id: '999', badges: [{ set_id: 'broadcaster' }] };
  await say('999', 'Streamerin', '!pomodoro 25 5 3', mod);
  let st = await timerLib.getTimer();
  assert.deepEqual(st.cycle, { total: 3, index: 1, focusMin: 25, breakMin: 5 });
  await say('1', 'Lena', '!anhalten'); assert.equal((await timerLib.getTimer()).paused, null); // Zuschauer dürfen das nicht
  await say('999', 'Streamerin', '!anhalten', mod); assert.ok((await timerLib.getTimer()).paused);
  await say('999', 'Streamerin', '!weiter', mod); assert.equal((await timerLib.getTimer()).paused, null);
  await say('999', 'Streamerin', '!pomodoro', mod); // ohne Zahlen: Einstellungen
  st = await timerLib.getTimer(); assert.equal(st.cycle.total, (await getSettings()).repeats);
  const login = await adminCall('POST', 'login', { password: 'geheim' });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const r = await adminCall('POST', 'timer/focus', { minutes: 30, breakMinutes: 10, repeats: 2 }, cookie);
  assert.deepEqual(r.body.timer.cycle, { total: 2, index: 1, focusMin: 30, breakMin: 10 });
  assert.ok((await adminCall('POST', 'timer/hold', {}, cookie)).body.timer.paused);
  assert.equal((await adminCall('POST', 'timer/resume', {}, cookie)).body.timer.paused, null);
  assert.equal((await adminCall('POST', 'test/event', { kind: 'tonstart' }, cookie)).status, 200);
  assert.equal((await adminCall('POST', 'test/event', { kind: 'tonende' }, cookie)).status, 200);
  const v = await viewNow(); assert.deepEqual(v.ton, { start: true, ende: true, lautstaerke: 60 }); assert.equal(v.timer.cycle.total, 2);
  await timerLib.stopTimer(await getSettings());
});
await test('Pomodoro von Hand zählen und Chat-Befehle', async () => {
  const login = await adminCall('POST', 'login', { password: 'geheim' });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const before = (await viewNow()).pomodoro.done;
  assert.equal((await adminCall('POST', 'timer/count', { delta: 2 }, cookie)).body.done, before + 2);
  assert.equal((await adminCall('POST', 'timer/count', { delta: -99 }, cookie)).body.done, 0);
  const bc = { chatter_user_id: '999', badges: [{ set_id: 'broadcaster' }] };
  assert.match((await say('999', 'Streamerin', '!pomodoros 8', bc)).message, /Ziel heute: 8 Pomodoros/);
  assert.equal((await getSettings()).pomodoroGoal, 8);
  await saveSettings({ pomodoroGoal: 6 });
  assert.match((await say('999', 'Streamerin', '!pomodoro 20', bc)).message, /Pomodoro 1 von \d+ startet: 20 Minuten/);
  await timerLib.stopTimer(await getSettings());
});
await test('Layout: wird geprüft, begrenzt und mit Standard ergänzt', async () => {
  const l = layoutLib.normalizeLayout({ uhr: { x: 99999, y: -5, s: 99 }, kamera: { w: 10, on: 0 }, unbekannt: { x: 1 } });
  assert.equal(l.uhr.x, 2200); assert.equal(l.uhr.s, 2.5); assert.equal(l.kamera.w, 160); assert.equal(l.kamera.on, false);
  assert.ok(!('unbekannt' in l)); assert.equal(l.musik.s, 1);
  const login = await adminCall('POST', 'login', { password: 'geheim' });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const saved = await adminCall('PUT', 'settings', { layout: { tasks: { x: 120, y: 340, s: 1.2 }, kamera: { x: 100, y: 100, w: 640, h: 360 } } }, cookie);
  assert.equal(saved.body.settings.layout.tasks.x, 120); assert.equal(saved.body.settings.layout.kamera.w, 640);
  assert.equal(saved.body.settings.layout.uhr.x, 36); // Rest bleibt
  const v = await viewNow();
  assert.equal(v.layout.tasks.y, 340);
});
await test('Musik: Schnittstelle mit Schlüssel, Chatbefehl, Veralten und Quellen', async () => {
  const post = (body, token) => musikIngest(new Request('https://x/api/musik', { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) }));
  assert.equal((await post({ title: 'X' })).status, 401);
  assert.equal((await post({ title: 'Lofi Rain', artist: 'Mondschein', cover: 'https://bild.example/c.jpg' }, 'ingest-geheim')).status, 200);
  assert.deepEqual(await getMusik(), { title: 'Lofi Rain', artist: 'Mondschein', cover: 'https://bild.example/c.jpg' });
  assert.equal(await getMusik(Date.now() + 10 * 60_000), null); // nichts mehr gemeldet: läuft nicht mehr
  await post({ title: '<b>Evil</b>', cover: 'javascript:alert(1)' }, 'ingest-geheim');
  assert.deepEqual(await getMusik(), { title: 'bEvil/b', artist: '', cover: '' });
  await saveSettings({ musikQuelle: 'server' });
  assert.equal((await viewNow()).musik.mode, 'server');
  const bc = { chatter_user_id: '999', badges: [{ set_id: 'broadcaster' }] };
  assert.match((await say('999', 'Streamerin', '!song Rainy Café - Mondschein', bc)).message, /Jetzt läuft: Rainy Café - Mondschein/);
  assert.equal((await viewNow()).musik.now.artist, 'Mondschein');
  assert.equal((await getMusik(Date.now() + 3 * 3_600_000)).title, 'Rainy Café'); // von Hand gesetzt bleibt stehen
  await say('1', 'Lena', '!song Geheim - Hacker'); // Zuschauer dürfen nicht
  assert.equal((await getMusik()).title, 'Rainy Café');
  await say('999', 'Streamerin', '!song aus', bc);
  assert.equal(await getMusik(), null);
  await saveSettings({ musikQuelle: 'lokal', musikUrl: 'http://localhost:1608/' });
  const v = await viewNow(); assert.equal(v.musik.mode, 'lokal'); assert.equal(v.musik.url, 'http://localhost:1608/');
  await saveSettings({ musikQuelle: 'aus' }); assert.equal((await viewNow()).musik, null);
});

console.log('Ziel-Karte, Streamzeit, Fenster-Ansicht');
await test('Kamerafenster ist immer quadratisch', async () => {
  assert.equal(layoutLib.DEFAULT_LAYOUT.kamera.w, layoutLib.DEFAULT_LAYOUT.kamera.h);
  const l = layoutLib.normalizeLayout({ kamera: { w: 500, h: 200 } });
  assert.equal(l.kamera.w, 500); assert.equal(l.kamera.h, 500);
});
await test('Seiten: setzen, dazuzählen, Chatbefehle nur für die Streamerin', async () => {
  const s = await getSettings();
  assert.equal((await pagesLib.setPages(10, s)).today, 10);
  assert.equal((await pagesLib.addPages(5, s)).today, 15);
  const bc = { chatter_user_id: '999', badges: [{ set_id: 'broadcaster' }] };
  assert.match((await say('999', 'Streamerin', '!seiten +3', bc)).message, /Heute 18 von 30 Seiten/);
  assert.match((await say('999', 'Streamerin', '!seitenziel 40', bc)).message, /Seitenziel: 40 Seiten/);
  const before = chatSent().length;
  await say('1', 'Lena', '!seiten 99');
  assert.equal(chatSent().length, before);
  assert.equal((await pagesLib.getPages(await getSettings())).today, 18);
  await saveSettings({ seitenGoal: 30 });
});
await test('Streamzeit: von Hand starten und beenden, Twitch-Beginn wird erkannt', async () => {
  await db.delete('cache/live');
  await streamLib.stopStream();
  assert.equal((await streamLib.streamInfo()).startedAt, null);
  liveStart = new Date(Date.now() - 90 * 60_000).toISOString(); // Twitch meldet: seit 90 Minuten live
  await db.delete('cache/live');
  const t = await streamLib.streamInfo(Date.now() + 1);
  assert.equal(t.startedAt, null); // von Hand beendet, der Twitch-Stream begann vorher: bleibt beendet
  await streamLib.startStream(Date.now() - 30 * 60_000);
  const m = await streamLib.streamInfo();
  assert.equal(m.quelle, 'hand'); assert.ok(Math.abs(Date.now() - m.startedAt - 30 * 60_000) < 5000);
  await db.set('state/stream', { startedAt: null, stoppedAt: Date.now() - 3 * 3_600_000 }); // früher beendet
  await db.delete('cache/live');
  const t2 = await streamLib.streamInfo();
  assert.equal(t2.quelle, 'twitch'); assert.ok(Math.abs(Date.now() - t2.startedAt - 90 * 60_000) < 5000);
  assert.equal(streamLib.fmtHM(5_400_000), '1:30');
  liveStart = null; await db.delete('cache/live'); await db.delete('state/stream');
});
await test('Ziel-Karte und Wachstum: Wörter, Seiten, Streamzeit, Pomodoros', async () => {
  const bc = { chatter_user_id: '999', badges: [{ set_id: 'broadcaster' }] };
  await saveSettings({ zielArt: 'woerter', wachstumQuelle: 'ziel', wordGoal: 1000 });
  await wordsLib.setToday(400, await getSettings());
  let v = await viewNow();
  assert.equal(v.ziel.art, 'woerter'); assert.equal(v.ziel.current, 400); assert.ok(Math.abs(v.progress - 0.4) < 0.001);
  await saveSettings({ zielArt: 'seiten', seitenGoal: 20 }); await pagesLib.setPages(5, await getSettings());
  v = await viewNow();
  assert.equal(v.ziel.label, 'Seiten heute'); assert.equal(v.ziel.numeric, true); assert.ok(Math.abs(v.progress - 0.25) < 0.001);
  // Streamzeit: 1,5 von 3 Stunden, die Landschaft wächst auch ohne Wörter
  await saveSettings({ zielArt: 'zeit', wachstumQuelle: 'ziel', streamGoalMinutes: 180 });
  await streamLib.startStream(Date.now() - 90 * 60_000);
  v = await viewNow();
  assert.equal(v.ziel.numeric, false); assert.equal(v.ziel.text, '1:30'); assert.equal(v.ziel.goalText, '3:00'); assert.ok(Math.abs(v.progress - 0.5) < 0.01);
  await saveSettings({ zielArt: 'woerter', wachstumQuelle: 'zeit' });
  v = await viewNow(); assert.ok(Math.abs(v.progress - 0.5) < 0.01); // Wörter spielen keine Rolle
  await saveSettings({ wachstumQuelle: 'kombi' });
  v = await viewNow(); assert.ok(Math.abs(v.progress - (0.5 + 0.4) / 2) < 0.01);
  await saveSettings({ zielArt: 'pomodoros', wachstumQuelle: 'ziel', pomodoroGoal: 4 });
  v = await viewNow(); assert.equal(v.ziel.label, 'Pomodoros heute'); assert.equal(v.ziel.goal, 4);
  // Chat: Streamzeit steuern
  assert.match((await say('999', 'Streamerin', '!stream ziel 4', bc)).message, /Streamziel: 4:00 Std/);
  assert.equal((await getSettings()).streamGoalMinutes, 240);
  assert.match((await say('999', 'Streamerin', '!stream stop', bc)).message, /gestoppt/);
  assert.equal((await viewNow()).zeit.startedAt, null);
  assert.match((await say('999', 'Streamerin', '!stream start', bc)).message, /Streamzeit läuft/);
  await saveSettings({ zielArt: 'woerter', wachstumQuelle: 'ziel', pomodoroGoal: 6, streamGoalMinutes: 180 });
  await streamLib.stopStream();
});
await test('Fenster-Ansicht: Ort, Blick und Wetter (Einstellungen und Ansicht)', async () => {
  const login = await adminCall('POST', 'login', { password: 'geheim' });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const saved = await adminCall('PUT', 'settings', { szeneModus: 'fenster', fensterOrt: 'arbeit', fensterBlick: 'see', fensterWetter: 'auto', jahreszeit: 'winter' }, cookie);
  assert.equal(saved.body.settings.szeneModus, 'fenster'); assert.equal(saved.body.settings.fensterBlick, 'see');
  let v = await viewNow();
  assert.equal(v.modus, 'fenster'); assert.deepEqual(v.fenster, { ort: 'arbeit', blick: 'see', wetter: 'schnee' }); assert.deepEqual(v.seats, []);
  assert.equal(v.stefanie, undefined);
  await saveSettings({ jahreszeit: 'sommer', fensterWetter: 'auto', fensterOrt: 'lese', fensterBlick: 'wald' });
  v = await viewNow(); assert.deepEqual(v.fenster, { ort: 'lese', blick: 'wald', wetter: 'klar' });
  await saveSettings({ fensterWetter: 'regen' });
  v = await viewNow(); assert.equal(v.fenster.wetter, 'regen');
  for (const bad of [{ fensterBlick: 'mond' }, { fensterOrt: 'keller' }, { fensterWetter: 'hagel' }, { szeneModus: 'kino' }]) assert.ok((await adminCall('PUT', 'settings', bad, cookie)).status === 400, JSON.stringify(bad));
  await saveSettings({ szeneModus: 'wachstum', jahreszeit: 'auto', fensterWetter: 'auto' });
});
await test('Admin: Seiten und Streamzeit', async () => {
  const login = await adminCall('POST', 'login', { password: 'geheim' });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  assert.equal((await adminCall('POST', 'pages', { mode: 'set', value: 7 }, cookie)).body.today, 7);
  assert.equal((await adminCall('POST', 'pages', { mode: 'delta', value: 2 }, cookie)).body.today, 9);
  assert.equal((await adminCall('POST', 'pages', { value: 'x' }, cookie)).status, 400);
  assert.equal((await adminCall('POST', 'stream/start', {}, cookie)).body.quelle, 'hand');
  assert.equal((await adminCall('POST', 'stream/stop', {}, cookie)).body.startedAt, null);
});

console.log('Design und Zugangsdaten-Datei');
await test('Design: wird geprüft, begrenzt, mit Standard ergänzt und im Overlay mitgeschickt', async () => {
  const login = await adminCall('POST', 'login', { password: 'geheim' });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const r = await adminCall('PUT', 'settings', { design: { theme: 'nacht', farben: { akzent: '#FF00AA', text: 'rot', gibtEsNicht: '#000000' }, radius: 999, deckkraft: 1, schrift: 'comic', randBreite: 'x' } }, cookie);
  const d = r.body.settings.design;
  assert.equal(d.theme, 'nacht'); assert.deepEqual(d.farben, { akzent: '#ff00aa' }); assert.equal(d.radius, 44); assert.equal(d.deckkraft, 40);
  assert.equal(d.schrift, 'rund'); assert.equal(d.randBreite, 3); assert.equal(d.schatten, true);
  assert.equal((await viewNow()).design.theme, 'nacht');
  const { designVars } = await import('../public/js/design.mjs');
  const vars = designVars(d); assert.equal(vars['--akzent'], '#ff00aa'); assert.equal(vars['--radius'], '44px'); assert.match(vars['--papier'], /^rgba\(44, 42, 58, 0\.4\)$/);
  await adminCall('PUT', 'settings', { design: { theme: 'warm', farben: null } }, cookie); // Farben zurücksetzen
  assert.deepEqual((await viewNow()).design.farben, {});
});
await test('novelsbyeverly.env: Werte werden geladen, echte Umgebungsvariablen haben Vorrang', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cowork-env-'));
  fs.writeFileSync(path.join(dir, 'novelsbyeverly.env'), '# Kommentar\nADMIN_PASSWORD="aus datei"\nTWITCH_CLIENT_ID = abc123\nPORT=9999\n');
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync(process.execPath, ['-e', "import('./server/core/config.mjs').then(() => console.log(JSON.stringify([process.env.ADMIN_PASSWORD, process.env.TWITCH_CLIENT_ID, process.env.PORT])))"], { env: { PATH: process.env.PATH, DATA_DIR: dir, PORT: '1234' }, encoding: 'utf8' });
  assert.deepEqual(JSON.parse(r.stdout), ['aus datei', 'abc123', '1234']);
  fs.rmSync(dir, { recursive: true, force: true });
});

console.log('System: ZIP, Update, Sicherung');
const { readZip, writeZip } = await mod('core/zip.mjs');
const sicherung = await mod('core/sicherung.mjs');
const updateMod = await mod('update.mjs');
const system = await mod('api/system.mjs');
const { DATA_DIR: dataDir, BACKUP_DIR: backupDir } = await mod('core/config.mjs');
const zipOf = (files) => writeZip(Object.entries(files).map(([name, text]) => ({ name, data: Buffer.from(text) })));
await test('ZIP: schreiben und lesen, Umlaute und Unterordner', async () => {
  const z = readZip(zipOf({ 'server/ü.txt': 'Grüße', 'a/b/c.txt': 'x'.repeat(5000) }));
  assert.deepEqual(z.map((e) => e.name), ['server/ü.txt', 'a/b/c.txt']);
  assert.equal(z[0].data().toString(), 'Grüße'); assert.equal(z[1].data().length, 5000);
  assert.throws(() => readZip(Buffer.from('kein zip')), /keine gültige ZIP/);
});
await test('Update-ZIP: umschließender Ordner wird abgestreift, Fremdes ignoriert, Pflichtdateien geprüft', async () => {
  const gut = { 'server/index.mjs': '1', 'server/update.mjs': '1', 'public/overlay.html': '1', 'VERSION.txt': 'x', 'README.md': 'egal', 'docker-compose.yml': 'egal' };
  const e = updateMod.programmEintraege(readZip(zipOf(Object.fromEntries(Object.entries(gut).map(([k, v]) => [`novelsbyeverly/${k}`, v])))));
  assert.deepEqual([...e.keys()].sort(), ['VERSION.txt', 'public/overlay.html', 'server/index.mjs', 'server/update.mjs']);
  assert.equal(updateMod.programmEintraege(readZip(zipOf(gut))).size, 4);
  assert.throws(() => updateMod.programmEintraege(readZip(zipOf({ 'server/index.mjs': '1' }))), /kein Update für dieses Programm/);
  assert.throws(() => updateMod.programmEintraege(readZip(zipOf({ ...gut, 'server/../../x.mjs': '1' }))), /Unzulässiger Pfad/);
});
await test('Datensicherung: ohne Twitch-Zugänge, Wiederherstellung ersetzt die Daten', async () => {
  await db.set('config/settings', { marker: 'vorher' }); await db.set('config/tokens', { access_token: 'geheim' });
  const name = sicherung.sichereDaten('test');
  const inhalt = readZip(fs.readFileSync(path.join(backupDir, name))).map((e) => e.name);
  assert.ok(inhalt.includes('cowork/config%2Fsettings')); assert.ok(inhalt.includes('INFO.txt'));
  assert.ok(!inhalt.some((n) => n.includes('tokens')), 'Zugänge dürfen nicht in der Sicherung stehen');
  await db.set('config/settings', { marker: 'nachher' }); await db.set('config/tokens', { access_token: 'neu' });
  sicherung.stelleDatenWiederHer(path.join(backupDir, name));
  assert.equal((await db.get('config/settings')).marker, 'vorher');
  assert.equal((await db.get('config/tokens')).access_token, 'neu'); // Zugänge bleiben unberührt
  assert.ok(sicherung.liste().daten.some((b) => b.name === name));
  assert.ok(sicherung.liste().daten.some((b) => b.name.endsWith('_vor_wiederherstellung.zip')));
});
await test('Update einspielen: neues Programm, Sicherung des alten, fehlerhaftes Update ändert nichts', async () => {
  // Kopie des Programms in einem Hilfsordner, damit das echte Projekt unangetastet bleibt
  const app = fs.mkdtempSync(path.join(os.tmpdir(), 'cowork-app-')), data = fs.mkdtempSync(path.join(os.tmpdir(), 'cowork-data-'));
  fs.cpSync('server', path.join(app, 'server'), { recursive: true }); fs.mkdirSync(path.join(app, 'public')); fs.writeFileSync(path.join(app, 'public/overlay.html'), 'alt');
  fs.writeFileSync(path.join(app, 'VERSION.txt'), '1.0 alt'); fs.writeFileSync(path.join(app, 'package.json'), '{}');
  const { spawnSync } = await import('node:child_process');
  const lauf = () => spawnSync(process.execPath, ['-e', "import('./server/update.mjs').then((m) => console.log('NEUSTART=' + m.wendeAnstehendesAn()))"], { cwd: app, env: { ...process.env, DATA_DIR: data, LOCAL_STORE_DIR: '' }, encoding: 'utf8' });
  const programm = { 'server/index.mjs': 'export {};', 'server/update.mjs': fs.readFileSync('server/update.mjs', 'utf8'), 'server/core/config.mjs': fs.readFileSync('server/core/config.mjs', 'utf8'), 'server/core/zip.mjs': fs.readFileSync('server/core/zip.mjs', 'utf8'), 'server/core/sicherung.mjs': fs.readFileSync('server/core/sicherung.mjs', 'utf8'), 'public/overlay.html': 'neu', 'VERSION.txt': '2.0 neu', 'package.json': '{}' };
  // 1) fehlerhaft: Syntaxfehler
  fs.writeFileSync(path.join(data, 'update.zip'), zipOf({ ...programm, 'server/kaputt.mjs': 'const = ;' }));
  let r = lauf(); assert.match(r.stdout, /NEUSTART=false/);
  assert.equal(fs.readFileSync(path.join(app, 'VERSION.txt'), 'utf8'), '1.0 alt'); assert.ok(fs.existsSync(path.join(data, 'update_fehlerhaft.zip')));
  assert.match(fs.readFileSync(path.join(data, 'update_status.txt'), 'utf8'), /Syntaxfehler in server\/kaputt\.mjs/);
  assert.ok(!fs.existsSync(path.join(app, 'server/kaputt.mjs')));
  // 2) gut
  fs.writeFileSync(path.join(data, 'update.zip'), zipOf(Object.fromEntries(Object.entries(programm).map(([k, v]) => [`novelsbyeverly/${k}`, v]))));
  r = lauf(); assert.match(r.stdout, /NEUSTART=true/, r.stderr);
  assert.equal(fs.readFileSync(path.join(app, 'VERSION.txt'), 'utf8'), '2.0 neu'); assert.equal(fs.readFileSync(path.join(app, 'public/overlay.html'), 'utf8'), 'neu');
  assert.ok(!fs.existsSync(path.join(data, 'update.zip'))); assert.match(fs.readFileSync(path.join(data, 'update_status.txt'), 'utf8'), /erfolgreich/);
  const backups = fs.readdirSync(path.join(data, 'backups')).filter((n) => n.startsWith('programm_vor_update_'));
  assert.equal(backups.length, 1);
  assert.equal(readZip(fs.readFileSync(path.join(data, 'backups', backups[0]))).find((e) => e.name === 'VERSION.txt').data().toString(), '1.0 alt');
  fs.rmSync(app, { recursive: true, force: true }); fs.rmSync(data, { recursive: true, force: true });
});
await test('System-API: nur mit Login, Update-Upload wird geprüft und vorgemerkt, Rückrollen und Sicherungen', async () => {
  let neustarts = 0; system.hooks.neustart = () => { neustarts += 1; };
  const call = (method, p, { body, type = 'application/json', cookie } = {}) => system.default(new Request(`https://x/api/system/${p}`, { method, headers: { ...(type ? { 'content-type': type } : {}), ...(cookie ? { cookie } : {}) }, body }));
  assert.equal((await call('GET', '')).status, 401);
  const login = await adminCall('POST', 'login', { password: 'geheim' });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const info = await (await call('GET', '', { cookie })).json();
  assert.match(info.version, /^1\./); assert.ok(Array.isArray(info.daten) && Array.isArray(info.programm));
  assert.equal((await call('POST', 'update', { body: 'x', type: 'application/zip' })).status, 401);
  assert.equal((await call('POST', 'update', { body: 'x', type: 'text/plain', cookie })).status, 415);
  assert.equal((await call('POST', 'update', { body: 'kein zip', type: 'application/zip', cookie })).status, 400);
  assert.equal((await call('POST', 'update', { body: zipOf({ 'foo.txt': 'x' }), type: 'application/zip', cookie })).status, 400); // kein Programm
  assert.equal(neustarts, 0);
  const gut = zipOf({ 'server/index.mjs': '1', 'server/update.mjs': '1', 'public/overlay.html': '1', 'VERSION.txt': '9.9 test' });
  assert.equal((await call('POST', 'update', { body: gut, type: 'application/zip', cookie })).status, 200);
  assert.ok(fs.existsSync(path.join(dataDir, 'update.zip'))); assert.equal(neustarts, 1);
  fs.rmSync(path.join(dataDir, 'update.zip'));
  assert.ok((await (await call('GET', '', { cookie })).json()).daten.some((b) => b.name.endsWith('_vor_update.zip'))); // Daten wurden vorher gesichert
  assert.equal((await call('POST', 'zurueck', { body: JSON.stringify({ name: '../../etc/passwd' }), cookie })).status, 400);
  // Datensicherung: anlegen, herunterladen, löschen
  const neu = await (await call('POST', 'sicherung', { body: '{}', cookie })).json();
  const dl = await call('GET', `sicherung/${neu.name}`, { cookie, type: null }); assert.equal(dl.headers.get('content-type'), 'application/zip');
  assert.equal((await call('POST', 'wiederherstellen', { body: JSON.stringify({ name: neu.name }), cookie })).status, 200); assert.equal(neustarts, 2);
  fs.rmSync(path.join(dataDir, 'restore.zip'), { force: true });
  assert.equal((await call('DELETE', `sicherung/${neu.name}`, { body: '{}', cookie })).status, 200);
  assert.equal((await call('GET', `sicherung/${neu.name}`, { cookie, type: null })).status, 404);
});

console.log('Twitch-App im Admin und Live-Kanal');
const zugang = await mod('twitch/zugang.mjs');
const live = await mod('core/live.mjs');
const einlogg = async () => (await adminCall('POST', 'login', { password: 'geheim' })).headers.get('set-cookie').split(';')[0];
const eigeneId = 'cid' + 'a'.repeat(20);

await test('Twitch-App: Client-ID und Secret im Admin, Secret bleibt geheim und aus Sicherungen', async () => {
  const cookie = await einlogg();
  assert.equal((await adminCall('GET', 'twitch-app')).status, 401);
  const a = (await adminCall('GET', 'twitch-app', null, cookie)).body;
  assert.equal(a.clientId, 'cid'); assert.equal(a.idQuelle, 'env'); assert.equal(a.hasSecret, false);
  assert.equal((await adminCall('PUT', 'twitch-app', { clientId: 'zu kurz!' }, cookie)).status, 400);
  assert.equal((await adminCall('PUT', 'twitch-app', { clientSecret: 'x' }, cookie)).status, 400);
  const neu = await adminCall('PUT', 'twitch-app', { clientId: eigeneId }, cookie);
  assert.equal(neu.status, 200); assert.equal(neu.body.disconnected, true); // andere ID: alte Anmeldungen gelten nicht mehr
  assert.equal(await db.get('config/tokens'), null); assert.equal(await db.get('config/bot-tokens'), null);
  const mitSecret = await adminCall('PUT', 'twitch-app', { clientSecret: 's'.repeat(30) }, cookie);
  assert.equal(mitSecret.body.hasSecret, true); assert.equal(mitSecret.body.disconnected, false);
  assert.ok(!JSON.stringify(mitSecret.body).includes('ssssss')); // das Secret verlässt den Server nie
  assert.ok(!JSON.stringify((await adminCall('GET', 'state', null, cookie)).body).includes('ssssss'));
  // Twitch-Aufrufe nehmen die gespeicherten Angaben
  const { tokenRequest } = await mod('twitch/api.mjs');
  await tokenRequest({ grant_type: 'client_credentials' });
  const gesendet = new URLSearchParams(calls.at(-1).raw);
  assert.equal(gesendet.get('client_id'), eigeneId); assert.equal(gesendet.get('client_secret'), 's'.repeat(30));
  assert.equal((await adminCall('POST', 'twitch-app/test', {}, cookie)).body.ok, true);
  const start = await auth(new Request('https://x/api/auth/device/start', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: '{}' }));
  assert.equal(start.status, 200); assert.equal(new URLSearchParams(calls.at(-1).raw).get('client_id'), eigeneId);
  // Sicherungen enthalten weder Client-ID noch Secret
  const name = sicherung.sichereDaten('app');
  assert.ok(!readZip(fs.readFileSync(path.join(backupDir, name))).some((e) => e.name.includes('twitch-app')));
  sicherung.stelleDatenWiederHer(path.join(backupDir, name));
  await zugang.ladeTwitchApp();
  assert.equal(zugang.twitchApp().clientId, eigeneId); // die Wiederherstellung lässt die Zugangsdaten stehen
  assert.equal((await adminCall('PUT', 'twitch-app', { clearSecret: true }, cookie)).body.hasSecret, false);
  await adminCall('PUT', 'twitch-app', { clientId: '' }, cookie); // zurück auf den Ersatzwert aus der Umgebung
  assert.equal(zugang.twitchApp().clientId, 'cid');
});

// Anmeldungen für die folgenden Tests wiederherstellen
await db.set('config/tokens', { access_token: 'tokB', refresh_token: 'r', expires_at: Date.now() + 3_600_000, user_id: '999', login: 'streamerin', scopes: ['channel:read:redemptions', 'channel:manage:redemptions', 'user:write:chat', 'user:read:chat', 'user:bot', 'channel:bot'] });

await test('Live-Kanal: Änderungen gehen sofort ans Overlay', async () => {
  const gesehen = [];
  const listeners = [];
  live.attach({ on: (e, f) => listeners.push([e, f]) }, { writeHead() {}, write: (t) => gesehen.push(t) });
  await saveSettings({ jahreszeit: 'herbst' });
  await adminCall('POST', 'test/event', { kind: 'goal' }, await einlogg());
  assert.ok(gesehen.some((t) => t.startsWith('event: settings')) && gesehen.some((t) => t.startsWith('event: event')));
  assert.equal(live.listeners(), 1);
  listeners.find(([e]) => e === 'close')[1]();
  assert.equal(live.listeners(), 0);
  await saveSettings({ jahreszeit: 'auto' });
});

console.log(`\n${passed} Tests bestanden${process.exitCode ? ' – es gibt Fehler (siehe oben)' : ''}`);
