// Spielt beim Start ein hochgeladenes Update (update.zip) oder eine Datensicherung (restore.zip) ein.
// Läuft ganz am Anfang, bevor irgendein anderes Programmteil geladen wird, und nutzt nur Node-Bordmittel.
//
// Ablauf eines Updates: ZIP prüfen → in einen Hilfsordner entpacken → jede .mjs auf Syntaxfehler prüfen →
// altes Programm sichern (data/backups/programm_vor_update_*.zip) → server/ und public/ austauschen → Neustart.
// Schlägt etwas fehl, bleibt das alte Programm unverändert, die ZIP heißt dann update_fehlerhaft.zip und der Grund steht in update_status.txt.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { APP_DIR, DATA_DIR, PROGRAMM_TEILE } from './core/config.mjs';
import { readZip } from './core/zip.mjs';
import { sichereProgramm, stelleDatenWiederHer } from './core/sicherung.mjs';

export const UPDATE_ZIP = path.join(DATA_DIR, 'update.zip');
export const RESTORE_ZIP = path.join(DATA_DIR, 'restore.zip');
export const STATUS = path.join(DATA_DIR, 'update_status.txt');
const TMP = path.join(DATA_DIR, 'update_tmp');
const status = (text) => fs.writeFileSync(STATUS, `${new Date().toLocaleString('de-DE')}: ${text}\n`);

// Nimmt die Einträge einer ZIP und liefert { pfad: Buffer-Funktion } nur für die Programmteile.
// Ein einzelner umschließender Ordner (z. B. „novelsbyeverly/“) wird abgestreift.
export function programmEintraege(entries) {
  const dateien = entries.filter((e) => !e.dir && !e.name.startsWith('__MACOSX/'));
  const tops = new Set(dateien.map((e) => e.name.split('/')[0]));
  const strip = tops.size === 1 && !PROGRAMM_TEILE.includes([...tops][0]) ? `${[...tops][0]}/` : '';
  const out = new Map();
  for (const e of dateien) {
    const rel = strip && e.name.startsWith(strip) ? e.name.slice(strip.length) : e.name;
    if (!rel || rel.startsWith('/') || rel.split('/').includes('..')) throw new Error(`Unzulässiger Pfad in der ZIP: ${e.name}`);
    if (PROGRAMM_TEILE.includes(rel.split('/')[0])) out.set(rel, e);
  }
  for (const pflicht of ['server/index.mjs', 'server/update.mjs', 'public/overlay.html', 'VERSION.txt']) {
    if (!out.has(pflicht)) throw new Error(`Das ist kein Update für dieses Programm (${pflicht} fehlt)`);
  }
  return out;
}

function pruefeSyntax(ordner) {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((f) => (f.isDirectory() ? walk(path.join(d, f.name)) : [path.join(d, f.name)]));
  for (const f of walk(ordner).filter((x) => x.endsWith('.mjs'))) {
    try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); } catch (e) { throw new Error(`Syntaxfehler in ${path.relative(ordner, f)}: ${String(e.stderr ?? e.message).split('\n').slice(0, 3).join(' ')}`); }
  }
}

function spieleUpdateEin() {
  const eintraege = programmEintraege(readZip(fs.readFileSync(UPDATE_ZIP)));
  fs.rmSync(TMP, { recursive: true, force: true });
  for (const [rel, e] of eintraege) { const z = path.join(TMP, rel); fs.mkdirSync(path.dirname(z), { recursive: true }); fs.writeFileSync(z, e.data()); }
  pruefeSyntax(TMP);
  if (fs.existsSync(path.join(TMP, 'package.json'))) JSON.parse(fs.readFileSync(path.join(TMP, 'package.json'), 'utf8'));
  sichereProgramm();
  const getauscht = [];
  try {
    for (const teil of PROGRAMM_TEILE) {
      const neu = path.join(TMP, teil), alt = path.join(APP_DIR, teil);
      if (!fs.existsSync(neu)) continue;
      if (fs.existsSync(alt)) fs.renameSync(alt, `${alt}.alt`);
      getauscht.push(teil);
      fs.cpSync(neu, alt, { recursive: true });
    }
  } catch (e) { // zurückrollen
    for (const teil of getauscht) { const alt = path.join(APP_DIR, teil); fs.rmSync(alt, { recursive: true, force: true }); if (fs.existsSync(`${alt}.alt`)) fs.renameSync(`${alt}.alt`, alt); }
    throw e;
  }
  for (const teil of getauscht) fs.rmSync(path.join(APP_DIR, `${teil}.alt`), { recursive: true, force: true });
  fs.rmSync(TMP, { recursive: true, force: true });
  const v = fs.readFileSync(path.join(APP_DIR, 'VERSION.txt'), 'utf8').trim().split('\n')[0];
  fs.rmSync(UPDATE_ZIP, { force: true });
  status(`Update auf „${v}“ erfolgreich eingespielt`);
}

// Gibt true zurück, wenn etwas eingespielt wurde (dann muss der Prozess neu starten).
export function wendeAnstehendesAn() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  let neustart = false;
  if (fs.existsSync(RESTORE_ZIP)) {
    try { stelleDatenWiederHer(RESTORE_ZIP); status('Sicherung wiederhergestellt'); } catch (e) { status(`Wiederherstellung fehlgeschlagen: ${e.message}`); }
    fs.rmSync(RESTORE_ZIP, { force: true });
  }
  if (fs.existsSync(UPDATE_ZIP)) {
    try { spieleUpdateEin(); neustart = true; } catch (e) {
      fs.rmSync(TMP, { recursive: true, force: true });
      fs.renameSync(UPDATE_ZIP, path.join(DATA_DIR, 'update_fehlerhaft.zip'));
      status(`Update fehlgeschlagen, das alte Programm läuft weiter: ${e.message}`);
      console.error('Update fehlgeschlagen:', e.message);
    }
  }
  return neustart;
}
