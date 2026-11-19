// Stream-Pause (Overlay /pause): zeigt neu zugeschalteten Zuschauern, dass es gleich weitergeht („Kurz Trinkpause“).
//   pause/state   { active, text, startedAt (ms), until (ms oder null) }
// Gesteuert per Chat (!auszeit 5 Trinkpause, !zurueck; nur Moderation und Streamerin) oder per Knopf im Admin.
// Nicht zu verwechseln mit der Pomodoro-Pause (!pause, timer.mjs). Neue Funktion: standardmäßig aus (pauseEnabled).
// Der Zustand ist kurzlebig und steht bewusst nicht in der Sicherung.
import { db } from './store.mjs';
import { fill } from './util.mjs';
import { norm } from '../../public/js/katalog.mjs';

export const STATE_KEY = 'pause/state';
const IDLE = { active: false, text: '', startedAt: 0, until: null };

// ---- Eigene Pausen („Vorlagen“): je ein Befehlswort, Text, Minuten und Icon (Emoji oder kleines Bild)
//   pausecfg/presets      [{ id, word, text, minutes (0 = offen), emoji }]
//   pausecfg/icon/<id>    { type, b64, size, version }   ausgeliefert über /api/pause-icon
export const MAX_PRESETS = 8;
export const MAX_ICON_BYTES = 600 * 1024;
const PRESETS_KEY = 'pausecfg/presets', ICON_KEY = (id) => `pausecfg/icon/${id}`;
export const validId = (id) => /^[a-z0-9]{4,12}$/.test(String(id ?? ''));
export const getPresets = async () => ((await db.get(PRESETS_KEY)) ?? []).filter((p) => p && validId(p.id));
export const presetByWord = async (word) => (await getPresets()).find((p) => p.word === word) ?? null;

/** Prüft die Liste aus dem Admin. `reserved` sind die Wörter, die der Bot schon kennt (!sprint, !wetter …). */
export function cleanPresets(input, reserved = []) {
  if (!Array.isArray(input)) return { error: 'Keine Liste von Pausen' };
  if (input.length > MAX_PRESETS) return { error: `Es sind höchstens ${MAX_PRESETS} eigene Pausen möglich` };
  const taken = new Set([...reserved.map(norm), 'auszeit', 'zurueck', 'weiter']);
  const out = [];
  for (const p of input) {
    const word = norm(p?.word).replace(/^[^a-z0-9]+/, '').replace(/[^a-z0-9]/g, '');
    if (word.length < 2 || word.length > 20) return { error: 'Das Befehlswort braucht 2 bis 20 Buchstaben oder Ziffern (zum Beispiel kaffee)' };
    if (taken.has(word)) return { error: `„${word}“ ist schon ein Befehl des Bots oder doppelt vergeben, bitte ein anderes Wort wählen` };
    taken.add(word);
    const text = String(p?.text ?? '').trim().slice(0, 80);
    if (!text) return { error: `Die Pause „${word}“ braucht einen Text` };
    const minutes = Math.min(240, Math.max(0, Math.round(Number(p?.minutes) || 0)));
    const emoji = [...String(p?.emoji ?? '').trim()].slice(0, 4).join('');
    out.push({ id: validId(p?.id) ? p.id : Math.random().toString(36).slice(2, 10).replace(/[^a-z0-9]/g, 'x'), word, text, minutes, emoji });
  }
  return { presets: out };
}

export async function savePresets(list, reserved = []) {
  const r = cleanPresets(list, reserved);
  if (r.error) return r;
  await db.set(PRESETS_KEY, r.presets);
  const keep = new Set(r.presets.map((p) => ICON_KEY(p.id)));
  for (const key of await db.list('pausecfg/icon/')) if (!keep.has(key)) await db.delete(key); // Bilder gelöschter Pausen aufräumen
  return r;
}

export const getIcon = (id) => (validId(id) ? db.get(ICON_KEY(id)) : null);
export async function saveIcon(id, data) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(data ?? ''));
  if (!validId(id)) return { error: 'Unbekannte Pause', status: 404 };
  if (!m) return { error: 'Bitte ein Bild (PNG, JPG oder WebP) wählen', status: 400 };
  const size = Math.floor((m[2].length * 3) / 4);
  if (size > MAX_ICON_BYTES) return { error: 'Das Bild ist zu groß (höchstens 600 KB, es wird im Browser verkleinert)', status: 413 };
  const icon = { type: m[1], b64: m[2], size, version: Date.now() };
  await db.set(ICON_KEY(id), icon);
  return { icon };
}
export const deleteIcon = (id) => (validId(id) ? db.delete(ICON_KEY(id)) : null);
const iconOf = async (p) => (p ? { emoji: p.emoji ?? '', url: (await getIcon(p.id)) ? `/api/pause-icon?id=${p.id}&v=${(await getIcon(p.id)).version}` : '' } : { emoji: '', url: '' });

export const getState = async () => ({ ...IDLE, ...((await db.get(STATE_KEY)) ?? {}) });

/** Aus „5 Trinkpause“ wird { minutes: 5, text: 'Trinkpause' }. Eine Zahl vorne ist optional (so lange dauert die Pause etwa). */
export function parseArgs(args) {
  const raw = Array.isArray(args) ? args.join(' ') : String(args ?? '');
  const m = /^(\d{1,3})\s*(?:min\w*)?(?:\s+(.*))?$/i.exec(raw.trim());
  if (m) return { minutes: Math.min(240, Math.max(1, Number(m[1]))), text: (m[2] ?? '').trim() };
  return { minutes: null, text: raw.trim() };
}

export async function start({ text, minutes, preset = null } = {}, settings, now = Date.now()) {
  const min = minutes ? Math.min(240, Math.max(1, Math.round(Number(minutes)))) : null;
  const state = { active: true, text: String(text ?? '').trim().slice(0, 80) || settings.pauseDefaultText, startedAt: now, until: min ? now + min * 60_000 : null, icon: await iconOf(preset) };
  await db.set(STATE_KEY, state);
  return state;
}

export async function stop() {
  const was = await getState();
  await db.set(STATE_KEY, { ...IDLE });
  return was;
}

/** Was die OBS-Seite braucht. `now` ist die Serverzeit in Millisekunden. */
export async function publicView(settings, now = Date.now()) {
  const s = await getState();
  return { show: s.active, text: s.text, sub: settings.pauseSubtitle, startedAt: s.startedAt, until: s.until, icon: s.icon ?? { emoji: '', url: '' }, now };
}

export const startReply = (state, settings) => fill(settings.pauseStartTemplate, { text: state.text, minutes: state.until ? Math.max(1, Math.round((state.until - state.startedAt) / 60_000)) : '' });
export const endReply = (settings) => settings.pauseEndTemplate;
