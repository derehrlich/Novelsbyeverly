// Das OBS-Overlay fragt hier alle paar Sekunden nach dem Stand. Erster Abruf (ohne ?since) liefert nur den aktuellen
// Stand, damit alte Ereignisse nicht erneut abgespielt werden.
import { getSettings } from '../lib/settings.mjs';
import { buildView } from '../lib/view.mjs';
import { json } from '../lib/http.mjs';

export const config = { path: '/api/overlay' };

export default async (req) => json(await buildView(await getSettings(), new URL(req.url).searchParams.get('since')));
