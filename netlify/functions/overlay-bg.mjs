// Das eigene Hintergrundbild des Overlays (öffentlich, das Overlay läuft ohne Anmeldung). Der Parameter ?v= ändert sich bei jedem neuen Bild.
import { db } from '../lib/store.mjs';
import { text } from '../lib/http.mjs';

export const config = { path: '/api/overlay-bg' };

export default async (req) => {
  if (req.method !== 'GET') return text('Method not allowed', 405);
  const u = new URL(req.url);
  const plate = u.searchParams.get('plate');
  if (plate && !['zug', 'sitzecke', 'stadt', 'see'].includes(plate)) return text('Unbekannte Szene', 404);
  const jz = u.searchParams.get('jz');
  if (jz && !/^(fruehling|sommer|herbst|winter)[AB]$|^(blumen|blaetter|bluete)$/.test(jz)) return text('Unbekannter Platz', 404);
  const img = await db.get(jz ? `bg/jz/${jz}` : plate ? `bg/plate/${plate}` : 'bg/image');
  if (!img) return text('Kein Bild', 404);
  const long = u.searchParams.has('v');
  return new Response(Buffer.from(img.b64, 'base64'), { headers: { 'content-type': img.type, 'cache-control': long ? 'public, max-age=31536000, immutable' : 'no-cache' } });
};
