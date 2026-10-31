// Verbindet den Kanal (role=broadcaster) oder den Bot-Account (role=bot) mit Twitch über den „Device Code“-Ablauf:
// Der Admin zeigt einen Code, du bestätigst ihn auf twitch.tv/activate (am Handy oder PC). Dafür braucht der Server
// keine Weiterleitungs-Adresse, das passt zu einem Server im Heimnetz. Nur mit Admin-Login möglich.
import { db } from '../lib/store.mjs';
import { hasSession, json } from '../lib/http.mjs';
import { ROLES, toStored } from '../lib/twitch.mjs';
import { startEventSub } from '../lib/eventsub.mjs';

export const config = { path: ['/api/auth/device/start', '/api/auth/device/poll'] };

const form = (o) => new URLSearchParams(o);
const roleOf = (body) => (body.role === 'bot' ? 'bot' : 'broadcaster');

export default async (req) => {
  if (!hasSession(req)) return json({ error: 'Bitte zuerst im Admin-Bereich anmelden' }, 401);
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!process.env.TWITCH_CLIENT_ID) return json({ error: 'TWITCH_CLIENT_ID fehlt' }, 500);
  const body = await req.json().catch(() => ({}));
  const role = roleOf(body);
  const scopes = ROLES[role].scopes.join(' ');
  const path = new URL(req.url).pathname;

  if (path.endsWith('/start')) {
    const res = await fetch('https://id.twitch.tv/oauth2/device', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form({ client_id: process.env.TWITCH_CLIENT_ID, scopes }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return json({ error: `Twitch: ${data.message ?? res.status}` }, 502);
    return json({ role, device_code: data.device_code, user_code: data.user_code, verification_uri: data.verification_uri, interval: data.interval ?? 5, expires_in: data.expires_in });
  }

  if (!body.device_code) return json({ error: 'device_code fehlt' }, 400);
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form({ client_id: process.env.TWITCH_CLIENT_ID, scopes, device_code: body.device_code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }),
  });
  const t = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = String(t.message ?? '');
    if (/pending/i.test(msg)) return json({ pending: true });
    return json({ error: `Twitch: ${msg || res.status}` }, 400);
  }
  const who = await fetch('https://id.twitch.tv/oauth2/validate', { headers: { Authorization: `OAuth ${t.access_token}` } }).then((r) => r.json());
  await db.set(ROLES[role].key, toStored(t, { user_id: who.user_id, login: who.login, scopes: who.scopes ?? [] }));
  startEventSub().catch((e) => console.warn('EventSub:', e.message)); // neue Verbindung gilt sofort
  return json({ ok: true, role, login: who.login });
};
