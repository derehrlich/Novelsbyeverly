// Kleines Hilfsprogramm für den PC der Streamerin (braucht Node 20 oder neuer). Es schickt alle paar Sekunden an die Seite,
// was gerade in der Musik-App läuft (über Tuna oder eine andere lokale Adresse). Später kann hier auch die Wortzahl aus Papyrus dazukommen.
//
//   SITE_URL=https://DEINE-SEITE.netlify.app INGEST_TOKEN=dein-schluessel node scripts/pc-helfer.mjs
//   optional: MUSIK_URL=http://localhost:1608/  (Standard, Adresse von Tuna)  und  INTERVALL=5 (Sekunden)
import { nowPlaying } from '../public/js/jetztlaeuft.mjs';

const site = (process.env.SITE_URL ?? '').replace(/\/$/, '');
const token = process.env.INGEST_TOKEN ?? '';
const quelle = process.env.MUSIK_URL ?? 'http://localhost:1608/';
const pause = Math.max(2, Number(process.env.INTERVALL ?? 5)) * 1000;
if (!site || !token) { console.error('Bitte SITE_URL und INGEST_TOKEN setzen (siehe Kommentar oben).'); process.exit(1); }

let zuletzt = '';
async function runde() {
  let m = null;
  try { m = nowPlaying(await (await fetch(quelle, { cache: 'no-store' })).json()); } catch { /* App oder Tuna läuft gerade nicht */ }
  const text = m ? `${m.title} – ${m.artist}` : 'nichts';
  try {
    const res = await fetch(`${site}/api/musik`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(m ? { ...m, playing: true } : { title: '', playing: false }) });
    if (!res.ok) throw new Error(`Seite antwortet mit ${res.status}`);
    if (text !== zuletzt) { console.log(`${new Date().toLocaleTimeString('de-DE')}  ${text}`); zuletzt = text; }
  } catch (e) { console.error(`Senden fehlgeschlagen: ${e.message}`); }
}
console.log(`Hilfsprogramm läuft. Quelle: ${quelle}  Ziel: ${site}`);
await runde();
setInterval(runde, pause);
