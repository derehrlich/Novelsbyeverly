import { db } from './store.mjs';
import { DEFAULT_FIGUR, MAX_PLAETZE, SZENEN, cleanFigur } from '../../public/js/katalog.mjs';
import { DEFAULT_LAYOUT, normalizeLayout } from '../../public/js/layout.mjs';

export const DEFAULTS = {
  // Darstellung: 'wachstum' = Landschaft, die mit dem Fortschritt zuwächst; 'zimmer' = Szene mit den Figuren der Zuschauer (pausiert)
  szeneModus: 'wachstum',
  jahreszeit: 'auto', // auto | fruehling | sommer | herbst | winter
  tageszeit: 'auto', // auto | morgen | mittag | abend
  // Ziel-Karte: woerter (Wörter schreiben) | seiten (Seiten lesen) | zeit (Streamzeit) | pomodoros
  zielArt: 'woerter',
  seitenGoal: 30,
  streamGoalMinutes: 180, // geplante Streamdauer für das Ziel "Streamzeit"
  // Was die Landschaft wachsen lässt: ziel (wie die Ziel-Karte) | zeit (Streamzeit, auch ohne eine Eingabe) | woerter | pomodoro | kombi (Mittel aus Zeit und Ziel)
  wachstumQuelle: 'ziel',
  // Stefanie im Pavillon: auto (Laptop beim Fokus, Buch in der Pause) | laptop | buch
  stefanieTaetigkeit: 'auto',
  stefanieFigur: { ...DEFAULT_FIGUR, haare: 'braun', frisur: 'lang', oberteil: 'gruen' },
  pomodoroGoal: 6, // so viele Pomodoros sollen es heute werden (0 = ohne Ziel)
  longBreakMinutes: 15,
  longBreakEvery: 4, // nach so vielen Pomodoros kommt die lange Pause (0 = nie)
  // Musik-Anzeige: aus | lokal (das Overlay liest die Adresse selbst, z. B. Tuna) | server (Titel kommt per Schnittstelle, Chat oder Admin)
  musikQuelle: 'aus',
  musikUrl: 'http://localhost:1608/',
  layout: DEFAULT_LAYOUT,
  // Aussehen der Karten (Uhr, Ziel, To-Do, Musik, Banner): papier = warme Karten wie bisher, glas = durchsichtige, getönte Glaskacheln
  kartenStil: 'papier',
  kameraRahmen: 'holz', // Rahmen um das Kamerabild bei Szenen, Jahreszeiten und eigenem Bild: holz | papier | glas | keiner
  glasFarbe: '#3b6f94', // Tönung der Glaskacheln
  glasStaerke: 38, // wie kräftig die Tönung ist (0 = klar, 90 = fast deckend)
  glasUnschaerfe: 22, // wie stark der Hintergrund hinter dem Glas verschwimmt (Pixel)
  // Hintergrund: landschaft = die gemalte Landschaft, bild = ein eigenes Bild (Upload im Admin)
  hintergrund: 'landschaft', // landschaft | bild | zug | sitzecke | stadt | see (die vier Szenen mit bewegtem Ausblick)
  wetter: 'klar', // klar | wolkig | regen | gewitter | schnee | nebel (gilt für die Szenen)
  wind: 30, // 0 bis 100: wie stark sich Bäume und Wasser bewegen und der Regen schräg fällt
  kulisseTempo: 50, // 0 bis 100: Geschwindigkeit der vorbeiziehenden Landschaft im Zug
  // Versionen der hochgeladenen Raumbilder je Szene (Zeitstempel, 0 = keins)
  raumZug: 0, raumSitzecke: 0, raumStadt: 0, raumSee: 0,
  // Jahreszeiten-Landschaft (Hintergrund „jahreszeiten“): je Jahreszeit ein Anfangs- und ein Endbild, dazu Blätter mit Blumen, Herbstblättern und Blüten (Versionen, 0 = keins)
  jzFruehlingA: 0, jzFruehlingB: 0, jzSommerA: 0, jzSommerB: 0, jzHerbstA: 0, jzHerbstB: 0, jzWinterA: 0, jzWinterB: 0, jzBlumen: 0, jzBlaetter: 0, jzBluete: 0,
  jzWieseVon: 80, jzWieseBis: 98, // Wiesenstreifen für die Blumen (Höhe in % von oben)
  jzBaumX: 31, jzStammBreite: 24, // Baum: Mitte in % von links, Breite des Stammbereichs, in dem keine Blumen wachsen
  jzKroneBreite: 56, jzKroneVon: 8, // Krone: Breite in %, Oberkante in % von oben (von dort fallen Blätter und Blüten)
  jzDichte: 60, // wie viele Blumen wachsen (0 bis 100)
  jzFall: 50, // wie viele Blätter und Blüten fallen (0 bis 100)
  hintergrundVersion: 0, // Zeitstempel des hochgeladenen Bildes (0 = keins), wird vom Upload gesetzt
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
  videoZug: 'zeit', videoSitzecke: 'zeit', videoStadt: 'zeit', videoSee: 'zeit', // welches Video je Szene läuft: zeit (nach Tageszeit) | b1 b2 b3 (Bibliothek) | aus
  // Alerts und Raids (aus, bis sie im Admin eingeschaltet werden). Platzhalter stehen in {geschweiften Klammern}
  alertsEnabled: false, raidEnabled: false,
  // Eigene Befehle, Zitate und Shoutout (aus, bis eingeschaltet). Platzhalter stehen in {geschweiften Klammern}
  customCommandsEnabled: false, quoteEnabled: false, soEnabled: false,
  quoteTemplate: '📜 Zitat #{n}: „{text}“ – {by}, {date}', quoteNoneTemplate: '{user}, es gibt noch keine Zitate (oder diese Nummer gibt es nicht).', quoteAddedTemplate: '📜 Zitat #{n} ist gespeichert, danke {user}!',
  soTemplate: '💛 Schaut bei {name} vorbei! Zuletzt gespielt: {game} → {url}',
  alertSoundVolume: 80, // Lautstärke der eigenen Alert-Töne (0 bis 100)
  alertFollow: true, alertSub: true, alertGift: true, alertCheer: true, alertCheerMin: 1, alertChat: true, alertSeconds: 7, raidSeconds: 10, raidMinViewers: 1,
  followTitle: 'Willkommen, {user}!', followMessage: 'folgt jetzt dem Schreibzimmer 🌱',
  subTitle: '{user} ist dabei!', subMessage: 'Neues Abo ({tier})',
  resubTitle: '{user} ist {months} Monate dabei!', resubMessage: '{tier}',
  giftTitle: '{user} verschenkt Abos!', giftMessage: '{total} Sub(s) für die Community',
  cheerTitle: '{user} schickt Bits!', cheerMessage: '{bits} Bits',
  raidTitle: 'Raid von {raider}!', raidMessage: '{viewers} Schreibfreunde kommen vorbei',
  followTemplate: 'Willkommen im Schreibzimmer, {user}! 🌱 Schön, dass du da bist.',
  subTemplate: 'Danke für dein Abo, {user}! ({tier}, {months} Monate) ☕',
  giftTemplate: 'Danke, {user}, für {total} verschenkte Abos! 🎁',
  cheerTemplate: 'Danke für {bits} Bits, {user}! ✨',
  raidTemplate: 'Willkommen {raider} und {viewers} Raider! 💛 Ihr seid {visit}. Schaut gern bei {url} vorbei.',
  // Alert als eigenes Video (statt des gezeichneten Buchs): Ort und Größe, Textfeld und Zeitraum des Textes, alles in Prozent
  alertVideoAn: true, alertVideoKey: true, alertVideoLinks: true, alertVideoB: 90, alertVideoY: 46, alertVideoTX: 53, alertVideoTY: 26, alertVideoTB: 19, alertVideoTH: 46, alertVideoVon: 28, alertVideoBis: 63, alertVideoEnde: 78, alertVideoSchrift: 80,
  // Stream-Pause (Overlay /pause, Chat: !auszeit und !zurueck), aus bis zum Einschalten
  pauseEnabled: false, pauseChat: true, pauseDefaultText: 'Kurze Pause', pauseSubtitle: 'Gleich geht es weiter!',
  pauseStartTemplate: '☕ {text} – gleich geht es weiter!', pauseEndTemplate: '▶️ Weiter geht’s!',
  pavillonZeigen: false, // Pavillon mit Stefanie in der gemalten Landschaft (aus, der Code bleibt)
  moduleBlume: true, // Blume wächst mit den Wörtern des Tages
  moduleKerze: true, // Kerze brennt mit dem Sprint herunter
  moduleBuecher: true, // Bücherstapel wächst mit den Sprints des Tages
  moduleDeko: true, // Zimmer wächst mit der gemeinsamen Arbeitszeit
  // Check-in-Reward (nur nötig, wenn appearOn 'checkin' oder 'both' ist)
  checkinRewardTitle: 'Check-in',
  checkinRewardCost: 1,
  // Check-in mit Besuchszähler und Streak (Kanalpunkte-Reward). Ist er an, braucht es den Reward auch ohne „Zimmer-Modus“.
  checkinEnabled: false,
  // Streak-Retter: eigener Reward, der verpasste Streams überbrückt (aus, bis eingeschaltet)
  streakRescueEnabled: false, streakRewardTitle: 'Streak-Retter', streakRewardCost: 500, rescueMaxDays: 3,
  rescueTemplate: '🛟 {user} rettet die Streak! {days} verpasste(r) Stream(s) überbrückt – Streak: {streak} 🔥',
  rescueNotNeededTemplate: '{user}, deine Streak ist nicht in Gefahr ✅ Deine Punkte bekommst du zurück.',
  rescueTooLongTemplate: '{user}, die Lücke ist zu lang oder zu lange her, da kann ich nichts mehr retten. Deine Punkte bekommst du zurück.',
  rescueTitle: 'Streak gerettet!', rescueMessage: '{user}: {days} verpasste(r) Stream(s) überbrückt – Streak: {streak}',
  streakGrace: 1, // so viele Streams darf man verpassen, ohne dass die Streak reißt
  milestoneEnabled: true,
  milestoneLevels: '10,25,50,100,250,500,1000',
  visitTemplate: '✅ {user} ist eingecheckt – Besuch #{count}, 🔥 Streak {streak}! Schön, dass du da bist.',
  milestoneTemplate: '🏆 {user} ist zum {count}. Mal dabei – Meilenstein! Danke für deine Treue ❤️',
  visitDuplicateTemplate: '{user}, du bist heute schon eingecheckt (Besuch #{count}) ✅ Deine Punkte bekommst du zurück.',
  streakCmdTemplate: '📊 {user}: {count} Besuche · 🔥 Streak {streak} (Rekord {record}) · Platz {rank} von {total}',
  streakCmdNone: '{user}, ich habe noch keinen Check-in von dir – löse den Check-in-Reward ein ✅',
  // Punkte und Monatsrangliste (Twitch-Chat und Check-ins)
  pointsEnabled: false,
  pointsWeightMsg: 1,
  pointsWeightDay: 10,
  pointsWeightCheckin: 20,
  pointsMsgCap: 30, // gezählte Nachrichten pro Tag (höchstens)
  pointsMsgGap: 60, // Mindestabstand zwischen zwei gezählten Nachrichten (Sekunden)
  pointsRankSize: 5, // Plätze im Chat
  pointsRankTemplate: '🏆 Rangliste {month}: {list}{me} · Alle Plätze: {url}',
  pointsRankEmpty: '🏆 In der Rangliste {month} stehen noch keine Punkte. Schreib im Chat und check dich ein! {url}',
  pointsMeTemplate: '⭐ {user}: {points} Punkte im {month} · Platz {rank} von {total}. Rangliste: {url}',
  pointsMeNone: '{user}, du hast im {month} noch keine Punkte. Schreib im Chat und check dich ein ✅',
  // Sicherung (nur auf dem Heimserver)
  backupAutoEnabled: true,
  backupHour: 3,
  backupKeep: 7,
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
  sprintStartTemplate: '🍅 Pomodoro startet: {minutes} Minuten Fokus. Stifte bereit!',
  breakTemplate: '☕ Pause! {minutes} Minuten durchatmen.',
  longBreakTemplate: '🌿 Lange Pause! {minutes} Minuten Luft holen, du hast {n} Pomodoros geschafft.',
  sprintEndTemplate: '🎉 Pomodoro {n}{ziel} geschafft{streamer}!',
  rankUpTemplate: '⭐ {user} ist jetzt „{rank}“ ({hours} Arbeitszeit)!',
  unlockTemplate: '🎁 {user} hat „{item}“ freigeschaltet! Mit {figur} kannst du es anziehen.',
  decoTemplate: '🌿 Das Zimmer wächst: „{deko}“ ist freigeschaltet – danke an alle Mitschreibenden!',
  goalTemplate: '🎯 Tagesziel erreicht: {words} Wörter! Ihr seid großartig.',
};

const INT = { alertSoundVolume: [0, 100], streakRewardCost: [1, 1000000], rescueMaxDays: [1, 14], alertVideoB: [20, 100], alertVideoY: [0, 100], alertVideoTX: [0, 95], alertVideoTY: [0, 95], alertVideoTB: [5, 100], alertVideoTH: [5, 100], alertVideoVon: [0, 95], alertVideoBis: [1, 100], alertVideoEnde: [10, 100], alertVideoSchrift: [40, 250], alertCheerMin: [1, 100000], alertSeconds: [3, 30], raidSeconds: [3, 40], raidMinViewers: [0, 10000], seitenGoal: [0, 5000], streamGoalMinutes: [10, 1440], pomodoroGoal: [0, 30], longBreakMinutes: [1, 90], longBreakEvery: [0, 12], maxSeats: [1, MAX_PLAETZE], seatIdleMinutes: [10, 720], focusMinutes: [1, 180], breakMinutes: [1, 60], dayRolloverHour: [0, 12], wordGoal: [0, 1_000_000], checkinRewardCost: [1, 1_000_000], commandCooldown: [0, 300], maxTasks: [1, 10], streakGrace: [0, 5], pointsWeightMsg: [0, 1000], pointsWeightDay: [0, 1000], pointsWeightCheckin: [0, 1000], pointsMsgCap: [1, 500], pointsMsgGap: [0, 3600], pointsRankSize: [1, 10], backupHour: [0, 23], backupKeep: [1, 60], glasStaerke: [0, 90], glasUnschaerfe: [0, 60], hintergrundVersion: [0, 9_999_999_999_999], wind: [0, 100], kulisseTempo: [0, 100], raumZug: [0, 9_999_999_999_999], raumSitzecke: [0, 9_999_999_999_999], raumStadt: [0, 9_999_999_999_999], raumSee: [0, 9_999_999_999_999], jzFruehlingA: [0, 9_999_999_999_999], jzFruehlingB: [0, 9_999_999_999_999], jzSommerA: [0, 9_999_999_999_999], jzSommerB: [0, 9_999_999_999_999], jzHerbstA: [0, 9_999_999_999_999], jzHerbstB: [0, 9_999_999_999_999], jzWinterA: [0, 9_999_999_999_999], jzWinterB: [0, 9_999_999_999_999], jzBlumen: [0, 9_999_999_999_999], jzBlaetter: [0, 9_999_999_999_999], jzBluete: [0, 9_999_999_999_999], jzWieseVon: [40, 99], jzWieseBis: [41, 100], jzBaumX: [0, 100], jzStammBreite: [0, 80], jzKroneBreite: [10, 100], jzKroneVon: [0, 60], jzDichte: [0, 100], jzFall: [0, 100] };
const BOOL = ['customCommandsEnabled', 'quoteEnabled', 'soEnabled', 'alertVideoLinks', 'streakRescueEnabled', 'pauseEnabled', 'pauseChat', 'alertVideoAn', 'alertVideoKey', 'alertsEnabled', 'raidEnabled', 'alertFollow', 'alertSub', 'alertGift', 'alertCheer', 'alertChat', 'pavillonZeigen', 'autoBreak', 'autoCycle', 'unlocksEnabled', 'moduleBlume', 'moduleKerze', 'moduleBuecher', 'moduleDeko', 'chatEnabled', 'chatCommands', 'announceSprint', 'checkinEnabled', 'milestoneEnabled', 'pointsEnabled', 'backupAutoEnabled'];
const VIDEO_WAHL = ['zeit', 'b1', 'b2', 'b3', 'aus'];
const ENUM = { kameraRahmen: ['holz', 'papier', 'glas', 'keiner'], videoZug: VIDEO_WAHL, videoSitzecke: VIDEO_WAHL, videoStadt: VIDEO_WAHL, videoSee: VIDEO_WAHL, appearOn: ['sit', 'checkin', 'both'], scene: Object.keys(SZENEN), szeneModus: ['wachstum', 'zimmer'], jahreszeit: ['auto', 'fruehling', 'sommer', 'herbst', 'winter'], tageszeit: ['auto', 'morgen', 'mittag', 'abend', 'nacht'], wachstumQuelle: ['ziel', 'zeit', 'woerter', 'pomodoro', 'kombi'], zielArt: ['woerter', 'seiten', 'zeit', 'pomodoros'], stefanieTaetigkeit: ['auto', 'laptop', 'buch'], musikQuelle: ['aus', 'lokal', 'server'], kartenStil: ['papier', 'glas'], hintergrund: ['landschaft', 'jahreszeiten', 'bild', 'zug', 'sitzecke', 'stadt', 'see'], wetter: ['klar', 'wolkig', 'regen', 'gewitter', 'schnee', 'nebel'] };

export const seatsOnReward = (s) => s.appearOn === 'checkin' || s.appearOn === 'both';
// Der Chat-Webhook wird gebraucht, wenn der Bot Befehle versteht oder Chat-Punkte zählt
export const needsAlerts = (s) => s.alertsEnabled;
export const needsRaids = (s) => s.raidEnabled;
export const needsRescue = (s) => s.streakRescueEnabled && s.checkinEnabled;
export const needsChat = (s) => s.chatCommands || s.pointsEnabled || s.customCommandsEnabled;
export const needsReward = (s) => s.checkinEnabled || seatsOnReward(s);
export const allowsSit = (s) => s.appearOn === 'sit' || s.appearOn === 'both';

export function validTimezone(tz) {
  try { new Intl.DateTimeFormat('en-CA', { timeZone: tz }); return true; } catch { return false; }
}

// Prüft Eingaben aus dem Admin und liefert { settings } oder { error }. Unbekannte Schlüssel werden verworfen.
export function normalize(input, base = DEFAULTS) {
  const out = { ...base };
  for (const [key, value] of Object.entries(input ?? {})) {
    if (!(key in DEFAULTS)) continue;
    if (key === 'stefanieFigur') { out.stefanieFigur = cleanFigur(value); continue; }
    if (key === 'layout') { out.layout = normalizeLayout(value, out.layout); continue; }
    if (key === 'musikUrl') {
      const u = String(value ?? '').trim();
      if (u && !/^https?:\/\/[^\s]+$/i.test(u)) return { error: 'Die Musik-Adresse muss mit http:// oder https:// beginnen' };
      out.musikUrl = u.slice(0, 300);
      continue;
    }
    if (key === 'glasFarbe') {
      if (!/^#[0-9a-f]{6}$/i.test(String(value ?? ''))) return { error: 'Die Glasfarbe muss so aussehen: #3b6f94' };
      out.glasFarbe = String(value).toLowerCase();
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

// Die ersten Standardwerte des Alert-Videos wurden beim Speichern im Admin festgehalten und blieben dann auch nach Verbesserungen
// der Standardwerte stehen. Sind alle neun noch genau auf dem alten Stand (also nie bewusst geändert), gelten wieder die aktuellen.
const OLD_ALERT_VIDEO = [
  { alertVideoB: 62, alertVideoY: 40, alertVideoTX: 54, alertVideoTY: 26, alertVideoTB: 36, alertVideoTH: 48, alertVideoVon: 40, alertVideoBis: 72, alertVideoSchrift: 100 }, // erste Fassung
  { alertVideoB: 90, alertVideoY: 46, alertVideoTX: 53, alertVideoTY: 26, alertVideoTB: 18, alertVideoTH: 46, alertVideoVon: 28, alertVideoBis: 63, alertVideoSchrift: 100 }, // zweite Fassung (Schrift war zu groß)
];
export function migrateStored(stored) {
  const old = OLD_ALERT_VIDEO.find((sig) => Object.entries(sig).every(([k, v]) => stored[k] === v));
  if (!old) return stored;
  const out = { ...stored };
  for (const k of Object.keys(old)) delete out[k];
  return out;
}

export async function getSettings() {
  const stored = migrateStored((await db.get('config/settings')) ?? {});
  return { ...DEFAULTS, ...stored, layout: normalizeLayout(stored.layout) };
}

export async function saveSettings(input) {
  const { settings, error } = normalize(input, await getSettings());
  if (error) return { error };
  await db.set('config/settings', settings);
  return { settings };
}
