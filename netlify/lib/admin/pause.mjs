// /api/admin/pause: Stream-Pause von Hand steuern und eigene Pausen (mit Befehl und Icon) verwalten.
//   GET pause | POST pause/start { text, minutes, preset } | POST pause/stop
//   PUT pause/presets { presets: [...] } | POST pause/icon/<id> { data } | DELETE pause/icon/<id>
import { json } from '../http.mjs';
import { getSettings } from '../settings.mjs';
import { featureOn } from '../funktionen.mjs';
import * as pause from '../pause.mjs';
import { COMMAND_WORDS } from '../chat.mjs';
import { getCommands } from '../befehle.mjs';

export async function pauseRoute({ route, method, body }) {
  if (route[0] !== 'pause') return;
  const settings = await getSettings();
  if (!featureOn(settings, 'auszeit') && method !== 'GET') return json({ error: 'Die Stream-Pause ist abgewählt (System → Funktionen)' }, 403);
  const view = async () => {
    const presets = await pause.getPresets();
    return json({ state: await pause.getState(), defaultText: settings.pauseDefaultText, enabled: settings.pauseEnabled, prefix: settings.commandPrefix, max: pause.MAX_PRESETS,
      presets: await Promise.all(presets.map(async (p) => ({ ...p, icon: (await pause.getIcon(p.id))?.version ?? 0 }))) });
  };
  if (route.length === 1 && method === 'GET') return view();
  if (route[1] === 'start' && method === 'POST') {
    const preset = body?.preset ? (await pause.getPresets()).find((p) => p.id === body.preset) : null;
    if (body?.preset && !preset) return json({ error: 'Diese Pause gibt es nicht mehr' }, 404);
    await pause.start(preset ? { text: body?.text || preset.text, minutes: body?.minutes ?? preset.minutes, preset } : { text: body?.text, minutes: body?.minutes }, settings);
    return view();
  }
  if (route[1] === 'stop' && method === 'POST') { await pause.stop(); return view(); }
  if (route[1] === 'presets' && method === 'PUT') {
    const own = (await getCommands()).filter((c) => c.type === 'command').map((c) => c.word);
    const r = await pause.savePresets(body?.presets, [...COMMAND_WORDS, ...own]);
    return r.error ? json({ error: r.error }, 400) : view();
  }
  if (route[1] === 'icon' && route[2]) {
    if (!(await pause.getPresets()).some((p) => p.id === route[2])) return json({ error: 'Bitte die Pause zuerst speichern' }, 404);
    if (method === 'POST') { const r = await pause.saveIcon(route[2], body?.data); return r.error ? json({ error: r.error }, r.status) : view(); }
    if (method === 'DELETE') { await pause.deleteIcon(route[2]); return view(); }
  }
}
