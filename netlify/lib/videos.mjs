// Videos für die Szenen: ein kurzes Video je Szene und Tageszeit, das als Ausblick durchs Fenster läuft (statt der Code-Landschaft).
// Nur auf dem Heimserver (LOCAL_STORE_DIR): Die Dateien liegen im Datenordner unter video/, die Angaben dazu im Speicher unter bg/video/<szene>/<zeit>.
// Wetter (Regen, Schnee, Nebel, Blitz) legt der Bot selbst darüber. Videos sind NICHT in der JSON-Sicherung, der Datenordner enthält sie aber.
import fs from 'node:fs';
import path from 'node:path';
import { db } from './store.mjs';

export const VIDEO_SZENEN = ['zug', 'sitzecke', 'stadt', 'see'];
export const VIDEO_ZEITEN = ['morgen', 'mittag', 'abend', 'nacht'];
export const MAX_VIDEO_BYTES = 80 * 1024 * 1024;
export const videosAvailable = () => Boolean(process.env.LOCAL_STORE_DIR);
export const videoDir = () => path.join(process.env.LOCAL_STORE_DIR ?? '.', 'video');
export const videoKey = (szene, zeit) => `bg/video/${szene}/${zeit}`;
export const validSlot = (szene, zeit) => VIDEO_SZENEN.includes(szene) && VIDEO_ZEITEN.includes(zeit);

// Dateityp an den ersten Bytes erkennen (MP4/MOV: „ftyp“, WebM: EBML-Kennung), nicht dem Namen oder dem Header glauben
export function sniffVideo(buf) {
  if (buf.length > 12 && buf.subarray(4, 8).toString('latin1') === 'ftyp') return { type: 'video/mp4', ext: 'mp4' };
  if (buf.length > 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return { type: 'video/webm', ext: 'webm' };
  return null;
}

export const getVideoMeta = (szene, zeit) => db.get(videoKey(szene, zeit));
export const videoFile = (meta, szene, zeit) => path.join(videoDir(), `${szene}-${zeit}.${meta.ext}`);

export async function saveVideo(szene, zeit, buf, kind) {
  fs.mkdirSync(videoDir(), { recursive: true, mode: 0o700 });
  const old = await getVideoMeta(szene, zeit);
  const meta = { type: kind.type, ext: kind.ext, size: buf.length, version: Date.now() };
  const file = videoFile(meta, szene, zeit); const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, buf, { mode: 0o600 }); fs.renameSync(tmp, file);
  if (old && old.ext !== meta.ext) fs.rmSync(videoFile(old, szene, zeit), { force: true });
  await db.set(videoKey(szene, zeit), meta);
  return meta;
}

export async function deleteVideo(szene, zeit) {
  const meta = await getVideoMeta(szene, zeit);
  if (meta) fs.rmSync(videoFile(meta, szene, zeit), { force: true });
  await db.delete(videoKey(szene, zeit));
}

/** Übersicht: { zug: { morgen: { size, version }, … }, … } */
export async function listVideos() {
  const out = {};
  for (const s of VIDEO_SZENEN) { out[s] = {}; for (const z of VIDEO_ZEITEN) { const m = await getVideoMeta(s, z); if (m && fs.existsSync(videoFile(m, s, z))) out[s][z] = { size: m.size, version: m.version }; } }
  return out;
}

/** Adresse des Videos für Szene und Zeit, oder null (kein Video oder Datei fehlt) */
export async function videoUrl(szene, zeit) {
  if (!videosAvailable() || !validSlot(szene, zeit)) return null;
  const m = await getVideoMeta(szene, zeit);
  return m && fs.existsSync(videoFile(m, szene, zeit)) ? `/api/overlay-video?s=${szene}&z=${zeit}&v=${m.version}` : null;
}
