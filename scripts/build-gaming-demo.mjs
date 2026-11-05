// Baut eine einzelne, klickbare HTML-Datei der Gaming-Szene (ohne Bot, Server oder OBS).
//   node scripts/build-gaming-demo.mjs [Pfad-für-Artifact-Fassung]   →  docs/gaming-demo.html (per Doppelklick im Browser öffnen)
// Nutzt denselben Code wie das echte Overlay (public/js/gaming-ui.mjs); Spiel, Kamera und Chat sind nur simuliert.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const strip = (code) => code.replace(/^import .*$/gm, '').replace(/^export /gm, '');
const modules = ['katalog', 'malerei', 'figur', 'wachstum', 'gaming', 'gaming-ui'].map((n) => strip(read(`public/js/${n}.mjs`))).join('\n');
const font = (w) => `url(data:font/woff2;base64,${fs.readFileSync(path.join(root, `public/fonts/fredoka-latin-${w}-normal.woff2`)).toString('base64')}) format('woff2')`;

const css = `
@font-face { font-family: Fredoka; font-weight: 500; src: ${font(500)}; }
@font-face { font-family: Fredoka; font-weight: 600; src: ${font(600)}; }
@font-face { font-family: Fredoka; font-weight: 700; src: ${font(700)}; }
/* Layout: breite Bühne oben, darunter die Bedienung in vier Spalten, die auf dem Handy untereinander stehen */
:root { --bg: #f4f1ea; --panel: #fbf9f4; --fg: #3d362d; --muted: #7a705f; --line: #ddd5c4; --accent: #6f8c64; --accent-fg: #ffffff; --soft: #e9e4d6; --font: Fredoka, ui-rounded, system-ui, sans-serif; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #1d211d; --panel: #262b26; --fg: #ebe6d9; --muted: #a39b88; --line: #3a413a; --accent: #8fae83; --accent-fg: #17201a; --soft: #313831; color-scheme: dark; } }
:root[data-theme="dark"] { --bg: #1d211d; --panel: #262b26; --fg: #ebe6d9; --muted: #a39b88; --line: #3a413a; --accent: #8fae83; --accent-fg: #17201a; --soft: #313831; color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font-family: var(--font); font-size: 16px; line-height: 1.4; padding-block: 20px 40px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
main { max-width: 1280px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }
h1 { font-size: 1.5rem; margin: 0; font-weight: 700; text-wrap: balance; }
.kopf p { margin: 4px 0 0; color: var(--muted); max-width: 70ch; }
.buehne { position: relative; width: 100%; aspect-ratio: 16 / 9; overflow: hidden; border-radius: 14px; border: 1px solid var(--line); background: #111; }
#stage { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; transform-origin: 0 0; }
.fake-spiel { position: absolute; overflow: hidden; background: linear-gradient(#5a7fd6 0 58%, #3c3a52 58% 100%); }
.fake-spiel::before { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 42%; background: repeating-linear-gradient(90deg, #4d4a68 0 120px, #44415e 120px 240px); }
.fake-spiel i { position: absolute; background: #f3c86b; }
.fake-spiel b { position: absolute; left: 24px; bottom: 24px; font: 600 28px var(--font); color: #fff; opacity: .8; }
.fake-kamera { position: absolute; overflow: hidden; background: linear-gradient(160deg, #c9a98c, #7d6a8d); }
.fake-kamera svg { width: 100%; height: 100%; display: block; }
.leiste { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; align-items: start; }
.gruppe { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.gruppe h2 { font-size: .8rem; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin: 0; font-weight: 600; }
label { display: flex; align-items: center; gap: 8px; min-width: 0; }
label.feld { flex-direction: column; align-items: stretch; gap: 4px; color: var(--muted); font-size: .85rem; }
input[type=text], input[type=number], select { font: inherit; color: var(--fg); background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 7px 10px; min-width: 0; width: 100%; }
input[type=range] { width: 100%; accent-color: var(--accent); }
input[type=checkbox] { accent-color: var(--accent); width: 18px; height: 18px; }
button { font: inherit; font-weight: 600; cursor: pointer; border: 1px solid var(--line); background: var(--soft); color: var(--fg); border-radius: 8px; padding: 7px 14px; }
button.haupt { background: var(--accent); color: var(--accent-fg); border-color: var(--accent); }
button:hover { filter: brightness(1.06); }
:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
.reihe { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.reihe > input[type=text], .reihe > input[type=number] { flex: 1; width: auto; }
.antwort { min-height: 2.6em; font-size: .9rem; color: var(--muted); background: var(--bg); border: 1px dashed var(--line); border-radius: 8px; padding: 6px 10px; }
.antwort b { color: var(--fg); }
.hinweis { font-size: .85rem; color: var(--muted); margin: 0; }
code { background: var(--soft); padding: 1px 6px; border-radius: 5px; font-size: .9em; }
`;

const body = `
<main>
  <div class="kopf">
    <h1>Gaming-Szene zum Ausprobieren</h1>
    <p>So sieht das Overlay in OBS aus. Das Spiel und die Kamera sind hier nur Beispielbilder, die durch die ausgeschnittenen Fenster scheinen. Alles darunter lässt sich ausprobieren.</p>
  </div>
  <div class="buehne" id="buehne"><div id="stage"></div></div>
  <div class="leiste">
    <section class="gruppe">
      <h2>Kamerafenster</h2>
      <label><input type="checkbox" id="kOL"> Oben links</label>
      <label><input type="checkbox" id="kOR" checked> Oben rechts</label>
      <label><input type="checkbox" id="kUL"> Unten links</label>
      <label><input type="checkbox" id="kUR"> Unten rechts</label>
      <label class="feld"><span>Seitenlänge: <span id="groesseWert">340</span> px</span><input type="range" id="groesse" min="200" max="500" step="10" value="340"></label>
      <p class="hinweis">Nicht angehakte Fenster fehlen ganz. Steht der Deathcounter in derselben Ecke, rückt er neben die Kamera.</p>
    </section>
    <section class="gruppe">
      <h2>Deathcounter</h2>
      <label><input type="checkbox" id="todeAn" checked> Anzeigen</label>
      <label class="feld">Beschriftung<input type="text" id="todeLabel" value="Tode" maxlength="20"></label>
      <label class="feld">Ausblenden nach (Sekunden, 0 = nie)<input type="number" id="todeSek" min="0" max="3600" value="8"></label>
      <label class="feld">Position<select id="todePos">
        <option value="oben-links">Oben links</option><option value="oben-mitte">Oben Mitte</option><option value="oben-rechts">Oben rechts</option>
        <option value="unten-links" selected>Unten links</option><option value="unten-mitte">Unten Mitte</option><option value="unten-rechts">Unten rechts</option></select></label>
      <div class="reihe"><button id="todeMinus">−1</button><button class="haupt" id="todePlus">+1 Tod</button><button id="todeZeigen">Einblenden</button><button id="todeNull">Auf 0</button></div>
      <p class="hinweis">Im echten Overlay zählt dasselbe per Chat oder Hotkey. Die Karte blendet nach der Zeit aus und bei jedem Zählen wieder ein.</p>
    </section>
    <section class="gruppe">
      <h2>Chat ausprobieren</h2>
      <label class="feld">Wer schreibt?<select id="rolle"><option value="zuschauer">Zuschauer</option><option value="mod" selected>Moderation</option><option value="streamerin">Streamerin</option></select></label>
      <div class="reihe"><input type="text" id="chatText" value="!tod" aria-label="Chatnachricht"><button class="haupt" id="chatSenden">Senden</button></div>
      <div class="reihe"><button data-c="!tod">!tod</button><button data-c="!tod -">!tod -</button><button data-c="!tod 12">!tod 12</button><button data-c="!tod reset">!tod reset</button><button data-c="!tode">!tode</button></div>
      <div class="antwort" id="antwort" aria-live="polite">Antwort des Bots erscheint hier.</div>
    </section>
    <section class="gruppe">
      <h2>Landschaft</h2>
      <label class="feld">Jahreszeit<select id="jahr"><option value="fruehling">Frühling</option><option value="sommer">Sommer</option><option value="herbst">Herbst</option><option value="winter">Winter</option></select></label>
      <label class="feld">Tageszeit<select id="tag"><option value="morgen">Morgengrauen</option><option value="mittag" selected>Mittag</option><option value="abend">Abend</option></select></label>
      <label class="feld"><span>Wachstum: <span id="wachsWert">55</span> %</span><input type="range" id="wachs" min="0" max="100" value="55"></label>
      <label><input type="checkbox" id="beispiel" checked> Beispielspiel und Kamerabild zeigen</label>
    </section>
  </div>
</main>`;

const script = `
${modules}

const $ = (id) => document.getElementById(id);
const stage = $('stage'), buehne = $('buehne');
const fit = () => { stage.style.transform = 'scale(' + (buehne.clientWidth / 1920) + ')'; };
new ResizeObserver(fit).observe(buehne); fit();

// Beispielbilder unter den Fenstern (in OBS sind das deine echte Spielaufnahme und Kamera)
const fake = document.createElement('div'); stage.prepend(fake);
const AVATAR = '<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="40" r="19" fill="#f1d3b8"/><path d="M28 36c0-16 12-22 24-22s20 8 20 24c-6-9-14-13-22-13s-16 4-22 11z" fill="#4a3426"/><path d="M12 100c2-24 18-34 38-34s36 10 38 34z" fill="#5d7a58"/></svg>';
function renderFake(view) {
  fake.textContent = '';
  if (!$('beispiel').checked) return;
  const s = document.createElement('div'); s.className = 'fake-spiel';
  Object.assign(s.style, { left: SPIEL.x + 'px', top: SPIEL.y + 'px', width: SPIEL.w + 'px', height: SPIEL.h + 'px' });
  s.innerHTML = '<i style="left:760px;top:520px;width:70px;height:110px;border-radius:12px"></i><i style="left:1180px;top:560px;width:90px;height:70px;background:#e07a5f;border-radius:50%"></i><b>Dein Spiel</b>';
  fake.append(s);
  for (const e of view.gaming.kameras) {
    const r = kameraRect(e, view.gaming.groesse), k = document.createElement('div'); k.className = 'fake-kamera';
    Object.assign(k.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' }); k.innerHTML = AVATAR; fake.append(k);
  }
}

const ov = new GamingOverlay(stage);
let tode = 7, todeAt = Date.now();
const pad = (n) => new Intl.NumberFormat('de-DE').format(n);
function current() {
  const kameras = [['oben-links', 'kOL'], ['oben-rechts', 'kOR'], ['unten-links', 'kUL'], ['unten-rechts', 'kUR']].filter(([, id]) => $(id).checked).map(([k]) => k);
  return {
    now: Date.now(), jahreszeit: $('jahr').value, tageszeit: $('tag').value, progress: Number($('wachs').value) / 100, timer: { phase: 'idle' },
    stefanie: { figur: { haut: '2', haare: 'braun', frisur: 'lang', oberteil: 'gruen', kopf: 'keine', gesicht: 'brille', hals: 'keine', tier: 'keine', tisch: 'laptop', getraenk: 'tee' }, taetigkeit: 'laptop' },
    gaming: { kameras, groesse: Number($('groesse').value), tode: $('todeAn').checked ? { n: tode, at: todeAt, sekunden: Math.max(0, Number($('todeSek').value) || 0), label: $('todeLabel').value || 'Tode', pos: $('todePos').value } : null },
  };
}
function refresh() {
  $('groesseWert').textContent = $('groesse').value; $('wachsWert').textContent = $('wachs').value;
  const v = current(); ov.update(v); renderFake(v);
}
for (const el of document.querySelectorAll('input, select')) { el.addEventListener('input', refresh); el.addEventListener('change', refresh); }
const setze = (n) => { tode = Math.min(99999, Math.max(0, Math.round(n))); todeAt = Date.now(); refresh(); };
$('todeZeigen').onclick = () => { todeAt = Date.now(); refresh(); };
$('todePlus').onclick = () => setze(tode + 1); $('todeMinus').onclick = () => setze(tode - 1); $('todeNull').onclick = () => setze(0);

// Nachbau der Chat-Befehle (gleiche Regeln wie im Bot: Moderation zählt, Reset nur die Streamerin, !tode für alle)
function chat(text) {
  const rolle = $('rolle').value, mod = rolle !== 'zuschauer';
  const [wort, ...args] = text.trim().split(/\\s+/);
  const antwort = () => '💀 ' + pad(tode) + ' ' + ($('todeLabel').value || 'Tode');
  if (!$('todeAn').checked) return 'Der Deathcounter ist ausgeschaltet. Bot schweigt.';
  if (wort === '!tode') { todeAt = Date.now(); refresh(); return antwort(); }
  if (wort !== '!tod') return 'Kein bekannter Befehl. Bot schweigt.';
  if (!mod) return 'Nur Moderation und Streamerin dürfen zählen. Bot schweigt.';
  const sub = (args[0] ?? '').toLowerCase();
  if (!sub || sub === '+') setze(tode + 1);
  else if (sub === '-') setze(tode - 1);
  else if (sub === 'reset') { if (rolle !== 'streamerin') return 'Nur die Streamerin darf zurücksetzen. Bot schweigt.'; setze(0); }
  else if (/^\\d+$/.test(sub)) setze(Number(sub));
  else return '!tod · !tod - · !tod 12 · !tod reset';
  return antwort();
}
const senden = (t) => { $('antwort').innerHTML = '<b>Bot:</b> ' + chat(t).replace(/</g, '&lt;'); };
$('chatSenden').onclick = () => senden($('chatText').value);
$('chatText').addEventListener('keydown', (e) => { if (e.key === 'Enter') senden($('chatText').value); });
for (const b of document.querySelectorAll('[data-c]')) b.onclick = () => { $('chatText').value = b.dataset.c; senden(b.dataset.c); };
refresh();
`;

const title = 'Gaming-Szene Demo';
const fragment = `<title>${title}</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<style>${css}</style>\n${body}\n<script type="module">${script}</script>\n`;
const standalone = `<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n${fragment.replace('\n<meta name="claude:viewport-fit-sides" content="cover">', '')}</head>\n<body>\n</body>\n</html>\n`
  .replace(/<\/style>\n([\s\S]*)<script type="module">([\s\S]*)<\/script>\n<\/head>\n<body>\n<\/body>/, (_, b, s) => `</style>\n</head>\n<body>\n${b}<script type="module">${s}</script>\n</body>`);
fs.writeFileSync(path.join(root, 'docs/gaming-demo.html'), standalone);
if (process.argv[2]) fs.writeFileSync(process.argv[2], fragment);
console.log(`docs/gaming-demo.html (${Math.round(standalone.length / 1024)} KB)`);
