// POST /api/admin/setup: legt den Check-in-Reward an (oder schaltet ihn aus) und baut die Verbindung zu Twitch (EventSub) neu auf.
import { getSettings, needsReward } from '../settings.mjs';
import { json } from '../http.mjs';
import { ensureCheckinReward } from '../twitch.mjs';
import { info, startEventSub } from '../eventsub.mjs';

export async function setup({ method }) {
  if (method !== 'POST') return;
  const settings = await getSettings();
  const reward = await ensureCheckinReward(settings, needsReward(settings));
  await startEventSub();
  const warnings = [...info.warnings, ...(info.state === 'verbunden' ? [] : [`Verbindung zu Twitch: ${info.state}${info.error ? ` (${info.error})` : ''}`])];
  return json({ ok: info.state === 'verbunden', reward: reward?.title ?? null, ...(warnings.length ? { warnings } : {}) });
}
