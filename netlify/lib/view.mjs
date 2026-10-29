// Alles, was das Overlay zum Zeichnen braucht (GET /api/overlay).
import { db } from './store.mjs';
import { RAENGE, unlockedDeko } from '../../public/js/katalog.mjs';
import { activeSeats, capacity, communityMinutes, resolveSlots } from './people.mjs';
import { eventCursor } from './util.mjs';
import { tick } from './timer.mjs';
import { getTasks, visibleTasks } from './tasks.mjs';
import { getWords, viewerWordsToday } from './words.mjs';
import { storedTokens } from './twitch.mjs';

export const STREAMER_TASKS = 'streamer'; // Aufgaben-Schlüssel, falls Twitch noch nicht verbunden ist

export async function streamerId() {
  return (await storedTokens('broadcaster'))?.user_id ?? STREAMER_TASKS;
}

export async function buildView(settings, since, now = Date.now()) {
  const timer = await tick(settings, now);
  const seats = resolveSlots(await activeSeats(settings, now), capacity(settings));
  const keys = await db.list('event/');
  const cursor = keys.at(-1) ?? eventCursor(now);

  const words = await getWords(settings, new Date(now));
  const community = await communityMinutes();
  const sid = await streamerId();
  const streamerTasks = visibleTasks(await getTasks(sid), now, 5);
  const people = [];
  for (const s of seats) {
    people.push({ id: s.id, name: s.name, slot: s.slot, figure: s.figure, rank: RAENGE.find((r) => r.id === s.rank)?.label ?? '', tasks: visibleTasks(await getTasks(s.id), now, 2) });
  }

  const view = {
    now,
    scene: settings.scene,
    deco: settings.unlocksEnabled ? unlockedDeko(community) : unlockedDeko(Infinity),
    timer: { phase: timer.phase, round: timer.round, startedAt: timer.startedAt, endsAt: timer.endsAt, minutes: timer.minutes ?? null, wordsAtStart: timer.wordsAtStart ?? 0 },
    words: { today: words.today, goal: words.goal, chat: await viewerWordsToday(settings) },
    streamerTasks,
    seats: people,
    communityHours: Math.floor(community / 60),
  };

  if (!since) return { cursor, events: [], ...view };
  const events = [];
  for (const key of keys.filter((k) => k > since)) {
    const ev = await db.get(key);
    if (ev) events.push(ev);
  }
  return { cursor: since > cursor ? since : cursor, events, ...view };
}
