// Eigene Töne für die Alerts: je Alert-Art ein kurzer Ton (MP3, WAV oder OGG, bis 1,5 MB), der statt des Standard-Klangs abgespielt wird.
//   sound/index         { <slot>: { name, size, version } }
//   sound/file/<slot>   { type, b64 }       ausgeliefert über /api/alert-sound?slot=…&v=…
// Das Overlay bekommt die Adressen über view.alertSounds. Fehlt ein Ton, spielt der Standard-Klang.
import { db } from './store.mjs';

export const SOUND_SLOTS = [['follow', 'Follow'], ['sub', 'Abo'], ['resub', 'Abo-Jubiläum'], ['gift', 'Geschenk-Abos'], ['cheer', 'Bits'], ['raid', 'Raid'], ['rescue', 'Streak-Rettung']];
export const SLOT_IDS = SOUND_SLOTS.map(([k]) => k);
export const MAX_SOUND_BYTES = 1_500_000;
const INDEX = 'sound/index', FILE = (slot) => `sound/file/${slot}`;

// Dateityp an den ersten Bytes erkennen, nicht dem Namen glauben
export function sniffAudio(buf) {
  const head = buf.subarray(0, 12).toString('latin1');
  if (head.startsWith('RIFF') && head.slice(8, 12) === 'WAVE') return 'audio/wav';
  if (head.startsWith('OggS')) return 'audio/ogg';
  if (head.startsWith('ID3') || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) return 'audio/mpeg';
  return null;
}
export const cleanName = (n) => String(n ?? '').replace(/\.(mp3|wav|ogg)$/i, '').replace(/[<>"'`\u0000-\u001f]/g, '').trim().slice(0, 60);

export const getIndex = async () => (await db.get(INDEX)) ?? {};

export async function saveSound(slot, name, data) {
  if (!SLOT_IDS.includes(slot)) return { error: 'Unbekannte Alert-Art', status: 404 };
  const buf = Buffer.from(typeof data === 'string' ? data.replace(/^data:[^,]*;base64,/, '') : '', 'base64');
  if (!buf.length) return { error: 'Keine Datei empfangen', status: 400 };
  if (buf.length > MAX_SOUND_BYTES) return { error: 'Die Datei ist zu groß (höchstens 1,5 MB). Bitte kürzen oder kleiner abspeichern.', status: 413 };
  const type = sniffAudio(buf);
  if (!type) return { error: 'Bitte eine MP3-, WAV- oder OGG-Datei wählen', status: 400 };
  await db.set(FILE(slot), { type, b64: buf.toString('base64') });
  const index = await getIndex();
  index[slot] = { name: cleanName(name) || 'Eigener Ton', size: buf.length, version: Date.now() };
  await db.set(INDEX, index);
  return { index };
}

export async function deleteSound(slot) {
  if (!SLOT_IDS.includes(slot)) return { error: 'Unbekannte Alert-Art', status: 404 };
  await db.delete(FILE(slot));
  const index = await getIndex(); delete index[slot]; await db.set(INDEX, index);
  return { index };
}

export const getSoundFile = (slot) => (SLOT_IDS.includes(slot) ? db.get(FILE(slot)) : null);

/** { follow: '/api/alert-sound?slot=follow&v=…', … } für das Overlay (nur Alert-Arten mit hochgeladenem Ton) */
export async function soundUrls() {
  const index = await getIndex();
  return Object.fromEntries(Object.entries(index).filter(([k]) => SLOT_IDS.includes(k)).map(([k, v]) => [k, `/api/alert-sound?slot=${k}&v=${v.version}`]));
}
