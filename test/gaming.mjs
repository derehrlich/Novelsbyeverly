// Prüft die Gaming-Szene gegen den echten Server (leerer Datenordner, Port 8899): node test/gaming.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'nbe-'));
process.env.DATA_DIR = data; process.env.LOCAL_STORE_DIR = data; // der Chat-Aufruf unten läuft in diesem Prozess, mit demselben Datenordner wie der Server
const PORT = 8899, base = `http://localhost:${PORT}`;
const srv = spawn(process.execPath, ['server/index.mjs'], { cwd: root, env: { ...process.env, DATA_DIR: data, LOCAL_STORE_DIR: data, PORT, ADMIN_PASSWORD: 'geheim', INGEST_TOKEN: 'ingest-geheim' }, stdio: 'pipe' });
let log = ''; srv.stdout.on('data', (d) => { log += d; }); srv.stderr.on('data', (d) => { log += d; });
const ende = (code = 0) => { srv.kill(); fs.rmSync(data, { recursive: true, force: true }); process.exit(code); };
for (let i = 0; i < 50; i += 1) { try { if ((await fetch(`${base}/healthz`)).ok) break; } catch { /* warten */ } await new Promise((r) => setTimeout(r, 100)); }

let ok = 0;
const test = async (name, fn) => { try { await fn(); ok += 1; console.log(`  ok  ${name}`); } catch (e) { console.log(`  FEHLER  ${name}\n${e.stack}\n${log}`); process.exitCode = 1; } };
const get = async (p, o) => (await fetch(`${base}${p}`, o));
const view = async () => (await get('/api/overlay')).json();
const login = await get('/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'geheim' }) });
const cookie = login.headers.get('set-cookie').split(';')[0];
const admin = (method, p, body) => get(`/api/admin/${p}`, { method, headers: { cookie, 'content-type': 'application/json' }, body: method === 'GET' ? undefined : JSON.stringify(body ?? {}) });

const { handleChat } = await import(`${root}/server/features/chat.mjs`);
const chat = async (uid, name, text, badges = []) => handleChat({ broadcaster_user_id: '999', chatter_user_id: uid, chatter_user_name: name, message_id: `m${Math.random()}`, message: { text }, badges });

await test('Seiten /gaming und /admin/gaming.html werden ausgeliefert', async () => {
  const g = await get('/gaming'); assert.equal(g.status, 200); assert.match(await g.text(), /Gaming-Overlay/);
  assert.equal((await get('/admin/gaming.html')).status, 200);
  assert.equal((await get('/js/gaming-ui.mjs')).status, 200);
});
await test('Spielfenster macht den Kameras Platz: 16:9, im Bild, Überlappung genau wie eingestellt', async () => {
  const g = await import(`${root}/public/js/gaming.mjs`);
  const o = g.spielRect([]); assert.deepEqual(o, { x: 104, y: 58, w: 1712, h: 963 });
  for (const ecken of [[], ['oben-rechts'], ['oben-links'], ['unten-links', 'unten-rechts'], ['oben-links', 'oben-rechts', 'unten-links', 'unten-rechts']]) {
    for (const size of [160, 340, 700]) for (const ueber of [0, 40, 300]) {
      const s = g.spielRect(ecken, size, ueber);
      assert.equal(s.w * 9, s.h * 16, `16:9 bei ${ecken} ${size} ${ueber}`);
      assert.ok(s.x >= 0 && s.y >= 0 && s.x + s.w <= 1920 && s.y + s.h <= 1080, `im Bild bei ${ecken} ${size} ${ueber}`);
    }
  }
  const s = g.spielRect(['oben-rechts'], 340, 40), k = g.kameraRect('oben-rechts', 340);
  assert.equal(s.x + s.w - k.x, 40, 'rechte Kamera ragt genau 40 px ins Spiel');
  const l = g.spielRect(['oben-links'], 340, 40), kl = g.kameraRect('oben-links', 340);
  assert.equal(kl.x + kl.w - l.x, 40, 'linke Kamera ragt genau 40 px ins Spiel');
  const b = g.spielRect(['oben-links', 'oben-rechts'], 340, 40);
  assert.equal(g.kameraRect('oben-links', 340).x + 340 - b.x, 40); assert.equal(b.x + b.w - g.kameraRect('oben-rechts', 340).x, 40);
  assert.ok(s.w < o.w, 'mit Kamera wird das Spiel kleiner');
});
await test('Einstellungen landen im Overlay, Eingaben werden geprüft', async () => {
  let v = await view();
  assert.equal(v.gaming.design, 'gemuetlich'); assert.equal(v.gaming.ueberlappung, 40); assert.deepEqual(v.gaming.kameras, ['oben-rechts']); assert.equal(v.gaming.tode, null); assert.equal(v.gaming.hintergrund, 'design');
  const put = async (b) => (await admin('PUT', 'settings', b));
  assert.equal((await put({ gamingKameraOR: false, gamingKameraOL: true, gamingKameraGroesse: 9999, gamingKameraUeberlappung: 9999, gamingDesign: 'glas', gamingHintergrund: 'obs', gamingAbdunkeln: 500, gamingTode: true, gamingTodePos: 'unten-mitte', gamingTodeSekunden: 99999 })).status, 200);
  v = await view();
  assert.deepEqual(v.gaming.kameras, ['oben-links']); assert.equal(v.gaming.groesse, 700); assert.equal(v.gaming.ueberlappung, 300); assert.equal(v.gaming.design, 'glas');
  assert.equal(v.gaming.hintergrund, 'obs'); assert.equal(v.gaming.abdunkeln, 80); assert.equal(v.gaming.tode.pos, 'unten-mitte'); assert.equal(v.gaming.tode.sekunden, 3600);
  assert.equal((await put({ gamingDesign: 'neon' })).status, 400);
  assert.equal((await put({ gamingTodePos: 'mitte' })).status, 400);
  await put({ gamingDesign: 'gemuetlich', gamingHintergrund: 'design', gamingTodeSekunden: 10, gamingKameraUeberlappung: 40 });
});
await test('Deathcounter: Chat (Moderation), Reset nur Streamerin, !tode für alle', async () => {
  const mod = [{ set_id: 'moderator' }], bc = [{ set_id: 'broadcaster' }];
  const n = async () => (await view()).gaming.tode.n;
  assert.equal((await chat('5', 'Mo', '!tod', mod)).reply, '💀 1 Tode'); assert.equal(await n(), 1);
  await chat('5', 'Mo', '!tod +', mod); assert.equal(await n(), 2);
  await chat('5', 'Mo', '!tod -', mod); assert.equal(await n(), 1);
  await chat('5', 'Mo', '!tod 12', mod); assert.equal(await n(), 12);
  await chat('1', 'Lena', '!tod'); await chat('5', 'Mo', '!tod reset', mod); assert.equal(await n(), 12, 'Zuschauer und Moderation dürfen nicht zurücksetzen');
  assert.equal((await chat('1', 'Lena', '!tode')).reply, '💀 12 Tode');
  assert.equal((await chat('1', 'Lena', '!tod')).reply, undefined);
  await chat('999', 'Streamerin', '!tod reset', bc); assert.equal(await n(), 0);
  await admin('PUT', 'settings', { gamingTode: false });
  await chat('5', 'Mo', '!tod', mod); assert.equal((await view()).gaming.tode, null);
  await admin('PUT', 'settings', { gamingTode: true });
  assert.equal((await (await get('/api/admin/tode')).status), 401);
  assert.equal((await (await admin('GET', 'tode')).json()).n, 0);
});
await test('Deathcounter: Admin-Knöpfe und Hotkey-Schnittstelle (INGEST_TOKEN)', async () => {
  assert.equal((await (await admin('POST', 'tode', { aktion: 'plus' })).json()).n, 1);
  assert.equal((await (await admin('POST', 'tode', { aktion: 'set', wert: 7 })).json()).n, 7);
  assert.equal((await admin('POST', 'tode', { aktion: 'unsinn' })).status, 400);
  assert.equal((await get('/api/tod?aktion=plus')).status, 401);
  assert.equal((await get('/api/tod?aktion=plus&token=falsch')).status, 401);
  assert.equal((await (await get('/api/tod?aktion=plus&token=ingest-geheim')).json()).n, 8);
  const post = await get('/api/tod', { method: 'POST', headers: { authorization: 'Bearer ingest-geheim', 'content-type': 'application/json' }, body: JSON.stringify({ aktion: 'minus' }) });
  assert.equal((await post.json()).n, 7);
  const alt = (await view()).gaming.tode.at; await new Promise((r) => setTimeout(r, 15));
  assert.equal((await (await get('/api/tod?aktion=zeigen&token=ingest-geheim')).json()).n, 7);
  const neu = (await view()).gaming.tode; assert.ok(neu.at > alt); assert.equal(neu.n, 7);
  assert.equal((await get('/api/tod?aktion=nix&token=ingest-geheim')).status, 400);
  assert.equal((await (await get('/api/tod?token=ingest-geheim')).json()).n, 7);
});
await test('Ereignis weckt das Overlay (Live-Kanal)', async () => {
  const res = await fetch(`${base}/api/overlay/live`); const reader = res.body.getReader();
  await reader.read(); // retry-Zeile
  await get('/api/tod?aktion=plus&token=ingest-geheim');
  const { value } = await Promise.race([reader.read(), new Promise((_, no) => setTimeout(() => no(new Error('kein Signal')), 2000))]);
  assert.match(new TextDecoder().decode(value), /event: event/); reader.cancel();
});

console.log(`\n${ok} Tests bestanden${process.exitCode ? ' – es gibt Fehler (siehe oben)' : ''}`);
ende(process.exitCode ?? 0);
