// Chat-Webhook (channel.chat.message): Befehle für Platz, Figur, Aufgaben, Wörter, Rang und die Sprint-Steuerung.
import { db } from './store.mjs';
import { ITEMS, SLOTS, SLOT_ALIASE, SZENEN, cleanFigur, nextRank, norm, rankFor, slotValues } from '../../public/js/katalog.mjs';
import { allowsSit, getSettings, needsReward, saveSettings } from './settings.mjs';
import { figureOf, getOrCreateUser, getSeat, getUser, leave, sceneOf, saveUser, sit, touchSeat } from './people.mjs';
import { addTask, completeTask, getTasks } from './tasks.mjs';
import { addViewerWords, addWords, getWords, setAbsolute } from './words.mjs';
import { announceCredit, getTimer, say, startBreak, startFocus, stopTimer, tick } from './timer.mjs';
import { fill, fmtDuration, fmtNumber, pushEvent } from './util.mjs';
import * as streamPause from './pause.mjs';
import { storedTokens } from './twitch.mjs';
import { clearMusik, setMusik } from './musik.mjs';
import { addPages, getPages, setPages } from './pages.mjs';
import { fmtHM, startStream, stopStream, streamInfo } from './streamzeit.mjs';
import { countChat, pointsReply, rankReply, streakReply } from './punkte.mjs';

const MAX_VIEWER_WORDS = 3000;
const num = (s) => { const n = Number(String(s ?? '').replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.')); return Number.isFinite(n) ? n : null; };

// Befehlsname (ohne Zeichen, ohne Umlaute) -> interne Aktion
const COMMANDS = {
  sitzen: 'sit', hinsetzen: 'sit', platz: 'sit', dabei: 'sit',
  aufstehen: 'leave', gehen: 'leave', tschuess: 'leave',
  figur: 'figure', avatar: 'figure',
  task: 'task', aufgabe: 'task', todo: 'task',
  tasks: 'tasks', aufgaben: 'tasks',
  done: 'done', fertig: 'done', erledigt: 'done',
  woerter: 'words', worte: 'words', words: 'words',
  ziel: 'goal',
  rang: 'rank', level: 'rank',
  sprint: 'sprint', fokus: 'sprint', pomodoro: 'sprint', pomo: 'sprint',
  pomodoros: 'pgoal',
  song: 'song', musik: 'song',
  seiten: 'pages', seitenziel: 'pagegoal', stream: 'stream',
  pause: 'pause',
  auszeit: 'streampause', zurueck: 'streamweiter', weiter: 'streamweiter',
  stop: 'stop', stopp: 'stop',
  szene: 'scene', ort: 'scene',
  wetter: 'weather', tageszeit: 'daytime', zeit: 'daytime', hintergrund: 'backdrop',
  streak: 'streak', besuche: 'streak',
  rangliste: 'ranking', top: 'ranking', punkte: 'points',
  hilfe: 'help', befehle: 'help', commands: 'help',
};
export const COMMAND_WORDS = Object.keys(COMMANDS); // für die Prüfung eigener Pausen (kein doppeltes Befehlswort)
const MOD_ONLY = new Set(['pausepreset', 'streampause', 'streamweiter', 'sprint', 'pause', 'stop', 'scene', 'song', 'stream', 'weather', 'daytime', 'backdrop']);
const BROADCASTER_ONLY = new Set(['goal', 'pgoal', 'pages', 'pagegoal']);
// Nur im Zimmer-Modus (Figuren der Zuschauer); in der Landschaft sind sie pausiert
const ZIMMER_ONLY = new Set(['sit', 'leave', 'figure', 'rank']);

const hasBadge = (e, ...ids) => (e.badges ?? []).some((b) => ids.includes(b.set_id));

// Befehle haben je Person und Befehl eine kurze Abklingzeit gegen Spam
async function cooling(key, seconds) {
  if (!seconds) return false;
  const last = await db.get(`cooldown/${key}`);
  if (last && Date.now() - last < seconds * 1000) return true;
  await db.set(`cooldown/${key}`, Date.now());
  return false;
}

export async function handleChat(e, settings = null) {
  settings ??= await getSettings();
  const id = e.chatter_user_id, name = e.chatter_user_name;
  if (!id) return { ok: false };
  const bot = await storedTokens('bot');
  // Eigene Nachrichten des Bots ignorieren, außer Bot und Kanal sind dasselbe Konto (dann sind es die Befehle der Streamerin)
  if (bot && bot.user_id === id && id !== e.broadcaster_user_id) return { ok: true, ignored: 'bot' };
  const isBroadcaster = id === e.broadcaster_user_id;
  const isMod = isBroadcaster || hasBadge(e, 'moderator');

  await touchSeat(id); // wer schreibt, behält seinen Platz
  if (settings.pointsEnabled && id !== e.broadcaster_user_id && !(bot && bot.user_id === id)) await countChat(id, name, settings).catch((err) => console.warn('Punkte-Zählung fehlgeschlagen:', err.message));
  await tick(settings);

  const text = String(e.message?.text ?? '').trim();
  if (!settings.chatCommands || !text.startsWith(settings.commandPrefix)) return { ok: true };
  const [word, ...args] = text.slice(settings.commandPrefix.length).split(/\s+/);
  let action = COMMANDS[norm(word)], preset = null;
  if (!action && settings.pauseEnabled && isMod) { preset = await streamPause.presetByWord(norm(word)); if (preset) action = 'pausepreset'; } // eigene Pause mit eigenem Befehlswort
  if (!action) return { ok: true };
  if (e.message_id && !(await db.setIfNew(`seen/chat-${e.message_id}`, Date.now()))) return { ok: true }; // doppelt zugestellt
  if (ZIMMER_ONLY.has(action) && settings.szeneModus !== 'zimmer') return { ok: true };
  if ((action === 'streampause' || action === 'streamweiter' || action === 'pausepreset') && !settings.pauseEnabled) return { ok: true };
  if (action === 'streak' && !settings.checkinEnabled) return { ok: true };
  if ((action === 'ranking' || action === 'points') && !settings.pointsEnabled) return { ok: true };
  if (MOD_ONLY.has(action) && !isMod) return { ok: true };
  if (BROADCASTER_ONLY.has(action) && !isBroadcaster) return { ok: true };

  const ctx = { id, name, args, settings, isBroadcaster, isMod, e, preset };
  const reply = await run(action, ctx);
  if (reply && settings.chatEnabled) await say(settings, reply, { replyTo: e.message_id });
  return { ok: true, action, reply };
}

const pre = (s) => s.commandPrefix;

async function run(action, ctx) {
  const { id, name, args, settings } = ctx;
  switch (action) {
    case 'streampause': { const state = await streamPause.start(streamPause.parseArgs(args), settings); return settings.pauseChat ? streamPause.startReply(state, settings) : null; }
    case 'pausepreset': { // !kaffee oder !kaffee 10 (Minuten überschreiben)
      const o = streamPause.parseArgs(args);
      const state = await streamPause.start({ text: ctx.preset.text, minutes: o.minutes ?? ctx.preset.minutes, preset: ctx.preset }, settings);
      return settings.pauseChat ? streamPause.startReply(state, settings) : null;
    }
    case 'streamweiter': { const was = await streamPause.stop(); return was.active && settings.pauseChat ? streamPause.endReply(settings) : null; }
    case 'sit': return doSit(ctx);
    case 'weather': case 'daytime': case 'backdrop': return setLook(action, args, settings);
    case 'streak': return (await cooling(`streak-${id}`, settings.commandCooldown)) ? null : streakReply(settings, id, name);
    case 'ranking': return (await cooling('ranking', settings.commandCooldown)) ? null : rankReply(settings, id);
    case 'points': return (await cooling(`points-${id}`, settings.commandCooldown)) ? null : pointsReply(settings, id, name);
    case 'leave': {
      const timer = await getTimer();
      const r = await leave(id, name, settings, timer);
      if (!r) return fill(settings.notSeatedTemplate, { user: name, sit: `${pre(settings)}sitzen` });
      await pushEvent({ type: 'leave', slot: r.seat.slot, name });
      await announceCredit(r, settings);
      return fill(settings.leaveTemplate, { user: name, minutes: fmtDuration(r.minutes), total: fmtDuration(r.user.minutes) });
    }
    case 'figure': return figure(ctx);
    case 'task': {
      const text = args.join(' ');
      const r = await addTask(id, name, text, settings.maxTasks);
      if (r.error === 'empty') return `${name}, schreib die Aufgabe hinter den Befehl, z. B. ${pre(settings)}task Kapitel 3 überarbeiten`;
      if (r.error === 'full') return `${name}, du hast schon ${r.max} offene Aufgaben – erst mit ${pre(settings)}done eine abhaken ✅`;
      return `📝 ${name}: „${r.item.text}“ ist dabei!${(await getSeat(id)) || ctx.isBroadcaster ? '' : ` (Sie erscheint im Overlay, sobald du mit ${pre(settings)}sitzen sitzt.)`}`;
    }
    case 'tasks': {
      const open = (await getTasks(id)).items.filter((i) => !i.done);
      return open.length ? `📝 ${name}: ${open.map((i, n) => `${n + 1}. ${i.text}`).join(' · ')}` : `${name}, du hast keine offenen Aufgaben. Neu mit ${pre(settings)}task …`;
    }
    case 'done': {
      const r = await completeTask(id, name, args[0] ? num(args[0]) : null);
      if (r.error === 'none') return `${name}, du hast keine offenen Aufgaben.`;
      if (r.error) return `${name}, diese Nummer gibt es nicht. Deine Aufgaben: ${pre(settings)}tasks`;
      return `✅ ${name} hat „${r.item.text}“ geschafft!${r.left ? ` Noch ${r.left} offen.` : ' Alles erledigt! 🎉'}`;
    }
    case 'words': return words(ctx);
    case 'goal': {
      const n = num(args[0]);
      if (n == null || n < 0) return `Tagesziel: ${fmtNumber(settings.wordGoal)} Wörter. Ändern mit ${pre(settings)}ziel 1500`;
      await saveSettings({ wordGoal: n });
      return `🎯 Tagesziel steht auf ${fmtNumber(n)} Wörter.`;
    }
    case 'pgoal': {
      const n = num(args[0]);
      if (n == null || n < 0) return `🍅 Ziel heute: ${settings.pomodoroGoal} Pomodoros. Ändern mit ${pre(settings)}pomodoros 6`;
      const { settings: saved } = await saveSettings({ pomodoroGoal: n });
      return `🍅 Ziel heute: ${saved.pomodoroGoal} Pomodoros.`;
    }
    case 'pages': {
      const raw = String(args[0] ?? '');
      const n = num(raw.replace(/^\+/, ''));
      const p = n == null || n < 0 ? await getPages(settings) : raw.startsWith('+') ? await addPages(n, settings) : await setPages(n, settings);
      return `📖 Heute ${fmtNumber(p.today)}${p.goal ? ` von ${fmtNumber(p.goal)}` : ''} Seiten.`;
    }
    case 'pagegoal': {
      const n = num(args[0]);
      if (n == null || n < 0) return `📖 Seitenziel: ${settings.seitenGoal}. Ändern mit ${pre(settings)}seitenziel 40`;
      const { settings: saved } = await saveSettings({ seitenGoal: n });
      return `📖 Seitenziel: ${saved.seitenGoal} Seiten.`;
    }
    case 'stream': {
      const sub = norm(args[0]);
      if (sub === 'start') { await startStream(); return `⏱️ Streamzeit läuft (Ziel: ${fmtHM(settings.streamGoalMinutes * 60_000)} Std).`; }
      if (sub === 'stop' || sub === 'ende') { await stopStream(); return '⏱️ Streamzeit gestoppt.'; }
      if (sub === 'ziel') {
        const h = num(args[1]);
        if (h == null || h <= 0) return `Streamziel: ${fmtHM(settings.streamGoalMinutes * 60_000)} Std. Ändern mit ${pre(settings)}stream ziel 3`;
        const { settings: saved } = await saveSettings({ streamGoalMinutes: Math.round(h * 60) });
        return `⏱️ Streamziel: ${fmtHM(saved.streamGoalMinutes * 60_000)} Std.`;
      }
      const info = await streamInfo();
      return info.startedAt ? `⏱️ Streamzeit: ${fmtHM(Date.now() - info.startedAt)} von ${fmtHM(settings.streamGoalMinutes * 60_000)} Std.` : `⏱️ Die Streamzeit läuft nicht. Start mit ${pre(settings)}stream start`;
    }
    case 'song': {
      const text = args.join(' ').trim();
      if (!text || norm(text) === 'aus') { await clearMusik(); return '🎵 Musik-Anzeige aus.'; }
      const [title, artist] = text.split(/\s+[-–]\s+/);
      await setMusik({ title, artist }, { manual: true });
      return `🎵 Jetzt läuft: ${text}`;
    }
    case 'rank': {
      const user = await getUser(id);
      if (!user || !user.minutes) return `${name}, du hast noch keine Arbeitszeit. Setz dich mit ${pre(settings)}sitzen dazu und nimm an einem Sprint teil!`;
      const rank = rankFor(user.minutes);
      const next = nextRank(user.minutes);
      return `🏅 ${name}: ${rank.label} · ${fmtDuration(user.minutes)} Arbeitszeit · ${user.sprints} Sprints${next ? ` · noch ${fmtDuration(next.hours * 60 - user.minutes)} bis „${next.label}“` : ' · höchster Rang!'}`;
    }
    case 'sprint': {
      const n = num(args[0]);
      await startFocus(settings, n && n > 0 ? n : undefined);
      return null; // die Ansage kommt vom Timer
    }
    case 'pause': {
      const n = num(args[0]);
      await startBreak(settings, n && n > 0 ? n : undefined);
      return null;
    }
    case 'stop': {
      await stopTimer(settings);
      return settings.announceSprint ? null : '⏹️ Timer gestoppt.';
    }
    case 'scene': {
      const key = Object.keys(SZENEN).find((k) => k === norm(args[0]) || norm(SZENEN[k].label) === norm(args[0]));
      if (!key) return `Szenen: ${Object.values(SZENEN).map((s) => s.label).join(', ')} – z. B. ${pre(settings)}szene garten`;
      await saveSettings({ scene: key });
      return `🎬 Neue Szene: ${SZENEN[key].label}.`;
    }
    case 'help': {
      const p = pre(settings);
      const extra = `${settings.checkinEnabled ? ` · ${p}streak` : ''}${settings.pointsEnabled ? ` · ${p}punkte · ${p}rangliste` : ''}`;
      if (settings.szeneModus !== 'zimmer') return `📖 ${p}task Text · ${p}done · ${p}tasks · ${p}wörter 300${extra}`;
      const sit = allowsSit(settings) ? `${p}sitzen · ` : needsReward(settings) ? `Platz per Reward „${settings.checkinRewardTitle}“ · ` : '';
      return `📖 ${sit}${p}aufstehen · ${p}figur · ${p}task Text · ${p}done · ${p}wörter 300 · ${p}rang${extra}`;
    }
    default: return null;
  }
}

async function doSit({ id, name, settings }) {
  if (!allowsSit(settings)) return `${name}, den Platz bekommst du per Kanalpunkte-Reward „${settings.checkinRewardTitle}“.`;
  return seatReply(await sit(id, name, settings), name, settings);
}

// Antwort und Overlay-Ereignis nach einem Hinsetzen (auch vom Check-in-Reward genutzt)
export async function seatReply(r, name, settings, { checkin = false } = {}) {
  const ort = sceneOf(settings).ort;
  if (r.status === 'full') return fill(settings.fullTemplate, { user: name });
  if (r.status === 'already') return fill(settings.sitAgainTemplate, { user: name, ort });
  await pushEvent({ type: 'sit', slot: r.seat.slot, name });
  const rank = rankFor(r.user.minutes).label;
  return fill(checkin ? settings.checkinTemplate : settings.sitTemplate, { user: name, ort, rank, count: r.user.days.length });
}

async function words({ id, name, args, settings, isBroadcaster }) {
  const raw = String(args[0] ?? '');
  const n = num(raw.replace(/^\+/, ''));
  if (n == null || n < 0) {
    const w = await getWords(settings);
    return isBroadcaster
      ? `Heute ${fmtNumber(w.today)} von ${fmtNumber(w.goal)} Wörtern. Melden mit ${pre(settings)}wörter 4231 (Stand aus Papyrus) oder ${pre(settings)}wörter +300.`
      : `${name}, melde deine Wörter mit ${pre(settings)}wörter 300 – sie zählen für die ganze Runde. Heute geschrieben: ${fmtNumber(w.today)} (Streamerin).`;
  }
  if (isBroadcaster) {
    const w = raw.startsWith('+') ? await addWords(n, settings) : await setAbsolute(n, settings);
    return `✍️ Heute ${fmtNumber(w.today)} von ${fmtNumber(w.goal)} Wörtern${w.goal && w.today >= w.goal ? ' – Ziel erreicht! 🎯' : ''}`;
  }
  if (await cooling(`words-${id}`, 20)) return null;
  const add = Math.min(Math.round(n), MAX_VIEWER_WORDS);
  if (add <= 0) return null;
  const user = await getOrCreateUser(id, name);
  user.words += add;
  await saveUser(id, user);
  const total = await addViewerWords(add, settings);
  await pushEvent({ type: 'words', name, words: add });
  return `✍️ ${name}: +${fmtNumber(add)} Wörter! Gemeinsam heute im Chat: ${fmtNumber(total)}.`;
}

function figureHelp(settings, user) {
  const p = pre(settings);
  const free = ITEMS.filter((i) => !settings.unlocksEnabled || user.minutes >= i.hours * 60).map((i) => i.id);
  return `🎨 ${p}figur <Platz> <Wert>. Plätze: ${Object.keys(SLOTS).join(', ')}. Mehr: ${p}figur haare · ${p}figur zufall.${free.length ? ` Freigeschaltet: ${free.join(', ')}.` : ''}`;
}

async function figure({ id, name, args, settings }) {
  const user = await getOrCreateUser(id, name);
  const [first, ...rest] = args;
  if (!first) return figureHelp(settings, user);
  if (norm(first) === 'zufall') {
    const pick = (list) => list[Math.floor(Math.random() * list.length)];
    const f = { ...user.figure };
    for (const slot of ['haare', 'frisur', 'haut', 'oberteil']) f[slot] = pick(slotValues(slot));
    return saveFigure(id, user, f, settings, `🎲 ${name} hat eine neue Figur!`);
  }
  const slotName = norm(first);
  const slot = SLOT_ALIASE[slotName] ?? slotName;
  if (!SLOTS[slot]) return `${name}, den Platz „${first}“ kenne ich nicht. ${figureHelp(settings, user)}`;
  const value = norm(rest.join(''));
  const options = slotValues(slot);
  if (!value) {
    const label = (v) => {
      const item = ITEMS.find((i) => i.id === v && i.slot === slot);
      return item && settings.unlocksEnabled && user.minutes < item.hours * 60 ? `${v} (ab ${item.hours} Std)` : v;
    };
    return `${SLOTS[slot].label}: ${options.map(label).join(', ')}`;
  }
  const picked = options.find((o) => o === value);
  if (!picked) return `${name}, „${rest.join(' ')}“ gibt es bei ${SLOTS[slot].label} nicht: ${options.join(', ')}`;
  const item = ITEMS.find((i) => i.id === picked && i.slot === slot);
  if (item && settings.unlocksEnabled && user.minutes < item.hours * 60) {
    return `🔒 ${name}, „${item.label}“ gibt es ab ${item.hours} Std Arbeitszeit (du hast ${fmtDuration(user.minutes)}).`;
  }
  return saveFigure(id, user, { ...user.figure, [slot]: picked }, settings, `🎨 ${name}: ${SLOTS[slot].label} ist jetzt „${picked}“.`);
}

async function saveFigure(id, user, figur, settings, message) {
  user.figure = cleanFigur(figur, settings.unlocksEnabled ? user.minutes : Infinity);
  await saveUser(id, user);
  const seat = await getSeat(id);
  if (seat) { // wer sitzt, sieht die Änderung sofort
    seat.figure = figureOf(user, settings);
    await db.set(`seat/${id}`, seat);
  }
  return message;
}

// Wetter, Tageszeit und Hintergrund per Chat (nur Moderation): z. B. !wetter regen, !tageszeit nacht, !hintergrund stadt
const LOOK = {
  weather: { key: 'wetter', name: 'Wetter', values: { klar: 'klar', wolkig: 'wolkig', regen: 'Regen', gewitter: 'Gewitter', schnee: 'Schnee', nebel: 'Nebel' }, icon: '🌦️' },
  daytime: { key: 'tageszeit', name: 'Tageszeit', values: { auto: 'automatisch', morgen: 'Morgen', mittag: 'Mittag', abend: 'Abend', nacht: 'Nacht' }, icon: '🕒' },
  backdrop: { key: 'hintergrund', name: 'Hintergrund', values: { landschaft: 'Landschaft mit Pavillon', zug: 'Zugabteil', sitzecke: 'Sitzecke am Fenster', stadt: 'Stadt', see: 'See', bild: 'eigenes Bild' }, icon: '🎬' },
};
async function setLook(action, args, settings) {
  const L = LOOK[action]; const want = norm(args[0] ?? '');
  const list = Object.keys(L.values).join(', ');
  if (!want) return `${L.icon} ${L.name}: ${L.values[settings[L.key]] ?? settings[L.key]}. Ändern mit ${settings.commandPrefix}${Object.keys(COMMANDS).find((k) => COMMANDS[k] === action)} <${list}>`;
  const value = Object.keys(L.values).find((v) => norm(v) === want || norm(L.values[v]) === want);
  if (!value) return `${L.name} „${args[0]}“ gibt es nicht. Möglich: ${list}`;
  const { error } = await saveSettings({ [L.key]: value });
  return error ? null : `${L.icon} ${L.name}: ${L.values[value]}`;
}
