// Video-Upload im Admin (nur mit Anmeldung): PUT /api/admin-video?s=<szene>&z=<zeit> mit der Videodatei als Inhalt, DELETE zum Entfernen, GET für die Übersicht.
// Eigene Function statt /api/admin/*, weil die Datei roh kommt (nicht als JSON) und bis 80 MB groß sein darf.
import { hasSession, json } from '../lib/http.mjs';
import { MAX_VIDEO_BYTES, deleteVideo, listVideos, saveVideo, sniffVideo, validSlot, videosAvailable } from '../lib/videos.mjs';

export const config = { path: '/api/admin-video' };

export default async (req) => {
  if (!hasSession(req)) return json({ error: 'Nicht angemeldet' }, 401);
  if (!videosAvailable()) return json({ error: 'Videos gibt es nur auf dem Heimserver (CasaOS), nicht auf Netlify' }, 501);
  if (req.method === 'GET') return json({ videos: await listVideos(), maxMb: MAX_VIDEO_BYTES / 1048576 });
  // Schutz vor Formularen fremder Seiten: eigener Header nötig
  if (req.headers.get('x-upload') !== '1') return json({ error: 'Ungültige Anfrage' }, 400);
  const u = new URL(req.url); const s = u.searchParams.get('s'), z = u.searchParams.get('z');
  if (!validSlot(s, z)) return json({ error: 'Unbekannte Szene oder Tageszeit' }, 400);
  if (req.method === 'DELETE') { await deleteVideo(s, z); return json({ ok: true }); }
  if (req.method !== 'PUT') return json({ error: 'Method not allowed' }, 405);
  const buf = Buffer.from(await req.arrayBuffer());
  if (!buf.length) return json({ error: 'Die Datei ist leer' }, 400);
  if (buf.length > MAX_VIDEO_BYTES) return json({ error: `Das Video ist zu groß (höchstens ${MAX_VIDEO_BYTES / 1048576} MB)` }, 413);
  const kind = sniffVideo(buf);
  if (!kind) return json({ error: 'Bitte ein Video als MP4 oder WebM wählen' }, 400);
  const meta = await saveVideo(s, z, buf, kind);
  return json({ ok: true, size: meta.size, version: meta.version });
};
