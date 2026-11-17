// POST /api/admin/preview: das Overlay so, wie es mit den (noch nicht gespeicherten) Einstellungen aussähe.
// Body: { draft: { jahreszeit: 'winter', … } }. Nichts wird gespeichert, auch der Timer wird nicht weitergeschaltet.
import { normalize, getSettings } from '../settings.mjs';
import { buildView } from '../view.mjs';
import { json } from '../http.mjs';

export async function preview({ route, method, body }) {
  if (route[0] !== 'preview' || method !== 'POST') return;
  const { settings, error } = normalize(body.draft ?? {}, await getSettings());
  if (error) return json({ error }, 400);
  return json(await buildView(settings, null, Date.now(), { preview: true }));
}
