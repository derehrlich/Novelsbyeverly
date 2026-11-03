// Baut aus dem echten Overlay eine einzelne HTML-Datei zum Ausprobieren, ohne Bot, Server oder Twitch.
//   node scripts/build-vorschau.mjs   →  docs/vorschau.html (per Doppelklick im Browser öffnen)
// Die Vorschau nutzt denselben Code wie das Overlay (Szene, Figuren, Karten, Banner); nur die Daten sind Beispiele.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const overlay = read('public/overlay.html');

const between = (s, a, b) => { const i = s.indexOf(a); const j = s.indexOf(b, i + a.length); if (i < 0 || j < 0) throw new Error(`Marke fehlt: ${a}`); return s.slice(i + a.length, j); };
const must = (s, from, to) => { if (!s.includes(from)) throw new Error(`Ersetzung nicht möglich: ${from.slice(0, 50)}`); return s.replace(from, () => to); };

let css = between(overlay, '<style>', '</style>');
const stageHtml = between(overlay, '<body>\n', '\n<script type="module">');
let script = between(overlay, '<script type="module">\n', '\n</script>');

// Schriften einbetten
for (const w of [400, 500, 600, 700]) {
  const b64 = fs.readFileSync(path.join(root, `public/fonts/fredoka-latin-${w}-normal.woff2`)).toString('base64');
  css = css.replace(`url(fonts/fredoka-latin-${w}-normal.woff2)`, `url(data:font/woff2;base64,${b64})`);
}
if (css.includes('url(fonts/')) throw new Error('Schrift nicht eingebettet');
// Buch-Sprites einbetten (Alerts)
css = must(css, 'url(alerts/buch-aufklappen.png)', `url(data:image/png;base64,${fs.readFileSync(path.join(root, 'public/alerts/buch-aufklappen.png')).toString('base64')})`);

// Module einbinden (ohne import/export)
const strip = (code) => code.replace(/^import .*$/gm, '').replace(/^export /gm, '');
const modules = ['katalog', 'layout', 'jetztlaeuft', 'malerei', 'figur', 'wachstum', 'szene'].map((n) => strip(read(`public/js/${n}.mjs`))).join('\n');
script = must(script, "import { Szene, seatPos, moduleLayout } from './js/szene.mjs';", modules);
script = must(script, "import { nowPlaying } from './js/jetztlaeuft.mjs';", '');
script = must(script, "const ton = q.get('ton') !== 'aus';", 'let ton = false;');
script = must(script, "const fit = () => { stage.style.transform = `scale(${Math.min(innerWidth / 1920, innerHeight / 1080)})`; };",
  "const wrap = $('rahmen');\nconst fit = () => { const s = wrap.clientWidth / 1920; stage.style.transform = `scale(${s})`; wrap.style.height = `${1080 * s}px`; };");
script = must(script, "const demo = q.has('demo');", 'const demo = true;');

const demoStart = script.indexOf('if (demo) {');
const demoEnd = script.indexOf('// ---- Schleifen');
if (demoStart < 0 || demoEnd < 0) throw new Error('Demo-Block nicht gefunden');
script = script.slice(0, demoStart) + read('scripts/vorschau-demo.js') + '\n' + script.slice(demoEnd);

const vorschauCss = `
:root { --v-bg: #2a2018; --v-karte: #382b20; --v-rand: #6b4c33; --v-text: #f1e4d0; --v-leise: #c9b08c; --v-akzent: #e0a43c; --v-gruen: #4f9a5b; color-scheme: dark; }
html, body { width: auto; height: auto; overflow: auto; background: var(--v-bg); }
header, #steuerung { color: var(--v-text); }
body { padding-block: 20px 48px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
main { max-width: 1280px; margin: 0 auto; display: flex; flex-direction: column; gap: 18px; }
h1 { font-size: clamp(24px, 4vw, 34px); margin: 0; text-wrap: balance; }
.intro { margin: 4px 0 0; color: var(--v-leise); max-width: 62ch; font-size: 17px; line-height: 1.45; }
#rahmen { position: relative; width: 100%; overflow: hidden; border: 3px solid var(--v-rand); border-radius: 14px; background: #1c1510; }
#steuerung { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; background: var(--v-karte); border: 2px solid var(--v-rand); border-radius: 14px; padding: 16px; }
.gruppe { min-width: 0; } .gruppe h2 { font-size: 14px; letter-spacing: .06em; text-transform: uppercase; color: var(--v-leise); margin: 0 0 8px; font-weight: 600; }
.knoepfe { display: flex; flex-wrap: wrap; gap: 8px; }
#steuerung button { font: inherit; font-size: 16px; font-weight: 600; color: var(--v-text); background: transparent; border: 2px solid var(--v-rand); border-radius: 10px; padding: 7px 14px; cursor: pointer; }
#steuerung button:hover { border-color: var(--v-akzent); }
#steuerung button.aktiv { background: var(--v-gruen); border-color: var(--v-gruen); color: #fff; }
#steuerung button:focus-visible, #steuerung input:focus-visible { outline: 3px solid var(--v-akzent); outline-offset: 2px; }
#steuerung label { display: flex; align-items: center; gap: 10px; font-size: 16px; margin: 4px 0; } #steuerung input[type=range] { flex: 1; min-width: 0; accent-color: var(--v-akzent); }
#steuerung input[type=checkbox] { width: 20px; height: 20px; accent-color: var(--v-akzent); }
.fuss { color: var(--v-leise); font-size: 15px; margin: 0; max-width: 80ch; }
`;

const intro = `<header>
  <h1>Co-Working-Overlay zum Ausprobieren</h1>
  <p class="intro">So sieht das Overlay in OBS aus. Alles hier sind Beispieldaten, es ist nichts mit Twitch verbunden. Wechsle Jahres- und Tageszeit, zieh den Regler für das Wachstum und löse Ereignisse aus.</p>
</header>`;
const controls = `<section id="steuerung" aria-label="Vorschau steuern">
  <div class="gruppe"><h2>Jahreszeit</h2><div class="knoepfe" id="k-jahr"><button data-j="fruehling">Frühling</button><button data-j="sommer">Sommer</button><button data-j="herbst">Herbst</button><button data-j="winter">Winter</button></div></div>
  <div class="gruppe"><h2>Tageszeit</h2><div class="knoepfe" id="k-zeit"><button data-z="morgen">Morgengrauen</button><button data-z="mittag">Mittag</button><button data-z="abend">Abend</button></div></div>
  <div class="gruppe"><h2>Pomodoro</h2><div class="knoepfe" id="k-phase"><button data-p="focus">Fokus</button><button data-p="break">Pause</button><button data-p="idle">Bereit</button></div>
    <label for="sprintPct">Verlauf <output id="sprintPctWert">28 %</output><input type="range" id="sprintPct" min="0" max="100" value="28"></label>
    <label for="pomoDone">Geschafft <output id="pomoDoneWert">3 von 6</output><input type="range" id="pomoDone" min="0" max="6" value="3"></label>
  </div>
  <div class="gruppe"><h2>Ziel-Karte</h2><div class="knoepfe" id="k-ziel"><button data-a="woerter">Wörter</button><button data-a="seiten">Seiten lesen</button><button data-a="zeit">Streamzeit</button></div></div>
  <div class="gruppe"><h2>Stefanie</h2><div class="knoepfe" id="k-tat"><button data-t="laptop">Am Laptop</button><button data-t="buch">Mit Buch</button></div></div>
  <div class="gruppe"><h2>Wachstum</h2>
    <label for="wachsRegler">Landschaft <output id="wachsWert">55 %</output><input type="range" id="wachsRegler" min="0" max="100" value="55"></label>
    <p class="fuss" style="margin:4px 0 0">Zieh den Regler von links nach rechts: so wächst die Wiese im Lauf eines Streams.</p>
  </div>
  <div class="gruppe"><h2>Module</h2>
    <label for="mBlume"><input type="checkbox" id="mBlume" checked> Blume (Wörter)</label>
    <label for="mKerze"><input type="checkbox" id="mKerze" checked> Kerze (Pomodoro)</label>
    <label for="mBuecher"><input type="checkbox" id="mBuecher" checked> Bücher (Pomodoros)</label>
    <label for="mMusik"><input type="checkbox" id="mMusik" checked> Musik</label>
    <label for="mKamera"><input type="checkbox" id="mKamera" checked> Kamerafenster</label>
  </div>
  <div class="gruppe"><h2>Ereignisse</h2><div class="knoepfe" id="k-event">
    <button data-e="sprint">Pomodoro-Ende</button><button data-e="goal">Tagesziel</button><button data-e="taskdone">Aufgabe erledigt</button><button data-e="woerter">+150 Wörter</button>
    <button data-e="follow">Follow</button><button data-e="sub">Abo</button><button data-e="giftsub">Geschenk-Abos</button><button data-e="cheer">Bits</button><button data-e="raid">Raid</button></div>
    <label for="tonAn" style="margin-top:10px"><input type="checkbox" id="tonAn"> Glockenton</label></div>
</section>
<p class="fuss">Im Admin lassen sich Karten, Module und das Kamerafenster frei verschieben, Module einzeln abschalten und Jahres- und Tageszeit festlegen. Alles hier sind Beispieldaten.</p>`;

const body = `<main>\n${intro}\n<div id="rahmen">\n${stageHtml}\n</div>\n${controls}\n</main>`;
const title = 'Co-Working Overlay Vorschau';
const parts = { title, style: css + vorschauCss, body, script };

// Eigenständige Datei zum Doppelklicken
const full = `<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${title}</title>\n<style>${parts.style}</style>\n</head>\n<body>\n${body}\n<script type="module">\n${script}\n</script>\n</body>\n</html>\n`;
fs.writeFileSync(path.join(root, 'docs/vorschau.html'), full);

// Fassung ohne Dokumentrahmen für die Veröffentlichung als Seite
const fragment = `<title>${title}</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<style>${parts.style}</style>\n${body}\n<script type="module">\n${script}\n</script>\n`;
const out = process.argv[2];
if (out) fs.writeFileSync(out, fragment);
console.log(`docs/vorschau.html geschrieben (${Math.round(full.length / 1024)} KB)`);
