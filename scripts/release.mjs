// Baut die Update-ZIP fürs CasaOS-Tool:  npm run zip   →  dist/novelsbyeverly-<Version>.zip
// Inhalt wie die bisherigen Updates: server/, public/, package.json, VERSION.txt (ohne umschließenden Ordner).
// Hochladen: Admin → System → Update. Prüft vorher jede .mjs auf Syntaxfehler und die Pflichtdateien, die der Updater verlangt.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEILE = ['server', 'public', 'package.json', 'VERSION.txt'];
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const vz = fs.readFileSync(path.join(root, 'VERSION.txt'), 'utf8').trim();
if (!vz.startsWith(version)) throw new Error(`VERSION.txt („${vz.slice(0, 30)}…“) passt nicht zur Version ${version} in package.json`);
for (const pflicht of ['server/index.mjs', 'server/main.mjs', 'server/update.mjs', 'public/overlay.html']) if (!fs.existsSync(path.join(root, pflicht))) throw new Error(`${pflicht} fehlt`);

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((f) => (f.isDirectory() ? walk(path.join(d, f.name)) : [path.join(d, f.name)]));
for (const f of walk(path.join(root, 'server')).concat(walk(path.join(root, 'public'))).filter((x) => x.endsWith('.mjs'))) execFileSync(process.execPath, ['--check', f]);

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', `novelsbyeverly-${version}.zip`);
fs.rmSync(out, { force: true });
execFileSync('zip', ['-r', '-X', '-q', out, ...TEILE, '-x', '*.DS_Store'], { cwd: root });
console.log(`${path.relative(root, out)} (${Math.round(fs.statSync(out).size / 1024)} KB)`);
