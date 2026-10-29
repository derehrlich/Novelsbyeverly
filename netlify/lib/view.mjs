// Alles, was das Overlay zum Zeichnen braucht (GET /api/overlay).
import { db } from './store.mjs';
import { RAENGE, unlockedDeko } from '../../public/js/katalog.mjs';
import { activeSeats, capacity, communityMinutes, resolveSlots } from './people.mjs';
import { eventCursor } from './util.mjs';
import { sprintsToday, tick } from './timer.mjs';
import { getTasks, visibleTasks } from './tasks.mjs';
import { getWords, viewerWordsToday } from './words.mjs';
import { storedTokens } from './twitch.mjs';
import { getMusik } from './musik.mjs';
import { resolveSeason, resolveTime } from './zeiten.mjs';

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
  const streamerTasks = visibleTasks(await getTasks(sid), now, 7);
  const people = [];
  for (const s of settings.szeneModus === 'zimmer' ? seats : []) {
    people.push({ id: s.id, name: s.name, slot: s.slot, figure: s.figure, rank: RAENGE.find((r) => r.id === s.rank)?.label ?? '', tasks: visibleTasks(await getTasks(s.id), now, 2) });
  }

  const done = await sprintsToday(settings, now);
  const progress = settings.wachstumQuelle === 'pomodoro'
    ? done / (settings.pomodoroGoal || 6)
    : words.today / (settings.wordGoal || 1000);
  const musik = settings.musikQuelle === 'aus' ? null : settings.musikQuelle === 'lokal'
    ? { mode: 'lokal', url: settings.musikUrl }
    : { mode: 'server', now: await getMusik(now) };

  const view = {
    now,
    modus: settings.szeneModus,
    jahreszeit: resolveSeason(settings, new Date(now)),
    tageszeit: resolveTime(settings, new Date(now)),
    progress: Math.min(1, Math.max(0, progress)),
    pomodoro: { done, goal: settings.pomodoroGoal, minutes: settings.focusMinutes },
    layout: settings.layout,
    musik,
    scene: settings.scene,
    deco: !settings.moduleDeko ? [] : settings.unlocksEnabled ? unlockedDeko(community) : unlockedDeko(Infinity),
    modules: { blume: settings.moduleBlume, kerze: settings.moduleKerze, buecher: settings.moduleBuecher },
    sprintsToday: done,
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
