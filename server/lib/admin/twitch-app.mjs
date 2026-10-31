// /api/admin/twitch-app: Client-ID und Secret der Twitch-App eintragen, prüfen und entfernen.
// Das Secret verlässt den Server nie wieder; der Admin sieht nur, ob eines gesetzt ist.
import { db } from '../store.mjs';
import { json } from '../http.mjs';
import { saveTwitchApp, twitchApp } from '../twitch-app.mjs';
import { startEventSub, stopEventSub } from '../eventsub.mjs';

const view = () => {
  const a = twitchApp();
  return { clientId: a.clientId, idSource: a.idSource, hasSecret: Boolean(a.clientSecret), secretSource: a.secretSource };
};

export async function twitchAppRoute({ route, method, body }) {
  if (route[0] !== 'twitch-app') return;
  if (method === 'GET') return json(view());

  if (method === 'PUT') {
    const r = await saveTwitchApp(body);
    if (r.error) return json({ error: r.error }, 400);
    let disconnected = false;
    if (r.changedId) { // Anmeldungen gehören zur alten App und gelten nicht mehr
      await db.delete('config/tokens'); await db.delete('config/bot-tokens');
      stopEventSub(); disconnected = true;
    } else if (twitchApp().clientId) startEventSub().catch((e) => console.warn('EventSub:', e.message));
    return json({ ...view(), disconnected });
  }

  // POST test: fragt Twitch, ob die Angaben stimmen. Mit Secret über ein App-Token, sonst über den Geräte-Code-Start (ohne Folgen).
  if (method === 'POST' && route[1] === 'test') {
    const a = twitchApp();
    if (!a.clientId) return json({ error: 'Bitte zuerst eine Client-ID eintragen' }, 400);
    try {
      if (a.clientSecret) {
        const res = await fetch('https://id.twitch.tv/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: a.clientId, client_secret: a.clientSecret, grant_type: 'client_credentials' }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return json({ ok: false, message: `Twitch lehnt die Angaben ab: ${data.message ?? res.status}` });
        return json({ ok: true, message: 'Client-ID und Secret stimmen.' });
      }
      const res = await fetch('https://id.twitch.tv/oauth2/device', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: a.clientId, scopes: 'user:read:chat' }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return json({ ok: false, message: `Twitch lehnt die Client-ID ab: ${data.message ?? res.status}` });
      return json({ ok: true, message: 'Die Client-ID wird von Twitch akzeptiert (ohne Secret, passend für „Public“).' });
    } catch (e) {
      return json({ ok: false, message: `Twitch nicht erreichbar: ${e.message}` });
    }
  }
}
