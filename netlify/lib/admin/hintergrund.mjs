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

// Raumbilder der Szenen (Zug, Sitzecke, Stadt, See): Bild mit Fenster in Magenta, der Ausblick wird per Code eingesetzt
const PLATES = { zug: 'raumZug', sitzecke: 'raumSitzecke', stadt: 'raumStadt', see: 'raumSee' };
export const MAX_PLATE_BYTES = 8 * 1024 * 1024;

async function plate({ route, method, body }) {
  const name = route[2];
  if (!route[2]) {
    if (method !== 'GET') return;
    const s = await getSettings();
    return json({ raeume: Object.fromEntries(Object.entries(PLATES).map(([n, k]) => [n, s[k]])) });
  }
  if (!PLATES[name]) return json({ error: 'Unbekannte Szene' }, 404);
  if (method === 'POST') {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(body.data ?? ''));
    if (!m) return json({ error: 'Bitte ein Bild (JPG, PNG oder WebP) wählen' }, 400);
    const size = Math.floor((m[2].length * 3) / 4);
    if (size > MAX_PLATE_BYTES) return json({ error: 'Das Bild ist zu groß (höchstens 8 MB)' }, 413);
    await db.set(`bg/plate/${name}`, { type: m[1], b64: m[2], size });
    const { settings } = await saveSettings({ [PLATES[name]]: Date.now() });
    return json({ ok: true, version: settings[PLATES[name]], size });
  }
  if (method === 'DELETE') {
    await db.delete(`bg/plate/${name}`);
    await saveSettings({ [PLATES[name]]: 0 });
    return json({ ok: true, version: 0 });
  }
}

// Jahreszeiten-Landschaft: je Jahreszeit ein Anfangs- und Endbild (Himmel in Magenta) und drei Blätter mit Blumen, Herbstblättern und Blüten (Hintergrund Magenta)
export const JZ_SLOTS = { fruehlingA: 'jzFruehlingA', fruehlingB: 'jzFruehlingB', sommerA: 'jzSommerA', sommerB: 'jzSommerB', herbstA: 'jzHerbstA', herbstB: 'jzHerbstB', winterA: 'jzWinterA', winterB: 'jzWinterB', blumen: 'jzBlumen', blaetter: 'jzBlaetter', bluete: 'jzBluete' };
async function jz({ route, method, body }) {
  const name = route[2];
  if (!name) { if (method !== 'GET') return; const s = await getSettings(); return json({ slots: Object.fromEntries(Object.entries(JZ_SLOTS).map(([n, k]) => [n, s[k]])) }); }
  if (!JZ_SLOTS[name]) return json({ error: 'Unbekannter Platz' }, 404);
  if (method === 'POST') {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(body.data ?? ''));
    if (!m) return json({ error: 'Bitte ein Bild (JPG, PNG oder WebP) wählen' }, 400);
    const size = Math.floor((m[2].length * 3) / 4);
    if (size > MAX_PLATE_BYTES) return json({ error: 'Das Bild ist zu groß (höchstens 8 MB)' }, 413);
    await db.set(`bg/jz/${name}`, { type: m[1], b64: m[2], size });
    const { settings } = await saveSettings({ [JZ_SLOTS[name]]: Date.now() });
    return json({ ok: true, version: settings[JZ_SLOTS[name]], size });
  }
  if (method === 'DELETE') { await db.delete(`bg/jz/${name}`); await saveSettings({ [JZ_SLOTS[name]]: 0 }); return json({ ok: true, version: 0 }); }
}

export async function hintergrund(ctx) {
  const { route, method, body } = ctx;
  if (route[0] !== 'hintergrund') return;
  if (route[1] === 'raum') return plate(ctx);
  if (route[1] === 'jz') return jz(ctx);
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
