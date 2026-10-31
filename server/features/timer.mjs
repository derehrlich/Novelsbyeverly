// Sprint-Timer mit festem Ablauf: Pomodoro → Pause, `repeats`-mal, dann Leerlauf. Anhalten und Fortsetzen jederzeit möglich.
// Es läuft kein eigener Zeitgeber pro Phase; der Takt (core/jobs.mjs, außerdem Overlay und Chat) ruft tick() auf,
// das fällige Phasenwechsel nachholt. Abgerechnet wird jeder Sprint genau einmal.
import { db } from '../core/store.mjs';
import { ITEMS, DEKO } from '../../public/js/katalog.mjs';
import { activeSeats, credit, sprintMinutes } from './people.mjs';
import { fill, fmtDuration, fmtNumber, once, pushEvent, streamDay } from '../core/util.mjs';
import { sendChat } from '../twitch/api.mjs';
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

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(n)) || lo));
const zyklus = (c) => (c ? { index: c.index, total: c.total } : null);

// Ein Abschnitt (Pomodoro oder Pause) beginnt. `cycle` ist der laufende Ablauf: { total, index, focusMin, breakMin }.
async function startPhase(phase, minutes, settings, round, now, { cycle = null, vorher = null } = {}) {
  const words = (await getWords(settings)).today;
  const t = {
    phase, round, startedAt: now, endsAt: now + minutes * 60_000,
    sprintId: phase === 'focus' ? `s${now}` : null,
    wordsAtStart: phase === 'focus' ? words : 0, minutes, cycle, paused: null,
  };
  await db.set(KEY, t);
  await pushEvent({ type: 'phase', phase, minutes, cycle: zyklus(cycle), vorher });
  return t;
}

// Startet einen neuen Ablauf: Pomodoro → Pause, `repeats`-mal. Eine laufende Runde wird vorher abgerechnet.
// Werte, die nicht angegeben sind, kommen aus den Einstellungen.
export async function startFocus(settings, minutes, now = Date.now(), { breakMinutes, repeats } = {}) {
  const current = await getTimer();
  if (current.phase === 'focus') await finalizeSprint(current, settings, now, { early: true });
  const cycle = { total: clamp(repeats ?? settings.repeats, 1, 20), index: 1, focusMin: clamp(minutes ?? settings.focusMinutes, 1, 180), breakMin: clamp(breakMinutes ?? settings.breakMinutes, 1, 60) };
  const t = await startPhase('focus', cycle.focusMin, settings, (current.round ?? 0) + 1, now, { cycle });
  if (settings.announceSprint) await say(settings, fill(settings.sprintStartTemplate, { minutes: cycle.focusMin, runde: 1, gesamt: cycle.total }));
  return t;
}

// Pause von Hand (z. B. früher als geplant). Der laufende Ablauf geht danach normal weiter.
export async function startBreak(settings, minutes, now = Date.now()) {
  const current = await getTimer();
  if (current.phase === 'focus') await finalizeSprint(current, settings, now, { early: true });
  const m = clamp(minutes ?? current.cycle?.breakMin ?? settings.breakMinutes, 1, 60);
  const t = await startPhase('break', m, settings, current.round ?? 0, now, { cycle: current.cycle ?? null });
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

// Anhalten und Fortsetzen: Die Zeit bleibt stehen, der Rest läuft nach dem Fortsetzen weiter.
export async function holdTimer(settings, now = Date.now()) {
  const t = await getTimer();
  if (t.phase === 'idle' || t.paused) return t;
  const neu = { ...t, paused: { at: now, remaining: Math.max(0, t.endsAt - now) } };
  await db.set(KEY, neu);
  await pushEvent({ type: 'hold', on: true });
  if (settings.announceSprint) await say(settings, '⏸️ Timer angehalten.');
  return neu;
}
export async function resumeTimer(settings, now = Date.now()) {
  const t = await getTimer();
  if (!t.paused) return t;
  const shift = now - t.paused.at;
  const neu = { ...t, startedAt: t.startedAt + shift, endsAt: t.endsAt + shift, paused: null };
  await db.set(KEY, neu);
  await pushEvent({ type: 'hold', on: false });
  if (settings.announceSprint) await say(settings, '▶️ Weiter geht’s!');
  return neu;
}

/** Holt fällige Phasenwechsel nach. Gibt den aktuellen Stand zurück. Angehaltene Timer bleiben stehen. */
export async function tick(settings, now = Date.now()) {
  let t = await getTimer();
  for (let guard = 0; t.phase !== 'idle' && !t.paused && now >= t.endsAt && guard < 40; guard += 1) {
    const at = t.endsAt;
    if (t.phase === 'focus') { // Pomodoro vorbei: abrechnen, dann immer die Pause
      await finalizeSprint(t, settings, at);
      const mins = t.cycle?.breakMin ?? settings.breakMinutes;
      t = { ...t, phase: 'break', sprintId: null, startedAt: at, endsAt: at + mins * 60_000, minutes: mins, wordsAtStart: 0 };
      await db.set(KEY, t);
      if (await once(`break-${at}`)) {
        await pushEvent({ type: 'phase', phase: 'break', minutes: mins, cycle: zyklus(t.cycle), vorher: 'focus' });
        if (settings.announceSprint) await say(settings, fill(settings.breakTemplate, { minutes: mins }));
      }
    } else if (t.cycle && t.cycle.index < t.cycle.total) { // Pause vorbei: nächster Durchgang
      const cycle = { ...t.cycle, index: t.cycle.index + 1 };
      const words = (await getWords(settings)).today;
      t = { phase: 'focus', round: t.round + 1, startedAt: at, endsAt: at + cycle.focusMin * 60_000, sprintId: `s${at}`, wordsAtStart: words, minutes: cycle.focusMin, cycle, paused: null };
      await db.set(KEY, t);
      if (await once(`focus-${at}`)) {
        await pushEvent({ type: 'phase', phase: 'focus', minutes: cycle.focusMin, cycle: zyklus(cycle), vorher: 'break' });
        if (settings.announceSprint) await say(settings, fill(settings.sprintStartTemplate, { minutes: cycle.focusMin, runde: cycle.index, gesamt: cycle.total }));
      }
    } else { // letzte Pause vorbei: der Ablauf ist fertig
      const gesamt = t.cycle?.total ?? 0;
      t = { ...IDLE, round: t.round };
      await db.set(KEY, t);
      if (await once(`ende-${at}`)) {
        await pushEvent({ type: 'phase', phase: 'idle', vorher: 'break', sessionEnde: gesamt > 0, gesamt });
        if (gesamt > 0 && settings.announceSprint) await say(settings, fill(settings.sessionEndTemplate, { gesamt }));
      }
    }
  }
  return t;
}
