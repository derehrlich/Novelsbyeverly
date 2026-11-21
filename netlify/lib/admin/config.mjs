// GET/PUT /api/admin/settings (immer die gespeicherten Werte, auch bei abgewählten Funktionen) und GET /api/admin/funktionen
import { DEFAULTS, getRawSettings, saveSettings } from '../settings.mjs';
import { featureList } from '../funktionen.mjs';
import { json } from '../http.mjs';

export async function config({ route, method, body }) {
  if (route[0] === 'funktionen' && method === 'GET') return json({ items: featureList(await getRawSettings()) });
  if (route[0] !== 'settings') return;
  if (method === 'GET') return json({ settings: await getRawSettings(), defaults: DEFAULTS });
  if (method === 'PUT') {
    const { settings, error } = await saveSettings(body);
    return error ? json({ error }, 400) : json({ settings });
  }
}
