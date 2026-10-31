// Sprint-Timer: Fokus → Pause → (Leerlauf oder nächste Runde). Es läuft kein Hintergrundprozess; jeder Abruf (Overlay,
// Chat) ruft tick() auf, das fällige Phasenwechsel nachholt. Abgerechnet wird jeder Sprint genau einmal.
import { db } from './store.mjs';
import { ITEMS, DEKO } from '../../public/js/katalog.mjs';
import { activeSeats, credit, sprintMinutes } from './people.mjs';
import { fill, fmtDuration, fmtNumber, once, pushEvent, streamDay } from './util.mjs';
import { sendChat } from './twitch.mjs';
import { getWords } from './words.mjs';

const KEY = 'state/timer';
export const IDLE = { phase: 'idle', sprintId: null, round: 0, startedAt: null, endsAt: null, wordsAtStart: 0 };

export async function getTimer() {
  return (await db.get(KEY)) ?? { ...IDLE };
}

// Wie viele Sprints heute abgeschlossen wurden (für den Bücherstapel)
export async function sprintsToday(settings, now = Date.now()) {
  return ((await db.get(`stats/sprints-${streamDay(settings, new Date(now))}`)) ?? { n: 0 }).n;
}

export async function say(settings, text, opts) {
  if (!settings.chatEnabled || !text) return;
  await sendChat(text, opts).catch((e) => console.warn('Chat fehlgeschlagen:', e.message));
}

// Rang, neue Gegenstände und neue Zimmer-Dekoration verkünden (Overlay und Chat)
export async function announceCredit(result, settings) {
  if (!settings.unlocksEnabled) return;
  const { user, rankUp, items, deko } = result;
  const name = user.name;
  if (rankUp) {
    await pushEvent({ type: 'rankup', name, rank: rankUp.label });
    await say(settings, fill(settings.rankUpTemplate, { user: name, rank: rankUp.label, hours: fmtDuration(user.minutes) }));
  }
  for (const id of items.map((i) => i.id)) {
    const item = ITEMS.find((i) => i.id === id);
    await pushEvent({ type: 'unlock', name, item: item.label });
    await say(settings, fill(settings.unlockTemplate, { user: name, item: item.label, figur: `${settings.commandPrefix}figur` }));
  }
  for (const d of deko) {
    const deco = DEKO.find((x) => x.id === d.id);
    await pushEvent({ type: 'deko', item: deco.label });
    await say(settings, fill(settings.decoTemplate, { deko: deco.label }));
  }
}

// Sprint abrechnen: allen, die sitzen, die Minuten gutschreiben; Ergebnis ins Overlay und in den Chat
async function finalizeSprint(t, settings, until, { early = false } = {}) {
  if (!t.sprintId || !(await once(`end-${t.sprintId}`))) return null;
  const seats = await activeSeats(settings, until);
  let writers = 0;
  const results = [];
  for (const seat of seats) {
    const minutes = sprintMinutes(seat, t, until);
    if (minutes <= 0) continue;
    const result = await credit(seat.id, seat.name, minutes);
    seat.creditedSprint = t.sprintId;
    await db.set(`seat/${seat.id}`, (({ id, ...rest }) => rest)(seat));
    writers += 1;
    results.push(result);
  }
  const today = (await getWords(settings)).today;
  const streamerWords = Math.max(0, today - (t.wordsAtStart ?? 0));
  const minutes = Math.max(1, Math.round((until - t.startedAt) / 60_000));
  if (!early) {
    const key = `stats/sprints-${streamDay(settings, new Date(until))}`;
    await db.set(key, { n: ((await db.get(key)) ?? { n: 0 }).n + 1 });
  }
  const n = await sprintsToday(settings, until);
  await pushEvent({ type: 'sprint', writers, minutes, streamerWords, early, n, goal: settings.pomodoroGoal });
  if (settings.announceSprint) {
    const extra = streamerWords > 0 ? `, ${fmtNumber(streamerWords)} Wörter in dieser Runde` : '';
    await say(settings, early
      ? `⏹️ Pomodoro beendet nach ${fmtDuration(minutes)}.`
      : fill(settings.sprintEndTemplate, { writers, n, ziel: settings.pomodoroGoal ? ` von ${settings.pomodoroGoal}` : '', streamer: extra }));
  }
  for (const r of results) await announceCredit(r, settings);
  return { writers, streamerWords, n };
}

async function startPhase(phase, minutes, settings, round, now) {
  const words = (await getWords(settings)).today;
  const t = {
    phase, round, startedAt: now, endsAt: now + minutes * 60_000,
    sprintId: phase === 'focus' ? `s${now}` : null,
    wordsAtStart: words, focusMin: settings.focusMinutes, breakMin: settings.breakMinutes, minutes,
  };
  await db.set(KEY, t);
  await pushEvent({ type: 'phase', phase, minutes });
  return t;
}

export async function startFocus(settings, minutes, now = Date.now()) {
  const current = await getTimer();
  if (current.phase === 'focus') await finalizeSprint(current, settings, now, { early: true });
  const m = clamp(minutes ?? settings.focusMinutes, 1, 180);
  const t = await startPhase('focus', m, settings, (current.round ?? 0) + 1, now);
  if (settings.announceSprint) await say(settings, fill(settings.sprintStartTemplate, { minutes: m }));
  return t;
}

export async function startBreak(settings, minutes, now = Date.now()) {
  const current = await getTimer();
  if (current.phase === 'focus') await finalizeSprint(current, settings, now, { early: true });
  const m = clamp(minutes ?? settings.breakMinutes, 1, 60);
  const t = await startPhase('break', m, settings, current.round ?? 0, now);
  if (settings.announceSprint) await say(settings, fill(settings.breakTemplate, { minutes: m }));
  return t;
}

export async function stopTimer(settings, now = Date.now()) {
  const current = await getTimer();
  if (current.phase === 'focus') await finalizeSprint(current, settings, now, { early: true });
  const t = { ...IDLE, round: current.round ?? 0 };
  await db.set(KEY, t);
  await pushEvent({ type: 'phase', phase: 'idle' });
  return t;
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(n)) || lo));

/** Holt fällige Phasenwechsel nach. Gibt den aktuellen Stand zurück. */
export async function tick(settings, now = Date.now()) {
  let t = await getTimer();
  for (let guard = 0; t.phase !== 'idle' && now >= t.endsAt && guard < 8; guard += 1) {
    const at = t.endsAt;
    if (t.phase === 'focus') {
      await finalizeSprint(t, settings, at);
      if (settings.autoBreak) {
        const n = await sprintsToday(settings, at);
        const long = settings.longBreakEvery > 0 && n > 0 && n % settings.longBreakEvery === 0;
        const mins = long ? settings.longBreakMinutes : settings.breakMinutes;
        t = { ...t, phase: 'break', sprintId: null, startedAt: at, endsAt: at + mins * 60_000, minutes: mins, wordsAtStart: 0 };
        await db.set(KEY, t);
        if (await once(`break-${at}`)) {
          await pushEvent({ type: 'phase', phase: 'break', minutes: mins, long });
          if (settings.announceSprint) await say(settings, fill(long ? settings.longBreakTemplate : settings.breakTemplate, { minutes: mins, n }));
        }
      } else {
        t = { ...IDLE, round: t.round };
        await db.set(KEY, t);
      }
    } else if (settings.autoCycle) { // Pause vorbei: nächste Runde
      const words = (await getWords(settings)).today;
      t = { phase: 'focus', round: t.round + 1, startedAt: at, endsAt: at + settings.focusMinutes * 60_000, sprintId: `s${at}`, wordsAtStart: words, focusMin: settings.focusMinutes, breakMin: settings.breakMinutes, minutes: settings.focusMinutes };
      await db.set(KEY, t);
      if (await once(`focus-${at}`)) {
        await pushEvent({ type: 'phase', phase: 'focus', minutes: settings.focusMinutes });
        if (settings.announceSprint) await say(settings, fill(settings.sprintStartTemplate, { minutes: settings.focusMinutes }));
      }
    } else {
      t = { ...IDLE, round: t.round };
      await db.set(KEY, t);
    }
  }
  return t;
}
