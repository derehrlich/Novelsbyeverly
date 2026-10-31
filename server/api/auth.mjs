// POST /api/auth/device/start und /poll: Kanal (role=broadcaster) oder Bot-Account (role=bot) mit Twitch verbinden. Nur mit Admin-Login.
import { hasSession, json } from '../core/http.mjs';
import { geraetPruefen, geraetStart } from '../twitch/anmeldung.mjs';

export const config = { path: ['/api/auth/device/start', '/api/auth/device/poll'] };

export default async (req) => {
  if (!hasSession(req)) return json({ error: 'Bitte zuerst im Admin-Bereich anmelden' }, 401);
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!process.env.TWITCH_CLIENT_ID) return json({ error: 'TWITCH_CLIENT_ID fehlt' }, 500);
  const body = await req.json().catch(() => ({}));
  const role = body.role === 'bot' ? 'bot' : 'broadcaster';
  try {
    if (new URL(req.url).pathname.endsWith('/start')) {
      const d = await geraetStart(role);
      return json({ role, device_code: d.device_code, user_code: d.user_code, verification_uri: d.verification_uri, interval: d.interval ?? 5, expires_in: d.expires_in });
    }
    if (!body.device_code) return json({ error: 'device_code fehlt' }, 400);
    return json({ role, ...(await geraetPruefen(role, body.device_code)) });
  } catch (e) { return json({ error: e.message }, e.message.startsWith('Twitch:') ? 400 : 502); }
};
