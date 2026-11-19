// Video-Upload im Admin (Route /api/admin/video, nur mit Anmeldung): PUT ?s=<szene>&z=<zeit> mit der Videodatei als Inhalt, DELETE zum Entfernen, GET für die Übersicht.
// Liegt bewusst unter /api/admin/…: So gilt dieselbe Anmeldung und derselbe Schutz (z. B. Cloudflare Access) wie für alle Admin-Aufrufe. Die Datei kommt roh, nicht als JSON, bis 80 MB.
import { json } from '../http.mjs';
import { MAX_VIDEO_BYTES, cleanName, deleteVideo, listVideos, saveVideo, sniffVideo, validSlot, videosAvailable } from '../videos.mjs';

export async function video({ req, method }) {
  if (!videosAvailable()) return json({ error: 'Videos gibt es nur auf dem Heimserver (CasaOS), nicht auf Netlify' }, 501);
  if (method === 'GET') return json({ videos: await listVideos(), maxMb: MAX_VIDEO_BYTES / 1048576 });
  // Schutz vor Formularen fremder Seiten: eigener Header nötig (der Inhalt ist hier kein JSON, deshalb greift die Prüfung in admin.mjs nicht)
  if (req.headers.get('x-upload') !== '1') return json({ error: 'Ungültige Anfrage' }, 400);
  const u = new URL(req.url); const s = u.searchParams.get('s'), z = u.searchParams.get('z');
  if (!validSlot(s, z)) return json({ error: 'Unbekannte Szene oder Tageszeit' }, 400);
  if (method === 'DELETE') { await deleteVideo(s, z); return json({ ok: true }); }
  if (method !== 'PUT') return json({ error: 'Method not allowed' }, 405);
  const buf = Buffer.from(await req.arrayBuffer());
  if (!buf.length) return json({ error: 'Die Datei ist leer' }, 400);
  if (buf.length > MAX_VIDEO_BYTES) return json({ error: `Das Video ist zu groß (höchstens ${MAX_VIDEO_BYTES / 1048576} MB)` }, 413);
  const kind = sniffVideo(buf);
  if (!kind) return json({ error: 'Bitte ein Video als MP4 oder WebM wählen' }, 400);
  const meta = await saveVideo(s, z, buf, kind, cleanName(u.searchParams.get('n')));
  return json({ ok: true, size: meta.size, version: meta.version, name: meta.name });
}
