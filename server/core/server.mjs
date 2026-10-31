// HTTP-Server: leitet /api-Anfragen an die Routen weiter und liefert sonst Dateien aus public/ aus.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { APP_DIR } from './config.mjs';

const PUBLIC = path.join(APP_DIR, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.json': 'application/json' };
const ADRESSEN = { '/': '/admin/', '/overlay': '/overlay.html' }; // kurze Adressen
const STANDARD_MAX = 1_000_000;

// Der Body wird als Strom durchgereicht und erst von der Route gelesen (bei Uploads erst nach der Anmeldeprüfung).
// Das Limit gilt für die Größe laut Header und für die tatsächlich gelesenen Bytes.
function bodyOf(req, max) {
  if (['GET', 'HEAD'].includes(req.method)) return undefined;
  let size = 0;
  const limit = new TransformStream({ transform(chunk, c) { size += chunk.length; if (size > max) c.error(new Error('Zu groß')); else c.enqueue(chunk); } });
  return Readable.toWeb(req).pipeThrough(limit);
}

export function createServer(routes) {
  const match = (p) => routes.find((r) => (r.path.endsWith('/*') ? p.startsWith(r.path.slice(0, -1)) : p === r.path));
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
    try {
      if (url.pathname === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('ok'); }
      const route = match(url.pathname);
      if (route) {
        const max = route.maxBody ?? STANDARD_MAX;
        if (Number(req.headers['content-length'] ?? 0) > max) { res.writeHead(413); return res.end('Zu groß'); }
        const body = bodyOf(req, max);
        const out = await route.handler(new Request(url, { method: req.method, headers: req.headers, body, ...(body ? { duplex: 'half' } : {}) }));
        const headers = {}; // mehrere Set-Cookie-Zeilen bleiben getrennt
        for (const [k, v] of out.headers) if (k !== 'set-cookie') headers[k] = v;
        const cookies = out.headers.getSetCookie?.() ?? [];
        res.writeHead(out.status, cookies.length ? { ...headers, 'set-cookie': cookies } : headers);
        return res.end(Buffer.from(await out.arrayBuffer()));
      }
      let file = ADRESSEN[url.pathname] ?? url.pathname;
      if (file.endsWith('/')) file += 'index.html';
      const target = path.join(PUBLIC, path.normalize(file));
      if (!target.startsWith(PUBLIC + path.sep) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) { res.writeHead(404); return res.end('Nicht gefunden'); }
      res.writeHead(200, { 'content-type': TYPES[path.extname(target)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
      res.end(fs.readFileSync(target));
    } catch (e) {
      console.error(e);
      if (!res.headersSent) res.writeHead(500);
      res.end('Fehler');
    }
  });
}
