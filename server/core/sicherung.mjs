// Sicherungen des Datenordners (Einstellungen, Zählerstände, Aufgaben, Mitschreibende) und des Programms.
// Die Twitch-Zugänge (config/tokens, config/bot-tokens) sind bewusst nicht dabei: Sie lassen sich per Code neu verbinden.
// Nur Node-Bordmittel, weil auch die Update-Einspielung (update.mjs) das nutzt.
import fs from 'node:fs';
import path from 'node:path';
import { APP_DIR, BACKUP_DIR, DATA_DIR, PROGRAMM_TEILE, version } from './config.mjs';
import { readZip, writeZip } from './zip.mjs';

const STORE = path.join(DATA_DIR, 'cowork');
const AUSGENOMMEN = [/^config%2Ftokens$/, /^config%2Fbot-tokens$/, /^event%2F/, /^seen%2F/];
const jetzt = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '').replace('T', '_'); // 20261031_154500
const sicher = (s) => String(s).replace(/[^a-z0-9_]/gi, '').slice(0, 30) || 'manuell';
export const NAME_DATEN = /^sicherung_\d{8}_\d{6}_[a-z0-9_]+\.zip$/i;
export const NAME_PROGRAMM = /^programm_vor_update_\d{8}_\d{6}\.zip$/;

function behalte(muster, anzahl) {
  const alle = fs.readdirSync(BACKUP_DIR).filter((n) => muster.test(n)).sort();
  for (const n of alle.slice(0, Math.max(0, alle.length - anzahl))) fs.rmSync(path.join(BACKUP_DIR, n), { force: true });
}

// Datensicherung anlegen; behält die letzten 10
export function sichereDaten(grund = 'manuell') {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const entries = [{ name: 'INFO.txt', data: Buffer.from(`Co-Working-Overlay ${version()}\nGesichert: ${new Date().toISOString()}\nGrund: ${grund}\nEnthält Einstellungen und Zählerstände, nicht die Twitch-Zugänge.\n`) }];
  if (fs.existsSync(STORE)) {
    for (const f of fs.readdirSync(STORE)) {
      if (AUSGENOMMEN.some((r) => r.test(f))) continue;
      entries.push({ name: `cowork/${f}`, data: fs.readFileSync(path.join(STORE, f)) });
    }
  }
  const name = `sicherung_${jetzt()}_${sicher(grund)}.zip`;
  fs.writeFileSync(path.join(BACKUP_DIR, name), writeZip(entries));
  behalte(NAME_DATEN, 10);
  return name;
}

// Sicherung einspielen: alle Daten außer den Twitch-Zugängen werden ersetzt. Vorher entsteht eine Sicherung des jetzigen Stands.
export function stelleDatenWiederHer(zipPfad) {
  const entries = readZip(fs.readFileSync(zipPfad)).filter((e) => !e.dir && e.name.startsWith('cowork/') && !e.name.includes('..'));
  if (!entries.length) throw new Error('Die Sicherung enthält keine Daten');
  sichereDaten('vor_wiederherstellung');
  fs.mkdirSync(STORE, { recursive: true });
  for (const f of fs.readdirSync(STORE)) if (!AUSGENOMMEN.some((r) => r.test(f)) || /^(event|seen)%2F/.test(f)) fs.rmSync(path.join(STORE, f), { force: true });
  for (const e of entries) {
    const f = e.name.slice('cowork/'.length);
    if (f && !f.includes('/') && !AUSGENOMMEN.some((r) => r.test(f))) fs.writeFileSync(path.join(STORE, f), e.data());
  }
}

// Programmsicherung vor einem Update; behält die letzten 5
export function sichereProgramm() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const entries = [];
  const walk = (abs, rel) => {
    if (fs.statSync(abs).isDirectory()) for (const n of fs.readdirSync(abs)) walk(path.join(abs, n), `${rel}/${n}`);
    else entries.push({ name: rel, data: fs.readFileSync(abs) });
  };
  for (const teil of PROGRAMM_TEILE) if (fs.existsSync(path.join(APP_DIR, teil))) walk(path.join(APP_DIR, teil), teil);
  const name = `programm_vor_update_${jetzt()}.zip`;
  fs.writeFileSync(path.join(BACKUP_DIR, name), writeZip(entries));
  behalte(NAME_PROGRAMM, 5);
  return name;
}

export function liste() {
  if (!fs.existsSync(BACKUP_DIR)) return { daten: [], programm: [] };
  const info = (n) => { const s = fs.statSync(path.join(BACKUP_DIR, n)); return { name: n, groesse: s.size, zeit: s.mtimeMs }; };
  const alle = fs.readdirSync(BACKUP_DIR).sort().reverse();
  return { daten: alle.filter((n) => NAME_DATEN.test(n)).map(info), programm: alle.filter((n) => NAME_PROGRAMM.test(n)).map(info) };
}

// Gab es heute schon eine automatische Sicherung?
export function autoHeute() {
  const heute = jetzt().slice(0, 8);
  return fs.existsSync(BACKUP_DIR) && fs.readdirSync(BACKUP_DIR).some((n) => n.startsWith(`sicherung_${heute}_`) && n.endsWith('_auto.zip'));
}
