// Check-in-Reward (Kanalpunkte): setzt die Figur hin, wenn "Erscheinen bei" auf Check-in oder beides steht.
import { db } from './store.mjs';
import { getSettings, needsReward } from './settings.mjs';
import { seatReply } from './chat.mjs';
import { sit } from './people.mjs';
import { say } from './timer.mjs';
import { setRedemptionStatus } from './twitch.mjs';

export async function handleRedemption(redemption, settings) {
  const { id, user_id, user_name, reward } = redemption;
  if (!needsReward(settings)) {
    await setRedemptionStatus(id, reward.id, 'CANCELED'); // Reward sollte aus sein; Punkte zurück
    return { ok: false, skipped: true };
  }
  const r = await sit(user_id, user_name, settings);
  const text = await seatReply(r, user_name, settings, { checkin: true });
  // Voll oder schon da: Punkte zurück; sonst als erledigt markieren
  await setRedemptionStatus(id, reward.id, r.status === 'seated' ? 'FULFILLED' : 'CANCELED');
  await say(settings, r.status === 'seated' ? text : `${text} Deine Punkte bekommst du zurück.`);
  return { ok: true, status: r.status };
}

export async function rewardState() {
  return (await db.get('config/state')) ?? {};
}
