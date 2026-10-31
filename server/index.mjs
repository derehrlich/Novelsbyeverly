// Startpunkt. Ist im Datenordner ein Update eingespielt (<Datenordner>/app, siehe Admin → System), startet der Server daraus;
// scheitert das Laden, läuft die eingebaute Version weiter. Notausgang: den Ordner „app“ im Datenordner löschen
// oder COWORK_SAFE=1 setzen.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
process.env.DATA_DIR ??= fs.existsSync('/data') ? '/data' : path.join(root, 'data');
const dataRoot = path.resolve(process.env.LOCAL_STORE_DIR || process.env.DATA_DIR);
const update = path.join(dataRoot, 'app', 'server', 'main.mjs');

let started = false;
if (!process.env.COWORK_SAFE && fs.existsSync(update)) {
  try {
    await import(pathToFileURL(update).href);
    started = true;
    console.log('Update aus dem Datenordner geladen.');
  } catch (e) {
    console.error('Das eingespielte Update lässt sich nicht laden, starte die eingebaute Version:', e.message);
  }
}
if (!started) await import('./main.mjs');
