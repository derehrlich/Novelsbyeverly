// Streak: Stream-Tage in Folge, in denen eine Person eingecheckt war. Wird nie gespeichert, sondern aus den Besuchstagen berechnet.
// Speicher: streamday/<Tag> = Tage, an denen mindestens eine Person eingecheckt war.
import { db } from './store.mjs';

// Stream-Tage nachtragen, wenn es sie noch nicht gibt (Besuche aus der Zeit vor den Streaks): aus den Check-in-Sperren und den Besuchstagen aller Personen.
export async function getStreamDays() {
  const state = (await db.get('config/state')) ?? {};
  if (!state.streamDaysSeeded) {
    for (const key of await db.list('checked/')) await db.setIfNew(`streamday/${key.split('/')[1]}`, 1);
    const users = (await db.list('user/')).filter((k) => !k.startsWith('user/test-'));
    for (let i = 0; i < users.length; i += 25) {
      for (const u of await Promise.all(users.slice(i, i + 25).map((k) => db.get(k)))) for (const d of u?.days ?? []) await db.setIfNew(`streamday/${d}`, 1);
    }
    await db.set('config/state', { ...((await db.get('config/state')) ?? {}), streamDaysSeeded: true });
  }
  return (await db.list('streamday/')).map((k) => k.slice(10)).sort();
}

/**
 * Streak über alle Stream-Tage. Ein verpasster Stream wird bis zur Schonfrist (grace) verziehen, danach reißt die Streak.
 * Der heutige Tag ist erst nach seinem Ende ein Fehltag. Rückgabe: aktuelle Streak und persönlicher Rekord.
 */
export function computeStreak({ days = [], saved = [] }, streamDays, today, grace) {
  const attended = new Set(days);
  const bridged = new Set(saved); // vom Streak-Retter überbrückte Tage: zählen nicht mit, reißen aber auch nicht
  let current = 0, record = 0, misses = 0;
  for (const d of streamDays) {
    if (d > today) break;
    if (attended.has(d)) { current++; misses = 0; record = Math.max(record, current); }
    else if (bridged.has(d)) misses = 0;
    else if (d === today) continue;
    else if (++misses > grace) current = 0;
  }
  return { current, record };
}

// Wie viele Stream-Tage zurück eine Lücke liegen darf, damit der Streak-Retter sie noch schließt
export const RESCUE_WINDOW = 7;

/**
 * Lücke, die der Streak-Retter schließen kann: die jüngste Folge verpasster Stream-Tage seit dem ersten Besuch.
 * status: 'ok' (rettbar, days = die Tage), 'none' (keine Lücke oder schon verziehen), 'toolong' (zu lang oder zu lange her)
 */
export function findRescue({ days = [], saved = [] }, streamDays, today, grace, maxDays) {
  const attended = new Set(days);
  const bridged = new Set(saved);
  const first = [...days].sort()[0];
  const past = streamDays.filter((d) => d < today && first && d >= first);
  let run = [], last = [];
  for (const d of past) {
    if (attended.has(d) || bridged.has(d)) { if (run.length) last = run; run = []; }
    else run.push(d);
  }
  if (run.length) last = run; // die Lücke reicht bis gestern
  if (last.length <= grace) return { status: 'none', days: [] };
  const recent = past.slice(-RESCUE_WINDOW).includes(last.at(-1));
  if (last.length > maxDays || !recent) return { status: 'toolong', days: last };
  return { status: 'ok', days: last };
}

export async function streakFor(userId, today, settings) {
  const user = await db.get(`user/${userId}`);
  if (!user) return { current: 0, record: 0 };
  return computeStreak(user, await getStreamDays(), today, settings.streakGrace);
}

// "10, 25 50" -> [10, 25, 50]
export const parseLevels = (v) => [...new Set(String(v ?? '').split(/[\s,;]+/).map(Number).filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b);
