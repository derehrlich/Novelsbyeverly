import { db } from '../core/store.mjs';
import { notify } from '../core/live.mjs';
import { MAX_PLAETZE, SZENEN } from '../../public/js/katalog.mjs';
import { DEFAULT_LAYOUT, normalizeLayout } from '../../public/js/layout.mjs';
import { DEFAULT_DESIGN, normalizeDesign } from '../../public/js/design.mjs';
import { DEFAULT_ALERTS, normalizeAlerts } from '../../public/js/alerts.mjs';

export const DEFAULTS = {
  // Darstellung: 'wachstum' = Landschaft, die mit dem Fortschritt zuwächst; 'fenster' = gemütliche Leseecke oder Arbeitsplatz mit großem Fenster;
  // 'zimmer' = Szene mit den Figuren der Zuschauer (pausiert)
  szeneModus: 'wachstum',
  jahreszeit: 'auto', // auto | fruehling | sommer | herbst | winter
  tageszeit: 'auto', // auto | morgen | mittag | abend
  // Ziel-Karte: woerter (Wörter schreiben) | seiten (Seiten lesen) | zeit (Streamzeit) | pomodoros
  zielArt: 'woerter',
  seitenGoal: 30,
  streamGoalMinutes: 180, // geplante Streamdauer für das Ziel "Streamzeit"
  // Was die Landschaft wachsen lässt: ziel (wie die Ziel-Karte) | zeit (Streamzeit, auch ohne eine Eingabe) | woerter | pomodoro | kombi (Mittel aus Zeit und Ziel)
  wachstumQuelle: 'ziel',
  // Fenster-Ansicht: Ort im Zimmer, Blick nach draußen und Wetter (Jahres- und Tageszeit gelten wie bei der Landschaft)
  fensterOrt: 'lese', // lese | arbeit
  fensterBlick: 'stadt', // stadt | landschaft | wald | see
  fensterWetter: 'auto', // auto (Winter: Schnee, sonst klar) | klar | regen | schnee
  pomodoroGoal: 6, // so viele Pomodoros sollen es heute werden (0 = ohne Ziel)
  // Musik-Anzeige: aus | lokal (das Overlay liest die Adresse selbst, z. B. Tuna) | server (Titel kommt per Schnittstelle, Chat oder Admin)
  musikQuelle: 'aus',
  musikUrl: 'http://localhost:1608/',
  layout: DEFAULT_LAYOUT,
  design: DEFAULT_DESIGN, // Farben, Rundung, Schrift der Karten (siehe public/js/design.mjs)
  alerts: DEFAULT_ALERTS, // Buch-Alerts: Texte, Schrift, Größe, Position (siehe public/js/alerts.mjs), eigene OBS-Quelle /alerts
  // Gaming-Szene (/gaming): Design, Rand, Kamerafenster in den Ecken des Spielrahmens und der Deathcounter
  gamingDesign: 'gemuetlich', // gemuetlich (Landschaft, Holzrahmen) | glas (schlicht, durchscheinendes Glas, an Apples Liquid Glass angelehnt)
  gamingHintergrund: 'design', // design (Landschaft bzw. Glasverlauf) | obs (Rand bleibt durchsichtig: darunter liegt in OBS eine unscharfe Kopie des Spiels)
  gamingAbdunkeln: 25, // bei Hintergrund obs: Rand um so viel Prozent abdunkeln (0–80)
  gamingKameraOL: false, gamingKameraOR: true, gamingKameraUL: false, gamingKameraUR: false,
  gamingKameraUeberlappung: 40, // so viele Pixel ragt ein Kamerafenster in das Spielfenster (das Spielfenster macht den Kameras Platz)
  gamingKameraGroesse: 340, // Seitenlänge der quadratischen Kamera in Pixeln
  gamingTode: false, // Deathcounter anzeigen
  gamingTodeLabel: 'Tode',
  gamingTodePos: 'unten-links', // oben-links | oben-mitte | oben-rechts | unten-links | unten-mitte | unten-rechts
  gamingTodeSekunden: 10, // Karte blendet nach so vielen Sekunden wieder aus (0 = bleibt sichtbar)
  gamingTodeChat: true, // Bot schreibt bei jeder Änderung die aktuelle Zahl in den Chat
  gamingTodeTemplate: '💀 {n} {label}', // Chat-Antwort bei Änderung und bei !tode
  // Wann erscheint die Figur: 'sit' = Chatbefehl !sitzen, 'checkin' = Kanalpunkte-Reward "Check-in", 'both' = beides
  appearOn: 'sit',
  scene: 'cafe',
  maxSeats: MAX_PLAETZE,
  // Wer so lange nichts im Chat schreibt, verliert den Platz (Minuten)
  seatIdleMinutes: 120,
  // Fester Ablauf: Pomodoro (focusMinutes) → Pause (breakMinutes), das Ganze `repeats`-mal. Bei 1 gibt es einen Pomodoro und eine Pause, dann ist Schluss.
  focusMinutes: 25,
  breakMinutes: 5,
  repeats: 4,
  // Töne im Overlay (OBS: „Audio über OBS steuern“): nur zwei Stück, Pomodoro-Beginn und Pomodoro-Ende; eigene Dateien siehe features/sounds.mjs
  soundAn: true, // Hauptschalter: aus = das Overlay ist komplett stumm
  soundStart: true, // Ton, wenn ein Pomodoro beginnt
  soundEnde: true, // Ton, wenn ein Pomodoro zu Ende ist (Pausen und alles andere bleiben still)
  soundLautstaerke: 60, // 0–100
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
  sprintStartTemplate: '🍅 Pomodoro {runde} von {gesamt} startet: {minutes} Minuten Fokus. Stifte bereit!',
  breakTemplate: '☕ Pause! {minutes} Minuten durchatmen.',
  sessionEndTemplate: '🎉 Geschafft! {gesamt} Pomodoros am Stück, schön gemacht.',
  sprintEndTemplate: '🎉 Pomodoro {n}{ziel} geschafft{streamer}!',
  rankUpTemplate: '⭐ {user} ist jetzt „{rank}“ ({hours} Arbeitszeit)!',
  unlockTemplate: '🎁 {user} hat „{item}“ freigeschaltet! Mit {figur} kannst du es anziehen.',
  decoTemplate: '🌿 Das Zimmer wächst: „{deko}“ ist freigeschaltet – danke an alle Mitschreibenden!',
  goalTemplate: '🎯 Tagesziel erreicht: {words} Wörter! Ihr seid großartig.',
};

const INT = { gamingKameraUeberlappung: [0, 300], gamingAbdunkeln: [0, 80], gamingKameraGroesse: [160, 700], gamingTodeSekunden: [0, 3600], seitenGoal: [0, 5000], streamGoalMinutes: [10, 1440], pomodoroGoal: [0, 30], repeats: [1, 20], soundLautstaerke: [0, 100], maxSeats: [1, MAX_PLAETZE], seatIdleMinutes: [10, 720], focusMinutes: [1, 180], breakMinutes: [1, 60], dayRolloverHour: [0, 12], wordGoal: [0, 1_000_000], checkinRewardCost: [1, 1_000_000], commandCooldown: [0, 300], maxTasks: [1, 10] };
const BOOL = ['gamingKameraOL', 'gamingKameraOR', 'gamingKameraUL', 'gamingKameraUR', 'gamingTode', 'gamingTodeChat', 'soundAn', 'soundStart', 'soundEnde', 'unlocksEnabled', 'moduleBlume', 'moduleKerze', 'moduleBuecher', 'moduleDeko', 'chatEnabled', 'chatCommands', 'announceSprint'];
const ENUM = { gamingDesign: ['gemuetlich', 'glas'], gamingHintergrund: ['design', 'obs'], gamingTodePos: ['oben-links', 'oben-mitte', 'oben-rechts', 'unten-links', 'unten-mitte', 'unten-rechts'], appearOn: ['sit', 'checkin', 'both'], scene: Object.keys(SZENEN), szeneModus: ['wachstum', 'fenster', 'zimmer'], fensterOrt: ['lese', 'arbeit'], fensterBlick: ['stadt', 'landschaft', 'wald', 'see'], fensterWetter: ['auto', 'klar', 'regen', 'schnee'], jahreszeit: ['auto', 'fruehling', 'sommer', 'herbst', 'winter'], tageszeit: ['auto', 'morgen', 'mittag', 'abend'], wachstumQuelle: ['ziel', 'zeit', 'woerter', 'pomodoro', 'kombi'], zielArt: ['woerter', 'seiten', 'zeit', 'pomodoros'], musikQuelle: ['aus', 'lokal', 'server'] };

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
    if (key === 'layout') { out.layout = normalizeLayout(value, out.layout); continue; }
    if (key === 'design') { out.design = normalizeDesign(value, out.design); continue; }
    if (key === 'alerts') { out.alerts = normalizeAlerts(value, out.alerts); continue; }
    if (key === 'musikUrl') {
      const u = String(value ?? '').trim();
      if (u && !/^https?:\/\/[^\s]+$/i.test(u)) return { error: 'Die Musik-Adresse muss mit http:// oder https:// beginnen' };
      out.musikUrl = u.slice(0, 300);
      continue;
    }
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
  const stored = (await db.get('config/settings')) ?? {};
  return { ...DEFAULTS, ...stored, layout: normalizeLayout(stored.layout), design: normalizeDesign(stored.design), alerts: normalizeAlerts(stored.alerts) };
}

export async function saveSettings(input) {
  const { settings, error } = normalize(input, await getSettings());
  if (error) return { error };
  await db.set('config/settings', settings);
  notify('settings'); // das Overlay übernimmt die Änderung sofort
  return { settings };
}
