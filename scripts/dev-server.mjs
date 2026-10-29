// Lokaler Entwicklungsserver ohne Netlify: liefert public/ aus und ruft die Functions auf. Daten landen in ./data.
//   ADMIN_PASSWORD=geheim EVENTSUB_SECRET=zufallstext123 node scripts/dev-server.mjs   →  http://localhost:8888/admin/
// Twitch-Funktionen (Chat, Rewards) brauchen eine echte Verbindung und laufen nur auf der veröffentlichten Seite.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.LOCAL_STORE_DIR ??= path.join(root, 'data');
const port = Number(process.env.PORT ?? 8888);
process.env.SITE_URL ??= `http://localhost:${port}`;

const routes = [];
for (const file of fs.readdirSync(path.join(root, 'netlify/functions'))) {
  const mod = await import(pathToFileURL(path.join(root, 'netlify/functions', file)).href);
  for (const p of [mod.config.path].flat()) routes.push({ p, handler: mod.default });
}
const match = (pathname) => routes.find(({ p }) => (p.endsWith('/*') ? pathname.startsWith(p.slice(0, -1)) : pathname === p));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.txt': 'text/plain' };
const redirects = { '/': '/admin/', '/overlay': '/overlay.html' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  try {
    const route = match(url.pathname);
    if (route) {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks);
      const out = await route.handler(new Request(url, { method: req.method, headers: req.headers, body }));
      res.writeHead(out.status, Object.fromEntries(out.headers));
      return res.end(Buffer.from(await out.arrayBuffer()));
    }
    let file = redirects[url.pathname] ?? url.pathname;
    if (file === '/admin/' || file.endsWith('/')) file += 'index.html';
    const target = path.join(root, 'public', path.normalize(file));
    if (!target.startsWith(path.join(root, 'public')) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) { res.writeHead(404); return res.end('Nicht gefunden'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(target)] ?? 'application/octet-stream' });
    res.end(fs.readFileSync(target));
  } catch (e) {
    console.error(e);
    res.writeHead(500); res.end('Fehler');
  }
}).listen(port, () => console.log(`Läuft auf http://localhost:${port}/admin/`));
