import { db } from './store.mjs';

const pad = (n) => String(n).padStart(15, '0');

// Stream-Tag als YYYY-MM-DD in der eingestellten Zeitzone (der Tag wechselt zur eingestellten Stunde)
export function streamDay(settings, date = new Date()) {
  const shifted = new Date(date.getTime() - settings.dayRolloverHour * 3_600_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: settings.timezone }).format(shifted);
}

// 134 -> "2 Std 14 Min", 120 -> "2 Std", 45 -> "45 Min"
export function fmtDuration(minutes) {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} Min`;
  return m % 60 ? `${Math.floor(m / 60)} Std ${m % 60} Min` : `${Math.floor(m / 60)} Std`;
}

export const fmtNumber = (n) => new Intl.NumberFormat('de-DE').format(Math.round(n));

export const fill = (tpl, vars) => String(tpl).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);

// Etwas höchstens einmal tun, auch wenn mehrere Anfragen gleichzeitig kommen
export const once = (key) => db.setIfNew(`done/${key}`, Date.now());

// Overlay-Ereignis ablegen; das Overlay holt es beim nächsten Abruf. Alte Einträge werden gleich mit entsorgt.
export async function pushEvent(event) {
  const now = Date.now();
  await db.set(`event/${pad(now)}-${Math.random().toString(36).slice(2, 7)}`, { ...event, at: now });
  for (const key of await db.list('event/')) {
    if (now - Number(key.slice(6, 21)) > 600_000) await db.delete(key);
  }
}

export const eventCursor = (now = Date.now()) => `event/${pad(now)}`;
