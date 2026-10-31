// Wie lange der Stream heute schon läuft. Quellen: von Hand gestartet (Admin, Chat) oder von Twitch erkannt (Stream ist live).
import { db } from '../core/store.mjs';
import { helix, storedTokens } from '../twitch/api.mjs';

const KEY = 'state/stream';
const CACHE_MS = 60_000;

export async function startStream(now = Date.now()) {
  await db.set(KEY, { startedAt: now, stoppedAt: null });
}
export async function stopStream(now = Date.now()) {
  await db.set(KEY, { startedAt: null, stoppedAt: now });
}

async function twitchStart(now) {
  const cached = await db.get('cache/live');
  if (cached && now - cached.checked < CACHE_MS) return cached.startedAt;
  let startedAt = null;
  try {
    const tokens = await storedTokens('broadcaster');
    if (tokens && process.env.TWITCH_CLIENT_ID) {
      const r = await helix('GET', 'streams', { query: { user_id: tokens.user_id } });
      const live = r.data?.[0];
      startedAt = live?.started_at ? Date.parse(live.started_at) : null;
    }
  } catch (e) { console.warn('Live-Status nicht abrufbar:', e.message); }
  await db.set('cache/live', { checked: now, startedAt });
  return startedAt;
}

/** { startedAt, quelle: 'hand' | 'twitch' | null }. Ein von Hand beendeter Stream bleibt beendet, bis ein neuer beginnt. */
export async function streamInfo(now = Date.now()) {
  const m = (await db.get(KEY)) ?? { startedAt: null, stoppedAt: null };
  if (m.startedAt) return { startedAt: m.startedAt, quelle: 'hand' };
  const t = await twitchStart(now);
  if (t && (!m.stoppedAt || t > m.stoppedAt)) return { startedAt: t, quelle: 'twitch' };
  return { startedAt: null, quelle: null };
}

export const fmtHM = (ms) => {
  const m = Math.max(0, Math.floor(ms / 60_000));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
};
