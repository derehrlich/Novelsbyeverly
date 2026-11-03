// Zugangsdaten der Twitch-App (Client-ID und Secret). Sie werden im Admin (Betrieb → Twitch-App) eingetragen und im Datenordner
// gespeichert (config/twitch-app). Die Werte aus novelsbyeverly.env bzw. den Umgebungsvariablen TWITCH_CLIENT_ID/TWITCH_CLIENT_SECRET
// gelten nur als Ersatz, wenn im Admin nichts eingetragen ist.
import { db } from '../core/store.mjs';

const KEY = 'config/twitch-app';
let gespeichert = null; // im Speicher, damit die Twitch-Aufrufe synchron nachsehen können

export async function ladeTwitchApp() {
  gespeichert = (await db.get(KEY)) ?? null;
  return twitchApp();
}

export function twitchApp() {
  const clientId = gespeichert?.clientId || process.env.TWITCH_CLIENT_ID || '';
  const clientSecret = gespeichert?.clientSecret || process.env.TWITCH_CLIENT_SECRET || '';
  return {
    clientId,
    clientSecret,
    idQuelle: gespeichert?.clientId ? 'admin' : process.env.TWITCH_CLIENT_ID ? 'env' : null,
    secretQuelle: gespeichert?.clientSecret ? 'admin' : process.env.TWITCH_CLIENT_SECRET ? 'env' : null,
  };
}

// Speichert die Angaben. Leeres Secret = unverändert, clearSecret = entfernen. Gibt zurück, ob sich die Client-ID geändert hat.
export async function speichereTwitchApp({ clientId, clientSecret, clearSecret }) {
  const vorher = twitchApp();
  const neu = { ...(gespeichert ?? {}) };
  if (clientId !== undefined) {
    const id = String(clientId).trim();
    if (id && !/^[a-z0-9]{20,40}$/i.test(id)) return { error: 'Die Client-ID sieht nicht richtig aus (20 bis 40 Buchstaben und Zahlen)' };
    neu.clientId = id;
  }
  if (clearSecret) neu.clientSecret = '';
  else if (clientSecret !== undefined && String(clientSecret).trim()) {
    const s = String(clientSecret).trim();
    if (!/^[a-z0-9]{20,60}$/i.test(s)) return { error: 'Das Secret sieht nicht richtig aus (nur Buchstaben und Zahlen, 20 bis 60 Zeichen)' };
    neu.clientSecret = s;
  }
  await db.set(KEY, neu);
  gespeichert = neu;
  return { idGeaendert: twitchApp().clientId !== vorher.clientId };
}
