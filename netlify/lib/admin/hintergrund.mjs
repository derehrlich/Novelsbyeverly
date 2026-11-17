// /api/admin/hintergrund: eigenes Hintergrundbild für das Overlay (statt der gemalten Landschaft).
//   GET     { vorhanden, version, size }
//   POST    { data: "data:image/jpeg;base64,…" }  speichert das Bild
//   DELETE  entfernt es
// Das Bild liegt unter bg/image und wird über /api/overlay-bg ausgeliefert (netlify/functions/overlay-bg.mjs).
import { db } from '../store.mjs';
import { getSettings, saveSettings } from '../settings.mjs';
import { json } from '../http.mjs';

export const MAX_BYTES = 5 * 1024 * 1024; // das Bild wird im Browser vorher verkleinert, das ist nur die Obergrenze
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function hintergrund({ route, method, body }) {
  if (route[0] !== 'hintergrund') return;
  if (method === 'GET') {
    const s = await getSettings();
    const img = await db.get('bg/image');
    return json({ vorhanden: Boolean(img), version: s.hintergrundVersion, size: img?.size ?? 0 });
  }
  if (method === 'POST') {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(body.data ?? ''));
    if (!m || !TYPES.includes(m[1])) return json({ error: 'Bitte ein Bild (JPG, PNG oder WebP) wählen' }, 400);
    const size = Math.floor((m[2].length * 3) / 4);
    if (size > MAX_BYTES) return json({ error: 'Das Bild ist zu groß (höchstens 5 MB)' }, 413);
    await db.set('bg/image', { type: m[1], b64: m[2], size });
    const { settings } = await saveSettings({ hintergrundVersion: Date.now() });
    return json({ ok: true, version: settings.hintergrundVersion, size });
  }
  if (method === 'DELETE') {
    await db.delete('bg/image');
    const { settings } = await saveSettings({ hintergrundVersion: 0, hintergrund: 'landschaft' });
    return json({ ok: true, version: 0, hintergrund: settings.hintergrund });
  }
}
