// Stream-Pause (Overlay /pause): zeigt neu zugeschalteten Zuschauern, dass es gleich weitergeht („Kurz Trinkpause“).
//   pause/state   { active, text, startedAt (ms), until (ms oder null) }
// Gesteuert per Chat (!auszeit 5 Trinkpause, !zurueck; nur Moderation und Streamerin) oder per Knopf im Admin.
// Nicht zu verwechseln mit der Pomodoro-Pause (!pause, timer.mjs). Neue Funktion: standardmäßig aus (pauseEnabled).
// Der Zustand ist kurzlebig und steht bewusst nicht in der Sicherung.
import { db } from './store.mjs';
import { fill } from './util.mjs';

export const STATE_KEY = 'pause/state';
const IDLE = { active: false, text: '', startedAt: 0, until: null };

export const getState = async () => ({ ...IDLE, ...((await db.get(STATE_KEY)) ?? {}) });

/** Aus „5 Trinkpause“ wird { minutes: 5, text: 'Trinkpause' }. Eine Zahl vorne ist optional (so lange dauert die Pause etwa). */
export function parseArgs(args) {
  const raw = Array.isArray(args) ? args.join(' ') : String(args ?? '');
  const m = /^(\d{1,3})\s*(?:min\w*)?(?:\s+(.*))?$/i.exec(raw.trim());
  if (m) return { minutes: Math.min(240, Math.max(1, Number(m[1]))), text: (m[2] ?? '').trim() };
  return { minutes: null, text: raw.trim() };
}

export async function start({ text, minutes } = {}, settings, now = Date.now()) {
  const min = minutes ? Math.min(240, Math.max(1, Math.round(Number(minutes)))) : null;
  const state = { active: true, text: String(text ?? '').trim().slice(0, 80) || settings.pauseDefaultText, startedAt: now, until: min ? now + min * 60_000 : null };
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
  return { show: s.active, text: s.text, sub: settings.pauseSubtitle, startedAt: s.startedAt, until: s.until, now };
}

export const startReply = (state, settings) => fill(settings.pauseStartTemplate, { text: state.text, minutes: state.until ? Math.max(1, Math.round((state.until - state.startedAt) / 60_000)) : '' });
export const endReply = (settings) => settings.pauseEndTemplate;
