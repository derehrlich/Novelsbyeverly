// Speicher: JSON-Dateien in DATA_DIR (siehe config.mjs).
//
// Schlüssel:
//   config/settings|tokens|bot-tokens|state   Einstellungen, Twitch-Verbindungen (Kanal und Bot), IDs der Rewards
//   state/timer                               aktueller Sprint (Fokus, Pause, Leerlauf)
//   state/words                               Wortzähler der Streamerin (Tagesstand)
//   stats/community                           gemeinsam gearbeitete Minuten (schaltet das Zimmer frei)
//   user/<twitchId>                           Name, Arbeitszeit, Figur, Besuche
//   seat/<twitchId>                           wer gerade sitzt (Platz, Figur-Schnappschuss, Wörter im Sprint)
//   task/<twitchId>                           Aufgaben einer Person
//   checked/<tag>/<twitchId>                  Sperre: pro Stream-Tag nur ein Check-in
//   seen/<id>                                 Twitch wiederholt Zustellungen, hier werden sie erkannt
//   done/<sprintId>                           Sprint wurde bereits abgerechnet
//   event/<zeit>-<zufall>                     Overlay-Ereignisse (kurzlebig)
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './config.mjs';

function fileStore(name) {
  const dir = path.join(DATA_DIR, name);
  fs.mkdirSync(dir, { recursive: true });
  const f = (k) => path.join(dir, encodeURIComponent(k));
  return {
    async get(k) { try { return JSON.parse(fs.readFileSync(f(k), 'utf8')); } catch { return null; } },
    async set(k, v) { fs.writeFileSync(f(k), JSON.stringify(v)); },
    async setIfNew(k, v) {
      try { fs.writeFileSync(f(k), JSON.stringify(v), { flag: 'wx' }); return true; } catch { return false; }
    },
    async delete(k) { fs.rmSync(f(k), { force: true }); },
    async list(prefix = '') { return fs.readdirSync(dir).map(decodeURIComponent).filter((k) => k.startsWith(prefix)).sort(); },
  };
}

// Daten liegen als JSON-Dateien in DATA_DIR (im Container: /data, als Volume eingebunden).
export const db = fileStore('cowork');
