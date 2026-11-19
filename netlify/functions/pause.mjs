// Daten für das Pause-Overlay (/pause). Öffentlich wie das Overlay, es steht nur der Pausentext drin.
import { publicView } from '../lib/pause.mjs';
import { getSettings } from '../lib/settings.mjs';
import { json } from '../lib/http.mjs';

export const config = { path: '/api/pause' };

export default async () => json(await publicView(await getSettings()));
