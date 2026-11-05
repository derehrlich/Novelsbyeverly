// Alle Routen an einer Stelle. Jede Route-Datei exportiert `config` ({ path, maxBody? }) und die Funktion (Request → Response).
import * as overlay from './overlay.mjs';
import * as admin from './admin.mjs';
import * as auth from './auth.mjs';
import * as ingestWords from './ingest-words.mjs';
import * as ingestMusik from './ingest-musik.mjs';
import * as system from './system.mjs';
import * as sounds from './sounds.mjs';
import * as ingestTode from './ingest-tode.mjs';

export const routes = [overlay, admin, auth, ingestWords, ingestMusik, system, sounds, ingestTode]
  .flatMap((m) => [m.config.path].flat().map((path) => ({ path, maxBody: m.config.maxBody, handler: m.default })));
