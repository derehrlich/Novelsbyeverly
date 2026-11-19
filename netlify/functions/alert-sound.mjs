// Der eigene Ton einer Alert-Art (öffentlich, das Overlay läuft ohne Anmeldung). ?v= ändert sich bei jedem neuen Ton.
import { getSoundFile } from '../lib/alertsounds.mjs';
import { text } from '../lib/http.mjs';

export const config = { path: '/api/alert-sound' };

export default async (req) => {
  if (req.method !== 'GET') return text('Method not allowed', 405);
  const u = new URL(req.url);
  const f = await getSoundFile(u.searchParams.get('slot'));
  if (!f) return text('Kein Ton', 404);
  return new Response(Buffer.from(f.b64, 'base64'), { headers: { 'content-type': f.type, 'cache-control': u.searchParams.has('v') ? 'public, max-age=31536000, immutable' : 'no-cache', 'x-content-type-options': 'nosniff' } });
};
