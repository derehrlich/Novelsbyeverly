// Personen, Sitzplätze, Arbeitszeit und Freischaltungen.
import { db } from './store.mjs';
import { DEKO, ITEMS, MAX_PLAETZE, SZENEN, cleanFigur, rankFor, startFigur } from '../../public/js/katalog.mjs';
import { streamDay } from './util.mjs';

// Reihenfolge, in der Plätze vergeben werden: erst die Mitte, damit es nie leer und schief aussieht
const SLOT_ORDER = [2, 7, 0, 5, 4, 9, 1, 6, 3, 8];

export async function getUser(id) {
  return (await db.get(`user/${id}`)) ?? null;
}

export function newUser(id, name) {
  return { name, minutes: 0, sprints: 0, words: 0, days: [], figure: startFigur(id), lastSlot: null };
}

export async function getOrCreateUser(id, name) {
  const user = (await getUser(id)) ?? newUser(id, name);
  user.name = name || user.name;
  return user;
}

export const saveUser = (id, user) => db.set(`user/${id}`, user);

// Figur ohne gesperrte Gegenstände (wenn Freischaltungen aus sind, ist alles erlaubt)
export const figureOf = (user, settings) => cleanFigur(user.figure, settings.unlocksEnabled ? user.minutes : Infinity);

export const capacity = (settings) => Math.min(settings.maxSeats, MAX_PLAETZE);
export const isExpired = (seat, settings, now = Date.now()) => now - seat.lastActive > settings.seatIdleMinutes * 60_000;

// Alle Sitzenden, die ihren Platz noch haben (älteste zuerst). Abgelaufene Plätze werden gleich aufgeräumt.
export async function activeSeats(settings, now = Date.now()) {
  const seats = [];
  for (const key of await db.list('seat/')) {
    const seat = await db.get(key);
    if (!seat) continue;
    const id = key.slice(5);
    if (isExpired(seat, settings, now)) await db.delete(key);
    else seats.push({ id, ...seat });
  }
  return seats.sort((a, b) => a.since - b.since || a.id.localeCompare(b.id));
}

// Legt fest, wer wo sitzt. Zwei Personen mit demselben Platz (gleichzeitiges Hinsetzen) oder ein Platz außerhalb der
// erlaubten Anzahl bekommen den nächsten freien; reicht der Platz nicht, bleibt die Person unsichtbar.
export function resolveSlots(seats, cap) {
  const used = new Set();
  const placed = [];
  const rest = [];
  for (const s of seats) {
    if (Number.isInteger(s.slot) && s.slot < cap && !used.has(s.slot)) { used.add(s.slot); placed.push({ ...s }); } else rest.push(s);
  }
  for (const s of rest) {
    const slot = SLOT_ORDER.find((x) => x < cap && !used.has(x));
    if (slot === undefined) continue;
    used.add(slot);
    placed.push({ ...s, slot });
  }
  return placed;
}

export async function getSeat(id) {
  return db.get(`seat/${id}`);
}

/** Setzt eine Person hin. status: 'seated' | 'already' | 'full' */
export async function sit(id, name, settings, now = Date.now()) {
  const user = await getOrCreateUser(id, name);
  const day = streamDay(settings, new Date(now));
  const firstToday = !user.days.includes(day);
  if (firstToday) user.days = [...user.days, day].sort();
  const existing = await getSeat(id);
  if (existing && !isExpired(existing, settings, now)) {
    existing.lastActive = now;
    await db.set(`seat/${id}`, existing);
    if (firstToday) await saveUser(id, user);
    return { status: 'already', seat: existing, user, firstToday };
  }
  const taken = resolveSlots(await activeSeats(settings, now), capacity(settings));
  const used = new Set(taken.map((s) => s.slot));
  const cap = capacity(settings);
  const slot = Number.isInteger(user.lastSlot) && user.lastSlot < cap && !used.has(user.lastSlot) ? user.lastSlot : SLOT_ORDER.find((x) => x < cap && !used.has(x));
  if (slot === undefined) return { status: 'full', user };
  const seat = { name: user.name, slot, since: now, lastActive: now, figure: figureOf(user, settings), rank: rankFor(user.minutes).id, creditedSprint: null };
  user.lastSlot = slot;
  await saveUser(id, user);
  await db.set(`seat/${id}`, seat);
  return { status: 'seated', seat, user, firstToday };
}

// Wer im Chat schreibt, behält seinen Platz. Höchstens alle 30 Sekunden schreiben, das reicht.
export async function touchSeat(id, now = Date.now()) {
  const seat = await getSeat(id);
  if (!seat || now - seat.lastActive < 30_000) return;
  seat.lastActive = now;
  await db.set(`seat/${id}`, seat);
}

// Minuten, die eine Person im laufenden Sprint bis "until" mitgearbeitet hat (und noch nicht gutgeschrieben bekam)
export function sprintMinutes(seat, timer, until) {
  if (timer?.phase !== 'focus' || !timer.sprintId || seat.creditedSprint === timer.sprintId) return 0;
  const from = Math.max(timer.startedAt, seat.since);
  return Math.max(0, Math.round((Math.min(until, timer.endsAt) - from) / 60_000));
}

/**
 * Schreibt Arbeitsminuten gut: persönlich, für das Zimmer, und meldet, was dadurch neu freigeschaltet wurde.
 * Ergebnis: { user, rankUp (neuer Rang oder null), items (neue Gegenstände), deko (neue Zimmer-Dekoration) }
 */
export async function credit(id, name, minutes, { sprint = true } = {}) {
  const user = await getOrCreateUser(id, name);
  const before = user.minutes;
  user.minutes += minutes;
  if (sprint) user.sprints += 1;
  await saveUser(id, user);
  const community = (await db.get('stats/community')) ?? { minutes: 0 };
  const communityBefore = community.minutes;
  community.minutes += minutes;
  await db.set('stats/community', community);
  const rankBefore = rankFor(before);
  const rankAfter = rankFor(user.minutes);
  return {
    user,
    rankUp: rankAfter.id !== rankBefore.id ? rankAfter : null,
    items: ITEMS.filter((i) => before < i.hours * 60 && user.minutes >= i.hours * 60),
    deko: DEKO.filter((d) => communityBefore < d.hours * 60 && community.minutes >= d.hours * 60),
  };
}

export async function communityMinutes() {
  return ((await db.get('stats/community')) ?? { minutes: 0 }).minutes;
}

/** Steht auf. Laufende Sprint-Minuten werden vorher gutgeschrieben. Ergebnis: null (saß nicht) oder { seat, credited } */
export async function leave(id, name, settings, timer, now = Date.now()) {
  const seat = await getSeat(id);
  if (!seat) return null;
  const minutes = isExpired(seat, settings, now) ? 0 : sprintMinutes(seat, timer, now);
  await db.delete(`seat/${id}`);
  const result = minutes > 0 ? await credit(id, name, minutes) : { user: await getOrCreateUser(id, name), rankUp: null, items: [], deko: [] };
  return { seat, minutes, ...result };
}

export const sceneOf = (settings) => SZENEN[settings.scene] ?? SZENEN.cafe;
