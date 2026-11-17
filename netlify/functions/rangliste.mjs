// Öffentliche Rangliste (JSON für die Seite /rangliste). Zeigt nur Namen und Zahlen, keine IDs.
import { getSettings } from '../lib/settings.mjs';
import { leaderboard } from '../lib/punkte.mjs';
import { json } from '../lib/http.mjs';

export const config = { path: '/api/rangliste' };

let cache = null; // kurz zwischenspeichern: die Seite lädt jede Minute, viele Zuschauer sollen den Server nicht belasten
export default async (req) => {
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  const settings = await getSettings();
  if (!settings.checkinEnabled && !settings.pointsEnabled) return json({ error: 'Die Rangliste ist gerade nicht öffentlich.' }, 404);
  if (!cache || Date.now() - cache.at > 20_000) cache = { at: Date.now(), data: await leaderboard(settings) };
  return json(cache.data, 200, { 'cache-control': 'public, max-age=20' });
};
