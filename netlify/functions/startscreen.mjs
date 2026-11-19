// Daten für den Startbildschirm (/startscreen). Öffentlich wie das Overlay, es stehen nur Texte und Zeiten drin.
import { publicView } from '../lib/startscreen.mjs';
import { json } from '../lib/http.mjs';

export const config = { path: '/api/startscreen' };

export default async () => json(await publicView());
