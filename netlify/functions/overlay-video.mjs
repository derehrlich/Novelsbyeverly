// Das Video einer Szene (öffentlich, das Overlay läuft ohne Anmeldung). Mit Range-Unterstützung, sonst kann der Browser das Video nicht in der Schleife abspielen.
import fs from 'node:fs';
import { Readable } from 'node:stream';
import { getVideoMeta, validSlot, videoFile, videosAvailable } from '../lib/videos.mjs';
import { text } from '../lib/http.mjs';

export const config = { path: '/api/overlay-video' };

export default async (req) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return text('Method not allowed', 405);
  const u = new URL(req.url); const s = u.searchParams.get('s'), z = u.searchParams.get('z');
  if (!videosAvailable() || !validSlot(s, z)) return text('Kein Video', 404);
  const meta = await getVideoMeta(s, z); const file = meta && videoFile(meta, s, z);
  if (!file || !fs.existsSync(file)) return text('Kein Video', 404);
  const size = fs.statSync(file).size;
  const headers = { 'content-type': meta.type, 'accept-ranges': 'bytes', 'cache-control': u.searchParams.has('v') ? 'public, max-age=31536000, immutable' : 'no-cache' };
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') ?? '');
  if (m && (m[1] || m[2])) {
    let start = m[1] ? Number(m[1]) : size - Number(m[2]), end = m[1] && m[2] ? Number(m[2]) : size - 1;
    end = Math.min(end, size - 1);
    if (!(start >= 0) || start > end) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
    return new Response(req.method === 'HEAD' ? null : Readable.toWeb(fs.createReadStream(file, { start, end })), { status: 206, headers: { ...headers, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': String(end - start + 1) } });
  }
  return new Response(req.method === 'HEAD' ? null : Readable.toWeb(fs.createReadStream(file)), { status: 200, headers: { ...headers, 'content-length': String(size) } });
};
