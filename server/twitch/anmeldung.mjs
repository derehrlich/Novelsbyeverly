// Verbindung mit Twitch über den „Device Code“-Ablauf: Der Admin zeigt einen Code, den du auf twitch.tv/activate bestätigst.
// Dafür braucht der Server keine Weiterleitungs-Adresse (im Heimnetz gibt es kein HTTPS).
import { db } from '../core/store.mjs';
import { ROLES, toStored } from './api.mjs';
import { startEventSub } from './eventsub.mjs';

const form = (o) => new URLSearchParams(o);
const POST = { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };

// Fordert einen Code an. Antwort: { device_code, user_code, verification_uri, interval, expires_in }
export async function geraetStart(role) {
  const res = await fetch('https://id.twitch.tv/oauth2/device', { ...POST, body: form({ client_id: process.env.TWITCH_CLIENT_ID, scopes: ROLES[role].scopes.join(' ') }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Twitch: ${data.message ?? res.status}`);
  return data;
}

// Fragt, ob der Code bestätigt wurde. { pending: true } oder { ok: true, login } (dann sind die Tokens gespeichert).
export async function geraetPruefen(role, deviceCode) {
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    ...POST, body: form({ client_id: process.env.TWITCH_CLIENT_ID, scopes: ROLES[role].scopes.join(' '), device_code: deviceCode, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }),
  });
  const t = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (/pending/i.test(String(t.message ?? ''))) return { pending: true };
    throw new Error(`Twitch: ${t.message || res.status}`);
  }
  const who = await fetch('https://id.twitch.tv/oauth2/validate', { headers: { Authorization: `OAuth ${t.access_token}` } }).then((r) => r.json());
  await db.set(ROLES[role].key, toStored(t, { user_id: who.user_id, login: who.login, scopes: who.scopes ?? [] }));
  startEventSub().catch((e) => console.warn('EventSub:', e.message)); // neue Verbindung gilt sofort
  return { ok: true, login: who.login };
}
