// System: Version, Update per ZIP, Programm zurückrollen, Datensicherungen, Neustart. Alles nur mit Admin-Login.
//   GET  /api/system                       Version, Status des letzten Updates, Sicherungen
//   POST /api/system/update                ZIP als Body (Content-Type: application/zip)
//   POST /api/system/zurueck   {name}      älteren Programmstand einspielen
//   POST /api/system/sicherung             Datensicherung jetzt anlegen
//   GET  /api/system/sicherung/<name>      Sicherung herunterladen
//   POST /api/system/wiederherstellen {name}   Datensicherung einspielen
//   DELETE /api/system/sicherung/<name>    Sicherung löschen
//   POST /api/system/neustart
import fs from 'node:fs';
import path from 'node:path';
import { BACKUP_DIR, DATA_DIR, version } from '../core/config.mjs';
import { hasSession, json } from '../core/http.mjs';
import { NAME_DATEN, NAME_PROGRAMM, liste, sichereDaten } from '../core/sicherung.mjs';
import { RESTORE_ZIP, STATUS, UPDATE_ZIP, programmEintraege } from '../update.mjs';
import { readZip } from '../core/zip.mjs';

export const config = { path: ['/api/system', '/api/system/*'], maxBody: 60 * 1024 * 1024 };

const startzeit = Date.now();
// Beendet den Prozess; Docker (restart: unless-stopped) startet ihn mit dem neuen Programm wieder. Austauschbar für Tests.
export const hooks = { neustart: () => setTimeout(() => { console.log('Neustart auf Wunsch aus dem Admin'); process.exit(1); }, 600) };
const neustart = () => hooks.neustart();
const lies = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim() : '');

export default async (req) => {
  if (!hasSession(req)) return json({ error: 'Nicht angemeldet' }, 401);
  const route = new URL(req.url).pathname.replace(/^\/api\/system\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const type = req.headers.get('content-type') ?? '';
  const writes = ['POST', 'PUT', 'DELETE'].includes(req.method);
  const zipUpload = route[0] === 'update' && type.includes('application/zip');
  if (writes && !zipUpload && !type.includes('application/json')) return json({ error: 'Content-Type muss application/json sein' }, 415);
  const body = writes && !zipUpload ? await req.json().catch(() => ({})) : {};

  try {
    if (!route.length && req.method === 'GET') {
      return json({ version: version(), laeuftSeit: startzeit, status: lies(STATUS), updateWartet: fs.existsSync(UPDATE_ZIP), ...liste(), datenordner: DATA_DIR });
    }
    if (route[0] === 'update' && req.method === 'POST') {
      if (!zipUpload) return json({ error: 'Bitte eine ZIP-Datei senden (application/zip)' }, 415);
      const daten = Buffer.from(await req.arrayBuffer());
      try { programmEintraege(readZip(daten)); } catch (e) { return json({ error: e.message }, 400); }
      sichereDaten('vor_update'); // Einstellungen sichern, bevor etwas passiert
      fs.writeFileSync(UPDATE_ZIP, daten);
      neustart();
      return json({ ok: true, hinweis: 'Update wird eingespielt, das Programm startet neu (bis zu 1 Minute).' });
    }
    if (route[0] === 'zurueck' && req.method === 'POST') {
      if (!NAME_PROGRAMM.test(body.name ?? '') || !fs.existsSync(path.join(BACKUP_DIR, body.name))) return json({ error: 'Unbekannter Programmstand' }, 400);
      fs.copyFileSync(path.join(BACKUP_DIR, body.name), UPDATE_ZIP);
      neustart();
      return json({ ok: true, hinweis: 'Älterer Programmstand wird eingespielt, das Programm startet neu.' });
    }
    if (route[0] === 'sicherung') {
      if (req.method === 'POST') return json({ ok: true, name: sichereDaten('manuell') });
      const name = route[1] ?? '';
      if (!NAME_DATEN.test(name) || !fs.existsSync(path.join(BACKUP_DIR, name))) return json({ error: 'Unbekannte Sicherung' }, 404);
      if (req.method === 'GET') return new Response(fs.readFileSync(path.join(BACKUP_DIR, name)), { headers: { 'content-type': 'application/zip', 'content-disposition': `attachment; filename="${name}"` } });
      if (req.method === 'DELETE') { fs.rmSync(path.join(BACKUP_DIR, name)); return json({ ok: true }); }
    }
    if (route[0] === 'wiederherstellen' && req.method === 'POST') {
      if (!NAME_DATEN.test(body.name ?? '') || !fs.existsSync(path.join(BACKUP_DIR, body.name))) return json({ error: 'Unbekannte Sicherung' }, 400);
      fs.copyFileSync(path.join(BACKUP_DIR, body.name), RESTORE_ZIP);
      neustart();
      return json({ ok: true, hinweis: 'Sicherung wird eingespielt, das Programm startet neu.' });
    }
    if (route[0] === 'neustart' && req.method === 'POST') { neustart(); return json({ ok: true }); }
  } catch (e) { console.error(e); return json({ error: e.message }, 500); }
  return json({ error: 'Not found' }, 404);
};
