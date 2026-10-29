// GET /api/admin/users, GET /api/admin/export.csv, DELETE /api/admin/users/<id>
import { db } from '../store.mjs';
import { rankFor } from '../../../public/js/katalog.mjs';
import { json } from '../http.mjs';

export async function allUsers() {
  const keys = (await db.list('user/')).filter((k) => !k.startsWith('user/test-'));
  const users = [];
  for (let i = 0; i < keys.length; i += 25) { // in Blöcken laden
    users.push(...(await Promise.all(keys.slice(i, i + 25).map(async (k) => ({ id: k.slice(5), ...(await db.get(k)) })))));
  }
  return users.sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name, 'de'));
}

export async function users({ route, method }) {
  if (route[0] !== 'users') return;
  if (method === 'GET') {
    const list = await allUsers();
    return json({ users: list.map((u) => ({ id: u.id, name: u.name, minutes: u.minutes, sprints: u.sprints, words: u.words, visits: u.days.length, rank: rankFor(u.minutes).label })) });
  }
  if (method === 'DELETE' && route[1]) {
    await db.delete(`user/${route[1]}`);
    await db.delete(`seat/${route[1]}`);
    await db.delete(`task/${route[1]}`);
    return json({ ok: true });
  }
}

const csv = (v) => `"${String(v).replace(/"/g, '""').replace(/^([=+\-@\t\r])/, "'$1")}"`;
export async function exportCsv({ route, method }) {
  if (route[0] !== 'export.csv' || method !== 'GET') return;
  const rows = [['Name', 'Rang', 'Arbeitszeit (Min)', 'Sprints', 'Wörter', 'Besuche'], ...(await allUsers()).map((u) => [u.name, rankFor(u.minutes).label, u.minutes, u.sprints, u.words, u.days.length])];
  return new Response('﻿' + rows.map((r) => r.map(csv).join(';')).join('\n'), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="mitschreibende.csv"' } });
}
