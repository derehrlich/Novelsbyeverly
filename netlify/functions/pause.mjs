// Daten für das Pause-Overlay (/pause). Öffentlich wie das Overlay, es steht nur der Pausentext drin.
import { publicView } from '../lib/pause.mjs';
import { getSettings } from '../lib/settings.mjs';
import { featureOn } from '../lib/funktionen.mjs';
import { json } from '../lib/http.mjs';

export const config = { path: '/api/pause' };

export default async () => {
  const settings = await getSettings();
  if (!featureOn(settings, 'auszeit')) return json({ show: false, now: Date.now() }); // Funktion abgewählt (System → Funktionen)
  return json(await publicView(settings));
};
