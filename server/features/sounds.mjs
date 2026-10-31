// Eigene Töne für das Overlay: je eine Datei für „Pomodoro beginnt“ (start) und „Pomodoro zu Ende“ (ende).
// Sie liegen im Datenordner (sounds/), bleiben also bei Updates erhalten. Hochgeladen wird nur, was wirklich nach Audio aussieht.
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from '../core/config.mjs';

export const ARTEN = ['start', 'ende'];
export const MAX_BYTES = 4 * 1024 * 1024;
const DIR = path.join(DATA_DIR, 'sounds');
const TYPEN = { mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', webm: 'audio/webm', aac: 'audio/aac' };

// Erkennt das Format am Dateianfang (nicht am Namen). Gibt die Endung zurück oder null.
export function erkenneAudio(buf) {
  if (buf.length < 12) return null;
  const s = (a, b) => buf.toString('latin1', a, b);
  if (s(0, 3) === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe6) === 0xe2)) return 'mp3';
  if (s(0, 4) === 'RIFF' && s(8, 12) === 'WAVE') return 'wav';
  if (s(0, 4) === 'OggS') return 'ogg';
  if (s(4, 8) === 'ftyp') return 'm4a';
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'webm';
  if (buf[0] === 0xff && (buf[1] & 0xf6) === 0xf0) return 'aac';
  return null;
}

const dateien = (art) => (fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => f.startsWith(`${art}.`) && !f.endsWith('.name')) : []);

export function sound(art) {
  if (!ARTEN.includes(art)) return null;
  const f = dateien(art)[0];
  if (!f) return null;
  const pfad = path.join(DIR, f), st = fs.statSync(pfad);
  let name = f;
  try { name = fs.readFileSync(`${pfad}.name`, 'utf8') || f; } catch { /* ohne Namen */ }
  return { pfad, typ: TYPEN[path.extname(f).slice(1)] ?? 'application/octet-stream', groesse: st.size, v: Math.round(st.mtimeMs), name };
}

export function speichereSound(art, buf, name = '') {
  if (!ARTEN.includes(art)) throw new Error('Unbekannte Art');
  if (buf.length > MAX_BYTES) throw new Error('Die Datei ist zu groß (höchstens 4 MB)');
  const ext = erkenneAudio(buf);
  if (!ext) throw new Error('Das sieht nicht nach einer Audiodatei aus (erlaubt: MP3, WAV, OGG, M4A, WebM)');
  loescheSound(art);
  fs.mkdirSync(DIR, { recursive: true });
  const pfad = path.join(DIR, `${art}.${ext}`);
  fs.writeFileSync(pfad, buf);
  fs.writeFileSync(`${pfad}.name`, String(name).replace(/[^\p{L}\p{N} ._()-]/gu, '').slice(0, 80));
  return sound(art);
}

export function loescheSound(art) {
  for (const f of dateien(art)) { fs.rmSync(path.join(DIR, f), { force: true }); fs.rmSync(path.join(DIR, `${f}.name`), { force: true }); }
}

// Für das Overlay und den Admin: Adresse (mit Versionsnummer gegen Zwischenspeicher) und Name je Art
export function soundInfo() {
  const out = {};
  for (const art of ARTEN) { const s = sound(art); out[art] = s ? { url: `/api/sound/${art}?v=${s.v}`, name: s.name, groesse: s.groesse } : null; }
  return out;
}
