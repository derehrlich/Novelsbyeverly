// POST /api/admin/setup: legt den Check-in-Reward an (oder schaltet ihn aus) und abonniert die Webhooks.
import { db } from '../store.mjs';
import { getSettings, needsAlerts, needsChat, needsRaids, needsRescue, needsReward } from '../settings.mjs';
import { json } from '../http.mjs';
import { ensureCheckinReward, ensureRescueReward, siteUrl, subscribe } from '../twitch.mjs';

export async function setup({ req, method }) {
  if (method !== 'POST') return;
  if (!process.env.EVENTSUB_SECRET) return json({ error: 'EVENTSUB_SECRET ist nicht gesetzt' }, 400);
  const settings = await getSettings();
  if (needsRescue(settings) && settings.streakRewardTitle === settings.checkinRewardTitle) return json({ error: 'Check-in und Streak-Retter brauchen verschiedene Reward-Namen' }, 400);
  const reward = await ensureCheckinReward(settings, needsReward(settings));
  const rescue = await ensureRescueReward(settings, needsRescue(settings));
  const { warnings } = await subscribe(`${siteUrl(req)}/api/twitch-webhook`, { rewardId: reward?.id ?? null, rescueRewardId: rescue?.id ?? null, chat: needsChat(settings), alerts: needsAlerts(settings), raids: needsRaids(settings) });
  await db.set('config/state', { ...((await db.get('config/state')) ?? {}), revoked: null });
  return json({ ok: true, reward: reward?.title ?? null, rescueReward: rescue?.title ?? null, ...(warnings.length ? { warnings } : {}) });
}
