// Verbindung zu Twitch per EventSub-WebSocket: Der Server ruft Twitch an, deshalb braucht er weder öffentliche Adresse noch Webhooks.
// Twitch schickt Chat-Nachrichten und Kanalpunkte-Einlösungen über diese Verbindung; Abos gelten nur, solange sie besteht.
// Bei Abbruch verbindet sich der Server selbst neu (mit wachsender Wartezeit) und legt die Abos neu an.
import { db } from '../core/store.mjs';
import { getSettings, needsReward } from '../features/settings.mjs';
import { handleRedemption } from '../features/checkin.mjs';
import { handleChat } from '../features/chat.mjs';
import { CHAT_TYPE, storedTokens, subscribeWs } from './api.mjs';

const URL_WS = process.env.EVENTSUB_URL || 'wss://eventsub.wss.twitch.tv/ws';

// ---- Eine Nachricht von Twitch verarbeiten (auch direkt aufrufbar, z. B. in Tests)
export async function handleNotification(type, e) {
  if (type === CHAT_TYPE) { // viele Nachrichten: ein Fehler darf nichts anhalten
    try { await handleChat(e, await getSettings()); } catch (err) { console.error('Chat fehlgeschlagen:', err); }
    return;
  }
  const state = (await db.get('config/state')) ?? {};
  if (!state.rewardId || e.reward?.id !== state.rewardId) return; // nur der eigene Check-in-Reward
  if (!(await db.setIfNew(`seen/${e.id}`, Date.now()))) return; // jede Einlösung nur einmal
  try {
    await handleRedemption({ id: e.id, user_id: e.user_id, user_name: e.user_name, reward: e.reward }, await getSettings());
  } catch (err) {
    console.error('Check-in fehlgeschlagen:', err);
    await db.delete(`seen/${e.id}`);
  }
}

// ---- Verbindung
export const info = { state: 'aus', since: null, warnings: [], error: null, lastMessageAt: null };
let ws = null, watchdog = null, retry = null, delay = 2000, wanted = false, waiting = [];
const setState = (state, extra = {}) => { Object.assign(info, { state, since: Date.now(), ...extra }); };
const settle = () => { for (const f of waiting.splice(0)) f(); };

function arm(seconds) {
  clearTimeout(watchdog);
  watchdog = setTimeout(() => { console.warn('EventSub: keine Nachricht mehr, verbinde neu'); try { ws?.close(); } catch { /* weiter */ } }, (seconds + 5) * 1000);
  watchdog.unref?.();
}

async function createSubscriptions(sessionId) {
  const settings = await getSettings();
  const state = (await db.get('config/state')) ?? {};
  const { warnings } = await subscribeWs(sessionId, { rewardId: needsReward(settings) ? state.rewardId ?? null : null, chat: settings.chatCommands });
  info.warnings = warnings;
}

function connect(url, isReconnect = false, previous = null) {
  const socket = new WebSocket(url);
  setState(isReconnect ? info.state : 'verbindet');
  socket.onmessage = async (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    info.lastMessageAt = Date.now();
    const type = msg.metadata?.message_type;
    if (type === 'session_welcome') {
      const session = msg.payload.session;
      arm(session.keepalive_timeout_seconds ?? 10);
      ws = socket;
      if (previous) { try { previous.onclose = null; previous.close(); } catch { /* weiter */ } }
      if (!isReconnect) {
        try { await createSubscriptions(session.id); setState('verbunden', { error: null }); delay = 2000; } catch (e) { setState('fehler', { error: e.message }); console.warn('EventSub-Abos:', e.message); }
      } else setState('verbunden', { error: null });
      settle();
    } else if (type === 'session_keepalive') arm(10);
    else if (type === 'notification') {
      arm(10);
      handleNotification(msg.payload.subscription?.type, msg.payload.event).catch((e) => console.error('EventSub:', e));
    } else if (type === 'session_reconnect') connect(msg.payload.session.reconnect_url, true, socket);
    else if (type === 'revocation') {
      console.warn('EventSub widerrufen:', msg.payload.subscription?.status);
      db.get('config/state').then((s) => db.set('config/state', { ...(s ?? {}), revoked: msg.payload.subscription?.status ?? 'unbekannt' }));
    }
  };
  socket.onclose = () => {
    if (!wanted || (ws && ws !== socket)) return;
    clearTimeout(watchdog);
    setState('getrennt');
    retry = setTimeout(() => { retry = null; if (wanted) connect(URL_WS); }, delay);
    retry.unref?.();
    delay = Math.min(delay * 2, 60_000);
  };
  socket.onerror = (e) => { info.error = e?.message ?? 'Verbindungsfehler'; };
}

// Verbindung herstellen (oder neu aufbauen, z. B. nach Änderung an Einstellungen oder Verbindungen). Wartet bis zu 15 s auf die Abos.
export async function startEventSub() {
  wanted = true;
  stopSocket();
  if (!(await storedTokens('broadcaster'))) { setState('nicht verbunden'); return; }
  const ready = new Promise((r) => { waiting.push(r); setTimeout(r, 15_000); });
  connect(URL_WS);
  await ready;
}

function stopSocket() {
  clearTimeout(watchdog); clearTimeout(retry); retry = null;
  const old = ws; ws = null;
  if (old) { old.onclose = null; try { old.close(); } catch { /* weiter */ } }
}

export function stopEventSub() { wanted = false; stopSocket(); setState('aus'); settle(); }
