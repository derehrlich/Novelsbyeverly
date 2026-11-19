// /api/admin/sounds: eigene Töne für die Alerts.   GET sounds | POST sounds/<slot> { name, data (Base64) } | DELETE sounds/<slot>
import { json } from '../http.mjs';
import * as snd from '../alertsounds.mjs';

export async function soundsRoute({ route, method, body }) {
  if (route[0] !== 'sounds') return;
  const view = async () => { const index = await snd.getIndex(); return json({ slots: snd.SOUND_SLOTS.map(([id, label]) => ({ id, label, ...(index[id] ?? {}) })), maxKb: Math.round(snd.MAX_SOUND_BYTES / 1000) }); };
  if (route.length === 1 && method === 'GET') return view();
  if (route.length === 2 && method === 'POST') { const r = await snd.saveSound(route[1], body?.name, body?.data); return r.error ? json({ error: r.error }, r.status) : view(); }
  if (route.length === 2 && method === 'DELETE') { const r = await snd.deleteSound(route[1]); return r.error ? json({ error: r.error }, r.status) : view(); }
}
