// /api/admin/backup: Sicherung als JSON herunterladen (GET) und wieder einspielen (POST).
// Enthalten: Einstellungen, Zustand (Timer, Wörter, Seiten), Mitschreibende, Aufgaben, Check-ins und Stream-Tage, Punkte.
// Nie enthalten: Twitch-Tokens (nach einem Restore neu verbinden) und Kurzlebiges (event/, seen/, cooldown/, done/, seat/).
// Der Zustand ist in „DATA_KEYS“ und „DATA_PREFIXES“ aufgelistet. NEUE DATENBEREICHE HIER EINTRAGEN, sonst fehlen sie in der Sicherung.
import { db } from '../store.mjs';
import { json } from '../http.mjs';
import { backupStatus, runBackupNow } from '../system/autobackup.mjs';

const FORMAT = 'everly-backup';
export const DATA_PREFIXES = ['user/', 'task/', 'checked/', 'streamday/', 'cmonth/', 'state/', 'stats/', 'bg/', 'raid/', 'pausecfg/', 'startbg/', 'rescue/', 'sound/', 'cmd/', 'counter/', 'quote/', 'quotemeta/'];
export const DATA_KEYS = ['config/settings', 'config/state', 'startscreen/config'];
const inScope = (key) => DATA_KEYS.includes(key) || DATA_PREFIXES.some((p) => key.startsWith(p));

async function keysOf() {
  const keys = [...DATA_KEYS];
  for (const p of DATA_PREFIXES) keys.push(...(await db.list(p)));
  return keys;
}

/** Die Sicherung als Objekt (für den Download und für die automatische Sicherung). */
export async function buildBackup() {
  const entries = {};
  const keys = await keysOf();
  for (let i = 0; i < keys.length; i += 25) {
    await Promise.all(keys.slice(i, i + 25).map(async (k) => { const v = await db.get(k); if (v != null) entries[k] = v; }));
  }
  return { format: FORMAT, version: 1, created: new Date().toISOString(), prefixes: DATA_PREFIXES, entries };
}

export async function backup({ method, body, route }) {
  if (route?.[1] === 'status' && method === 'GET') return json(await backupStatus());
  if (route?.[1] === 'now' && method === 'POST') return json(await runBackupNow(), 200);

  if (method === 'GET') {
    const file = await buildBackup();
    return new Response(JSON.stringify(file), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store',
        'content-disposition': `attachment; filename="everly-backup-${file.created.slice(0, 10)}.json"`,
      },
    });
  }

  if (method === 'POST') {
    const file = body.backup;
    if (file?.format !== FORMAT || typeof file.entries !== 'object' || file.entries === null) return json({ error: 'Das ist keine Everly-Sicherung' }, 400);
    if (body.confirm !== true) return json({ error: 'Bitte das Wiederherstellen bestätigen' }, 400);
    // Nur die Bereiche ersetzen, die die Sicherung selbst kennt
    const known = Array.isArray(file.prefixes) ? file.prefixes.filter((p) => DATA_PREFIXES.includes(p)) : DATA_PREFIXES;
    const entries = Object.entries(file.entries).filter(([k]) => inScope(k));
    if (!entries.length) return json({ error: 'Die Sicherung ist leer' }, 400);
    for (const k of DATA_KEYS) await db.delete(k);
    for (const p of known) for (const k of await db.list(p)) await db.delete(k);
    for (const [k, v] of entries) await db.set(k, v);
    return json({ ok: true, restored: entries.length });
  }
}
