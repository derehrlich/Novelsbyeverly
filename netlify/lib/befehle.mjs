// Eigene Chat-Befehle, Zitate und Shoutout (Admin → Chat → Eigene Befehle und Zitate).
// Ein eigener Befehl: { id, name, enabled, type, word, minutes, minMessages, role, cooldown, text, bookTitle, bookText }
//   type: command (!ant) | keyword (Stichwort irgendwo in der Nachricht) | timer (Erinnerung alle X Minuten, nur wenn im Chat etwas los ist)
//   role: all | sub | vip | mod | owner    text = Chat-Antwort, bookTitle/bookText = optional das Buch im Overlay
//   Platzhalter: {user} {args} {channel} {random} {count} {game} {title} {uptime} {viewers}
// Speicher: cmd/list (Liste), counter/<id> (Zähler für {count}), state/chatpulse (Zeitpunkte der letzten Chat-Nachrichten für Erinnerungen),
//   quote/<n> { n, text, by, date }, quotemeta/counter (letzte vergebene Nummer), cooldown/… (kurzlebig)
import crypto from 'node:crypto';
import { db } from './store.mjs';
import { fill, fmtDuration, pushEvent } from './util.mjs';
import { norm } from '../../public/js/katalog.mjs';
import { channelInfo, helix, sendChat, storedTokens, userByLogin } from './twitch.mjs';

export const MAX_COMMANDS = 40;
export const TYPES = ['command', 'keyword', 'timer'];
export const ROLES = ['all', 'sub', 'vip', 'mod', 'owner'];
const ROLE_BADGES = { all: null, sub: ['subscriber', 'vip', 'moderator', 'broadcaster'], vip: ['vip', 'moderator', 'broadcaster'], mod: ['moderator', 'broadcaster'], owner: ['broadcaster'] };
const LIST = 'cmd/list';
const str = (v, max) => String(v ?? '').trim().slice(0, max);
const clamp = (n, min, max, def) => (Number.isFinite(Number(n)) && n !== '' && n != null ? Math.min(max, Math.max(min, Math.round(Number(n)))) : def);
const newId = () => crypto.randomBytes(4).toString('hex');
const validId = (id) => /^[a-f0-9]{8}$/.test(String(id ?? ''));

export const getCommands = async () => ((await db.get(LIST)) ?? []).filter((c) => c && validId(c.id));

/** Prüft die Liste aus dem Admin. `reserved` sind Wörter, die der Bot schon kennt (!sprint, !pause …, eigene Pausen). */
export function cleanCommands(input, reserved = []) {
  if (!Array.isArray(input)) return { error: 'Keine Liste von Befehlen' };
  if (input.length > MAX_COMMANDS) return { error: `Es sind höchstens ${MAX_COMMANDS} eigene Befehle möglich` };
  const taken = new Set(reserved.map(norm));
  const out = [];
  for (const c of input) {
    const type = TYPES.includes(c?.type) ? c.type : 'command';
    const text = str(c?.text, 450), bookTitle = str(c?.bookTitle, 60), bookText = str(c?.bookText, 200);
    if (!text && !bookTitle && !bookText) return { error: 'Jeder Befehl braucht eine Antwort im Chat oder einen Text fürs Buch' };
    const item = { id: validId(c?.id) ? c.id : newId(), enabled: c?.enabled !== false, type, role: ROLES.includes(c?.role) ? c.role : 'all', text, bookTitle, bookText, word: '', minutes: 0, minMessages: 0, cooldown: clamp(c?.cooldown, 0, 86_400, type === 'timer' ? 0 : 10) };
    if (type === 'command') {
      const word = norm(c?.word).replace(/^[^a-z0-9_]+/, '').replace(/[^a-z0-9_]/g, '');
      if (word.length < 2 || word.length > 20) return { error: 'Das Befehlswort braucht 2 bis 20 Buchstaben oder Ziffern (zum Beispiel ant)' };
      if (taken.has(word)) return { error: `„${word}“ ist schon ein Befehl des Bots oder doppelt vergeben, bitte ein anderes Wort wählen` };
      taken.add(word); item.word = word;
    } else if (type === 'keyword') {
      const word = str(c?.word, 40).toLowerCase();
      if (word.length < 2) return { error: 'Das Stichwort braucht mindestens 2 Zeichen' };
      item.word = word;
    } else { item.minutes = clamp(c?.minutes, 5, 720, 20); item.minMessages = clamp(c?.minMessages, 1, 100, 3); }
    item.name = str(c?.name, 45) || (type === 'timer' ? 'Erinnerung' : item.word);
    out.push(item);
  }
  return { commands: out };
}

export async function saveCommands(list, reserved = []) {
  const r = cleanCommands(list, reserved);
  if (r.error) return r;
  await db.set(LIST, r.commands);
  const keep = new Set(r.commands.map((c) => `counter/${c.id}`));
  for (const key of await db.list('counter/')) if (!keep.has(key)) await db.delete(key); // Zähler gelöschter Befehle aufräumen
  return r;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const keywordMatches = (cmd, text) => new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(cmd.word)}($|[^\\p{L}\\p{N}])`, 'iu').test(text);

export function allowed(cmd, e) {
  const need = ROLE_BADGES[cmd.role ?? 'all'];
  if (!need) return true;
  const have = new Set((e.badges ?? []).map((b) => b.set_id));
  if (e.chatter_user_id && e.chatter_user_id === e.broadcaster_user_id) have.add('broadcaster');
  return need.some((b) => have.has(b));
}

async function cooling(key, seconds, now) {
  if (!seconds) return false;
  const last = await db.get(`cooldown/${key}`);
  if (last && now - last < seconds * 1000) return true;
  await db.set(`cooldown/${key}`, now);
  return false;
}

// Live-Werte für {game} {title} {uptime} {viewers}; fällt Twitch aus, stehen „?“ da statt der Klammern
async function liveVars() {
  try {
    const t = await storedTokens('broadcaster');
    const s = (await helix('GET', 'streams', { as: 'app', query: { user_id: t.user_id } })).data?.[0];
    return { game: s?.game_name || 'unbekannt', title: s?.title || 'unbekannt', viewers: String(s?.viewer_count ?? 0), uptime: s?.started_at ? fmtDuration((Date.now() - Date.parse(s.started_at)) / 60_000) : 'offline' };
  } catch (err) { console.warn('Live-Daten fehlgeschlagen:', err.message); return { game: '?', title: '?', viewers: '?', uptime: '?' }; }
}

/** Texte eines Befehls mit eingesetzten Platzhaltern. `dry`: der Zähler läuft nicht weiter (Testknopf im Admin). */
export async function render(cmd, ctx = {}, { dry = false } = {}) {
  const vars = { user: ctx.user ?? '', args: ctx.args ?? '', channel: ctx.channel ?? '', random: String(1 + Math.floor(Math.random() * 100)) };
  const all = `${cmd.text} ${cmd.bookTitle} ${cmd.bookText}`;
  if (/\{(game|title|uptime|viewers)\}/.test(all)) Object.assign(vars, await liveVars());
  if (/\{count\}/.test(all)) {
    const key = `counter/${cmd.id}`;
    const next = ((await db.get(key)) ?? 0) + 1; // beim Testknopf (dry) nur die nächste Nummer zeigen, nicht speichern
    if (!dry) await db.set(key, next);
    vars.count = String(next);
  }
  return { text: cmd.text ? fill(cmd.text, vars) : '', bookTitle: fill(cmd.bookTitle, vars), bookText: fill(cmd.bookText, vars), user: vars.user };
}

/** Führt einen Befehl aus: Antwort im Chat und (wenn angegeben) das Buch im Overlay. */
export async function run(cmd, ctx, settings) {
  const r = await render(cmd, ctx);
  if (r.text && settings.chatEnabled) await sendChat(r.text.slice(0, 500)).catch((e) => console.warn('Chat fehlgeschlagen:', e.message));
  if (r.bookTitle || r.bookText) await pushEvent({ type: 'alert', kind: 'command', user: r.user, title: r.bookTitle, message: r.bookText, ms: (settings.alertSeconds ?? 7) * 1000 });
  return r;
}

/** Befehlswort (!ant): gefunden, erlaubt und nicht gerade in der Wartezeit? */
export async function handleWord(word, args, e, settings, now = Date.now()) {
  const cmd = (await getCommands()).find((c) => c.enabled && c.type === 'command' && c.word === word);
  if (!cmd || !allowed(cmd, e)) return null;
  if (await cooling(`cmd-${cmd.id}`, cmd.cooldown, now)) return null;
  await run(cmd, { user: e.chatter_user_name, args, channel: e.broadcaster_user_name }, settings);
  return cmd;
}

/** Stichwörter: gelten für jede Nachricht (auch ohne Befehlszeichen), nie für die Nachrichten des Kanalinhabers (Endlosschleife). */
export async function handleKeywords(e, text, settings, now = Date.now()) {
  if (e.chatter_user_id === e.broadcaster_user_id) return 0;
  const list = (await getCommands()).filter((c) => c.enabled && c.type === 'keyword');
  let n = 0;
  for (const cmd of list) {
    if (!keywordMatches(cmd, text) || !allowed(cmd, e)) continue;
    if (await cooling(`cmd-${cmd.id}`, cmd.cooldown, now)) continue;
    await run(cmd, { user: e.chatter_user_name, args: text, channel: e.broadcaster_user_name }, settings);
    n += 1;
  }
  return n;
}

// ---- Erinnerungen: nur wenn im Chat etwas los ist (Zeitpunkte der letzten Nachrichten, ohne Bots und Kanalinhaber)
const PULSE = 'state/chatpulse';
export async function recordPulse(now = Date.now()) {
  const old = (await db.get(PULSE))?.times ?? [];
  await db.set(PULSE, { times: [...old.filter((t) => now - t < 6 * 3_600_000), now].slice(-200) });
}
export async function tickTimers(settings, now = Date.now()) {
  const timers = (await getCommands()).filter((c) => c.enabled && c.type === 'timer');
  if (!timers.length) return 0;
  const times = (await db.get(PULSE))?.times ?? [];
  let ran = 0;
  for (const cmd of timers) {
    const last = (await db.get(`cooldown/timer-${cmd.id}`)) ?? 0;
    if (now - last < cmd.minutes * 60_000) continue;
    if (times.filter((t) => t > Math.max(last, now - cmd.minutes * 60_000)).length < cmd.minMessages) continue; // niemand schreibt: nichts ausspielen
    await db.set(`cooldown/timer-${cmd.id}`, now);
    await run(cmd, { channel: '' }, settings);
    ran += 1;
  }
  return ran;
}
let lastTick = 0;
export async function tickTimersThrottled(settings, now = Date.now()) {
  if (now - lastTick < 20_000) return 0;
  lastTick = now;
  return tickTimers(settings, now);
}

// ---- Zitate
export async function addQuote(text, by, now = new Date()) {
  const n = ((await db.get('quotemeta/counter')) ?? 0) + 1;
  await db.set('quotemeta/counter', n);
  await db.set(`quote/${n}`, { n, text: str(text, 300), by: str(by, 40), date: now.toISOString().slice(0, 10) });
  return n;
}
export async function listQuotes() {
  const keys = await db.list('quote/');
  return (await Promise.all(keys.map((k) => db.get(k)))).filter(Boolean).sort((a, b) => a.n - b.n);
}
export async function pickQuote(arg = '') {
  const wanted = /^#?(\d+)$/.exec(String(arg).trim());
  if (wanted) return db.get(`quote/${wanted[1]}`);
  const keys = await db.list('quote/');
  return keys.length ? db.get(keys[Math.floor(Math.random() * keys.length)]) : null;
}
export async function deleteQuote(n) {
  if (!(await db.get(`quote/${n}`))) return false;
  await db.delete(`quote/${n}`);
  return true;
}
const fmtDate = (iso) => String(iso).split('-').reverse().join('.');
export const quoteText = (q, settings) => fill(settings.quoteTemplate, { n: q.n, text: q.text, by: q.by, date: fmtDate(q.date) });

// ---- Shoutout: Chat-Nachricht mit Link und zuletzt gespieltem Spiel (kein offizieller Twitch-Shoutout, der braucht eine zusätzliche Berechtigung)
export async function shoutText(login, settings) {
  const user = await userByLogin(login);
  if (!user) return null;
  const info = await channelInfo(user.id).catch(() => null);
  return fill(settings.soTemplate, { name: user.display_name, game: info?.game || 'unbekannt', url: `twitch.tv/${user.login}` });
}
