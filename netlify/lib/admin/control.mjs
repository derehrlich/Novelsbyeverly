// Steuerung aus dem Admin: Timer, Wörter, Aufgaben der Streamerin, Plätze und Tests.
import { db } from '../store.mjs';
import { getSettings, saveSettings } from '../settings.mjs';
import { activeSeats, newUser, saveUser, sit } from '../people.mjs';
import { startBreak, startFocus, stopTimer, tick } from '../timer.mjs';
import { addWords, getWords, resetDay, setAbsolute, setToday } from '../words.mjs';
import { addTask, clearTasks, completeTask, getTasks, removeTask } from '../tasks.mjs';
import { streamerId } from '../view.mjs';
import { pushEvent, streamDay } from '../util.mjs';
import { clearMusik, getMusik, setMusik } from '../musik.mjs';
import { addPages, getPages, setPages } from '../pages.mjs';
import { fmtHM, startStream, stopStream, streamInfo } from '../streamzeit.mjs';
import { getTode, todeAktion } from '../tode.mjs';
import { json } from '../http.mjs';

const num = (v) => (Number.isFinite(Number(v)) && v !== '' && v !== null ? Number(v) : null);

export async function timer({ route, method, body }) {
  if (route[0] !== 'timer' || method !== 'POST') return;
  const settings = await getSettings();
  const minutes = num(body.minutes) > 0 ? num(body.minutes) : undefined;
  if (route[1] === 'focus') return json({ timer: await startFocus(settings, minutes) });
  if (route[1] === 'break') return json({ timer: await startBreak(settings, minutes) });
  if (route[1] === 'stop') return json({ timer: await stopTimer(settings) });
  if (route[1] === 'tick') return json({ timer: await tick(settings) });
  if (route[1] === 'count') { // Pomodoros von Hand zählen (z. B. Arbeit ohne Timer)
    const key = `stats/sprints-${streamDay(settings)}`;
    const n = Math.max(0, ((await db.get(key)) ?? { n: 0 }).n + Math.round(Number(body.delta) || 0));
    await db.set(key, { n });
    return json({ done: n });
  }
}

export async function words({ route, method, body }) {
  if (route[0] !== 'words') return;
  const settings = await getSettings();
  if (method === 'GET') return json(await getWords(settings));
  if (method !== 'POST') return;
  const n = num(body.value);
  if (body.mode === 'reset') return json(await resetDay(settings));
  if (n === null || n < 0) return json({ error: 'Bitte eine Zahl eingeben' }, 400);
  const w = body.mode === 'delta' ? await addWords(Math.round(n), settings) : body.mode === 'today' ? await setToday(Math.round(n), settings) : await setAbsolute(Math.round(n), settings);
  return json(w);
}

// Aufgaben der Streamerin
export async function tasks({ route, method, body }) {
  if (route[0] !== 'tasks') return;
  const sid = await streamerId();
  if (method === 'GET') return json({ items: (await getTasks(sid)).items });
  if (method === 'POST' && route[1] === 'done') {
    const open = (await getTasks(sid)).items.filter((i) => !i.done);
    const index = open.findIndex((i) => i.id === body.id);
    const r = await completeTask(sid, 'Streamerin', index < 0 ? 99 : index + 1);
    return r.error ? json({ error: 'Aufgabe nicht gefunden' }, 404) : json({ ok: true });
  }
  if (method === 'POST') {
    const r = await addTask(sid, 'Streamerin', body.text, 10);
    return r.error ? json({ error: r.error === 'full' ? 'Zu viele offene Aufgaben' : 'Bitte einen Text eingeben' }, 400) : json({ item: r.item });
  }
  if (method === 'DELETE' && route[1] === 'all') { await clearTasks(sid); return json({ ok: true }); }
  if (method === 'DELETE') { await removeTask(sid, route[1]); return json({ ok: true }); }
}

export async function seats({ route, method, body }) {
  if (route[0] !== 'seats') return;
  const settings = await getSettings();
  if (method === 'GET') return json({ seats: await activeSeats(settings) });
  if (method === 'DELETE') { // einen Platz oder alle freigeben
    if (route[1]) await db.delete(`seat/${route[1]}`);
    else for (const key of await db.list('seat/')) await db.delete(key);
    return json({ ok: true });
  }
  if (method === 'POST' && route[1] === 'scene') {
    const { settings: saved, error } = await saveSettings({ scene: body.scene });
    return error ? json({ error }, 400) : json({ scene: saved.scene });
  }
}

const TEST_NAMES = ['Lena', 'Marie', 'Jonas', 'Sophie', 'Paul', 'Emma', 'Noah', 'Mia', 'Ben', 'Lotta'];

export async function tests({ route, method, body }) {
  if (route[0] !== 'test' || method !== 'POST') return;
  const settings = await getSettings();
  if (route[1] === 'seats') { // Testfiguren setzen (mit Arbeitszeit, damit Gegenstände zu sehen sind)
    const n = Math.min(10, Math.max(1, num(body.count) ?? 5));
    for (let i = 0; i < n; i += 1) {
      const id = `test-${i}`;
      const user = newUser(id, TEST_NAMES[i % TEST_NAMES.length]);
      user.minutes = [30, 90, 200, 400, 800, 1600, 3200, 6000, 12000, 0][i % 10];
      await saveUser(id, user);
      await sit(id, user.name, settings);
    }
    return json({ ok: true });
  }
  if (route[1] === 'clear') {
    for (const key of await db.list('seat/')) if (key.startsWith('seat/test-')) await db.delete(key);
    return json({ ok: true });
  }
  if (route[1] === 'event') {
    const kinds = {
      sprint: { type: 'sprint', writers: 6, minutes: 25, streamerWords: 420, early: false },
      goal: { type: 'goal', words: 1000 },
      rankup: { type: 'rankup', name: 'Lena', rank: 'Federkiel' },
      unlock: { type: 'unlock', name: 'Lena', item: 'Katze' },
      deko: { type: 'deko', item: 'Lichterkette' },
      taskdone: { type: 'taskdone', name: 'Lena', text: 'Kapitel 3 überarbeiten' },
    };
    if (!kinds[body.kind]) return json({ error: 'Unbekannter Test' }, 400);
    await pushEvent(kinds[body.kind]);
    return json({ ok: true });
  }
}

// Musik von Hand setzen oder löschen (wenn kein Hilfsprogramm läuft)
export async function musik({ route, method, body }) {
  if (route[0] !== 'musik') return;
  if (method === 'GET') return json({ musik: await getMusik() });
  if (method === 'POST') {
    if (!String(body.title ?? '').trim()) return json({ error: 'Bitte einen Titel eingeben' }, 400);
    await setMusik(body, { manual: true });
    return json({ musik: await getMusik() });
  }
  if (method === 'DELETE') { await clearMusik(); return json({ ok: true }); }
}

// Gelesene Seiten heute
export async function pages({ route, method, body }) {
  if (route[0] !== 'pages') return;
  const settings = await getSettings();
  if (method === 'GET') return json(await getPages(settings));
  if (method !== 'POST') return;
  const n = num(body.value);
  if (n === null || n < 0) return json({ error: 'Bitte eine Zahl eingeben' }, 400);
  return json(body.mode === 'delta' ? await addPages(Math.round(n), settings) : await setPages(Math.round(n), settings));
}

// Streamzeit starten und beenden (sonst erkennt das Overlay einen laufenden Twitch-Stream selbst)
export async function stream({ route, method }) {
  if (route[0] !== 'stream') return;
  const settings = await getSettings();
  if (method === 'POST' && route[1] === 'start') await startStream();
  else if (method === 'POST' && route[1] === 'stop') await stopStream();
  else if (method !== 'GET') return;
  const info = await streamInfo();
  return json({ startedAt: info.startedAt, quelle: info.quelle, goalMinutes: settings.streamGoalMinutes, text: info.startedAt ? fmtHM(Date.now() - info.startedAt) : null });
}

// Deathcounter der Gaming-Szene
export async function tode({ route, method, body }) {
  if (route[0] !== 'tode') return;
  if (method === 'GET') return json(await getTode());
  if (method !== 'POST') return;
  const r = await todeAktion(body.aktion, body.wert);
  return r ? json(r) : json({ error: 'Unbekannte Aktion' }, 400);
}
