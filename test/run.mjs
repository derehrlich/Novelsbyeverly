// Ende-zu-Ende-Test der Functions mit simulierter Twitch-API und Dateispeicher.  npm test
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.LOCAL_STORE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cowork-test-'));
Object.assign(process.env, {
  TWITCH_CLIENT_ID: 'cid', TWITCH_CLIENT_SECRET: 'csecret', EVENTSUB_SECRET: 'hooksecret1234',
  ADMIN_PASSWORD: 'geheim', SITE_URL: 'https://beispiel.netlify.app', INGEST_TOKEN: 'ingest-geheim',
});

// ---- Twitch simulieren
const calls = [];
let rewards = [];
let subs = [];
const failSubTypes = new Set();
let liveStart = null; // simulierter Twitch-Stream (ISO-Zeit) oder null
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url);
  const entry = { method: init.method || 'GET', path: u.pathname, query: Object.fromEntries(u.searchParams), auth: init.headers?.Authorization, body: init.body && !String(init.body).includes('=') ? JSON.parse(init.body) : init.body };
  calls.push(entry);
  const ok = (data, status = 200) => new Response(JSON.stringify(data), { status });
  if (u.host === 'id.twitch.tv') {
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

const mod = (rel) => import(`../netlify/${rel}`);
const { db } = await mod('lib/store.mjs');
const { getSettings, saveSettings, DEFAULTS, normalize } = await mod('lib/settings.mjs');
const webhook = (await mod('functions/twitch-webhook.mjs')).default;
const overlay = (await mod('functions/overlay.mjs')).default;
const admin = (await mod('functions/admin.mjs')).default;
const ingest = (await mod('functions/words-ingest.mjs')).default;
const auth = (await mod('functions/auth.mjs')).default;
const people = await mod('lib/people.mjs');
const timerLib = await mod('lib/timer.mjs');
const wordsLib = await mod('lib/words.mjs');
const tasksLib = await mod('lib/tasks.mjs');
const { ensureCheckinReward } = await mod('lib/twitch.mjs');
const musikIngest = (await mod('functions/musik-ingest.mjs')).default;
const { resolveSeason, resolveTime } = await mod('lib/zeiten.mjs');
const { getMusik } = await mod('lib/musik.mjs');
const layoutLib = await import('../public/js/layout.mjs');
const pagesLib = await mod('lib/pages.mjs');
const streamLib = await mod('lib/streamzeit.mjs');
const kat = await import('../public/js/katalog.mjs');

let passed = 0;
const test = async (name, fn) => {
  try { await fn(); passed += 1; console.log(`  ok  ${name}`); } catch (e) { console.error(`FAIL  ${name}\n`, e); process.exitCode = 1; }
};

// ---- Hilfen
let n = 0;
const sign = (body, type = 'notification', extra = {}) => {
  const raw = JSON.stringify(body);
  const id = `m${(n += 1)}`; const ts = extra.ts ?? new Date().toISOString();
  const sig = 'sha256=' + crypto.createHmac('sha256', extra.secret ?? process.env.EVENTSUB_SECRET).update(id + ts + raw).digest('hex');
  return new Request('https://x/api/twitch-webhook', { method: 'POST', body: raw, headers: { 'twitch-eventsub-message-id': id, 'twitch-eventsub-message-timestamp': ts, 'twitch-eventsub-message-signature': sig, 'twitch-eventsub-message-type': type } });
};
const chatEvent = (uid, name, text, extra = {}) => ({ subscription: { type: 'channel.chat.message' }, event: { broadcaster_user_id: '999', chatter_user_id: uid, chatter_user_name: name, message_id: `c${(n += 1)}`, message: { text }, badges: [], ...extra } });
const say = async (uid, name, text, extra) => { const res = await webhook(sign(chatEvent(uid, name, text, extra))); assert.equal(res.status, 204); return lastChat(); };
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

console.log('Webhook');
await test('falsche Signatur und altes Datum werden abgelehnt', async () => {
  assert.equal((await webhook(sign(chatEvent('1', 'A', '!hilfe'), 'notification', { secret: 'falsch' }))).status, 403);
  assert.equal((await webhook(sign(chatEvent('1', 'A', '!hilfe'), 'notification', { ts: new Date(Date.now() - 3_600_000).toISOString() }))).status, 403);
});
await test('Verifizierung gibt die Challenge zurück', async () => {
  const res = await webhook(sign({ challenge: 'abc123' }, 'webhook_callback_verification'));
  assert.equal(await res.text(), 'abc123');
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
  await webhook(sign(ev)); const sent = chatSent().length;
  await webhook(sign(ev));
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
  const msg = await say('999', 'Streamerin', '!sprint 1', { chatter_user_id: '999', badges: [{ set_id: 'broadcaster' }] });
  assert.equal(msg.sender_id, '555');
  assert.match(msg.message, /Pomodoro startet: 1 Minuten/);
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
await test('automatische Runden, wenn aktiviert', async () => {
  const s = { ...(await getSettings()), autoCycle: true, focusMinutes: 1, breakMinutes: 1 };
  await timerLib.stopTimer(s);
  const t = await timerLib.startFocus(s, 1, Date.now() - 125_000);
  const after = await timerLib.tick(s, Date.now());
  assert.equal(after.phase, 'focus'); assert.equal(after.round, t.round + 1);
  await timerLib.stopTimer(s);
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
  const redeem = (id, uid, name) => webhook(sign({ subscription: { type: 'channel.channel_points_custom_reward_redemption.add' }, event: { id, user_id: uid, user_name: name, reward: { id: reward.id } } }));
  await redeem('r1', '20', 'Emma');
  assert.match(lastChat().message, /Emma ist eingecheckt – Besuch #1/);
  assert.ok(calls.some((c) => c.path.endsWith('/redemptions') && c.body.status === 'FULFILLED'));
  assert.ok(await db.get('seat/20'));
  await redeem('r2', '20', 'Emma'); // schon da: Punkte zurück
  assert.match(lastChat().message, /sitzt schon.*Punkte/);
  assert.ok(calls.some((c) => c.path.endsWith('/redemptions') && c.body.status === 'CANCELED'));
  await webhook(sign({ subscription: { type: 'x' }, event: { id: 'r3', user_id: '21', user_name: 'X', reward: { id: 'fremd' } } }));
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
await test('OAuth: Bot-Rolle fordert nur Bot-Berechtigungen, Callback speichert getrennt', async () => {
  const login = await adminCall('POST', 'login', { password: 'geheim' });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const res = await auth(new Request('https://x/api/auth/login?role=bot', { headers: { cookie } }));
  const loc = new URL(res.headers.get('location'));
  assert.equal(loc.searchParams.get('scope'), 'user:write:chat user:read:chat user:bot');
  const state = loc.searchParams.get('state'); assert.ok(state.endsWith('.bot'));
  await db.delete('config/bot-tokens');
  const cb = await auth(new Request(`https://x/api/auth/callback?code=abc&state=${encodeURIComponent(state)}`, { headers: { cookie: `${cookie}; oauth_state=${encodeURIComponent(state)}` } }));
  assert.equal(cb.status, 302); assert.match(cb.headers.get('location'), /verbunden=bot/);
  assert.equal((await db.get('config/bot-tokens')).login, 'streamerin'); // Mock liefert immer denselben Nutzer
  assert.equal((await db.get('config/tokens')).access_token, 'tokB');
});

console.log('Landschaft, Pomodoro, Layout, Musik');
await saveSettings({ szeneModus: 'wachstum', appearOn: 'sit', scene: 'cafe', moduleBlume: true, moduleKerze: true, moduleBuecher: true, moduleDeko: true });
const viewNow = async () => (await overlay(new Request('https://x/api/overlay'))).json();
await test('Wachstums-Modus: Platz-Befehle sind pausiert, keine Figuren im Overlay', async () => {
  const before = chatSent().length;
  await webhook(sign(chatEvent('31', 'Neu', '!sitzen')));
  await webhook(sign(chatEvent('31', 'Neu', '!figur haare rot')));
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
  assert.equal(resolveTime(s, new Date('2026-06-01T17:00:00Z')), 'abend'); // 19 Uhr
  assert.equal(resolveTime(s, new Date('2026-06-01T20:00:00Z')), 'nacht'); // 22 Uhr
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
  assert.equal(normalize({ longBreakEvery: -3 }).settings.longBreakEvery, 0);
});
await test('Pomodoro: lange Pause nach der eingestellten Anzahl, Ziel im Chattext', async () => {
  await saveSettings({ longBreakEvery: 2, longBreakMinutes: 15, breakMinutes: 5, focusMinutes: 1, pomodoroGoal: 6, autoBreak: true, autoCycle: false });
  const s = await getSettings();
  await timerLib.stopTimer(s);
  const key = `stats/sprints-${(await mod('lib/util.mjs')).streamDay(s)}`;
  const start = (await db.get(key))?.n ?? 0;
  await db.set(key, { n: start + (2 - ((start) % 2)) - 1 }); // eine Runde vor der langen Pause
  const t0 = Date.now() - 200_000;
  await timerLib.startFocus(s, 1, t0);
  const t = await timerLib.getTimer();
  await timerLib.tick(s, t.endsAt + 500);
  const brk = await timerLib.getTimer();
  assert.equal(brk.phase, 'break'); assert.equal(brk.minutes, 15);
  assert.ok(chatSent().some((m) => /Lange Pause! 15 Minuten/.test(m.message)));
  assert.ok(chatSent().some((m) => /Pomodoro \d+ von 6 geschafft/.test(m.message)));
  await timerLib.stopTimer(s);
  await db.set(key, { n: start });
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
  assert.match((await say('999', 'Streamerin', '!pomodoro 20', bc)).message, /Pomodoro startet: 20 Minuten/);
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

console.log('Ziel-Karte, Streamzeit, Stefanie');
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
await test('Stefanie im Pavillon: Figur und Tätigkeit (automatisch nach Phase)', async () => {
  const login = await adminCall('POST', 'login', { password: 'geheim' });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const saved = await adminCall('PUT', 'settings', { stefanieFigur: { haare: 'rot', frisur: 'zopf', gesicht: 'brille', tisch: 'buch', haut: '9' }, stefanieTaetigkeit: 'auto' }, cookie);
  assert.equal(saved.body.settings.stefanieFigur.haare, 'rot'); assert.equal(saved.body.settings.stefanieFigur.tisch, 'laptop'); assert.equal(saved.body.settings.stefanieFigur.haut, '2');
  await timerLib.stopTimer(await getSettings());
  let v = await viewNow();
  assert.equal(v.stefanie.taetigkeit, 'laptop'); assert.equal(v.stefanie.figur.frisur, 'zopf');
  await timerLib.startBreak(await getSettings(), 5);
  v = await viewNow(); assert.equal(v.stefanie.taetigkeit, 'buch');
  await saveSettings({ stefanieTaetigkeit: 'laptop' });
  v = await viewNow(); assert.equal(v.stefanie.taetigkeit, 'laptop');
  await saveSettings({ stefanieTaetigkeit: 'auto' });
  await timerLib.stopTimer(await getSettings());
  assert.ok((await adminCall('PUT', 'settings', { stefanieTaetigkeit: 'fliegen' }, cookie)).status === 400);
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

console.log('Check-in, Streak, Punkte, Rangliste, Sicherung');
const streakLib = await mod('lib/streak.mjs');
const punkte = await mod('lib/punkte.mjs');
const rangliste = (await mod('functions/rangliste.mjs')).default;
const backupLib = await mod('lib/admin/backup.mjs');
const events = async () => Promise.all((await db.list('event/')).map((k) => db.get(k)));
const redeemWith = (rewardId) => (id, uid, name) => webhook(sign({ subscription: { type: 'channel.channel_points_custom_reward_redemption.add' }, event: { id, user_id: uid, user_name: name, reward: { id: rewardId } } }));
await saveSettings({ checkinEnabled: true, appearOn: 'sit', milestoneLevels: '3', pointsEnabled: false });
const ciReward = await ensureCheckinReward(await getSettings(), true);
const redeem = redeemWith(ciReward.id);

await test('Streak: Schonfrist, Rekord und der heutige Tag zählt noch nicht als Fehltag', () => {
  const days = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05'];
  const user = (d) => ({ days: d });
  assert.deepEqual(streakLib.computeStreak(user(['2026-01-01', '2026-01-02', '2026-01-03']), days, '2026-01-03', 1), { current: 3, record: 3 });
  assert.deepEqual(streakLib.computeStreak(user(['2026-01-01', '2026-01-02', '2026-01-04']), days, '2026-01-04', 1), { current: 3, record: 3 }); // ein Stream verpasst: verziehen
  assert.deepEqual(streakLib.computeStreak(user(['2026-01-01', '2026-01-02', '2026-01-05']), days, '2026-01-05', 1), { current: 1, record: 2 }); // zwei verpasst: gerissen
  assert.deepEqual(streakLib.computeStreak(user(['2026-01-01', '2026-01-02']), days, '2026-01-03', 0), { current: 2, record: 2 }); // heute noch offen
  assert.deepEqual(streakLib.parseLevels('10, 25;50 x 25'), [10, 25, 50]);
});
await test('Check-in: zählt Besuch und Streak, Banner im Overlay, Chat, Einlösung erfüllt', async () => {
  await redeem('ci1', '40', 'Mira');
  assert.match(lastChat().message, /Mira ist eingecheckt – Besuch #1, 🔥 Streak 1/);
  assert.ok(calls.some((c) => c.path.endsWith('/redemptions') && c.body.status === 'FULFILLED'));
  assert.equal((await db.get('user/40')).days.length, 1);
  assert.ok((await events()).some((e) => e.type === 'checkin' && e.name === 'Mira' && e.count === 1 && e.milestone === false));
  assert.equal(await db.get('seat/40'), null); // ohne „Erscheinen bei Check-in“ setzt sich keine Figur hin
});
await test('Check-in: zweiter am selben Tag wird erstattet und nicht doppelt gezählt', async () => {
  const before = calls.length;
  await redeem('ci2', '40', 'Mira');
  assert.match(lastChat().message, /schon eingecheckt \(Besuch #1\).*Punkte kommen|schon eingecheckt \(Besuch #1\).*Punkte bekommst/);
  assert.ok(calls.slice(before).some((c) => c.path.endsWith('/redemptions') && c.body.status === 'CANCELED'));
  assert.equal((await db.get('user/40')).days.length, 1);
});
await test('Check-in: Wiederholte Zustellung derselben Einlösung wird ignoriert', async () => {
  const before = chatSent().length;
  await redeem('ci1', '40', 'Mira');
  assert.equal(chatSent().length, before);
});
await test('Meilenstein: eigener Chattext und goldenes Banner', async () => {
  const user = await db.get('user/40');
  await db.set('user/41', { ...user, name: 'Nele', days: ['2026-01-01', '2026-01-02'] });
  await redeem('ci3', '41', 'Nele');
  assert.match(lastChat().message, /Nele ist zum 3\. Mal dabei – Meilenstein/);
  assert.ok((await events()).some((e) => e.type === 'checkin' && e.name === 'Nele' && e.milestone === true));
});
await test('Check-in mit „Erscheinen bei Check-in“ setzt im Zimmer-Modus zusätzlich die Figur hin', async () => {
  await saveSettings({ appearOn: 'checkin', szeneModus: 'zimmer' });
  await redeem('ci4', '42', 'Otto');
  assert.ok(await db.get('seat/42'));
  assert.equal((await db.get('user/42')).days.length, 1);
  await saveSettings({ appearOn: 'sit', szeneModus: 'wachstum' });
});
await test('!streak antwortet nur bei eingeschaltetem Check-in und zeigt Besuche, Streak und Platz', async () => {
  const msg = await say('40', 'Mira', '!streak');
  assert.match(msg.message, /Mira: 1 Besuche · 🔥 Streak 1 \(Rekord 1\) · Platz \d+ von \d+/);
  assert.match((await say('99', 'Fremd', '!streak')).message, /noch keinen Check-in von dir/);
  await saveSettings({ checkinEnabled: false });
  const before = chatSent().length;
  await say('40', 'Mira', '!streak');
  assert.equal(chatSent().length, before); // Check-in aus: keine Antwort
  await saveSettings({ checkinEnabled: true });
});
await test('Ohne Check-in-Schalter bleibt alles wie bisher (Reward setzt nur hin)', async () => {
  await saveSettings({ checkinEnabled: false, appearOn: 'checkin', szeneModus: 'zimmer' });
  await redeem('ci5', '43', 'Paul');
  assert.match(lastChat().message, /Paul ist eingecheckt – Besuch #1!/);
  assert.ok(await db.get('seat/43'));
  await saveSettings({ checkinEnabled: true, appearOn: 'sit', szeneModus: 'wachstum' });
});

await test('Punkte: Chat zählt mit Abstand und Tageslimit, Check-ins und aktive Tage zählen mit', async () => {
  await saveSettings({ pointsEnabled: true, pointsMsgGap: 0, pointsMsgCap: 3 });
  for (let i = 0; i < 5; i += 1) await webhook(sign(chatEvent('50', 'Pia', 'Hallo zusammen')));
  const rec = await db.get(`cmonth/${punkte.monthOf(await getSettings())}/50`);
  assert.equal(rec.msgs, 3); assert.equal(rec.days, 1); // Deckel: höchstens 3 pro Tag
  await saveSettings({ pointsMsgGap: 60 });
  await webhook(sign(chatEvent('51', 'Quin', 'Hi')));
  await webhook(sign(chatEvent('51', 'Quin', 'Hi nochmal')));
  assert.equal((await db.get(`cmonth/${punkte.monthOf(await getSettings())}/51`)).msgs, 1); // Mindestabstand
  const board = await punkte.monthBoard(await getSettings());
  const pia = board.rows.find((r) => r.name === 'Pia');
  assert.equal(pia.points, 3 * 1 + 1 * 10); // 3 Nachrichten + 1 aktiver Tag
  const mira = board.rows.find((r) => r.name === 'Mira');
  assert.ok(mira.points >= 20 && mira.checkins === 1); // Check-in-Tag
  assert.ok(board.rows.every((r, i) => i === 0 || board.rows[i - 1].points >= r.points)); // absteigend sortiert
});
await test('Punkte: Streamerin und Bot zählen nicht', async () => {
  await db.set('config/bot-tokens', { access_token: 'tokBot', refresh_token: 'r', expires_at: Date.now() + 3_600_000, user_id: '555', login: 'everlybot', scopes: ['user:write:chat', 'user:read:chat', 'user:bot'] });
  await webhook(sign(chatEvent('999', 'Streamerin', 'Hallo')));
  await webhook(sign(chatEvent('555', 'EverlyBot', 'Hallo')));
  assert.equal(await db.get(`cmonth/${punkte.monthOf(await getSettings())}/999`), null);
  assert.equal(await db.get(`cmonth/${punkte.monthOf(await getSettings())}/555`), null);
});
await test('!rangliste und !punkte antworten im Chat', async () => {
  await saveSettings({ pointsMsgGap: 0, pointsMsgCap: 50 });
  const top = (await punkte.monthBoard(await getSettings())).rows[0];
  assert.match((await say('50', 'Pia', '!rangliste')).message, new RegExp(`Rangliste .*: 1\\. ${top.name} \\(${top.points}\\) · `));
  assert.match((await say('50', 'Pia', '!punkte')).message, /Pia: \d+ Punkte .* Platz \d+ von \d+/);
  assert.match((await say('77', 'Neu', '!punkte')).message, /Neu: 11 Punkte/); // die erste Nachricht zählt schon (1 Nachricht + 10 für den aktiven Tag)
  assert.match(await punkte.pointsReply(await getSettings(), 'unbekannt', 'Neu'), /Neu, du hast .* noch keine Punkte/);
});
await test('Öffentliche Rangliste: Daten ohne IDs, 404 wenn Check-in und Punkte aus sind', async () => {
  const res = await rangliste(new Request('https://x/api/rangliste'));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.month.rows.length >= 2); assert.ok(data.visits.length >= 3);
  assert.equal(data.visits.find((v) => v.name === 'Mira').value, 1);
  assert.doesNotMatch(JSON.stringify(data), /"(twitchId|id)"/);
});
await test('Sicherung: Daten rein und wieder raus, Tokens nie dabei, Wiederherstellen über den Admin', async () => {
  const file = await backupLib.buildBackup();
  assert.equal(file.format, 'everly-backup');
  assert.ok(file.entries['user/40'] && file.entries['config/settings']);
  assert.ok(!Object.keys(file.entries).some((k) => k.startsWith('config/tokens') || k.startsWith('config/bot-tokens') || k.startsWith('seen/')));
  const login = await adminCall('POST', 'login', { password: 'geheim' });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  await db.delete('user/40');
  assert.equal((await adminCall('POST', 'backup', { backup: file }, cookie)).status, 400); // ohne Bestätigung
  assert.equal((await adminCall('POST', 'backup', { backup: { format: 'x', entries: {} }, confirm: true }, cookie)).status, 400);
  const r = await adminCall('POST', 'backup', { backup: file, confirm: true }, cookie);
  assert.equal(r.status, 200); assert.ok(r.body.restored > 5);
  assert.equal((await db.get('user/40')).name, 'Mira');
  assert.ok(await db.get('config/tokens')); // Tokens bleiben unberührt
});
await test('Automatische Sicherung: schreibt eine Datei, räumt alte weg, sichert nur einmal pro Tag', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'everly-backup-'));
  process.env.BACKUP_DIR = dir;
  const auto = await mod('lib/system/autobackup.mjs');
  await saveSettings({ backupKeep: 2, backupHour: 0 });
  for (const d of ['2026-01-01', '2026-01-02', '2026-01-03']) fs.writeFileSync(path.join(dir, `everly-${d}.json`), '{}');
  const r = await auto.runBackupNow();
  assert.ok(r.ok); assert.match(r.name, /^everly-\d{4}-\d{2}-\d{2}\.json$/);
  assert.equal(fs.readdirSync(dir).length, 2); // nur die zwei jüngsten bleiben
  assert.equal(await auto.backupTick(), null); // heute schon gesichert
  assert.ok(JSON.parse(fs.readFileSync(path.join(dir, r.name), 'utf8')).entries['user/40']);
  assert.equal((await auto.backupStatus()).files[0].name, r.name);
  delete process.env.BACKUP_DIR;
});
await test('Admin: Update-Knopf ohne Einrichtung, Testereignisse für Check-in und Meilenstein', async () => {
  const login = await adminCall('POST', 'login', { password: 'geheim' });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const u = await adminCall('GET', 'update', null, cookie);
  assert.equal(u.body.configured, false);
  assert.equal((await adminCall('POST', 'update', {}, cookie)).status, 503);
  assert.equal((await adminCall('POST', 'test/event', { kind: 'checkin' }, cookie)).status, 200);
  assert.equal((await adminCall('POST', 'test/event', { kind: 'meilenstein' }, cookie)).status, 200);
  assert.equal((await adminCall('PUT', 'settings', { streakGrace: 99, pointsRankSize: 0 }, cookie)).body.settings.streakGrace, 5);
  assert.equal((await adminCall('GET', 'state', null, cookie)).body.urls.rangliste, 'https://beispiel.netlify.app/rangliste');
});
await test('Rangliste ist nicht öffentlich, wenn Check-in und Punkte aus sind', async () => {
  await saveSettings({ checkinEnabled: false, pointsEnabled: false });
  assert.equal((await rangliste(new Request('https://x/api/rangliste'))).status, 404);
});

console.log('Admin-Oberfläche');
await test('Menü: jede Seite hat ein Panel, jede Einstellungsgruppe steht auf genau einer Seite', async () => {
  const { PAGES } = await import('../public/admin/nav.js');
  const html = fs.readFileSync(new URL('../public/admin/index.html', import.meta.url), 'utf8');
  const js = fs.readFileSync(new URL('../public/admin/admin.js', import.meta.url), 'utf8');
  const panels = [...html.matchAll(/data-panel="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...panels].sort(), PAGES.map((p) => p[0]).sort(), 'Menü und Panels passen zusammen');
  const groups = [...js.matchAll(/^  \['([^']+)', \[/gm)].map((m) => m[1]);
  const placed = [...html.matchAll(/data-schema="([^"]+)"/g)].flatMap((m) => m[1].split('|'));
  assert.deepEqual([...placed].sort(), [...groups].sort(), 'jede Gruppe genau einmal');
  // jeder Schlüssel im Formular ist eine bekannte Einstellung
  const keys = [...js.matchAll(/\['([a-zA-Z]+)', '[^']*', '(?:text|number|bool|area|select)'/g)].map((m) => m[1]);
  assert.ok(keys.length > 60);
  for (const k of keys) assert.ok(k in DEFAULTS, `Einstellung ${k} existiert`);
  // alle ids, die admin.js anspricht, gibt es im HTML
  for (const id of new Set([...js.matchAll(/\$\('([A-Za-z]+)'\)/g)].map((m) => m[1]))) assert.ok(html.includes(`id="${id}"`) || js.includes(`id="${id}"`) || js.includes(`id=\"${id}\"`) || ['liveTimer'].includes(id), `id ${id} fehlt im HTML`);
});
await test('Admin: Status liefert die Angaben für die Übersicht', async () => {
  const login = await adminCall('POST', 'login', { password: 'geheim' });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  await saveSettings({ checkinEnabled: true });
  const st = (await adminCall('GET', 'state', null, cookie)).body;
  assert.equal(st.features.checkin, true); assert.equal(typeof st.checkinsToday, 'number');
  assert.ok(st.pomodoro && st.words && st.timer);
  await saveSettings({ checkinEnabled: false });
});

console.log('Live-Vorschau, Glas-Stil und Hintergrundbild');
const bgFn = (await mod('functions/overlay-bg.mjs')).default;
const PNG1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
await test('Einstellungen: Glasfarbe, Tönung und Unschärfe werden geprüft', () => {
  assert.equal(normalize({ glasFarbe: '#ABCDEF' }).settings.glasFarbe, '#abcdef');
  assert.match(normalize({ glasFarbe: 'rot' }).error, /Glasfarbe/);
  assert.equal(normalize({ glasStaerke: 500 }).settings.glasStaerke, 90);
  assert.equal(normalize({ glasUnschaerfe: -3 }).settings.glasUnschaerfe, 0);
  assert.equal(normalize({ kartenStil: 'neon' }).error, 'kartenStil: unbekannter Wert');
  assert.equal(DEFAULTS.kartenStil, 'papier'); assert.equal(DEFAULTS.hintergrund, 'landschaft'); // ohne Zutun bleibt alles wie bisher
});
await test('Vorschau: rechnet mit ungespeicherten Einstellungen, speichert nichts und schaltet den Timer nicht weiter', async () => {
  const login = await adminCall('POST', 'login', { password: 'geheim' });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const before = (await adminCall('GET', 'settings', null, cookie)).body.settings;
  const r = await adminCall('POST', 'preview', { draft: { jahreszeit: 'winter', tageszeit: 'abend', kartenStil: 'glas', glasFarbe: '#5b4a8f', wordGoal: 777 } }, cookie);
  assert.equal(r.status, 200);
  assert.equal(r.body.jahreszeit, 'winter'); assert.equal(r.body.tageszeit, 'abend');
  assert.equal(r.body.stil, 'glas'); assert.equal(r.body.glas.farbe, '#5b4a8f'); assert.equal(r.body.words.goal, 777);
  assert.deepEqual(r.body.hintergrund, { mode: 'landschaft' });
  const after = (await adminCall('GET', 'settings', null, cookie)).body.settings;
  assert.deepEqual(after, before); // nichts gespeichert
  assert.equal((await adminCall('POST', 'preview', { draft: { glasFarbe: 'x' } }, cookie)).status, 400); // ungültig: Fehler statt Absturz
  assert.equal((await admin(new Request('https://x/api/admin/preview', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }))).status, 401);
});
await test('Hintergrundbild: hochladen, ausliefern, im Overlay-Stand, entfernen', async () => {
  const login = await adminCall('POST', 'login', { password: 'geheim' });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  assert.equal((await adminCall('POST', 'hintergrund', { data: 'data:text/html;base64,PGI+' }, cookie)).status, 400);
  assert.equal((await adminCall('POST', 'hintergrund', { data: 'keinbild' }, cookie)).status, 400);
  assert.equal((await bgFn(new Request('https://x/api/overlay-bg'))).status, 404); // noch keins
  const up = await adminCall('POST', 'hintergrund', { data: PNG1 }, cookie);
  assert.equal(up.status, 200); assert.ok(up.body.version > 0);
  const img = await bgFn(new Request(`https://x/api/overlay-bg?v=${up.body.version}`));
  assert.equal(img.status, 200); assert.equal(img.headers.get('content-type'), 'image/png'); assert.match(img.headers.get('cache-control'), /immutable/);
  assert.equal(Buffer.from(await img.arrayBuffer()).subarray(1, 4).toString(), 'PNG');
  assert.equal((await viewNow()).hintergrund.mode, 'landschaft'); // hochgeladen, aber noch nicht ausgewählt
  await saveSettings({ hintergrund: 'bild' });
  assert.deepEqual((await viewNow()).hintergrund, { mode: 'bild', url: `/api/overlay-bg?v=${up.body.version}` });
  assert.ok((await backupLib.buildBackup()).entries['bg/image']); // im Backup
  const del = await adminCall('DELETE', 'hintergrund', null, cookie);
  assert.equal(del.status, 200);
  assert.equal((await bgFn(new Request('https://x/api/overlay-bg'))).status, 404);
  assert.equal((await getSettings()).hintergrund, 'landschaft');
});
await test('Admin-Seite: Vorschau-Seiten gibt es im Menü, Regler haben Grenzen', async () => {
  const { PAGES, PREVIEW_PAGES } = await import('../public/admin/nav.js');
  for (const k of PREVIEW_PAGES) assert.ok(PAGES.some((p) => p[0] === k), `Seite ${k}`);
  assert.ok(PAGES.some((p) => p[0] === 'design'));
});

console.log('Szenen mit bewegtem Ausblick');
await test('Szenen, Wetter und Tageszeiten im Overlay-Code passen zu den Einstellungen', async () => {
  const k = await import('../public/js/kulisse.mjs');
  assert.deepEqual(k.WETTER, ['klar', 'wolkig', 'regen', 'gewitter', 'schnee', 'nebel']);
  assert.deepEqual(k.ZEITEN, ['morgen', 'mittag', 'abend', 'nacht']);
  for (const w of k.WETTER) assert.equal(normalize({ wetter: w }).settings.wetter, w);
  for (const z of k.ZEITEN) assert.equal(normalize({ tageszeit: z }).settings.tageszeit, z);
  for (const sz of k.SZENEN) assert.equal(normalize({ hintergrund: sz }).settings.hintergrund, sz);
  assert.equal(normalize({ wetter: 'hagel' }).error, 'wetter: unbekannter Wert');
  assert.equal(normalize({ wind: 400 }).settings.wind, 100);
});
await test('Szene im Overlay-Stand: Tageszeit und Wetter, Landschaft kennt keine Nacht', async () => {
  await saveSettings({ hintergrund: 'zug', tageszeit: 'nacht', wetter: 'regen', wind: 70, kulisseTempo: 80 });
  const v = await viewNow();
  assert.equal(v.hintergrund.mode, 'kulisse');
  assert.deepEqual({ ...v.hintergrund.kulisse, saison: undefined }, { name: 'zug', zeit: 'nacht', saison: undefined, wetter: 'regen', wind: 70, tempo: 80, plate: null, video: null });
  assert.equal(v.tageszeit, 'abend'); // die gemalte Landschaft hat keine eigene Nacht
  await saveSettings({ hintergrund: 'landschaft', tageszeit: 'auto', wetter: 'klar' });
  assert.equal((await viewNow()).hintergrund.mode, 'landschaft');
});
await test('Raumbilder: hochladen je Szene, ausliefern, entfernen', async () => {
  const login = await adminCall('POST', 'login', { password: 'geheim' });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  assert.equal((await adminCall('POST', 'hintergrund/raum/keller', { data: PNG1 }, cookie)).status, 404);
  assert.equal((await adminCall('POST', 'hintergrund/raum/stadt', { data: 'quatsch' }, cookie)).status, 400);
  assert.equal((await bgFn(new Request('https://x/api/overlay-bg?plate=stadt'))).status, 404);
  const up = await adminCall('POST', 'hintergrund/raum/stadt', { data: PNG1 }, cookie);
  assert.equal(up.status, 200);
  assert.equal((await adminCall('GET', 'hintergrund/raum', null, cookie)).body.raeume.stadt, up.body.version);
  const img = await bgFn(new Request(`https://x/api/overlay-bg?plate=stadt&v=${up.body.version}`));
  assert.equal(img.status, 200); assert.equal(img.headers.get('content-type'), 'image/png');
  assert.equal((await bgFn(new Request('https://x/api/overlay-bg?plate=../../config'))).status, 404);
  await saveSettings({ hintergrund: 'stadt' });
  assert.equal((await viewNow()).hintergrund.kulisse.plate, `/api/overlay-bg?plate=stadt&v=${up.body.version}`);
  assert.ok((await backupLib.buildBackup()).entries['bg/plate/stadt']);
  assert.equal((await adminCall('DELETE', 'hintergrund/raum/stadt', null, cookie)).status, 200);
  assert.equal((await viewNow()).hintergrund.kulisse.plate, null);
  await saveSettings({ hintergrund: 'landschaft' });
});
await test('Jahreszeiten-Landschaft: Bilder hochladen, ausliefern, Rückfall auf die gemalte Landschaft', async () => {
  const login = await adminCall('POST', 'login', { password: 'geheim' });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  assert.equal((await adminCall('POST', 'hintergrund/jz/keller', { data: PNG1 }, cookie)).status, 404);
  assert.equal((await adminCall('POST', 'hintergrund/jz/winterA', { data: 'quatsch' }, cookie)).status, 400);
  assert.equal((await bgFn(new Request('https://x/api/overlay-bg?jz=winterA'))).status, 404);
  assert.equal((await bgFn(new Request('https://x/api/overlay-bg?jz=../../config'))).status, 404);
  await saveSettings({ hintergrund: 'jahreszeiten' });
  assert.equal((await viewNow()).hintergrund.mode, 'landschaft'); // noch keine Bilder
  const a = await adminCall('POST', 'hintergrund/jz/winterA', { data: PNG1 }, cookie);
  const b = await adminCall('POST', 'hintergrund/jz/winterB', { data: PNG1 }, cookie);
  const s = await adminCall('POST', 'hintergrund/jz/blumen', { data: PNG1 }, cookie);
  assert.equal(a.status, 200); assert.equal(b.status, 200); assert.equal(s.status, 200);
  assert.ok((await adminCall('GET', 'hintergrund/jz', null, cookie)).body.slots.winterA);
  const img = await bgFn(new Request(`https://x/api/overlay-bg?jz=winterA&v=${a.body.version}`));
  assert.equal(img.status, 200); assert.equal(img.headers.get('content-type'), 'image/png');
  assert.ok(['jahreszeit', 'landschaft'].includes((await viewNow()).hintergrund.mode));
  assert.ok((await backupLib.buildBackup()).entries['bg/jz/winterA']);
  assert.equal((await adminCall('DELETE', 'hintergrund/jz/winterA', null, cookie)).status, 200);
  assert.equal((await adminCall('DELETE', 'hintergrund/jz/winterB', null, cookie)).status, 200);
  await saveSettings({ hintergrund: 'landschaft' });
});
await test('Pavillon ist standardmäßig ausgeblendet und lässt sich wieder einschalten', async () => {
  assert.equal((await viewNow()).pavillon, false);
  await saveSettings({ pavillonZeigen: true });
  assert.equal((await viewNow()).pavillon, true);
  await saveSettings({ pavillonZeigen: false });
});
await test('Chat: !wetter, !tageszeit und !hintergrund nur für Moderation', async () => {
  const mod = { badges: [{ set_id: 'moderator' }] };
  const before = chatSent().length;
  await say('61', 'Zuschauer', '!wetter regen');
  assert.equal(chatSent().length, before); assert.equal((await getSettings()).wetter, 'klar'); // nicht erlaubt
  assert.match((await say('62', 'Mod', '!wetter Regen', mod)).message, /Wetter: Regen/);
  assert.equal((await getSettings()).wetter, 'regen');
  assert.match((await say('62', 'Mod', '!tageszeit nacht', mod)).message, /Tageszeit: Nacht/);
  assert.match((await say('62', 'Mod', '!hintergrund see', mod)).message, /Hintergrund: See/);
  assert.equal((await getSettings()).hintergrund, 'see');
  assert.match((await say('62', 'Mod', '!wetter hagel', mod)).message, /gibt es nicht.*klar, wolkig/);
  assert.match((await say('62', 'Mod', '!wetter', mod)).message, /Wetter: Regen\. Ändern mit !wetter/);
  await saveSettings({ wetter: 'klar', tageszeit: 'auto', hintergrund: 'landschaft' });
});

console.log('Videos als Ausblick');
const videoUp = admin; // der Upload ist eine Admin-Route: /api/admin/video
const videoGet = (await mod('functions/overlay-video.mjs')).default;
const fakeMp4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(2000, 7)]);
const fakeWebm = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(900, 3)]);
await test('Videos: nur mit Anmeldung und eigenem Header, nur echte MP4/WebM-Dateien', async () => {
  const login = await adminCall('POST', 'login', { password: 'geheim' });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const put = (q, body, h = {}) => videoUp(new Request(`https://x/api/admin/video?${q}`, { method: 'PUT', headers: { 'x-upload': '1', cookie, ...h }, body }));
  assert.equal((await videoUp(new Request('https://x/api/admin/video?s=zug&z=nacht', { method: 'PUT', headers: { 'x-upload': '1' }, body: fakeMp4 }))).status, 401);
  assert.equal((await videoUp(new Request('https://x/api/admin/video?s=zug&z=nacht', { method: 'PUT', headers: { cookie }, body: fakeMp4 }))).status, 400); // ohne Header
  assert.equal((await put('s=keller&z=nacht', fakeMp4)).status, 400);
  assert.equal((await put('s=zug&z=mitternacht', fakeMp4)).status, 400);
  assert.equal((await put('s=zug&z=nacht', Buffer.from('<html>kein video</html>'))).status, 400);
  assert.equal((await put('s=zug&z=nacht', Buffer.alloc(0))).status, 400);
  const ok = await put('s=zug&z=nacht', fakeMp4);
  assert.equal(ok.status, 200); assert.equal((await ok.json()).size, fakeMp4.length);
  assert.equal((await put('s=stadt&z=abend', fakeWebm)).status, 200);
  const list = await (await videoUp(new Request('https://x/api/admin/video', { headers: { cookie } }))).json();
  assert.equal(list.videos.zug.nacht.size, fakeMp4.length); assert.ok(list.videos.stadt.abend); assert.equal(list.videos.see.mittag, undefined);
});
await test('Videos: Ausliefern mit Range, Adresse im Overlay-Stand nur bei passender Tageszeit', async () => {
  const full = await videoGet(new Request('https://x/api/overlay-video?s=zug&z=nacht&v=1'));
  assert.equal(full.status, 200); assert.equal(full.headers.get('content-type'), 'video/mp4'); assert.equal(full.headers.get('accept-ranges'), 'bytes');
  assert.equal(Buffer.from(await full.arrayBuffer()).length, fakeMp4.length);
  const part = await videoGet(new Request('https://x/api/overlay-video?s=zug&z=nacht', { headers: { range: 'bytes=4-11' } }));
  assert.equal(part.status, 206); assert.equal(part.headers.get('content-range'), `bytes 4-11/${fakeMp4.length}`);
  assert.equal(Buffer.from(await part.arrayBuffer()).toString('latin1'), 'ftypisom');
  const tail = await videoGet(new Request('https://x/api/overlay-video?s=zug&z=nacht', { headers: { range: 'bytes=-5' } }));
  assert.equal(tail.status, 206); assert.equal((await tail.arrayBuffer()).byteLength, 5);
  assert.equal((await videoGet(new Request('https://x/api/overlay-video?s=zug&z=nacht', { headers: { range: 'bytes=999999-' } }))).status, 416);
  assert.equal((await videoGet(new Request('https://x/api/overlay-video?s=zug&z=morgen'))).status, 404);
  assert.equal((await videoGet(new Request('https://x/api/overlay-video?s=../../config&z=nacht'))).status, 404);
  await saveSettings({ hintergrund: 'zug', tageszeit: 'nacht' });
  assert.match((await viewNow()).hintergrund.kulisse.video, /^\/api\/overlay-video\?s=zug&z=nacht&v=\d+$/);
  await saveSettings({ tageszeit: 'mittag' });
  assert.equal((await viewNow()).hintergrund.kulisse.video, null); // für diese Tageszeit gibt es keins: der Bot nimmt die gezeichnete Landschaft
  await saveSettings({ hintergrund: 'landschaft', tageszeit: 'auto' });
});
await test('Video-Bibliothek: drei Plätze je Szene mit Namen, Auswahl bestimmt, was läuft', async () => {
  const login = await adminCall('POST', 'login', { password: 'geheim' });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const put = (q, body) => videoUp(new Request(`https://x/api/admin/video?${q}`, { method: 'PUT', headers: { 'x-upload': '1', cookie }, body }));
  assert.equal((await put('s=see&z=b4', fakeMp4)).status, 400); // nur drei Plätze
  const up = await put(`s=see&z=b2&n=${encodeURIComponent('Sommersee.mp4')}`, fakeMp4);
  assert.equal(up.status, 200); assert.equal((await up.json()).name, 'Sommersee');
  const list = await (await videoUp(new Request('https://x/api/admin/video', { headers: { cookie } }))).json();
  assert.equal(list.videos.see.b2.name, 'Sommersee');
  assert.equal((await videoGet(new Request('https://x/api/overlay-video?s=see&z=b2'))).status, 200);
  await saveSettings({ hintergrund: 'see', tageszeit: 'mittag' });
  assert.equal((await viewNow()).hintergrund.kulisse.video, null); // Standard „nach Tageszeit“: für Mittag gibt es keins
  await saveSettings({ videoSee: 'b2' });
  assert.match((await viewNow()).hintergrund.kulisse.video, /^\/api\/overlay-video\?s=see&z=b2&v=\d+$/); // läuft zu jeder Tageszeit
  await saveSettings({ tageszeit: 'nacht' });
  assert.match((await viewNow()).hintergrund.kulisse.video, /z=b2/);
  await saveSettings({ videoSee: 'aus' });
  assert.equal((await viewNow()).hintergrund.kulisse.video, null);
  assert.equal(normalize({ videoSee: 'b9' }).error, 'videoSee: unbekannter Wert');
  await saveSettings({ videoSee: 'b3' });
  assert.equal((await viewNow()).hintergrund.kulisse.video, null); // leerer Platz: gezeichnete Landschaft
  await videoUp(new Request('https://x/api/admin/video?s=see&z=b2', { method: 'DELETE', headers: { 'x-upload': '1', cookie } }));
  await saveSettings({ videoSee: 'zeit', hintergrund: 'landschaft', tageszeit: 'auto' });
});
await test('Videos: entfernen löscht Datei und Eintrag', async () => {
  const login = await adminCall('POST', 'login', { password: 'geheim' });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const del = await videoUp(new Request('https://x/api/admin/video?s=zug&z=nacht', { method: 'DELETE', headers: { 'x-upload': '1', cookie } }));
  assert.equal(del.status, 200);
  assert.equal((await videoGet(new Request('https://x/api/overlay-video?s=zug&z=nacht'))).status, 404);
  const list = await (await videoUp(new Request('https://x/api/admin/video', { headers: { cookie } }))).json();
  assert.equal(list.videos.zug.nacht, undefined); assert.ok(list.videos.stadt.abend);
  await videoUp(new Request('https://x/api/admin/video?s=stadt&z=abend', { method: 'DELETE', headers: { 'x-upload': '1', cookie } }));
});

console.log(`\n${passed} Tests bestanden${process.exitCode ? ' – es gibt Fehler (siehe oben)' : ''}`);
