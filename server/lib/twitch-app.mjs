// Zugangsdaten der Twitch-App (Client-ID und Secret). Sie werden im Admin eingetragen und im Datenordner gespeichert;
// die Umgebungsvariablen TWITCH_CLIENT_ID und TWITCH_CLIENT_SECRET gelten nur als Ersatz, wenn dort nichts hinterlegt ist.
import { db } from './store.mjs';

const KEY = 'config/twitch-app';
let stored = null; // im Speicher, damit die Twitch-Aufrufe synchron nachsehen können

export async function initTwitchApp() {
  stored = (await db.get(KEY)) ?? null;
  return twitchApp();
}

export function twitchApp() {
  const clientId = stored?.clientId || process.env.TWITCH_CLIENT_ID || '';
  const clientSecret = stored?.clientSecret || process.env.TWITCH_CLIENT_SECRET || '';
  return {
    clientId,
    clientSecret,
    idSource: stored?.clientId ? 'admin' : process.env.TWITCH_CLIENT_ID ? 'env' : null,
    secretSource: stored?.clientSecret ? 'admin' : process.env.TWITCH_CLIENT_SECRET ? 'env' : null,
  };
}

export const validClientId = (id) => /^[a-z0-9]{20,40}$/i.test(id);

// Speichert die Angaben. Leeres Secret = unverändert, clearSecret = entfernen. Gibt zurück, ob sich die Client-ID geändert hat.
export async function saveTwitchApp({ clientId, clientSecret, clearSecret }) {
  const before = twitchApp();
  const next = { ...(stored ?? {}) };
  if (clientId !== undefined) {
    const id = String(clientId).trim();
    if (id && !validClientId(id)) return { error: 'Die Client-ID sieht nicht richtig aus (20 bis 40 Buchstaben und Zahlen)' };
    next.clientId = id;
  }
  if (clearSecret) next.clientSecret = '';
  else if (clientSecret !== undefined && String(clientSecret).trim()) {
    const s = String(clientSecret).trim();
    if (!/^[a-z0-9]{20,60}$/i.test(s)) return { error: 'Das Secret sieht nicht richtig aus (nur Buchstaben und Zahlen, 20 bis 60 Zeichen)' };
    next.clientSecret = s;
  }
  await db.set(KEY, next);
  stored = next;
  return { changedId: twitchApp().clientId !== before.clientId };
}

export function setStoredForRestore(value) { stored = value ?? null; }
