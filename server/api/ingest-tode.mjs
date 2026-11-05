// Schnittstelle für einen Hotkey (Stream Deck, AutoHotkey, OBS-Skript …), um den Deathcounter zu steuern.
//   POST /api/tod   Authorization: Bearer <INGEST_TOKEN>   { "aktion": "plus" | "minus" | "reset" | "set" | "zeigen", "wert": 12 }
//   GET  /api/tod?aktion=plus&token=<INGEST_TOKEN>        (für Programme, die nur Adressen aufrufen können)
import { getTode, todeAktion } from '../features/tode.mjs';
import { json, safeEqual } from '../core/http.mjs';

export const config = { path: '/api/tod' };

export default async (req) => {
  if (!['POST', 'GET'].includes(req.method)) return json({ error: 'Method not allowed' }, 405);
  const token = process.env.INGEST_TOKEN;
  if (!token) return json({ error: 'INGEST_TOKEN ist nicht gesetzt' }, 503);
  const url = new URL(req.url);
  const given = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '') || url.searchParams.get('token') || '';
  if (!given || !safeEqual(given, token)) return json({ error: 'Nicht erlaubt' }, 401);
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : Object.fromEntries(url.searchParams);
  if (!body.aktion) return json({ n: (await getTode()).n });
  const r = await todeAktion(body.aktion, body.wert);
  return r ? json({ ok: true, n: r.n }) : json({ error: 'aktion: plus, minus, reset, zeigen oder set (mit wert)' }, 400);
};
