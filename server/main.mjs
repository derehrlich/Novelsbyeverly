// Der eigentliche Server (gestartet über index.mjs): liefert Overlay und Admin aus, stellt die API bereit und hält die Verbindung zu Twitch (EventSub-WebSocket).
// Läuft im Heimnetz, z. B. als Docker-Container auf CasaOS (siehe Dockerfile und docker-compose.yml). Daten liegen in DATA_DIR.
//   ADMIN_PASSWORD=geheim node server/index.mjs   →  http://localhost:8888/admin/  (Twitch-Zugangsdaten trägt man im Admin ein)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.DATA_DIR ??= fs.existsSync('/data') ? '/data' : path.join(root, 'data');
const port = Number(process.env.PORT ?? 8888);

// Erst jetzt laden: Die Module legen den Speicher beim Import an und brauchen DATA_DIR.
const routes = [];
for (const file of fs.readdirSync(path.join(root, 'server/routes'))) {
  const mod = await import(pathToFileURL(path.join(root, 'server/routes', file)).href);
  for (const p of [mod.config.path].flat()) routes.push({ p, handler: mod.default });
}
const { startEventSub } = await import('./lib/eventsub.mjs');
const { initTwitchApp, twitchApp } = await import('./lib/twitch-app.mjs');
const live = await import('./lib/live.mjs');
const { hasSession } = await import('./lib/http.mjs');
await initTwitchApp();
const { getSettings } = await import('./lib/settings.mjs');
const { tick } = await import('./lib/timer.mjs');

const match = (pathname) => routes.find(({ p }) => (p.endsWith('/*') ? pathname.startsWith(p.slice(0, -1)) : pathname === p));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.txt': 'text/plain', '.json': 'application/json' };
const redirects = { '/': '/admin/', '/overlay': '/overlay.html' };
const publicDir = path.join(root, 'public');
const MAX_BODY = 1_000_000;
const MAX_UPLOAD = 100 * 1024 * 1024; // ZIP für Wiederherstellung und Update, nur mit Anmeldung

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
  try {
    if (url.pathname === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('ok'); }
    if (url.pathname === '/api/overlay/live') return live.attach(req, res);
    const route = match(url.pathname);
    if (route) {
      const upload = url.pathname.startsWith('/api/admin/system/') && hasSession({ headers: { get: (k) => req.headers[k.toLowerCase()] ?? null } });
      const limit = upload ? MAX_UPLOAD : MAX_BODY;
      const chunks = []; let size = 0;
      for await (const c of req) { size += c.length; if (size > limit) { res.writeHead(413); return res.end('Zu groß'); } chunks.push(c); }
      const body = ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks);
      const out = await route.handler(new Request(url, { method: req.method, headers: req.headers, body }));
      const headers = {}; // mehrere Set-Cookie-Zeilen bleiben getrennt
      for (const [k, v] of out.headers) if (k !== 'set-cookie') headers[k] = v;
      const cookies = out.headers.getSetCookie?.() ?? [];
      res.writeHead(out.status, cookies.length ? { ...headers, 'set-cookie': cookies } : headers);
      return res.end(Buffer.from(await out.arrayBuffer()));
    }
    let file = redirects[url.pathname] ?? url.pathname;
    if (file.endsWith('/')) file += 'index.html';
    const target = path.join(publicDir, path.normalize(file));
    if (!target.startsWith(publicDir + path.sep) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) { res.writeHead(404); return res.end('Nicht gefunden'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(target)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(fs.readFileSync(target));
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.writeHead(500);
    res.end('Fehler');
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Läuft auf Port ${port}: Admin /admin/ · Overlay /overlay · Daten in ${process.env.DATA_DIR}`);
  if (!process.env.ADMIN_PASSWORD) console.warn('Achtung: ADMIN_PASSWORD ist nicht gesetzt, der Admin-Bereich bleibt gesperrt.');
  if (!twitchApp().clientId) console.warn('Hinweis: Die Twitch-Client-ID fehlt, die Verbindung zu Twitch ist aus. Im Admin unter „Twitch“ eintragen.');
  else startEventSub().then(() => console.log('Twitch: Verbindung ok')).catch((e) => console.warn('Twitch:', e.message));
});

// Ohne Overlay und Chat läuft der Timer trotzdem weiter: Phasenwechsel und Ansagen kommen von hier.
setInterval(async () => { try { await tick(await getSettings()); } catch (e) { console.warn('Timer:', e.message); } }, 5000).unref();

for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { console.log('Beende …'); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); });
