// Aufgaben pro Person (task/<id>): { name, items: [{ id, text, done, at, doneAt }] }
import { db } from '../core/store.mjs';
import { pushEvent } from '../core/util.mjs';

const KEEP_DONE = 5; // erledigte Einträge, die gespeichert bleiben
const SHOW_DONE_MS = 30 * 60_000; // so lange bleibt Erledigtes im Overlay sichtbar

export const cleanText = (t) => String(t ?? '').replace(/\s+/g, ' ').replace(/[<>]/g, '').trim().slice(0, 70);

export async function getTasks(id) {
  return (await db.get(`task/${id}`)) ?? { name: '', items: [] };
}

export async function addTask(id, name, text, max, now = Date.now()) {
  const clean = cleanText(text);
  if (!clean) return { error: 'empty' };
  const t = await getTasks(id);
  if (t.items.filter((i) => !i.done).length >= max) return { error: 'full', max };
  const item = { id: now.toString(36) + Math.random().toString(36).slice(2, 5), text: clean, done: false, at: now, doneAt: null };
  t.name = name || t.name;
  t.items.push(item);
  await db.set(`task/${id}`, t);
  return { item };
}

// which = Nummer unter den offenen (1 = erste); ohne Angabe die älteste offene
export async function completeTask(id, name, which, now = Date.now()) {
  const t = await getTasks(id);
  const open = t.items.filter((i) => !i.done);
  const item = open[(which ?? 1) - 1];
  if (!item) return { error: open.length ? 'unknown' : 'none' };
  item.done = true;
  item.doneAt = now;
  t.name = name || t.name;
  const pos = new Map(t.items.map((i, n) => [i.id, n])); // bei gleicher Zeit bleibt die Reihenfolge des Anlegens
  const done = t.items.filter((i) => i.done).slice(-KEEP_DONE);
  t.items = [...done, ...t.items.filter((i) => !i.done)].sort((a, b) => a.at - b.at || pos.get(a.id) - pos.get(b.id));
  await db.set(`task/${id}`, t);
  await pushEvent({ type: 'taskdone', name: t.name || name, text: item.text, id });
  return { item, left: open.length - 1 };
}

export async function removeTask(id, itemId) {
  const t = await getTasks(id);
  t.items = t.items.filter((i) => i.id !== itemId);
  await db.set(`task/${id}`, t);
}

export const clearTasks = (id) => db.delete(`task/${id}`);

// Was das Overlay zeigt: offene Aufgaben und kürzlich Erledigtes
export const visibleTasks = (t, now = Date.now(), limit = 4) =>
  t.items.filter((i) => !i.done || now - i.doneAt < SHOW_DONE_MS).slice(-limit).map((i) => ({ id: i.id, text: i.text, done: i.done }));
