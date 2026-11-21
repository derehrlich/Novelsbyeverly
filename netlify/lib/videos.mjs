// Videos für die Szenen: ein kurzes Video je Szene und Tageszeit, das als Ausblick durchs Fenster läuft (statt der Code-Landschaft).
// Nur auf dem Heimserver (LOCAL_STORE_DIR): Die Dateien liegen im Datenordner unter video/, die Angaben dazu im Speicher unter bg/video/<szene>/<zeit>.
// Wetter (Regen, Schnee, Nebel, Blitz) legt der Bot selbst darüber. Videos sind NICHT in der JSON-Sicherung, der Datenordner enthält sie aber.
import fs from 'node:fs';
import path from 'node:path';
import { db } from './store.mjs';

export const VIDEO_SZENEN = ['zug', 'sitzecke', 'stadt', 'see'];
export const VIDEO_ZEITEN = ['morgen', 'mittag', 'abend', 'nacht'];
// Bibliothek: je Szene bis zu drei eigene Videos (Plätze b1 b2 b3), unabhängig von der Tageszeit. Welches läuft, steht je Szene in der Einstellung video<Szene>: zeit | b1 | b2 | b3 | aus
export const VIDEO_BIB = ['b1', 'b2', 'b3'];
export const VIDEO_WAHL = ['zeit', ...VIDEO_BIB, 'link', 'aus']; // link = Video-Link (YouTube oder direkte MP4/WebM-Adresse) statt Datei
export const LINK_KEY = { zug: 'videoLinkZug', sitzecke: 'videoLinkSitzecke', stadt: 'videoLinkStadt', see: 'videoLinkSee' };
export const WAHL_KEY = { zug: 'videoZug', sitzecke: 'videoSitzecke', stadt: 'videoStadt', see: 'videoSee' };
export const MAX_VIDEO_BYTES = 80 * 1024 * 1024;
export const videosAvailable = () => Boolean(process.env.LOCAL_STORE_DIR);
export const videoDir = () => path.join(process.env.LOCAL_STORE_DIR ?? '.', 'video');
export const videoKey = (szene, zeit) => `bg/video/${szene}/${zeit}`;
// Zusätzlich: das Alert-Video (ein Buch, das aufklappt), abgelegt wie ein Szenen-Video unter bg/video/alert/buch
export const validSlot = (szene, zeit) => (szene === 'alert' && zeit === 'buch') || VIDEO_SZENEN.includes(szene) && (VIDEO_ZEITEN.includes(zeit) || VIDEO_BIB.includes(zeit));
export const cleanName = (n) => String(n ?? '').replace(/\.(mp4|webm|mov)$/i, '').replace(/[<>"'`\u0000-\u001f]/g, '').trim().slice(0, 40);

// Dateityp an den ersten Bytes erkennen (MP4/MOV: „ftyp“, WebM: EBML-Kennung), nicht dem Namen oder dem Header glauben
export function sniffVideo(buf) {
  if (buf.length > 12 && buf.subarray(4, 8).toString('latin1') === 'ftyp') return { type: 'video/mp4', ext: 'mp4' };
  if (buf.length > 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return { type: 'video/webm', ext: 'webm' };
  return null;
}

export const getVideoMeta = (szene, zeit) => db.get(videoKey(szene, zeit));
export const videoFile = (meta, szene, zeit) => path.join(videoDir(), `${szene}-${zeit}.${meta.ext}`);

export async function saveVideo(szene, zeit, buf, kind, name = '') {
  fs.mkdirSync(videoDir(), { recursive: true, mode: 0o700 });
  const old = await getVideoMeta(szene, zeit);
  const meta = { type: kind.type, ext: kind.ext, size: buf.length, version: Date.now(), name: cleanName(name) };
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
  for (const s of VIDEO_SZENEN) { out[s] = {}; for (const z of [...VIDEO_ZEITEN, ...VIDEO_BIB]) { const m = await getVideoMeta(s, z); if (m && fs.existsSync(videoFile(m, s, z))) out[s][z] = { size: m.size, version: m.version, name: m.name ?? '' }; } }
  const a = await getVideoMeta('alert', 'buch');
  out.alert = a && fs.existsSync(videoFile(a, 'alert', 'buch')) ? { buch: { size: a.size, version: a.version, name: a.name ?? '' } } : {};
  return out;
}

/** Adresse des Videos für Szene und Zeit, oder null (kein Video oder Datei fehlt) */
export async function videoUrl(szene, zeit, wahl = 'zeit') {
  if (!videosAvailable() || wahl === 'aus') return null;
  const slot = VIDEO_BIB.includes(wahl) ? wahl : zeit; // Bibliothek: dieses Video läuft zu jeder Tageszeit
  if (!validSlot(szene, slot)) return null;
  const m = await getVideoMeta(szene, slot);
  return m && fs.existsSync(videoFile(m, szene, slot)) ? `/api/overlay-video?s=${szene}&z=${slot}&v=${m.version}` : null;
}

/** Video-Link prüfen: YouTube (als eingebettetes Video) oder eine direkte https-Adresse auf eine MP4-/WebM-Datei.
 *  Liefert { kind: 'youtube', id } | { kind: 'datei', url } | null (leer oder nicht erlaubt). */
export function parseVideoLink(text) {
  const raw = String(text ?? '').trim();
  if (!raw || raw.length > 300) return null;
  let u;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.toLowerCase().replace(/^(www|m|music)\./, '');
  const okId = (id) => (/^[\w-]{11}$/.test(id ?? '') ? id : null);
  let id = null;
  if (host === 'youtu.be') id = okId(u.pathname.split('/')[1]);
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const [, kind, vid] = u.pathname.split('/');
    id = kind === 'watch' ? okId(u.searchParams.get('v')) : ['embed', 'shorts', 'live', 'v'].includes(kind) ? okId(vid) : null;
  }
  if (id) return { kind: 'youtube', id };
  if (/\.(mp4|webm|m4v)$/i.test(u.pathname)) return { kind: 'datei', url: u.href };
  return null;
}
export const LINK_FEHLER = 'Bitte einen YouTube-Link (https://www.youtube.com/watch?v=… oder https://youtu.be/…) oder eine direkte https-Adresse auf eine MP4- oder WebM-Datei eintragen';
