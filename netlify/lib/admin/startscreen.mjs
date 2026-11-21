// /api/admin/startscreen: Startbildschirm steuern.
//   GET startscreen | PUT startscreen (Texte, Vorlauf, Sprüche) | POST startscreen/start { minutes } | POST startscreen/extend { minutes } | POST startscreen/stop
//   POST startscreen/bg { name, data (Base64: Bild oder HTML-Datei) } | DELETE startscreen/bg
import { db } from '../store.mjs';
import { json } from '../http.mjs';
import * as ss from '../startscreen.mjs';
import { getRawSettings } from '../settings.mjs';
import { featureOn } from '../funktionen.mjs';

export async function startscreenRoute({ route, method, body }) {
  if (route[0] !== 'startscreen') return;
  if (!featureOn(await getRawSettings(), 'startscreen') && method !== 'GET') return json({ error: 'Der Startbildschirm ist abgewählt (System → Funktionen)' }, 403);
  const view = async () => json(await ss.adminView());
  if (route.length === 1 && method === 'GET') return view();
  if (route.length === 1 && method === 'PUT') { await ss.updateConfig(body); return view(); }
  if (route[1] === 'start' && method === 'POST') { await ss.start(body?.minutes); return view(); }
  if (route[1] === 'extend' && method === 'POST') { await ss.extend(body?.minutes); return view(); }
  if (route[1] === 'stop' && method === 'POST') { await ss.stop(); return view(); }
  if (route[1] === 'bg' && method === 'POST') {
    const raw = typeof body?.data === 'string' ? body.data.replace(/^data:[^,]*;base64,/, '') : '';
    const buf = Buffer.from(raw, 'base64');
    if (!buf.length) return json({ error: 'Keine Datei empfangen' }, 400);
    if (buf.length > ss.BG_MAX) return json({ error: 'Die Datei ist zu groß (höchstens 8 MB). Bitte kleiner abspeichern, 1920×1080 reicht.' }, 413);
    const html = ss.isHtml(buf), type = html ? 'text/html' : ss.sniffImage(buf);
    if (!type) return json({ error: 'Bitte ein Bild (PNG, JPG, GIF, WebP) oder eine HTML-Datei wählen' }, 400);
    await db.set(ss.BG_KEY, { type, data: buf.toString('base64') });
    await ss.updateConfig({ bgName: ss.cleanName(body.name, html ? 'Eigene Animation' : 'Eigenes Bild'), bgVersion: Date.now(), bgKind: html ? 'html' : 'image' });
    return view();
  }
  if (route[1] === 'bg' && method === 'DELETE') { await db.delete(ss.BG_KEY); await ss.updateConfig({ bgName: null }); return view(); }
}
