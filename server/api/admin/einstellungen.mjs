// GET/PUT /api/admin/settings
import { DEFAULTS, getSettings, saveSettings } from '../../features/settings.mjs';
import { json } from '../../core/http.mjs';

export async function config({ route, method, body }) {
  if (route[0] !== 'settings') return;
  if (method === 'GET') return json({ settings: await getSettings(), defaults: DEFAULTS });
  if (method === 'PUT') {
    const { settings, error } = await saveSettings(body);
    return error ? json({ error }, 400) : json({ settings });
  }
}
