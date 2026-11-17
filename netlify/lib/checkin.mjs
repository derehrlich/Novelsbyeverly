// Check-in-Reward (Kanalpunkte).
// Mit „checkinEnabled“ zählt er den Besuch (ein Check-in pro Stream-Tag), berechnet die Streak, feiert Meilensteine und zeigt ein Banner im Overlay.
// Ist außerdem „Erscheinen bei“ auf Check-in oder beides gestellt, setzt er zusätzlich die Figur im Zimmer-Modus hin.
// Ohne „checkinEnabled“ gilt wie bisher nur das Hinsetzen.
import { db } from './store.mjs';
import { needsReward, seatsOnReward } from './settings.mjs';
import { seatReply } from './chat.mjs';
import { getOrCreateUser, saveUser, sit } from './people.mjs';
import { say } from './timer.mjs';
import { setRedemptionStatus } from './twitch.mjs';
import { fill, pushEvent, streamDay } from './util.mjs';
import { parseLevels, streakFor } from './streak.mjs';

/** Trägt den Besuch ein. Pro Stream-Tag zählt nur einer; die Sperre ist atomar. */
export async function recordCheckIn(userId, userName, settings) {
  const day = streamDay(settings);
  const fresh = await db.setIfNew(`checked/${day}/${userId}`, 1);
  if (fresh) await db.setIfNew(`streamday/${day}`, 1); // Stream-Tag für die Streak-Berechnung
  const user = await getOrCreateUser(userId, userName);
  if (!fresh) return { isNew: false, count: user.days.includes(day) ? user.days.length : user.days.length + 1, day, user };
  user.days = user.days.includes(day) ? user.days : [...user.days, day].sort();
  user.first ??= new Date().toISOString();
  user.last = new Date().toISOString();
  await saveUser(userId, user);
  return { isNew: true, count: user.days.length, day, user };
}

async function visit(redemption, settings) {
  const { id, user_id, user_name, reward } = redemption;
  const result = await recordCheckIn(user_id, user_name, settings);
  const streak = await streakFor(user_id, result.day, settings);
  const vars = { user: user_name, count: result.count, streak: streak.current, record: streak.record };
  if (!result.isNew) {
    await say(settings, fill(settings.visitDuplicateTemplate, vars));
    await setRedemptionStatus(id, reward.id, 'CANCELED'); // Punkte zurück
    return { ok: true, status: 'duplicate' };
  }
  const milestone = settings.milestoneEnabled && parseLevels(settings.milestoneLevels).includes(result.count);
  await pushEvent({ type: 'checkin', name: user_name, count: result.count, streak: streak.current, milestone });
  await say(settings, fill(milestone ? settings.milestoneTemplate : settings.visitTemplate, vars));
  if (seatsOnReward(settings)) { // Zimmer-Modus: die Figur setzt sich auch hin (die Besuchsnachricht war schon die Antwort)
    const r = await sit(user_id, user_name, settings);
    await seatReply(r, user_name, settings, { checkin: true });
  }
  await setRedemptionStatus(id, reward.id, 'FULFILLED');
  return { ok: true, status: 'checkedin', count: result.count, streak: streak.current };
}

export async function handleRedemption(redemption, settings) {
  const { id, user_id, user_name, reward } = redemption;
  if (!needsReward(settings)) {
    await setRedemptionStatus(id, reward.id, 'CANCELED'); // Reward sollte aus sein; Punkte zurück
    return { ok: false, skipped: true };
  }
  if (settings.checkinEnabled) return visit(redemption, settings);
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
