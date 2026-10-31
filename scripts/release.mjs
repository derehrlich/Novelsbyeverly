// Baut die Update-ZIP: node scripts/release.mjs  →  novelsbyeverly-<Version>.zip im Projektordner
// Die ZIP enthält nur das Programm (server, public, package.json, VERSION.txt), nie Daten oder Zugangsdaten.
// Hochladen: Admin → System → Update einspielen. Erste Installation: siehe ANLEITUNG_UPDATE.md.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROGRAMM_TEILE } from '../server/core/config.mjs';
import { writeZip } from '../server/core/zip.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entries = [];
const walk = (abs, rel) => {
  if (fs.statSync(abs).isDirectory()) for (const n of fs.readdirSync(abs).sort()) walk(path.join(abs, n), `${rel}/${n}`);
  else if (!/\.DS_Store$/.test(abs)) entries.push({ name: rel, data: fs.readFileSync(abs) });
};
for (const teil of PROGRAMM_TEILE) walk(path.join(root, teil), teil);
// Platzhalter für ältere Installationen: Deren eingebaute Update-Prüfung (Launcher-Version 1.1.0) verlangt diese beiden Dateien aus
// der früheren Ordnerstruktur. Sie sind leer und werden nur in die ZIP gelegt, nicht ins Projekt.
const BRUECKE = '// Platzhalter für die Update-Prüfung älterer Versionen, ohne Funktion.\nexport {};\n';
for (const name of ['server/lib/store.mjs', 'server/routes/admin.mjs']) entries.push({ name, data: Buffer.from(BRUECKE) });
const version = fs.readFileSync(path.join(root, 'VERSION.txt'), 'utf8').trim().split(/\s/)[0];
if (JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version !== version) throw new Error(`Versionen passen nicht: VERSION.txt sagt ${version}, package.json etwas anderes. Bitte beide gleich setzen.`);
const out = path.join(root, `novelsbyeverly-${version}.zip`);
fs.writeFileSync(out, writeZip(entries));
console.log(`${path.basename(out)}: ${entries.length} Dateien, ${(fs.statSync(out).size / 1048576).toFixed(1)} MB`);
