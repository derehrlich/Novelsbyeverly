// Schnittstelle für ein Hilfsprogramm auf dem PC (liest den Titel aus YouTube Music oder Tuna und meldet ihn alle paar Sekunden).
//   POST /api/musik   Authorization: Bearer <INGEST_TOKEN>   { "title": "...", "artist": "...", "cover": "https://...", "playing": true }
import { setMusik } from '../features/musik.mjs';
import { json, safeEqual } from '../core/http.mjs';

export const config = { path: '/api/musik' };

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const token = process.env.INGEST_TOKEN;
  if (!token) return json({ error: 'INGEST_TOKEN ist nicht gesetzt' }, 503);
  const given = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!given || !safeEqual(given, token)) return json({ error: 'Nicht erlaubt' }, 401);
  const body = await req.json().catch(() => ({}));
  const m = await setMusik(body);
  return json({ ok: true, playing: m.playing });
};
