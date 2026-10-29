// Speicher: Netlify Blobs in der Cloud. Mit LOCAL_STORE_DIR (nur für Tests und lokale Entwicklung) landen die Daten in Dateien.
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
import { getStore } from '@netlify/blobs';
import fs from 'node:fs';
import path from 'node:path';

function fileStore(name) {
  const dir = path.join(process.env.LOCAL_STORE_DIR, name);
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

// Der Blobs-Client merkt sich beim Anlegen das Zugriffstoken der aktuellen Function-Umgebung, und das läuft nach einigen
// Stunden ab. Das Overlay fragt dauernd nach und hält die Function warm, deshalb entsteht der Client bei jedem Zugriff
// neu und liest so immer das aktuelle Token. Das Anlegen ist billig, es passiert dabei kein Netzwerkzugriff.
export function createBlobStore(name, openStore = getStore) {
  const store = () => openStore({ name, consistency: 'strong' });
  return {
    get: (k) => store().get(k, { type: 'json' }),
    set: (k, v) => store().setJSON(k, v),
    async setIfNew(k, v) { return (await store().setJSON(k, v, { onlyIfNew: true })).modified; },
    delete: (k) => store().delete(k),
    async list(prefix = '') {
      const keys = [];
      for await (const page of store().list({ prefix, paginate: true })) keys.push(...page.blobs.map((b) => b.key));
      return keys.sort();
    },
  };
}

export const db = process.env.LOCAL_STORE_DIR ? fileStore('cowork') : createBlobStore('cowork');
