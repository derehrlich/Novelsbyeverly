// Das eigene Hintergrundbild des Overlays (öffentlich, das Overlay läuft ohne Anmeldung). Der Parameter ?v= ändert sich bei jedem neuen Bild.
import { db } from '../lib/store.mjs';
import { text } from '../lib/http.mjs';

export const config = { path: '/api/overlay-bg' };

export default async (req) => {
  if (req.method !== 'GET') return text('Method not allowed', 405);
  const img = await db.get('bg/image');
  if (!img) return text('Kein Hintergrundbild', 404);
  const long = new URL(req.url).searchParams.has('v');
  return new Response(Buffer.from(img.b64, 'base64'), { headers: { 'content-type': img.type, 'cache-control': long ? 'public, max-age=31536000, immutable' : 'no-cache' } });
};
