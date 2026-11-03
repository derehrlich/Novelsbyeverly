// Wortzähler der Streamerin. Quelle der Zahl: Chatbefehl, Admin oder die Schnittstelle /api/words (später ein Hilfsprogramm).
// Gespeichert wird der Stand aus der Statuszeile (abs) und der Stand zu Tagesbeginn (base); "heute" ist die Differenz.
import { db } from '../core/store.mjs';
import { fill, fmtNumber, once, pushEvent, streamDay } from '../core/util.mjs';
import { sendChat } from '../twitch/api.mjs';

const KEY = 'state/words';

export async function getWords(settings, now = new Date()) {
  const day = streamDay(settings, now);
  const s = (await db.get(KEY)) ?? { day, abs: null, base: null };
  if (s.day !== day) { // neuer Tag: der letzte Stand ist der neue Ausgangspunkt
    s.day = day;
    s.base = s.abs;
  }
  const today = s.abs == null ? 0 : Math.max(0, s.abs - (s.base ?? s.abs));
  return { ...s, today, goal: settings.wordGoal };
}

async function save(s, settings, before) {
  await db.set(KEY, { day: s.day, abs: s.abs, base: s.base });
  const today = s.abs == null ? 0 : Math.max(0, s.abs - (s.base ?? s.abs));
  if (settings.wordGoal > 0 && before < settings.wordGoal && today >= settings.wordGoal && (await once(`goal-${s.day}`))) {
    await pushEvent({ type: 'goal', words: today });
    if (settings.chatEnabled) await sendChat(fill(settings.goalTemplate, { words: fmtNumber(today) })).catch((e) => console.warn('Chat fehlgeschlagen:', e.message));
  }
  return { ...s, today, goal: settings.wordGoal };
}

// Stand aus der Statuszeile von Papyrus (Gesamtzahl des Dokuments). Der erste Wert des Tages ist der Ausgangspunkt,
// es sei denn, der Admin hat "heute schon geschrieben" angegeben.
export async function setAbsolute(n, settings) {
  const s = await getWords(settings);
  const before = s.today;
  if (s.base == null) s.base = n;
  s.abs = n;
  return save(s, settings, before);
}

// Nur dazugeschrieben: "+300"
export async function addWords(n, settings) {
  const s = await getWords(settings);
  const before = s.today;
  if (s.abs == null) { s.abs = 0; s.base = 0; }
  s.abs = Math.max(0, s.abs + n);
  return save(s, settings, before);
}

// "Heute habe ich schon N Wörter": verschiebt den Ausgangspunkt
export async function setToday(n, settings) {
  const s = await getWords(settings);
  const before = s.today;
  if (s.abs == null) s.abs = n;
  s.base = s.abs - n;
  return save(s, settings, before);
}

export async function resetDay(settings) {
  const s = await getWords(settings);
  s.base = s.abs;
  return save(s, settings, s.today);
}

// Wörter, die Mitschreibende im Chat melden: gemeinsamer Tageszähler
export async function addViewerWords(n, settings) {
  const key = `stats/words-${streamDay(settings)}`;
  const day = (await db.get(key)) ?? { total: 0 };
  day.total += n;
  await db.set(key, day);
  return day.total;
}

export async function viewerWordsToday(settings) {
  return ((await db.get(`stats/words-${streamDay(settings)}`)) ?? { total: 0 }).total;
}
