// Das Icon einer eigenen Pause (öffentlich, die Pause-Seite läuft ohne Anmeldung). ?v= ändert sich bei jedem neuen Bild.
import { getIcon } from '../lib/pause.mjs';
import { text } from '../lib/http.mjs';

export const config = { path: '/api/pause-icon' };

export default async (req) => {
  if (req.method !== 'GET') return text('Method not allowed', 405);
  const u = new URL(req.url);
  const icon = await getIcon(u.searchParams.get('id'));
  if (!icon) return text('Kein Bild', 404);
  return new Response(Buffer.from(icon.b64, 'base64'), { headers: { 'content-type': icon.type, 'cache-control': u.searchParams.has('v') ? 'public, max-age=31536000, immutable' : 'no-cache' } });
};
