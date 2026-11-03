// Gelesene Seiten heute (Ziel "Seiten lesen"). Gespeichert wird nur die Zahl des aktuellen Stream-Tags.
import { db } from '../core/store.mjs';
import { streamDay } from '../core/util.mjs';

export async function getPages(settings, now = new Date()) {
  const day = streamDay(settings, now);
  const s = (await db.get('state/pages')) ?? { day, n: 0 };
  return { day, today: s.day === day ? s.n : 0, goal: settings.seitenGoal };
}

export async function setPages(n, settings) {
  const day = streamDay(settings);
  await db.set('state/pages', { day, n: Math.max(0, Math.round(n)) });
  return getPages(settings);
}

export async function addPages(delta, settings) {
  const { today } = await getPages(settings);
  return setPages(today + delta, settings);
}
