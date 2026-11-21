// Daten für den Startbildschirm (/startscreen). Öffentlich wie das Overlay, es stehen nur Texte und Zeiten drin.
import { publicView } from '../lib/startscreen.mjs';
import { getRawSettings } from '../lib/settings.mjs';
import { featureOn } from '../lib/funktionen.mjs';
import { json } from '../lib/http.mjs';

export const config = { path: '/api/startscreen' };

export default async () => {
  if (!featureOn(await getRawSettings(), 'startscreen')) return json({ show: false, now: Date.now() }); // Funktion abgewählt (System → Funktionen)
  return json(await publicView());
};
