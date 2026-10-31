// Schnittstelle für ein Hilfsprogramm auf dem PC der Streamerin (liest später die Wortzahl aus Papyrus).
//   POST /api/words   Authorization: Bearer <INGEST_TOKEN>   { "absolute": 4231 }  oder  { "delta": 300 }
import { getSettings } from '../lib/settings.mjs';
import { addWords, setAbsolute } from '../lib/words.mjs';
import { json, safeEqual } from '../lib/http.mjs';

export const config = { path: '/api/words' };

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const token = process.env.INGEST_TOKEN;
  if (!token) return json({ error: 'INGEST_TOKEN ist nicht gesetzt' }, 503);
  const given = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!given || !safeEqual(given, token)) return json({ error: 'Nicht erlaubt' }, 401);
  const body = await req.json().catch(() => ({}));
  const settings = await getSettings();
  if (Number.isFinite(body.absolute) && body.absolute >= 0) return json({ ok: true, today: (await setAbsolute(Math.round(body.absolute), settings)).today });
  if (Number.isFinite(body.delta)) return json({ ok: true, today: (await addWords(Math.round(body.delta), settings)).today });
  return json({ error: 'Erwartet { "absolute": Zahl } oder { "delta": Zahl }' }, 400);
};
