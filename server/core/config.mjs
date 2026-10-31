// Pfade und feste Werte. Nur Node-Bordmittel, damit auch die Update-Einspielung (update.mjs) das laden kann.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// Datenordner: Einstellungen, Zählerstände, Sicherungen. Wird bei Updates nie angefasst.
export const DATA_DIR = process.env.LOCAL_STORE_DIR || process.env.DATA_DIR || (fs.existsSync('/data') ? '/data' : path.join(APP_DIR, 'data'));
// Zugangsdaten stehen in <Datenordner>/novelsbyeverly.env (Zeilen KEY=Wert), nie im Programm, in Git oder in docker-compose.yml.
// Echte Umgebungsvariablen haben Vorrang.
const ENV_DATEI = path.join(DATA_DIR, 'novelsbyeverly.env');
if (fs.existsSync(ENV_DATEI)) {
  for (const zeile of fs.readFileSync(ENV_DATEI, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(zeile);
    if (m && !zeile.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, '$2');
  }
}
export const PORT = Number(process.env.PORT ?? 8888);
export const BACKUP_DIR = path.join(DATA_DIR, 'backups');

// Teile des Programms, die ein Update austauscht (alles andere in der ZIP wird ignoriert)
export const PROGRAMM_TEILE = ['server', 'public', 'package.json', 'VERSION.txt'];

export function version() {
  try { return fs.readFileSync(path.join(APP_DIR, 'VERSION.txt'), 'utf8').trim(); } catch { return 'unbekannt'; }
}
