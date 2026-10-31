// /api/admin/system: Sicherung herunterladen, aus einer ZIP wiederherstellen und die Anwendung per ZIP aktualisieren.
//   GET  info | backup | backups/<name>      POST restore | update | update-remove      DELETE backups/<name>
// Sicherung = ZIP mit cowork-backup.json und allen Dateien aus dem Datenordner (daten/…).
// Update = ZIP mit server/, public/ und package.json; sie landet in <Datenordner>/app und wird beim nächsten Start geladen (siehe index.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dataRoot } from '../store.mjs';
import { json } from '../http.mjs';
import { readZip, writeZip } from '../zip.mjs';
import { initTwitchApp, twitchApp } from '../twitch-app.mjs';
import { startEventSub } from '../eventsub.mjs';
import { notify } from '../live.mjs';

const APP = 'novelsbyeverly';
const MANIFEST = 'cowork-backup.json';
const SECRET_FILES = ['config%2Ftokens', 'config%2Fbot-tokens', 'config%2Ftwitch-app']; // Twitch-Zugänge
const SKIP_PREFIX = ['event%2F', 'cache%2F']; // kurzlebig
const FILE_NAME = /^[A-Za-z0-9._~%!'()*-]{1,200}$/;
const BACKUP_NAME = /^[A-Za-z0-9._-]{1,120}\.zip$/;
const MAX_UPLOAD = 100 * 1024 * 1024;

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..'); // Wurzel der laufenden Anwendung
const dirs = () => { const r = dataRoot(); return { root: r, data: path.join(r, 'cowork'), backups: path.join(r, 'backups'), app: path.join(r, 'app'), next: path.join(r, 'app.next'), prev: path.join(r, 'app.prev') }; };

let restartFn = () => setTimeout(() => process.exit(0), 800);
export const setRestart = (fn) => { restartFn = fn; };

const stamp = (d = new Date()) => d.toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-');
const readPkg = (dir) => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')); } catch { return null; } };

// ---- Sicherung
export function buildBackup({ withSecrets = true } = {}) {
  const { data } = dirs();
  fs.mkdirSync(data, { recursive: true });
  const entries = [];
  for (const name of fs.readdirSync(data).sort()) {
    if (SKIP_PREFIX.some((p) => name.startsWith(p)) || (!withSecrets && SECRET_FILES.includes(name))) continue;
    const file = path.join(data, name);
    if (fs.statSync(file).isFile()) entries.push({ name: `daten/${name}`, data: fs.readFileSync(file) });
  }
  const manifest = { app: APP, version: readPkg(here)?.version ?? '?', created: new Date().toISOString(), files: entries.length, mitZugangsdaten: withSecrets };
  return writeZip([{ name: MANIFEST, data: Buffer.from(JSON.stringify(manifest, null, 2)) }, ...entries]);
}

function autoBackup(reason) {
  const { backups } = dirs();
  fs.mkdirSync(backups, { recursive: true });
  let name = `auto-${reason}-${stamp()}.zip`;
  for (let n = 2; fs.existsSync(path.join(backups, name)); n += 1) name = `auto-${reason}-${stamp()}-${n}.zip`; // nie eine frühere Sicherung überschreiben
  fs.writeFileSync(path.join(backups, name), buildBackup());
  const all = fs.readdirSync(backups).filter((f) => BACKUP_NAME.test(f)).sort();
  for (const old of all.slice(0, Math.max(0, all.length - 8))) fs.rmSync(path.join(backups, old), { force: true });
  return name;
}

// ---- Wiederherstellung
export async function restoreFromZip(buf) {
  const entries = readZip(buf, { maxBytes: MAX_UPLOAD });
  const manifest = entries.find((e) => e.name === MANIFEST);
  let meta;
  try { meta = JSON.parse(manifest?.data.toString('utf8') ?? ''); } catch { meta = null; }
  if (meta?.app !== APP) throw new Error('Das ist keine Sicherung dieser Anwendung (cowork-backup.json fehlt)');
  const files = new Map();
  for (const e of entries) {
    if (e.name === MANIFEST) continue;
    const m = /^daten\/([^/]+)$/.exec(e.name);
    if (!m || !FILE_NAME.test(m[1])) throw new Error(`Unerwarteter Eintrag in der Sicherung: ${e.name}`);
    try { JSON.parse(e.data.toString('utf8')); } catch { throw new Error(`Beschädigte Datei in der Sicherung: ${m[1]}`); }
    files.set(m[1], e.data);
  }
  const { data, root } = dirs();
  const before = autoBackup('vor-wiederherstellung');
  // Twitch-Zugänge der Sicherung fehlen (ohne Zugangsdaten gesichert)? Dann bleiben die jetzigen erhalten.
  for (const name of SECRET_FILES) if (!files.has(name) && fs.existsSync(path.join(data, name))) files.set(name, fs.readFileSync(path.join(data, name)));
  const fresh = path.join(root, 'cowork.new'), old = path.join(root, 'cowork.old');
  fs.rmSync(fresh, { recursive: true, force: true }); fs.rmSync(old, { recursive: true, force: true });
  fs.mkdirSync(fresh, { recursive: true });
  for (const [name, content] of files) fs.writeFileSync(path.join(fresh, name), content);
  fs.renameSync(data, old);
  fs.renameSync(fresh, data);
  fs.rmSync(old, { recursive: true, force: true });
  await initTwitchApp();
  if (twitchApp().clientId) startEventSub().catch((e) => console.warn('EventSub:', e.message));
  notify('settings');
  return { files: files.size, version: meta.version ?? null, created: meta.created ?? null, before };
}

// ---- Update
function checkSyntax(dir) {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  for (const file of walk(dir).filter((f) => f.endsWith('.mjs'))) {
    const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`Fehler in ${path.relative(dir, file)}: ${(r.stderr || '').split('\n').find((l) => l.trim() && !l.startsWith('file:')) ?? 'Syntaxfehler'}`);
  }
}

export function installUpdate(buf) {
  const entries = readZip(buf, { maxBytes: MAX_UPLOAD });
  const pkgEntry = entries.filter((e) => /^([^/]+\/)?package\.json$/.test(e.name)).sort((a, b) => a.name.length - b.name.length)[0];
  if (!pkgEntry) throw new Error('Das ist keine Update-ZIP (package.json fehlt)');
  const prefix = pkgEntry.name.slice(0, -'package.json'.length);
  let pkg;
  try { pkg = JSON.parse(pkgEntry.data.toString('utf8')); } catch { throw new Error('package.json in der ZIP ist beschädigt'); }
  if (pkg.name !== APP) throw new Error(`Die ZIP gehört zu „${pkg.name ?? '?'}“, nicht zu dieser Anwendung`);
  const files = entries.filter((e) => e.name.startsWith(prefix)).map((e) => ({ rel: e.name.slice(prefix.length), data: e.data }))
    .filter((e) => e.rel === 'package.json' || e.rel.startsWith('server/') || e.rel.startsWith('public/'));
  for (const need of ['server/index.mjs', 'server/main.mjs', 'server/lib/store.mjs', 'server/routes/admin.mjs', 'public/admin/index.html']) {
    if (!files.some((f) => f.rel === need)) throw new Error(`In der Update-ZIP fehlt ${need}`);
  }
  const { root, next, app, prev } = dirs();
  fs.rmSync(next, { recursive: true, force: true });
  try {
    for (const f of files) {
      const target = path.join(next, f.rel);
      if (!target.startsWith(next + path.sep)) throw new Error(`Unsicherer Pfad: ${f.rel}`);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, f.data);
    }
    checkSyntax(path.join(next, 'server'));
  } catch (e) { fs.rmSync(next, { recursive: true, force: true }); throw e; }
  const before = autoBackup('vor-update');
  fs.rmSync(prev, { recursive: true, force: true });
  if (fs.existsSync(app)) fs.renameSync(app, prev);
  fs.renameSync(next, app);
  return { version: pkg.version ?? '?', files: files.length, before, root };
}

// ---- Übersicht
function info() {
  const { data, backups, app, prev } = dirs();
  let count = 0, bytes = 0;
  if (fs.existsSync(data)) for (const f of fs.readdirSync(data)) { count += 1; bytes += fs.statSync(path.join(data, f)).size; }
  const list = fs.existsSync(backups) ? fs.readdirSync(backups).filter((f) => BACKUP_NAME.test(f)).sort().reverse().map((name) => { const st = fs.statSync(path.join(backups, name)); return { name, size: st.size, at: st.mtimeMs }; }) : [];
  const running = path.resolve(here);
  return {
    version: readPkg(here)?.version ?? '?',
    quelle: running === path.resolve(app) ? 'update' : 'eingebaut',
    updateDa: fs.existsSync(path.join(app, 'package.json')),
    updateVersion: readPkg(app)?.version ?? null,
    vorherigeDa: fs.existsSync(path.join(prev, 'package.json')),
    node: process.version,
    daten: { dateien: count, bytes },
    sicherungen: list,
  };
}

const zipResponse = (buf, name) => new Response(buf, { status: 200, headers: { 'content-type': 'application/zip', 'content-disposition': `attachment; filename="${name}"`, 'cache-control': 'no-store' } });
const readBody = async (req) => {
  const buf = Buffer.from(await req.arrayBuffer());
  if (!buf.length) throw new Error('Keine Datei empfangen');
  if (buf.length > MAX_UPLOAD) throw new Error('Die Datei ist zu groß (höchstens 100 MB)');
  return buf;
};
const fail = (e) => json({ error: e.message }, 400);

export async function system({ req, route, method, body }) {
  if (route[0] !== 'system') return;
  const sub = route[1];
  if (method === 'GET' && sub === 'info') { return json(info()); }
  if (method === 'GET' && sub === 'backup') {
    const withSecrets = new URL(req.url).searchParams.get('zugang') !== '0';
    return zipResponse(buildBackup({ withSecrets }), `novelsbyeverly-sicherung-${stamp()}${withSecrets ? '' : '-ohne-zugang'}.zip`);
  }
  if (sub === 'backups' && BACKUP_NAME.test(route[2] ?? '')) {
    const file = path.join(dirs().backups, route[2]);
    if (method === 'GET') return fs.existsSync(file) ? zipResponse(fs.readFileSync(file), route[2]) : json({ error: 'Nicht gefunden' }, 404);
    if (method === 'DELETE') { fs.rmSync(file, { force: true }); return json({ ok: true }); }
  }
  try {
    if (method === 'POST' && sub === 'restore') {
      if (req.headers.get('content-type')?.includes('application/json')) { // eine automatische Sicherung vom Server
        if (!BACKUP_NAME.test(body.name ?? '')) return json({ error: 'Unbekannte Sicherung' }, 400);
        const file = path.join(dirs().backups, body.name);
        if (!fs.existsSync(file)) return json({ error: 'Sicherung nicht gefunden' }, 404);
        return json({ ok: true, ...(await restoreFromZip(fs.readFileSync(file))) });
      }
      return json({ ok: true, ...(await restoreFromZip(await readBody(req))) });
    }
    if (method === 'POST' && sub === 'update') {
      const r = installUpdate(await readBody(req));
      restartFn();
      return json({ ok: true, version: r.version, files: r.files, before: r.before, restart: true });
    }
    if (method === 'POST' && sub === 'update-remove') {
      const { app } = dirs();
      fs.rmSync(app, { recursive: true, force: true });
      restartFn();
      return json({ ok: true, restart: true });
    }
  } catch (e) { return fail(e); }
}
