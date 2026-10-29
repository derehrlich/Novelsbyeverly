import { db } from './store.mjs';
import { MAX_PLAETZE, SZENEN } from '../../public/js/katalog.mjs';

export const DEFAULTS = {
  // Wann erscheint die Figur: 'sit' = Chatbefehl !sitzen, 'checkin' = Kanalpunkte-Reward "Check-in", 'both' = beides
  appearOn: 'sit',
  scene: 'cafe',
  maxSeats: MAX_PLAETZE,
  // Wer so lange nichts im Chat schreibt, verliert den Platz (Minuten)
  seatIdleMinutes: 120,
  focusMinutes: 25,
  breakMinutes: 5,
  autoBreak: true, // nach dem Fokus automatisch Pause
  autoCycle: false, // nach der Pause automatisch der nächste Fokus
  timezone: 'Europe/Berlin',
  dayRolloverHour: 5,
  wordGoal: 1000,
  unlocksEnabled: true,
  // Module im Overlay (auf dem Regalbrett und im Zimmer)
  moduleBlume: true, // Blume wächst mit den Wörtern des Tages
  moduleKerze: true, // Kerze brennt mit dem Sprint herunter
  moduleBuecher: true, // Bücherstapel wächst mit den Sprints des Tages
  moduleDeko: true, // Zimmer wächst mit der gemeinsamen Arbeitszeit
  // Check-in-Reward (nur nötig, wenn appearOn 'checkin' oder 'both' ist)
  checkinRewardTitle: 'Check-in',
  checkinRewardCost: 1,
  // Chat
  chatEnabled: true, // der Bot darf schreiben
  chatCommands: true, // der Bot versteht Befehle
  commandPrefix: '!',
  commandCooldown: 5, // Sekunden zwischen Info-Antworten (!rang, !hilfe)
  announceSprint: true, // Chatnachricht bei Sprintstart, Pause und Ende
  maxTasks: 3, // offene Aufgaben je Person
  // Texte. Platzhalter stehen in {geschweiften Klammern}
  sitTemplate: '🪑 {user} setzt sich {ort} und schreibt mit! ({rank})',
  sitAgainTemplate: '{user}, du sitzt schon {ort} 🙂',
  fullTemplate: '{user}, gerade sind alle Plätze belegt – versuch es gleich noch einmal.',
  leaveTemplate: '👋 {user} steht auf. Heute {minutes} mitgearbeitet, insgesamt {total}.',
  notSeatedTemplate: '{user}, du sitzt gerade nicht. Mit {sit} setzt du dich dazu.',
  checkinTemplate: '✅ {user} ist eingecheckt – Besuch #{count}! Schön, dass du da bist.',
  sprintStartTemplate: '⏱️ Sprint startet: {minutes} Minuten Fokus. Stifte bereit!',
  breakTemplate: '☕ Pause! {minutes} Minuten durchatmen.',
  sprintEndTemplate: '🎉 Sprint geschafft! {writers} Mitschreibende{streamer}. Danke fürs Dabeisein!',
  rankUpTemplate: '⭐ {user} ist jetzt „{rank}“ ({hours} Arbeitszeit)!',
  unlockTemplate: '🎁 {user} hat „{item}“ freigeschaltet! Mit {figur} kannst du es anziehen.',
  decoTemplate: '🌿 Das Zimmer wächst: „{deko}“ ist freigeschaltet – danke an alle Mitschreibenden!',
  goalTemplate: '🎯 Tagesziel erreicht: {words} Wörter! Ihr seid großartig.',
};

const INT = { maxSeats: [1, MAX_PLAETZE], seatIdleMinutes: [10, 720], focusMinutes: [1, 180], breakMinutes: [1, 60], dayRolloverHour: [0, 12], wordGoal: [0, 1_000_000], checkinRewardCost: [1, 1_000_000], commandCooldown: [0, 300], maxTasks: [1, 10] };
const BOOL = ['autoBreak', 'autoCycle', 'unlocksEnabled', 'moduleBlume', 'moduleKerze', 'moduleBuecher', 'moduleDeko', 'chatEnabled', 'chatCommands', 'announceSprint'];
const ENUM = { appearOn: ['sit', 'checkin', 'both'], scene: Object.keys(SZENEN) };

export const needsReward = (s) => s.appearOn === 'checkin' || s.appearOn === 'both';
export const allowsSit = (s) => s.appearOn === 'sit' || s.appearOn === 'both';

export function validTimezone(tz) {
  try { new Intl.DateTimeFormat('en-CA', { timeZone: tz }); return true; } catch { return false; }
}

// Prüft Eingaben aus dem Admin und liefert { settings } oder { error }. Unbekannte Schlüssel werden verworfen.
export function normalize(input, base = DEFAULTS) {
  const out = { ...base };
  for (const [key, value] of Object.entries(input ?? {})) {
    if (!(key in DEFAULTS)) continue;
    if (INT[key]) {
      const n = Number(value);
      if (!Number.isFinite(n)) return { error: `${key}: bitte eine Zahl eingeben` };
      out[key] = Math.min(INT[key][1], Math.max(INT[key][0], Math.round(n)));
    } else if (BOOL.includes(key)) out[key] = Boolean(value);
    else if (ENUM[key]) {
      if (!ENUM[key].includes(value)) return { error: `${key}: unbekannter Wert` };
      out[key] = value;
    } else if (key === 'timezone') {
      if (!validTimezone(value)) return { error: 'Unbekannte Zeitzone, z. B. Europe/Berlin' };
      out[key] = value;
    } else if (key === 'commandPrefix') {
      const p = String(value ?? '').trim();
      if (!p || p.length > 2 || /\s/.test(p)) return { error: 'Das Befehlszeichen muss 1 bis 2 Zeichen lang sein (z. B. !)' };
      out[key] = p;
    } else if (typeof DEFAULTS[key] === 'string') {
      const t = String(value ?? '').slice(0, 300);
      if (key.endsWith('RewardTitle') && !t.trim()) return { error: 'Der Reward braucht einen Namen' };
      out[key] = t;
    }
  }
  return { settings: out };
}

export async function getSettings() {
  return { ...DEFAULTS, ...((await db.get('config/settings')) ?? {}) };
}

export async function saveSettings(input) {
  const { settings, error } = normalize(input, await getSettings());
  if (error) return { error };
  await db.set('config/settings', settings);
  return { settings };
}
