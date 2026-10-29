// POST /api/admin/setup: legt den Check-in-Reward an (oder schaltet ihn aus) und abonniert die Webhooks.
import { db } from '../store.mjs';
import { getSettings, needsReward } from '../settings.mjs';
import { json } from '../http.mjs';
import { ensureCheckinReward, siteUrl, subscribe } from '../twitch.mjs';

export async function setup({ req, method }) {
  if (method !== 'POST') return;
  if (!process.env.EVENTSUB_SECRET) return json({ error: 'EVENTSUB_SECRET ist nicht gesetzt' }, 400);
  const settings = await getSettings();
  const reward = await ensureCheckinReward(settings, needsReward(settings));
  const { warnings } = await subscribe(`${siteUrl(req)}/api/twitch-webhook`, { rewardId: reward?.id ?? null, chat: settings.chatCommands });
  await db.set('config/state', { ...((await db.get('config/state')) ?? {}), revoked: null });
  return json({ ok: true, reward: reward?.title ?? null, ...(warnings.length ? { warnings } : {}) });
}
