// Eigene Töne: GET /api/sound/<start|ende> (öffentlich, das Overlay spielt sie ab), PUT (Upload) und DELETE nur mit Admin-Login.
import fs from 'node:fs';
import { hasSession, json } from '../core/http.mjs';
import { MAX_BYTES, loescheSound, sound, soundInfo, speichereSound } from '../features/sounds.mjs';
import { notify } from '../core/live.mjs';

export const config = { path: ['/api/sound', '/api/sound/*'], maxBody: MAX_BYTES + 1024 };

export default async (req) => {
  const art = new URL(req.url).pathname.replace(/^\/api\/sound\/?/, '').split('/')[0];
  if (!art) return hasSession(req) ? json(soundInfo()) : json({ error: 'Nicht angemeldet' }, 401);
  if (req.method === 'GET') {
    const s = sound(art);
    if (!s) return json({ error: 'Kein eigener Ton' }, 404);
    return new Response(fs.readFileSync(s.pfad), { headers: { 'content-type': s.typ, 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff' } });
  }
  if (!hasSession(req)) return json({ error: 'Nicht angemeldet' }, 401);
  try {
    if (req.method === 'PUT' || req.method === 'POST') {
      const type = req.headers.get('content-type') ?? '';
      if (!type.startsWith('audio/') && !type.includes('octet-stream')) return json({ error: 'Bitte eine Audiodatei senden' }, 415);
      const name = decodeURIComponent(req.headers.get('x-dateiname') ?? '');
      speichereSound(art, Buffer.from(await req.arrayBuffer()), name);
      notify('settings');
      return json({ ok: true, ...soundInfo() });
    }
    if (req.method === 'DELETE') { loescheSound(art); notify('settings'); return json({ ok: true, ...soundInfo() }); }
  } catch (e) { return json({ error: e.message }, 400); }
  return json({ error: 'Not found' }, 404);
};
