// Zeichnet die Szene (Café, Garten, Park) mit den sitzenden Figuren in Pixel-Optik auf ein 480×270-Canvas.
// Das Canvas wird per CSS ohne Glättung hochskaliert (4× bei 1920×1080).
import { FARBEN, HAUT } from './katalog.mjs';

export const W = 480;
export const H = 270;

// ---- Zeichenhelfer
const mix = (hex, f) => { // f < 0 dunkler, f > 0 heller
  const n = parseInt(hex.slice(1), 16);
  const t = f < 0 ? 0 : 255, p = Math.abs(f);
  const ch = (v) => Math.round((t - v) * p + v);
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
};
const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h); };
// Kreis und Ellipse Zeile für Zeile, damit die Kanten scharf bleiben
function ellipse(c, cx, cy, rx, ry, col) {
  c.fillStyle = col;
  for (let dy = -ry; dy <= ry; dy += 1) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry + 0.01))));
    c.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2 + 1, 1);
  }
}
const disc = (c, cx, cy, r, col) => ellipse(c, cx, cy, r, r, col);
// Feste Zufallszahlen, damit Gras und Blätter bei jedem Zeichnen gleich aussehen
const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const bands = (c, x, y, w, h, colors) => colors.forEach((col, i) => R(c, x, y + Math.floor((h * i) / colors.length), w, Math.ceil(h / colors.length), col));

// ---- Plätze: 2 Reihen mit je 5 Tischen. Platz 0–4 hinten, 5–9 vorne.
const COLS = [64, 152, 240, 328, 416];
const JIT_X = [-3, 2, 0, 3, -2];
const JIT_Y = [0, 2, -1, 1, 0];
export function seatPos(slot) {
  const col = slot % 5;
  const back = slot < 5;
  return { x: COLS[col] + JIT_X[col] + (back ? 0 : 2), ty: (back ? 170 : 240) + JIT_Y[col], back };
}

const STYLE = {
  cafe: { top: '#b8814a', apron: '#7d522c', leg: '#5f3d20', chair: '#8c3f33', chairLight: '#a65346' },
  garten: { top: '#efeadb', apron: '#b9b29c', leg: '#8f8a7a', chair: '#4f8a5a', chairLight: '#68a672' },
  park: { top: '#c79a5e', apron: '#8f6a3a', leg: '#6b4a26', chair: '#7a5a34', chairLight: '#93703f' },
};

// ---- Hintergründe (einmal gezeichnet und zwischengespeichert)
function windowPane(c, x, y, w, h, treeSeed) {
  R(c, x - 4, y - 4, w + 8, h + 8, '#6a4528');
  bands(c, x, y, w, h, ['#a9dcf0', '#b9e4f2', '#cdeaf0', '#dff0ea', '#e8f4e4']);
  disc(c, x + w - 24, y + 20, 11, '#fff3b0'); disc(c, x + w - 24, y + 20, 7, '#fffbd6');
  const r = rng(treeSeed);
  for (let i = 0; i < 9; i += 1) disc(c, x + 6 + i * (w / 8.5), y + h - 12 + Math.floor(r() * 6), 9 + Math.floor(r() * 5), i % 2 ? '#6fae6a' : '#5c9a5c');
  R(c, x, y + h - 6, w, 6, '#7fb872');
  R(c, x + w / 2 - 1, y, 2, h, '#6a4528'); R(c, x, y + h / 2 - 1, w, 2, '#6a4528');
  R(c, x - 7, y + h + 4, w + 14, 5, '#8a5d37'); R(c, x - 7, y + h + 4, w + 14, 1, '#a87648');
}

function cafeBackground(c) {
  R(c, 0, 0, W, 152, '#ead5ac');
  for (let x = 0; x < W; x += 16) R(c, x, 0, 1, 102, '#e1c99e');
  R(c, 0, 102, W, 3, '#8a5d37'); R(c, 0, 105, W, 44, '#b58455');
  for (let x = 20; x < W; x += 40) R(c, x, 111, 1, 32, '#9d6e44'); // Wandverkleidung
  R(c, 0, 147, W, 5, '#7a4f2b');
  R(c, 0, 152, W, 118, '#a56f3f');
  for (let y = 152, row = 0; y < H; y += 13, row += 1) {
    R(c, 0, y, W, 1, '#8c5a30');
    for (let x = (row % 2) * 40; x < W; x += 80) R(c, x, y, 1, 13, '#8c5a30');
  }
  R(c, 70, 180, 340, 56, mix('#b4564a', 0)); R(c, 70, 180, 340, 3, '#c9706a'); R(c, 70, 233, 340, 3, '#8d3f37'); // Teppich
  for (let x = 78; x < 404; x += 12) R(c, x, 186, 6, 44, '#a94d42');
  windowPane(c, 28, 18, 104, 74, 11); windowPane(c, 348, 18, 104, 74, 29);
  // Tafel mit Speisekarte
  R(c, 194, 20, 92, 42, '#6a4528'); R(c, 197, 23, 86, 36, '#2f4a3d');
  [[205, 30, 42], [205, 37, 56], [205, 44, 34], [205, 51, 48]].forEach(([x, y, w]) => R(c, x, y, w, 1, '#e6e1cc'));
  R(c, 262, 31, 12, 10, '#e6e1cc'); R(c, 264, 33, 8, 6, '#2f4a3d'); R(c, 274, 34, 3, 4, '#e6e1cc');
  // Regal mit Tassen und Büchern
  R(c, 172, 80, 136, 4, '#6a4528'); R(c, 178, 84, 3, 8, '#5a3a20'); R(c, 299, 84, 3, 8, '#5a3a20');
  [['#e8e2d0', 180], ['#d96b5a', 192], ['#6aa3c8', 204]].forEach(([col, x]) => { R(c, x, 73, 8, 7, col); R(c, x + 8, 75, 2, 3, col); });
  R(c, 218, 66, 14, 14, '#c9d6a8'); R(c, 218, 66, 14, 2, '#a3b585');
  [['#a64b3c', 240], ['#3f6d8c', 245], ['#d8a642', 250], ['#4f8a5a', 255]].forEach(([col, x], i) => R(c, x, 66 + (i % 2), 5, 14 - (i % 2), col));
  [96, 240, 384].forEach((x) => pendant(c, x));
}

function pendant(c, x) {
  R(c, x, 0, 1, 20, '#4a3320');
  for (let i = 0; i < 9; i += 1) R(c, x - 3 - i, 20 + i, 7 + i * 2, 1, i < 2 ? '#f0b94a' : '#e0a43c');
  R(c, x - 12, 29, 25, 2, '#b97f22');
  c.globalAlpha = 0.07; disc(c, x, 44, 30, '#ffd98a'); disc(c, x, 40, 18, '#ffe9b0'); c.globalAlpha = 1;
}

function gartenBackground(c) {
  bands(c, 0, 0, W, 112, ['#9fd8ee', '#acdff0', '#bbe5f1', '#cae9f0', '#d9eeef', '#e6f4ee']);
  c.globalAlpha = 0.35; disc(c, 420, 34, 30, '#fff7c4'); c.globalAlpha = 1;
  disc(c, 420, 34, 16, '#fff1a8'); disc(c, 420, 34, 11, '#fffbd6');
  [[70, 30], [200, 52], [300, 24]].forEach(([x, y]) => { ellipse(c, x, y, 26, 7, '#fbfdfd'); ellipse(c, x + 14, y - 5, 16, 6, '#fbfdfd'); ellipse(c, x - 12, y - 3, 12, 5, '#eef6f8'); });
  ellipse(c, 120, 130, 180, 34, '#a9d9a1'); ellipse(c, 400, 134, 200, 40, '#95ce92');
  // Hecke
  R(c, 0, 106, W, 48, '#4c9a58');
  for (let x = 0; x < W; x += 14) disc(c, x + 7, 106, 8, '#4c9a58');
  const r = rng(7);
  for (let i = 0; i < 380; i += 1) R(c, Math.floor(r() * W), 100 + Math.floor(r() * 52), 2, 2, r() > 0.5 ? '#63b06c' : '#3d8049');
  // Apfelbaum rechts, Vogelhaus links
  R(c, 432, 58, 12, 70, '#7a5230'); R(c, 432, 58, 3, 70, '#8f6340');
  [[438, 38, 36], [414, 54, 24], [462, 52, 22], [440, 62, 22]].forEach(([x, y, rad], i) => disc(c, x, y, rad, i % 2 ? '#56a860' : '#4a9a55'));
  [[426, 40], [446, 30], [452, 56], [420, 60], [440, 48]].forEach(([x, y]) => R(c, x, y, 3, 3, '#d9473a'));
  R(c, 36, 62, 3, 66, '#6b4a2b'); R(c, 28, 48, 20, 14, '#c98b4b'); R(c, 28, 44, 20, 4, '#9a4a38'); R(c, 36, 52, 4, 5, '#3a2616');
  // Zaun
  R(c, 0, 132, W, 3, '#ece4d0');
  for (let x = 0; x < W; x += 9) { R(c, x, 124, 6, 30, '#f6efde'); R(c, x + 1, 122, 4, 2, '#f6efde'); R(c, x + 5, 124, 1, 30, '#e0d7bf'); }
  R(c, 0, 142, W, 3, '#ece4d0');
  // Wiese, Streifen, Halme
  R(c, 0, 154, W, 116, '#86cc6a');
  for (let y = 154, i = 0; y < H; y += 18, i += 1) if (i % 2) R(c, 0, y, W, 18, '#7cc261');
  for (let i = 0; i < 260; i += 1) { const x = Math.floor(r() * W), y = 158 + Math.floor(r() * 110); R(c, x, y, 1, 3, '#68ad50'); R(c, x + 2, y + 1, 1, 2, '#9ad97c'); }
  // Gartenweg
  R(c, 0, 188, W, 16, '#dccfb6'); R(c, 0, 188, W, 1, '#c9bb9f'); R(c, 0, 203, W, 1, '#c9bb9f');
  for (let x = 6; x < W; x += 26) { R(c, x, 190, 10, 5, '#cbbd9f'); R(c, x + 12, 196, 11, 5, '#e6dac3'); }
  // Blumenbeet am Zaun
  const colors = ['#e86a8b', '#f2c94c', '#f4f0e6', '#a77bd6', '#ee8a4a'];
  for (let x = 4; x < W; x += 9) { const y = 146 + Math.floor(r() * 6); R(c, x, y + 3, 1, 5, '#3f8a45'); R(c, x - 1, y, 3, 3, colors[Math.floor(r() * colors.length)]); }
}

function parkBackground(c) {
  bands(c, 0, 0, W, 130, ['#a5d9f0', '#b2deef', '#c0e4ef', '#cfeaee', '#ddf0ec', '#e9f5ea']);
  [[90, 36], [250, 20], [360, 50]].forEach(([x, y]) => { ellipse(c, x, y, 30, 8, '#fbfdfd'); ellipse(c, x + 16, y - 6, 18, 7, '#fbfdfd'); });
  for (let x = -10; x < W + 20; x += 22) { disc(c, x, 128, 16 + ((x / 22) % 3) * 3, ((x / 22) % 2) ? '#7ab87c' : '#6aa86e'); }
  R(c, 0, 128, W, 26, '#6aa86e');
  // Teich am Horizont
  ellipse(c, 240, 150, 74, 9, '#6fb8d6'); ellipse(c, 240, 148, 62, 5, '#8fcbe3');
  R(c, 190, 140, 1, 8, '#4f8a4a'); R(c, 192, 138, 1, 10, '#4f8a4a'); R(c, 290, 141, 1, 8, '#4f8a4a');
  // Wiese
  R(c, 0, 154, W, 116, '#80c266');
  const r = rng(21);
  for (let i = 0; i < 6; i += 1) ellipse(c, 40 + i * 80, 170 + (i % 3) * 30, 34, 7, '#8ccd72');
  for (let i = 0; i < 300; i += 1) { const x = Math.floor(r() * W), y = 158 + Math.floor(r() * 110); R(c, x, y, 1, 3, '#6bae52'); R(c, x + 2, y, 1, 2, '#a1dc84'); }
  // Weg
  R(c, 0, 188, W, 16, '#d9c9a4'); R(c, 0, 188, W, 1, '#c6b68f'); R(c, 0, 203, W, 1, '#c6b68f');
  for (let i = 0; i < 90; i += 1) R(c, Math.floor(r() * W), 190 + Math.floor(r() * 12), 2, 1, i % 2 ? '#c4b38a' : '#e8dcc0');
  // Laternen
  [120, 360].forEach((x) => { R(c, x, 70, 3, 84, '#2f3a3a'); R(c, x - 4, 62, 11, 9, '#2f3a3a'); R(c, x - 2, 64, 7, 5, '#ffe29a'); c.globalAlpha = 0.14; disc(c, x + 1, 67, 16, '#ffe29a'); c.globalAlpha = 1; });
  // Große Bäume links und rechts
  [[30, 1], [452, 2]].forEach(([x, k]) => {
    R(c, x - 8, 40, 16, 114, '#6e4a2c'); R(c, x - 8, 40, 4, 114, '#835a37');
    const greens = ['#4f9a57', '#5aa862', '#45884e'];
    [[x, 38, 46], [x - 30 * (k === 1 ? -1 : 1) * -1, 62, 30], [x + 30 * (k === 1 ? 1 : -1) * 1, 60, 30], [x, 12, 30]].forEach(([cx, cy, rad], i) => disc(c, cx, cy, rad, greens[i % 3]));
    for (let i = 0; i < 20; i += 1) R(c, x - 40 + Math.floor(r() * 80), 12 + Math.floor(r() * 60), 3, 3, i % 4 ? '#6cba74' : '#d9a441');
  });
  // Blumeninseln
  const colors = ['#e86a8b', '#f2c94c', '#f4f0e6', '#a77bd6'];
  for (let i = 0; i < 40; i += 1) { const x = 6 + Math.floor(r() * (W - 12)), y = 160 + Math.floor(r() * 26); R(c, x, y, 2, 2, colors[i % 4]); R(c, x, y + 2, 1, 2, '#3f8a45'); }
}

const BACKGROUNDS = { cafe: cafeBackground, garten: gartenBackground, park: parkBackground };

// Verankerungen der Zimmer-Dekoration je Szene
const ANKER = {
  cafe: { plants: [[18, 178], [462, 178]], cat: [236, 208], books: [196, 80], lightsY: 10, sky: [28, 18, 104, 74], sky2: [348, 18, 104, 74] },
  garten: { plants: [[16, 170], [464, 170]], cat: [120, 205], books: [380, 205], lightsY: 14, sky: [0, 0, W, 100] },
  park: { plants: [[16, 172], [464, 172]], cat: [330, 205], books: [100, 205], lightsY: 14, sky: [0, 0, W, 120] },
};

function plant(c, x, y, big) {
  const h = big ? 24 : 18;
  const leaf = ['#3f8a45', '#4fa056', '#63b36a'];
  for (let i = 0; i < 7; i += 1) {
    const a = (i - 3) * 0.5, len = h - Math.abs(i - 3) * 2;
    for (let k = 0; k < len; k += 1) R(c, x + Math.round(Math.sin(a) * k * 0.7), y - 8 - Math.round(Math.cos(a) * k), 3, 2, leaf[(i + k) % 3]);
  }
  R(c, x - 6, y - 8, 13, 9, '#c0704a'); R(c, x - 7, y - 9, 15, 3, '#d48560'); R(c, x - 5, y, 11, 2, '#a85c3a');
}

function bookStack(c, x, y) {
  [['#a64b3c', 14], ['#3f6d8c', 12], ['#d8a642', 13]].forEach(([col, w], i) => { R(c, x + (i % 2), y - 5 - i * 5, w, 5, col); R(c, x + (i % 2), y - 5 - i * 5, w, 1, mix('#ffffff', -0.1)); });
}

function rainbow(c, rect, scene) {
  const [x, y, w, h] = rect;
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  const cols = ['#e85d5d', '#f2a65a', '#f2dc6b', '#78c27a', '#5fa8e0', '#9a7ad6'];
  const cx = scene === 'cafe' ? x + w / 2 : 140, cy = scene === 'cafe' ? y + h + 8 : 124;
  const r0 = scene === 'cafe' ? 44 : 100;
  cols.forEach((col, i) => { c.strokeStyle = col; c.lineWidth = scene === 'cafe' ? 3 : 5; c.beginPath(); c.arc(cx, cy, r0 - i * (scene === 'cafe' ? 3 : 5), Math.PI, 0); c.stroke(); });
  c.restore();
}

function deckeStatisch(c, scene, deco) {
  const a = ANKER[scene];
  if (deco.includes('regenbogen')) { c.globalAlpha = 0.55; rainbow(c, a.sky, scene); c.globalAlpha = 1; }
  if (deco.includes('pflanzen')) a.plants.forEach(([x, y], i) => plant(c, x, y, i === 0));
  if (deco.includes('buecher')) bookStack(c, a.books[0], a.books[1]);
}

// ---- Tisch und Stuhl
function chair(c, x, ty, style) {
  R(c, x - 13, ty - 22, 26, 22, style.chair); R(c, x - 13, ty - 22, 26, 3, style.chairLight);
  R(c, x - 15, ty - 14, 2, 14, style.chair); R(c, x + 13, ty - 14, 2, 14, style.chair);
}

function table(c, x, ty, style) {
  c.globalAlpha = 0.22; ellipse(c, x, ty + 18, 28, 4, '#000000'); c.globalAlpha = 1;
  R(c, x - 22, ty + 7, 3, 11, style.leg); R(c, x + 19, ty + 7, 3, 11, style.leg);
  R(c, x - 25, ty, 50, 7, style.top); R(c, x - 25, ty, 50, 1, mix(style.top, 0.25)); R(c, x - 25, ty + 6, 50, 2, style.apron);
}

// ---- Figur
function drawFigure(c, f, x, ty, a) {
  const skin = HAUT[f.haut] ?? HAUT[2];
  const hair = FARBEN[f.haare] ?? FARBEN.braun;
  const top = FARBEN[f.oberteil] ?? FARBEN.blau;
  const nod = a.working && Math.floor(a.t / 380) % 2 ? 1 : 0;
  const hy = ty - 30 + nod; // Oberkante des Kopfes
  const sip = a.sip;

  // Haare hinten
  if (f.frisur === 'lang') R(c, x - 8, hy + 2, 16, 20, hair);
  if (f.frisur === 'locken') { disc(c, x - 7, hy + 7, 4, hair); disc(c, x + 7, hy + 7, 4, hair); disc(c, x - 7, hy + 12, 3, hair); disc(c, x + 7, hy + 12, 3, hair); }
  if (f.frisur === 'dutt') disc(c, x, hy - 3, 4, hair);
  // Oberkörper
  R(c, x - 9, ty - 15, 18, 15, top); R(c, x - 7, ty - 16, 14, 1, top);
  R(c, x - 9, ty - 15, 18, 1, mix(top, 0.2)); R(c, x - 9, ty - 4, 18, 4, mix(top, -0.12));
  R(c, x - 2, ty - 16, 5, 3, skin);
  // Hals
  R(c, x - 2, hy + 10, 4, 4, mix(skin, -0.08));
  if (f.hals === 'schal') {
    R(c, x - 8, ty - 17, 16, 4, '#d9534a'); R(c, x - 8, ty - 15, 16, 1, '#f08a7f'); R(c, x + 3, ty - 14, 4, 9, '#d9534a'); R(c, x + 3, ty - 9, 4, 1, '#f2c94c'); R(c, x + 3, ty - 7, 4, 1, '#f2c94c');
  }
  // Kopf
  R(c, x - 6, hy, 12, 11, skin); R(c, x - 5, hy + 11, 10, 1, skin);
  R(c, x - 7, hy + 4, 1, 3, skin); R(c, x + 6, hy + 4, 1, 3, skin);
  const blink = Math.floor(a.t / 130 + a.seed * 7) % 38 === 0;
  if (f.gesicht !== 'sonnenbrille') {
    if (blink) { R(c, x - 4, hy + 6, 3, 1, '#2b2430'); R(c, x + 1, hy + 6, 3, 1, '#2b2430'); } else { R(c, x - 3, hy + 5, 2, 2, '#2b2430'); R(c, x + 2, hy + 5, 2, 2, '#2b2430'); }
  }
  R(c, x - 5, hy + 8, 2, 1, mix('#e58a8a', 0)); R(c, x + 3, hy + 8, 2, 1, '#e58a8a');
  if (sip) R(c, x - 1, hy + 9, 3, 1, '#7a3b3b'); else R(c, x - 1, hy + 9, 2, 1, '#7a3b3b');
  // Haare vorn
  switch (f.frisur) {
    case 'glatze': R(c, x - 3, hy, 4, 1, mix(skin, 0.25)); break;
    case 'locken': R(c, x - 7, hy - 2, 14, 5, hair); R(c, x - 6, hy + 3, 3, 2, hair); R(c, x + 3, hy + 3, 3, 2, hair); break;
    case 'dutt': R(c, x - 6, hy - 1, 12, 4, hair); R(c, x - 7, hy + 2, 2, 4, hair); R(c, x + 5, hy + 2, 2, 4, hair); break;
    case 'zopf': R(c, x - 6, hy - 1, 12, 4, hair); R(c, x - 7, hy + 2, 2, 5, hair); R(c, x + 5, hy + 2, 2, 5, hair); R(c, x + 7, ty - 22, 3, 14, hair); R(c, x + 7, ty - 14, 3, 1, '#f2c94c'); break;
    case 'lang': R(c, x - 7, hy - 1, 14, 5, hair); R(c, x - 8, hy + 3, 3, 12, hair); R(c, x + 5, hy + 3, 3, 12, hair); R(c, x - 3, hy + 3, 7, 1, hair); break;
    default: R(c, x - 6, hy - 1, 12, 4, hair); R(c, x - 7, hy + 2, 2, 3, hair); R(c, x + 5, hy + 2, 2, 3, hair); R(c, x - 2, hy + 3, 5, 1, hair);
  }
  R(c, x - 5, hy, 3, 1, mix(hair, 0.3));
  // Gesicht und Kopfschmuck
  if (f.gesicht === 'brille') { c.fillStyle = '#4a3a30'; c.fillRect(x - 5, hy + 4, 4, 4); c.fillRect(x + 1, hy + 4, 4, 4); R(c, x - 1, hy + 5, 2, 1, '#4a3a30'); R(c, x - 4, hy + 5, 2, 2, '#cfe8f2'); R(c, x + 2, hy + 5, 2, 2, '#cfe8f2'); }
  if (f.gesicht === 'sonnenbrille') { R(c, x - 5, hy + 4, 5, 3, '#1f1a22'); R(c, x + 1, hy + 4, 5, 3, '#1f1a22'); R(c, x, hy + 4, 1, 1, '#1f1a22'); R(c, x - 5, hy + 4, 1, 1, '#4d4556'); }
  if (f.kopf === 'muetze') { R(c, x - 7, hy - 4, 14, 6, mix(top, -0.2)); R(c, x - 7, hy + 1, 14, 2, mix(top, 0.15)); disc(c, x, hy - 5, 2, '#f4f0e6'); }
  if (f.kopf === 'kopfhoerer') { R(c, x - 7, hy - 2, 14, 2, '#3a3a44'); R(c, x - 8, hy + 1, 3, 7, '#3a3a44'); R(c, x + 6, hy + 1, 3, 7, '#3a3a44'); R(c, x - 8, hy + 2, 1, 5, '#e58a5a'); R(c, x + 8, hy + 2, 1, 5, '#e58a5a'); }
  if (f.kopf === 'blumenkranz') {
    R(c, x - 7, hy - 1, 14, 2, '#4fa056');
    ['#e86a8b', '#f4f0e6', '#f2c94c', '#e86a8b', '#a77bd6'].forEach((col, i) => R(c, x - 7 + i * 3, hy - 3, 3, 3, col));
  }
  // Arme: Ärmel zum Tisch, Hände tippen
  const typing = a.working && Math.floor(a.t / 160) % 2;
  if (f.tisch === 'notizbuch') {
    R(c, x - 9, ty - 6, 5, 6, top); R(c, x + 4, ty - 6 + (a.working ? (typing ? -1 : 0) : 0), 5, 6, top);
  }
  if (sip) { R(c, x + 6, ty - 14, 4, 11, top); R(c, x + 7, hy + 7, 3, 3, skin); } // Tasse zum Mund
}

function drawDesk(c, f, x, ty, a, style) {
  const typing = a.working && Math.floor(a.t / 140) % 2;
  if (f.tisch === 'laptop') {
    R(c, x - 9, ty - 9, 18, 11, '#c4c8d0'); R(c, x - 9, ty - 9, 18, 1, '#e6e9ef'); R(c, x - 9, ty + 1, 18, 1, '#9aa0aa');
    R(c, x - 2, ty - 5, 4, 3, '#9aa0aa'); // Logo
    if (a.working) { c.globalAlpha = 0.25; R(c, x - 10, ty - 9, 20, 11, '#9fd8ff'); c.globalAlpha = 1; }
    R(c, x - 10, ty + 2, 20, 3, '#aeb3bd'); R(c, x - 10, ty + 4, 20, 1, '#8a909b');
    if (typing) R(c, x - 7, ty + 2, 3, 1, '#d8dce3'); else R(c, x + 3, ty + 2, 3, 1, '#d8dce3');
  } else if (f.tisch === 'notizbuch') {
    R(c, x - 10, ty + 1, 20, 6, '#f7f1e1'); R(c, x - 10, ty + 1, 20, 1, '#d9cfb8'); R(c, x, ty + 1, 1, 6, '#cfc4aa');
    for (let i = 0; i < 3; i += 1) { R(c, x - 8, ty + 2 + i * 2, 6, 1, '#b8ad92'); R(c, x + 3, ty + 2 + i * 2, 5, 1, '#b8ad92'); }
    R(c, x + (typing ? 4 : 6), ty + 2, 5, 1, '#3a5a8c'); R(c, x + (typing ? 8 : 10), ty + 1, 1, 3, '#3a5a8c');
    R(c, x + 4, ty - 2, 5, 3, HAUT[f.haut] ?? HAUT[2]);
  } else { // Schreibmaschine
    R(c, x - 10, ty - 3, 20, 9, '#3f4650'); R(c, x - 10, ty - 3, 20, 1, '#6b7480'); R(c, x - 8, ty + 3, 16, 3, '#575f6b');
    R(c, x - 6, ty - 13, 12, 11, '#f7f1e1'); R(c, x - 6, ty - 13, 12, 1, '#d9cfb8');
    for (let i = 0; i < 3; i += 1) R(c, x - 4, ty - 10 + i * 2, 8 - (i === 2 ? 3 : 0), 1, '#8a8470');
    if (typing) R(c, x - 3, ty - 6, 2, 1, '#2b2430');
    R(c, x - 9, ty - 4, 2, 2, '#c4c8d0'); R(c, x + 7, ty - 4, 2, 2, '#c4c8d0');
  }
  // Getränk rechts auf dem Tisch (beim Schluck in der Hand)
  if (!a.sip) {
    const col = f.getraenk === 'kaffee' ? '#5a3a24' : f.getraenk === 'kakao' ? '#8a5a3c' : '#c98b4b';
    R(c, x + 13, ty - 4, 7, 7, '#f1ece4'); R(c, x + 13, ty - 4, 7, 2, col); R(c, x + 20, ty - 2, 2, 3, '#f1ece4'); R(c, x + 12, ty + 3, 9, 1, '#d9d2c4');
    if (Math.floor(a.t / 600) % 2) { R(c, x + 15, ty - 8, 1, 2, 'rgba(255,255,255,.7)'); R(c, x + 17, ty - 11, 1, 2, 'rgba(255,255,255,.5)'); } else { R(c, x + 16, ty - 8, 1, 2, 'rgba(255,255,255,.7)'); R(c, x + 15, ty - 11, 1, 2, 'rgba(255,255,255,.5)'); }
  }
  // Tier links auf dem Tisch
  if (f.tier === 'katze') {
    const wag = Math.floor(a.t / 500) % 2;
    R(c, x - 24, ty - 7, 9, 8, '#8a7f86'); R(c, x - 24, ty - 9, 2, 2, '#8a7f86'); R(c, x - 17, ty - 9, 2, 2, '#8a7f86'); R(c, x - 24, ty - 7, 9, 2, '#a39aa1');
    R(c, x - 22, ty - 5, 1, 1, '#2b2430'); R(c, x - 18, ty - 5, 1, 1, '#2b2430'); R(c, x - 15 + wag, ty - 2, 3, 2, '#8a7f86');
  } else if (f.tier === 'eule') {
    R(c, x - 23, ty - 10, 8, 11, '#9a6b3f'); R(c, x - 22, ty - 9, 6, 4, '#e8d3a9'); R(c, x - 22, ty - 8, 2, 2, '#2b2430'); R(c, x - 18, ty - 8, 2, 2, '#2b2430'); R(c, x - 20, ty - 6, 2, 1, '#e0a43c');
    R(c, x - 23, ty - 12, 2, 2, '#9a6b3f'); R(c, x - 17, ty - 12, 2, 2, '#9a6b3f');
  }
  void style;
}

// ---- Die Szene
export class Szene {
  constructor(canvas) {
    this.canvas = canvas;
    this.canvas.width = W; this.canvas.height = H;
    this.c = canvas.getContext('2d');
    this.c.imageSmoothingEnabled = false;
    this.cache = document.createElement('canvas');
    this.cache.width = W; this.cache.height = H;
    this.cacheKey = '';
    this.view = { scene: 'cafe', deco: [], seats: [], timer: { phase: 'idle' } };
    this.seen = new Map();
    this.effects = [];
    this.fx = null; // optionaler Rückruf für Partikel
  }

  update(view) {
    this.view = view;
    const now = performance.now();
    const ids = new Set(view.seats.map((s) => s.id));
    for (const s of view.seats) if (!this.seen.has(s.id)) this.seen.set(s.id, now);
    for (const id of [...this.seen.keys()]) if (!ids.has(id)) this.seen.delete(id);
  }

  event(ev) {
    const pos = ev.slot != null ? seatPos(ev.slot) : null;
    if (ev.type === 'sit' && pos) this.effects.push({ kind: 'spark', x: pos.x, y: pos.ty - 20, t0: performance.now() });
    if (ev.type === 'leave' && pos) this.effects.push({ kind: 'puff', x: pos.x, y: pos.ty - 14, t0: performance.now() });
  }

  background() {
    const { scene, deco } = this.view;
    const key = `${scene}|${deco.join(',')}`;
    if (key === this.cacheKey) return;
    this.cacheKey = key;
    const c = this.cache.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, W, H);
    (BACKGROUNDS[scene] ?? BACKGROUNDS.cafe)(c);
    deckeStatisch(c, BACKGROUNDS[scene] ? scene : 'cafe', deco);
  }

  draw(t = performance.now()) {
    this.background();
    const { c } = this;
    const { scene, deco, seats, timer } = this.view;
    const style = STYLE[scene] ?? STYLE.cafe;
    const anker = ANKER[scene] ?? ANKER.cafe;
    c.clearRect(0, 0, W, H);
    c.drawImage(this.cache, 0, 0);
    this.live(c, scene, deco, anker, t);

    const phase = timer?.phase;
    const ordered = [...seats].sort((p, q) => seatPos(p.slot).ty - seatPos(q.slot).ty);
    for (const s of ordered) {
      const { x, ty } = seatPos(s.slot);
      const age = t - (this.seen.get(s.id) ?? t);
      const drop = age < 450 ? Math.round((1 - age / 450) ** 2 * 26) : 0;
      const seed = [...s.id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 997, 7) / 997;
      const a = { t, seed, working: phase === 'focus', sip: phase === 'break' && Math.floor(t / 2600 + seed * 5) % 3 === 0 };
      c.save();
      c.translate(0, -drop);
      if (drop) c.globalAlpha = Math.min(1, age / 250);
      chair(c, x, ty, style);
      drawFigure(c, s.figure, x, ty, a);
      table(c, x, ty, style);
      drawDesk(c, s.figure, x, ty, a, style);
      c.restore();
    }
    this.drawEffects(c, t);
  }

  // bewegte Teile: Lichterkette, Zimmerkatze, Vögel
  live(c, scene, deco, a, t) {
    if (deco.includes('lichter')) {
      const y0 = a.lightsY;
      const cols = ['#ffd36b', '#ff8f6b', '#8fd6ff', '#b6f08f', '#ffb0d6'];
      for (let x = 0; x < W; x += 4) R(c, x, y0 + Math.round(Math.sin(x / 38) * 5) + 3, 4, 1, '#3a2b20');
      for (let i = 0, x = 8; x < W; i += 1, x += 24) {
        const y = y0 + Math.round(Math.sin(x / 38) * 5) + 4;
        const on = Math.floor(t / 700 + i * 1.7) % 4 !== 0;
        R(c, x, y, 3, 4, on ? cols[i % cols.length] : '#6b5a48');
        if (on) { c.globalAlpha = 0.18; disc(c, x + 1, y + 2, 5, cols[i % cols.length]); c.globalAlpha = 1; }
      }
    }
    if (deco.includes('katze')) {
      const [x, y] = a.cat;
      const tail = Math.floor(t / 600) % 2;
      R(c, x - 7, y - 8, 14, 8, '#e0a45a'); R(c, x - 7, y - 8, 14, 2, '#eebb78'); R(c, x - 5, y - 13, 10, 6, '#e0a45a');
      R(c, x - 5, y - 15, 2, 2, '#e0a45a'); R(c, x + 3, y - 15, 2, 2, '#e0a45a');
      R(c, x - 3, y - 10, 2, 1, '#2b2430'); R(c, x + 1, y - 10, 2, 1, '#2b2430');
      R(c, x + 7, y - 3 - tail, 6, 2, '#e0a45a'); R(c, x - 4, y - 4, 2, 4, '#c98b4b'); R(c, x + 2, y - 5, 2, 5, '#c98b4b');
      if (Math.floor(t / 1800) % 3 === 0) { R(c, x + 6, y - 20, 4, 1, '#ffffff'); R(c, x + 8, y - 22, 3, 1, '#ffffff'); }
    }
    if (deco.includes('voegel')) {
      const rect = scene === 'cafe' ? a.sky : [0, 0, W, 110];
      const clip = scene === 'cafe';
      if (clip) { c.save(); c.beginPath(); c.rect(...rect); c.clip(); }
      for (let i = 0; i < 3; i += 1) {
        const span = rect[2] + 40, p = ((t / (scene === 'cafe' ? 90 : 60)) + i * 120) % span;
        const x = rect[0] + p - 20, y = rect[1] + 24 + i * 14 + Math.round(Math.sin(t / 400 + i) * 3);
        const flap = Math.floor(t / 200 + i) % 2;
        const col = i === 1 ? '#e86a8b' : '#3a3a44';
        if (scene === 'cafe' || i !== 1) { R(c, x, y, 3, 2, col); R(c, x - 2, y - (flap ? 2 : 0), 2, 1, col); R(c, x + 3, y - (flap ? 2 : 0), 2, 1, col); R(c, x + 3, y + 1, 2, 1, '#e0a43c'); } else { // Schmetterling
          R(c, x, y, 1, 3, '#3a3a44'); R(c, x - 2, y - (flap ? 1 : 0), 2, 2, col); R(c, x + 1, y - (flap ? 1 : 0), 2, 2, col);
        }
      }
      if (clip) c.restore();
    }
  }

  drawEffects(c, t) {
    this.effects = this.effects.filter((e) => t - e.t0 < 900);
    for (const e of this.effects) {
      const p = (t - e.t0) / 900;
      c.globalAlpha = 1 - p;
      if (e.kind === 'spark') {
        for (let i = 0; i < 6; i += 1) {
          const ang = (i / 6) * Math.PI * 2 + p, d = 6 + p * 22;
          R(c, e.x + Math.cos(ang) * d, e.y + Math.sin(ang) * d - p * 8, 2, 2, i % 2 ? '#ffe27a' : '#ffffff');
        }
      } else {
        disc(c, e.x - 8 + p * 4, e.y - p * 14, 3 + p * 4, '#f4f0e6'); disc(c, e.x + 8 - p * 4, e.y - p * 10, 2 + p * 4, '#e6e1d3');
      }
      c.globalAlpha = 1;
    }
  }
}
