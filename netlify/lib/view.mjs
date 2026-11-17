// Alles, was das Overlay zum Zeichnen braucht (GET /api/overlay).
import { db } from './store.mjs';
import { RAENGE, unlockedDeko } from '../../public/js/katalog.mjs';
import { activeSeats, capacity, communityMinutes, resolveSlots } from './people.mjs';
import { eventCursor } from './util.mjs';
import { getTimer, sprintsToday, tick } from './timer.mjs';
import { getTasks, visibleTasks } from './tasks.mjs';
import { getWords, viewerWordsToday } from './words.mjs';
import { storedTokens } from './twitch.mjs';
import { getMusik } from './musik.mjs';
import { resolveSeason, resolveTime } from './zeiten.mjs';
import { getPages } from './pages.mjs';
import { fmtHM, streamInfo } from './streamzeit.mjs';
import { cleanFigur } from '../../public/js/katalog.mjs';

export const STREAMER_TASKS = 'streamer'; // Aufgaben-Schlüssel, falls Twitch noch nicht verbunden ist

export async function streamerId() {
  return (await storedTokens('broadcaster'))?.user_id ?? STREAMER_TASKS;
}

const frac = (n, goal) => (goal > 0 ? n / goal : 0);

// Die Ziel-Karte (Wörter, Seiten, Streamzeit oder Pomodoros) und die Streamzeit für die Landschaft
export async function buildZiel(settings, { words, done, now }) {
  const stream = await streamInfo(now);
  const elapsed = stream.startedAt ? Math.max(0, now - stream.startedAt) : 0;
  const goalMs = settings.streamGoalMinutes * 60_000;
  const zeit = { startedAt: stream.startedAt, quelle: stream.quelle, goalMinutes: settings.streamGoalMinutes, text: fmtHM(elapsed), goalText: fmtHM(goalMs), fraction: frac(elapsed, goalMs) };
  let ziel;
  if (settings.zielArt === 'seiten') {
    const pages = await getPages(settings, new Date(now));
    ziel = { art: 'seiten', label: 'Seiten heute', numeric: true, current: pages.today, goal: settings.seitenGoal, fraction: frac(pages.today, settings.seitenGoal) };
  } else if (settings.zielArt === 'zeit') {
    ziel = { art: 'zeit', label: 'Streamzeit', numeric: false, ...zeit, current: elapsed / 60_000, goal: settings.streamGoalMinutes };
  } else if (settings.zielArt === 'pomodoros') {
    ziel = { art: 'pomodoros', label: 'Pomodoros heute', numeric: true, current: done, goal: settings.pomodoroGoal, fraction: frac(done, settings.pomodoroGoal) };
  } else {
    ziel = { art: 'woerter', label: 'Wörter heute', numeric: true, current: words.today, goal: settings.wordGoal, fraction: frac(words.today, settings.wordGoal) };
  }
  return { ziel, zeit };
}

// preview: Vorschau im Admin mit noch nicht gespeicherten Einstellungen. Dann wird der Timer nur gelesen, nie weitergeschaltet.
export async function buildView(settings, since, now = Date.now(), { preview = false } = {}) {
  const timer = preview ? await getTimer() : await tick(settings, now);
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
  const { ziel, zeit } = await buildZiel(settings, { words, done, now });
  const q = settings.wachstumQuelle;
  const progress = q === 'zeit' ? zeit.fraction
    : q === 'woerter' ? words.today / (settings.wordGoal || 1000)
      : q === 'pomodoro' ? done / (settings.pomodoroGoal || 6)
        : q === 'kombi' ? (zeit.fraction + ziel.fraction) / 2
          : ziel.fraction;
  const taetigkeit = settings.stefanieTaetigkeit === 'auto' ? (timer.phase === 'break' ? 'buch' : 'laptop') : settings.stefanieTaetigkeit;
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
    ziel,
    zeit: { startedAt: zeit.startedAt, quelle: zeit.quelle, goalMinutes: zeit.goalMinutes, fraction: zeit.fraction },
    stefanie: { figur: cleanFigur(settings.stefanieFigur), taetigkeit },
    layout: settings.layout,
    stil: settings.kartenStil,
    glas: { farbe: settings.glasFarbe, staerke: settings.glasStaerke, unschaerfe: settings.glasUnschaerfe },
    hintergrund: settings.hintergrund === 'bild' && settings.hintergrundVersion ? { mode: 'bild', url: `/api/overlay-bg?v=${settings.hintergrundVersion}` } : { mode: 'landschaft' },
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
