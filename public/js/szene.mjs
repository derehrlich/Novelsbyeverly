// Malt die Szene (Café, Garten, Park) mit den sitzenden Figuren und den Modulen auf ein 1920×1080-Canvas.
// Stil: weiche, gemalte Flächen in gedeckten Tönen, runde Chibi-Figuren, viele Zimmerpflanzen.
import { FARBEN, HAUT } from './katalog.mjs';
import { Wachstum } from './wachstum.mjs';
import { H, TAU, W, alpha, blossoms, clamp01, cloud, ell, fern, glow, grassStrokes, lg, leaf, monstera, monsteraLeaf, palm, path, pot, rg, rng, rr, shade, snakePlant, tree, vine } from './malerei.mjs';


// ---- Plätze: 2 Reihen mit je 5 Tischen. Platz 0–4 hinten, 5–9 vorne. Koordinaten in Bildpunkten (1920×1080).
const COLS = [256, 608, 960, 1312, 1664];
const JIT_X = [-8, 6, 0, 10, -6];
const JIT_Y = [0, 6, -4, 4, 0];
export function seatPos(slot) {
  const col = slot % 5, back = slot < 5;
  return { x: COLS[col] + JIT_X[col] + (back ? 0 : 10), ty: (back ? 700 : 975) + JIT_Y[col], back };
}

const STYLE = {
  cafe: { top: '#cfa877', rim: '#94704a', chair: '#b98574', chairDark: '#9a6a5d' },
  garten: { top: '#f1eadb', rim: '#bfb59e', chair: '#93a98d', chairDark: '#778f73' },
  park: { top: '#d3ae7e', rim: '#957650', chair: '#a3916f', chairDark: '#85734f' },
};

// Regalbrett für die Module im Zimmer-Modus (Oberkante) und Verteilung der Module darauf
export const REGAL = { x0: 560, x1: 1360, y: 404 };
// Wo die Module stehen: im Wachstums-Modus frei nach Anordnung (layout), im Zimmer auf dem Regalbrett.
export function moduleLayout(modules = {}, layout = null, modus = 'zimmer') {
  const ids = ['blume', 'kerze', 'buecher'].filter((id) => modules[id] && (modus !== 'wachstum' || layout?.[id]?.on !== false));
  if (modus === 'wachstum' && layout) return ids.map((id) => ({ id, x: layout[id].x, y: layout[id].y, s: layout[id].s ?? 1 }));
  const xs = ids.length === 1 ? [960] : ids.length === 2 ? [860, 1060] : [760, 960, 1160];
  return ids.map((id, i) => ({ id, x: xs[i], y: REGAL.y, s: 1 }));
}

// ---------------------------------------------------------------- Hintergründe
function archWindow(c, x, y, w, h, seed) {
  const r = w / 2;
  const outline = (k) => { k.moveTo(x, y + h); k.lineTo(x, y + r); k.arc(x + r, y + r, r, Math.PI, 0); k.lineTo(x + w, y + h); k.closePath(); };
  c.save(); c.beginPath(); outline(c); c.clip();
  c.fillStyle = lg(c, 0, y, 0, y + h, [[0, '#c3d9d8'], [0.55, '#e9ecdc'], [1, '#f5edd3']]); c.fillRect(x, y, w, h);
  glow(c, x + w * 0.72, y + h * 0.3, 260, '#fff2c4', 0.85);
  const r2 = rng(seed);
  const greens = ['#a7bfa0', '#8fae8a', '#789a78', '#678a6a'];
  for (let layer = 0; layer < 3; layer += 1) for (let i = 0; i < 6; i += 1) ell(c, x + (i + r2() * 0.6) * (w / 5), y + h - 90 + layer * 36 - r2() * 40, 80 + r2() * 50, 60 + r2() * 30, greens[layer + (i % 2)]);
  ell(c, x + w / 2, y + h + 20, w * 0.7, 70, '#8aa77d');
  c.restore();
  path(c, outline, null, '#a8865c', 18);
  c.strokeStyle = '#a8865c'; c.lineWidth = 9;
  c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + r, y + h); c.moveTo(x, y + h * 0.55); c.lineTo(x + w, y + h * 0.55); c.moveTo(x, y + r); c.lineTo(x + w, y + r); c.stroke();
  path(c, outline, null, alpha('#fff6e0', 0.35), 3);
  rr(c, x - 26, y + h - 6, w + 52, 30, 10, lg(c, 0, y + h, 0, y + h + 30, [[0, '#c4a173'], [1, '#a38260']]));
}

function curtain(c, x, y, h, side) {
  const w = 96;
  path(c, (k) => { k.moveTo(x, y); k.lineTo(x + side * w, y); k.bezierCurveTo(x + side * (w - 10), y + h * 0.45, x + side * (w * 0.5), y + h * 0.75, x + side * (w * 0.78), y + h); k.lineTo(x, y + h); k.closePath(); },
    lg(c, x, 0, x + side * w, 0, [[0, '#b7c4a4'], [0.5, '#cfd8bd'], [1, '#aebb9d']]), alpha('#6c7a5a', 0.35), 2);
  c.strokeStyle = alpha('#7d8c6a', 0.28); c.lineWidth = 3;
  for (let i = 1; i < 4; i += 1) { c.beginPath(); c.moveTo(x + side * ((w * i) / 4), y + 4); c.quadraticCurveTo(x + side * ((w * i) / 4 + 6), y + h * 0.5, x + side * ((w * i) / 4 - 4), y + h); c.stroke(); }
  rr(c, x + side * (w * 0.4) - 12, y + h * 0.5, 24, 12, 6, '#c9a46b');
}

function pendant(c, x, len, col) {
  c.strokeStyle = '#6c5a45'; c.lineWidth = 3; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, len); c.stroke();
  glow(c, x, len + 60, 190, '#ffe0a0', 0.5);
  path(c, (k) => { k.moveTo(x - 20, len); k.quadraticCurveTo(x - 62, len + 8, x - 70, len + 50); k.lineTo(x + 70, len + 50); k.quadraticCurveTo(x + 62, len + 8, x + 20, len); k.closePath(); }, lg(c, x - 70, 0, x + 70, 0, [[0, shade(col, 0.1)], [1, shade(col, -0.12)]]));
  ell(c, x, len + 52, 56, 9, '#ffeec2');
}

function shelfBoard(c, posts) {
  const { x0, x1, y } = REGAL;
  if (posts) { // Pfosten (Garten, Park)
    for (const px of [x0 + 24, x1 - 24]) rr(c, px - 12, y, 24, 250, 8, lg(c, px - 12, 0, px + 12, 0, [[0, posts[0]], [1, posts[1]]]));
  } else { // Konsolen (Café)
    for (const px of [x0 + 60, x1 - 60]) path(c, (k) => { k.moveTo(px - 14, y + 16); k.lineTo(px + 14, y + 16); k.lineTo(px + 14, y + 90); k.quadraticCurveTo(px + 14, y + 40, px - 40, y + 16); k.closePath(); }, '#9c7b55');
  }
  c.fillStyle = alpha('#2b2118', 0.16); c.fillRect(x0 + 10, y + 18, x1 - x0 - 20, 14);
  rr(c, x0, y - 4, x1 - x0, 24, 9, lg(c, 0, y - 4, 0, y + 20, [[0, '#d2b083'], [1, '#a98660']]));
  c.fillStyle = alpha('#fff6e0', 0.3); c.fillRect(x0 + 12, y - 1, x1 - x0 - 24, 3);
}

function cafe(c) {
  c.fillStyle = lg(c, 0, 0, 0, 700, [[0, '#f0e7d3'], [1, '#e4d6b9']]); c.fillRect(0, 0, W, H);
  c.fillStyle = alpha('#ffffff', 0.07); for (let x = 0; x < W; x += 140) c.fillRect(x, 0, 70, 650);
  // Wandverkleidung
  c.fillStyle = lg(c, 0, 470, 0, 650, [[0, '#a4b596'], [1, '#8fa384']]); c.fillRect(0, 478, W, 172);
  rr(c, -10, 462, W + 20, 20, 6, '#d7c19a');
  for (let x = 30; x < W; x += 250) rr(c, x, 500, 210, 118, 10, alpha('#ffffff', 0.07), alpha('#f3efd8', 0.5), 3);
  // Boden
  c.fillStyle = lg(c, 0, 640, 0, H, [[0, '#bf9a6b'], [1, '#a88358']]); c.fillRect(0, 640, W, H - 640);
  c.strokeStyle = alpha('#6f5233', 0.14); c.lineWidth = 2;
  for (let y = 668, i = 0; y < H; y += 24 + i * 5, i += 1) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  const r = rng(11);
  for (let i = 0; i < 70; i += 1) { const y = 660 + r() * 400; c.beginPath(); c.moveTo(r() * W, y); c.lineTo(r() * W, y + 1); c.stroke(); }
  rr(c, -10, 634, W + 20, 22, 6, '#9a7a56');
  // Teppich
  ell(c, 960, 850, 820, 150, alpha('#2b2118', 0.1)); ell(c, 960, 842, 800, 140, '#c7998c'); ell(c, 960, 842, 740, 118, '#d6b0a2', alpha('#fff6e8', 0.5), 4); ell(c, 960, 842, 600, 90, alpha('#b88478', 0.35));
  // Fenster mit Vorhängen
  for (const [x, s] of [[170, 3], [1390, 8]]) { archWindow(c, x, 66, 360, 410, s); curtain(c, x - 18, 60, 440, -1); curtain(c, x + 378, 60, 440, 1); }
  // Regalbrett, Bilder, Lampen
  shelfBoard(c, null);
  for (const fx of [850, 1070]) {
    rr(c, fx - 66, 118, 132, 156, 8, '#c5a678', alpha('#6a4f33', 0.4), 3); rr(c, fx - 54, 130, 108, 132, 4, '#f3ead6');
    monsteraLeaf(c, fx, 246, 96, fx < 960 ? -0.15 : 0.15, '#7f9a74');
  }
  pendant(c, 640, 150, '#cdb98a'); pendant(c, 1280, 150, '#c3cfb0');
  // Pflanzen
  vine(c, 592, REGAL.y + 18, 250, 5, 1.1); vine(c, 1334, REGAL.y + 18, 300, 9, 1.15);
  for (const [px, col] of [[596, '#d8c7a8'], [1330, '#c9a08a']]) { for (const [a, l] of [[-0.7, 44], [0.1, 54], [0.8, 46]]) leaf(c, px, REGAL.y - 40, l, l * 0.38, a, '#7f9d6f'); pot(c, px, REGAL.y, 62, 46, col); }
  monstera(c, 118, 842, 1.25, 3); snakePlant(c, 1790, 838, 1.15, 4); fern(c, 1688, 760, 0.7, 5);
  for (const wx of [348, 1568]) { pot(c, wx - 60, 476 - 4, 54, 40, '#cbb28a'); leaf(c, wx - 60, 440, 54, 18, -0.5, '#8aa67e'); leaf(c, wx - 60, 440, 62, 20, 0.2, '#7a9a74'); leaf(c, wx - 60, 440, 50, 17, 0.8, '#97b189'); }
}

function hills(c, y, col, amp, seed, wave) {
  const r = rng(seed);
  const ph = [r() * 6, r() * 6, r() * 6];
  path(c, (k) => { k.moveTo(0, H); k.lineTo(0, y); for (let x = 0; x <= W; x += 40) k.lineTo(x, y + Math.sin(x / wave + ph[0]) * amp + Math.sin(x / (wave * 0.45) + ph[1]) * amp * 0.4); k.lineTo(W, H); k.closePath(); }, col);
}

function garten(c) {
  c.fillStyle = lg(c, 0, 0, 0, 640, [[0, '#bcd5da'], [0.55, '#e6ecd9'], [1, '#f6edd1']]); c.fillRect(0, 0, W, H);
  glow(c, 1500, 190, 560, '#fff0c4', 0.75);
  cloud(c, 300, 150, 1.1, '#fbf6ea', 0.8); cloud(c, 1100, 90, 0.9, '#fbf6ea', 0.7); cloud(c, 1650, 260, 0.8, '#fbf6ea', 0.6);
  hills(c, 520, '#bccbb0', 40, 2, 240); hills(c, 570, '#a4bb9a', 36, 5, 200); hills(c, 620, '#8ea886', 30, 8, 170);
  tree(c, 130, 700, 1.15, 3); tree(c, 1790, 720, 1.2, 12, ['#8aa27c', '#9db28c', '#6f8c68', '#a9bd95']);
  // Zaun mit Kletterrosen
  const ry = 600;
  rr(c, 0, ry + 40, W, 14, 4, '#e6dcc4'); rr(c, 0, ry + 100, W, 14, 4, '#e6dcc4');
  for (let x = 12; x < W; x += 52) path(c, (k) => { k.moveTo(x, ry + 150); k.lineTo(x, ry + 20); k.lineTo(x + 20, ry); k.lineTo(x + 40, ry + 20); k.lineTo(x + 40, ry + 150); k.closePath(); }, lg(c, x, 0, x + 40, 0, [[0, '#f3ead3'], [1, '#ddd2b8']]), alpha('#8f8468', 0.25), 2);
  const r = rng(21);
  for (let i = 0; i < 26; i += 1) { const x = 40 + r() * (W - 80), y = ry + 30 + r() * 80; ell(c, x, y, 50 + r() * 40, 28 + r() * 20, ['#7f9a74', '#6f8c68', '#8fa882'][i % 3]); }
  for (let i = 0; i < 70; i += 1) { const x = 30 + r() * (W - 60), y = ry + 20 + r() * 100; ell(c, x, y, 9 + r() * 5, 8 + r() * 4, ['#dba9a5', '#e8c9c0', '#cf948f'][i % 3]); ell(c, x, y, 3, 3, '#f1dc9a'); }
  // Gartenregal
  shelfBoard(c, ['#b79a72', '#8f7550']);
  // Wiese
  c.fillStyle = lg(c, 0, 700, 0, H, [[0, '#a2ba8c'], [1, '#86a173']]); c.fillRect(0, 700, W, H - 700);
  grassStrokes(c, 0, 720, W, H, 700, 31, ['#6f8c5e', '#a4bd8d', '#86a173']);
  // Steinweg
  for (let i = 0; i < 22; i += 1) { const x = 40 + i * 90 + (i % 2) * 14, y = 835 + (i % 3) * 14; ell(c, x, y, 40, 17, '#ddd3be', alpha('#9a8f78', 0.4), 2); ell(c, x - 6, y - 4, 24, 7, alpha('#fff', 0.25)); }
  blossoms(c, 20, 690, W - 20, 760, 70, 5, ['#dba9a5', '#e9dcb4', '#b7a6cf', '#f1ece0']);
  blossoms(c, 20, 1000, W - 20, 1060, 40, 15, ['#e9dcb4', '#f1ece0', '#d8b3a8']);
  monstera(c, 98, 860, 1.25, 7); fern(c, 1826, 880, 1.1, 8); palm(c, 1730, 800, 0.65, 9);
  // Laternen
  for (const lx of [420, 1500]) { c.strokeStyle = '#6c5a45'; c.lineWidth = 5; c.beginPath(); c.moveTo(lx, 760); c.lineTo(lx, 520); c.quadraticCurveTo(lx, 480, lx + 40, 480); c.stroke(); rr(c, lx + 28, 484, 26, 36, 8, '#ffe8b0', '#6c5a45', 3); glow(c, lx + 41, 502, 90, '#ffe3a0', 0.5); }
}

function park(c) {
  c.fillStyle = lg(c, 0, 0, 0, 640, [[0, '#b9d2d8'], [0.6, '#e5ebdb'], [1, '#f4ecd2']]); c.fillRect(0, 0, W, H);
  glow(c, 400, 160, 520, '#fff0c6', 0.7);
  cloud(c, 700, 130, 1.1, '#fbf6ea', 0.8); cloud(c, 1500, 190, 1.0, '#fbf6ea', 0.7);
  hills(c, 500, '#b3c6ae', 30, 4, 260);
  // ferne Baumreihe
  const r = rng(41);
  for (let i = 0; i < 22; i += 1) ell(c, i * 94 + r() * 30, 530 + r() * 30, 84 + r() * 30, 70 + r() * 20, ['#9db591', '#8eaa86', '#a7bd9a'][i % 3]);
  // Teich
  c.fillStyle = lg(c, 0, 520, 0, 640, [[0, '#9fbfc4'], [1, '#86aab2']]); c.fillRect(0, 580, W, 70);
  ell(c, 960, 612, 680, 56, lg(c, 0, 560, 0, 660, [[0, '#a9c8cc'], [1, '#86aab2']]), alpha('#fff', 0.35), 3);
  ell(c, 800, 600, 140, 12, alpha('#ffffff', 0.18)); ell(c, 1180, 628, 120, 10, alpha('#ffffff', 0.14));
  for (const [px, py] of [[700, 618], [860, 640], [1060, 606], [1240, 636], [1500, 618]]) { ell(c, px, py, 38, 14, '#6f9a6e'); ell(c, px - 6, py - 3, 20, 6, alpha('#d6e4b8', 0.5)); if (px % 3 === 0) ell(c, px + 8, py - 8, 8, 6, '#e8c4c0'); }
  // Baumriesen
  tree(c, 120, 760, 1.3, 51, ['#7f9a74', '#93ac85', '#6a8764', '#a1b78e']); tree(c, 1810, 780, 1.35, 61, ['#86a07a', '#9bb38b', '#6f8c68', '#adc097']);
  shelfBoard(c, ['#9c8460', '#7a6446']);
  // Wiese und Weg
  c.fillStyle = lg(c, 0, 650, 0, H, [[0, '#a0b98b'], [1, '#86a173']]); c.fillRect(0, 650, W, H - 650);
  grassStrokes(c, 0, 690, W, H, 700, 32, ['#6f8c5e', '#a4bd8d', '#86a173']);
  path(c, (k) => { k.moveTo(0, 820); k.bezierCurveTo(500, 790, 1100, 880, W, 830); k.lineTo(W, 910); k.bezierCurveTo(1100, 960, 500, 880, 0, 900); k.closePath(); }, lg(c, 0, 800, 0, 920, [[0, '#e4d7b6'], [1, '#d4c6a2']]));
  const r2 = rng(5);
  for (let i = 0; i < 160; i += 1) ell(c, r2() * W, 830 + r2() * 70, 4 + r2() * 4, 2 + r2() * 2, alpha('#a79770', 0.35));
  // Lichtflecken
  for (let i = 0; i < 26; i += 1) ell(c, r2() * W, 700 + r2() * 360, 40 + r2() * 60, 12 + r2() * 20, alpha('#fff3c8', 0.16));
  blossoms(c, 20, 700, W - 20, 770, 50, 25, ['#dba9a5', '#e9dcb4', '#b7a6cf', '#f1ece0']);
  monstera(c, 100, 880, 1.2, 4); fern(c, 1830, 890, 1.05, 6); snakePlant(c, 1730, 830, 0.8, 3);
  // Laternen
  for (const lx of [440, 1500]) { rr(c, lx - 5, 420, 10, 340, 4, '#5d6a5f'); rr(c, lx - 22, 380, 44, 52, 10, '#ffe8b0', '#5d6a5f', 4); glow(c, lx, 406, 120, '#ffe3a0', 0.45); }
}

const BACKGROUNDS = { cafe, garten, park };

// Zusätzliche Pflanzen und Dinge, die das Zimmer durch gemeinsame Arbeitszeit bekommt (ruhend)
function decoStatic(c, scene, deco) {
  if (deco.includes('pflanzen')) {
    if (scene === 'cafe') { fern(c, 380, 770, 0.8, 21); palm(c, 1530, 790, 0.7, 22); } else if (scene === 'garten') { snakePlant(c, 430, 760, 0.8, 23); fern(c, 1520, 770, 0.8, 24); } else { fern(c, 400, 780, 0.8, 25); palm(c, 1540, 790, 0.7, 26); }
  }
  if (deco.includes('buecher')) { // Bücherstapel mit Tasse am Boden
    const bx = 330, by = 930; const cols = ['#a8786b', '#7f98a6', '#c9b27a'];
    cols.forEach((col, i) => rr(c, bx - 40 + (i % 2) * 6, by - 18 * (i + 1), 82 - i * 6, 18, 5, col, alpha('#2b2118', 0.25), 2));
    rr(c, bx - 14, by - 82, 28, 22, 7, '#f4eee2', alpha('#2b2118', 0.25), 2); ell(c, bx, by - 80, 12, 4, '#c98f4e');
  }
  if (deco.includes('regenbogen')) {
    c.save(); if (scene === 'cafe') { c.beginPath(); c.rect(170, 66, 360, 410); c.clip(); }
    const cols = ['#d98c88', '#e3b387', '#e6d594', '#a3c49a', '#8fb3c6', '#a998c4'];
    const cx = scene === 'cafe' ? 350 : 960, cy = scene === 'cafe' ? 480 : 640, r0 = scene === 'cafe' ? 190 : 560, wd = scene === 'cafe' ? 14 : 26;
    cols.forEach((col, i) => { c.strokeStyle = alpha(col, 0.42); c.lineWidth = wd; c.beginPath(); c.arc(cx, cy, r0 - i * wd * 0.95, Math.PI, 0); c.stroke(); });
    c.restore();
  }
}

// ---------------------------------------------------------------- Figur
function drawChair(c, x, ty, st) {
  rr(c, x - 54, ty - 92, 108, 118, 30, lg(c, 0, ty - 92, 0, ty + 26, [[0, st.chair], [1, st.chairDark]]), alpha('#2b2118', 0.25), 2.5);
  rr(c, x - 38, ty - 74, 76, 70, 22, alpha('#fff6e0', 0.1));
}

function drawHairBack(c, f, hair) {
  if (f.frisur === 'lang') path(c, (k) => { k.moveTo(-50, -110); k.bezierCurveTo(-60, -60, -54, -20, -40, -8); k.lineTo(40, -8); k.bezierCurveTo(54, -20, 60, -60, 50, -110); k.closePath(); }, shade(hair, -0.12), alpha('#2b2118', 0.25), 2);
  if (f.frisur === 'locken') for (const sd of [-1, 1]) for (const dy of [-96, -72, -48]) ell(c, sd * 48, dy, 17, 17, shade(hair, -0.1), alpha('#2b2118', 0.2), 2);
}

function drawHairFront(c, f, hair) {
  const hi = shade(hair, 0.2), line = alpha('#2b2118', 0.28);
  const cap = (k, lift = 0) => {
    k.moveTo(-45, -96); k.bezierCurveTo(-52, -150 - lift, 52, -150 - lift, 45, -96);
    k.bezierCurveTo(40, -118, 32, -122, 24, -112); k.bezierCurveTo(14, -128, 4, -120, 0, -112); k.bezierCurveTo(-8, -126, -22, -122, -26, -110); k.bezierCurveTo(-34, -120, -42, -116, -45, -96); k.closePath();
  };
  switch (f.frisur) {
    case 'glatze': ell(c, -14, -132, 16, 6, alpha('#fff6e0', 0.35), null, 0, -0.3); return;
    case 'locken':
      for (let i = 0; i < 9; i += 1) { const a = Math.PI + (i / 8) * Math.PI; ell(c, Math.cos(a) * 44, -102 + Math.sin(a) * 44, 18, 18, hair, line, 2); }
      path(c, (k) => cap(k, 4), hair, line, 2); break;
    case 'dutt': ell(c, 0, -152, 21, 19, hair, line, 2); path(c, (k) => cap(k), hair, line, 2); rr(c, -22, -140, 44, 8, 4, shade(hair, -0.25)); break;
    case 'zopf':
      path(c, (k) => cap(k), hair, line, 2);
      for (let i = 0; i < 5; i += 1) ell(c, 52 + i * 1.5, -78 + i * 22, 11, 14, i % 2 ? hair : shade(hair, 0.08), line, 2, 0.1);
      ell(c, 56, 30, 8, 8, '#d9a6a4'); break;
    case 'lang':
      path(c, (k) => cap(k, 2), hair, line, 2);
      for (const sd of [-1, 1]) path(c, (k) => { k.moveTo(sd * 36, -112); k.bezierCurveTo(sd * 60, -90, sd * 56, -50, sd * 50, -22); k.lineTo(sd * 36, -22); k.bezierCurveTo(sd * 40, -60, sd * 34, -90, sd * 30, -108); k.closePath(); }, hair, line, 2);
      break;
    default: // kurz
      path(c, (k) => cap(k), hair, line, 2); ell(c, -38, -88, 8, 16, hair); ell(c, 38, -88, 8, 16, hair);
  }
  c.strokeStyle = alpha(hi, 0.7); c.lineWidth = 4; c.lineCap = 'round';
  c.beginPath(); c.arc(0, -104, 36, Math.PI * 1.15, Math.PI * 1.45); c.stroke();
}

function drawFace(c, f, a) {
  const ink = '#3b2d2a';
  const happy = a.happy;
  for (const sd of [-1, 1]) {
    const ex = sd * 16, ey = -100;
    if (happy || a.blink) { c.strokeStyle = ink; c.lineWidth = 3.5; c.lineCap = 'round'; c.beginPath(); c.arc(ex, ey + (happy ? 4 : 2), 6.5, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); } else {
      ell(c, ex, ey + (a.working ? 2 : 0), 6.4, 8, ink); ell(c, ex + 2, ey - 2.5 + (a.working ? 2 : 0), 2.4, 2.6, '#fff'); ell(c, ex - 2, ey + 3 + (a.working ? 2 : 0), 1.3, 1.3, alpha('#fff', 0.7));
    }
    ell(c, sd * 28, -86, 9, 5.5, alpha('#e58f8a', 0.42));
    c.strokeStyle = alpha(shade(FARBEN[f.haare] ?? '#7a5640', -0.2), 0.8); c.lineWidth = 3; c.beginPath(); c.arc(ex, ey - 17 + (happy ? -2 : 0), 8, Math.PI * 1.2, Math.PI * 1.8); c.stroke();
  }
  c.strokeStyle = alpha(ink, 0.8); c.lineWidth = 2.6;
  if (a.sip) ell(c, 0, -86, 3.6, 4.2, alpha('#a85a5a', 0.85)); else { c.beginPath(); c.arc(0, -90, 6.5, Math.PI * 0.18, Math.PI * 0.82); c.stroke(); }
}

function drawAccessories(c, f, top) {
  const ink = '#3b2d2a';
  if (f.gesicht === 'brille') { for (const sd of [-1, 1]) { ell(c, sd * 16, -100, 15, 14, alpha('#e9f2f1', 0.18), '#6b5441', 3.2); } c.strokeStyle = '#6b5441'; c.lineWidth = 3; c.beginPath(); c.moveTo(-3, -102); c.quadraticCurveTo(0, -106, 3, -102); c.stroke(); }
  if (f.gesicht === 'sonnenbrille') { for (const sd of [-1, 1]) rr(c, sd * 16 - 15, -112, 30, 24, 10, '#34303a'); rr(c, -4, -106, 8, 4, 2, '#34303a'); ell(c, -22, -106, 6, 3, alpha('#fff', 0.35)); ell(c, 10, -106, 6, 3, alpha('#fff', 0.35)); }
  if (f.kopf === 'muetze') {
    const col = shade(top, -0.05) === top ? top : '#b98574';
    path(c, (k) => { k.moveTo(-48, -112); k.bezierCurveTo(-56, -180, 56, -180, 48, -112); k.closePath(); }, lg(c, 0, -170, 0, -110, [[0, shade(col, 0.1)], [1, shade(col, -0.1)]]), alpha(ink, 0.3), 2.5);
    rr(c, -52, -128, 104, 24, 12, shade(col, -0.12), alpha(ink, 0.3), 2.5);
    c.strokeStyle = alpha('#fff6e0', 0.25); c.lineWidth = 3; for (let i = -40; i <= 40; i += 16) { c.beginPath(); c.moveTo(i, -126); c.lineTo(i, -106); c.stroke(); }
    ell(c, 0, -168, 15, 15, '#f4eee2', alpha(ink, 0.25), 2);
  }
  if (f.kopf === 'kopfhoerer') {
    c.strokeStyle = '#5a5560'; c.lineWidth = 9; c.lineCap = 'round'; c.beginPath(); c.arc(0, -104, 50, Math.PI * 1.04, Math.PI * 1.96); c.stroke();
    for (const sd of [-1, 1]) { ell(c, sd * 48, -98, 13, 20, '#5a5560', alpha(ink, 0.3), 2); ell(c, sd * 48 + sd * 2, -98, 7, 12, '#c98f7a'); }
  }
  if (f.kopf === 'blumenkranz') {
    for (let i = 0; i < 9; i += 1) {
      const a = Math.PI * 1.08 + (i / 8) * Math.PI * 0.84, px = Math.cos(a) * 48, py = -102 + Math.sin(a) * 45;
      leaf(c, px, py, 18, 7, a + Math.PI / 2, '#7f9a74', { veins: false });
      if (i % 2 === 0) { for (let k = 0; k < 5; k += 1) ell(c, px + Math.cos((k / 5) * TAU) * 7, py + Math.sin((k / 5) * TAU) * 7, 6, 4.5, ['#e8c9c0', '#f1ece0', '#e6cf8a'][(i / 2) % 3 | 0], null, 0, (k / 5) * TAU); ell(c, px, py, 3.4, 3.4, '#d9ad63'); }
    }
  }
}

function drawFigure(c, f, x, ty, a, st) {
  const skin = HAUT[f.haut] ?? HAUT[2];
  const hair = FARBEN[f.haare] ?? FARBEN.braun;
  const top = FARBEN[f.oberteil] ?? FARBEN.blau;
  const typing = a.working ? Math.sin(a.t / 95 + a.seed * 9) : 0;
  c.save(); c.translate(x, ty + a.bob);
  drawHairBack(c, f, hair);
  // Arme
  for (const sd of [-1, 1]) {
    c.strokeStyle = shade(top, -0.06); c.lineWidth = 30; c.lineCap = 'round';
    c.beginPath(); c.moveTo(sd * 40, -46); c.quadraticCurveTo(sd * 62, -10, sd * 38, 16 + (a.working ? typing * sd * 3 : 0)); c.stroke();
    ell(c, sd * 38, 20 + (a.working ? typing * sd * 3 : 0), 12, 11, skin);
  }
  // Körper
  path(c, (k) => { k.moveTo(-52, 18); k.bezierCurveTo(-58, -26, -46, -64, -16, -72); k.lineTo(16, -72); k.bezierCurveTo(46, -64, 58, -26, 52, 18); k.closePath(); },
    lg(c, 0, -74, 0, 18, [[0, shade(top, 0.14)], [1, shade(top, -0.1)]]), alpha('#2b2118', 0.3), 2.5);
  ell(c, 0, -70, 20, 9, shade(skin, -0.1));
  if (f.hals === 'schal') {
    rr(c, -36, -78, 72, 22, 11, '#c07a6c', alpha('#2b2118', 0.28), 2.5);
    c.strokeStyle = alpha('#f1e3c8', 0.6); c.lineWidth = 3; for (let i = -26; i <= 26; i += 13) { c.beginPath(); c.moveTo(i, -76); c.lineTo(i, -58); c.stroke(); }
    rr(c, 12, -62, 24, 56, 9, '#c07a6c', alpha('#2b2118', 0.28), 2.5);
    c.strokeStyle = alpha('#f1e3c8', 0.6); for (let yy = -48; yy < -10; yy += 14) { c.beginPath(); c.moveTo(14, yy); c.lineTo(34, yy); c.stroke(); }
  }
  rr(c, -10, -82, 20, 18, 7, shade(skin, -0.1));
  // Kopf
  ell(c, 0, -102, 44, 41, lg(c, -30, -140, 30, -60, [[0, shade(skin, 0.1)], [1, shade(skin, -0.06)]]), alpha('#2b2118', 0.3), 2.5);
  for (const sd of [-1, 1]) ell(c, sd * 43, -98, 7, 10, skin, alpha('#2b2118', 0.25), 2);
  drawFace(c, f, a);
  drawHairFront(c, f, hair);
  drawAccessories(c, f, top);
  c.restore();
}

function steam(c, x, y, t, strong, seed) {
  c.strokeStyle = alpha('#ffffff', strong ? 0.6 : 0.4); c.lineWidth = 3.5; c.lineCap = 'round';
  for (let i = 0; i < 2; i += 1) {
    const ph = t / 520 + seed * 5 + i * 1.6;
    c.beginPath(); c.moveTo(x + i * 10 - 5, y);
    c.bezierCurveTo(x + i * 10 - 5 + Math.sin(ph) * 8, y - 14, x + i * 10 - 5 - Math.sin(ph) * 8, y - 24, x + i * 10 - 5 + Math.sin(ph + 1) * 7, y - (strong ? 44 : 34));
    c.stroke();
  }
}

function drawTable(c, x, ty, st) {
  ell(c, x, ty + 110, 134, 20, alpha('#2b2118', 0.2));
  rr(c, x - 9, ty + 40, 18, 66, 8, shade(st.rim, -0.1)); ell(c, x, ty + 104, 50, 11, shade(st.rim, -0.14));
  ell(c, x, ty + 38, 116, 29, st.rim);
  ell(c, x, ty + 26, 116, 29, lg(c, x - 110, ty, x + 110, ty + 55, [[0, shade(st.top, 0.1)], [1, shade(st.top, -0.07)]]), alpha('#2b2118', 0.2), 2);
  ell(c, x - 24, ty + 14, 70, 11, alpha('#fff6e0', 0.16));
}

function drawDesk(c, f, x, ty, a) {
  const hand = (hx, hy) => ell(c, hx, hy, 12, 10, HAUT[f.haut] ?? HAUT[2], alpha('#2b2118', 0.25), 2);
  if (f.tisch === 'laptop') {
    rr(c, x - 62, ty + 28, 124, 18, 8, '#aaa498', alpha('#2b2118', 0.25), 2);
    rr(c, x - 54, ty - 34, 108, 70, 10, lg(c, x - 54, ty - 34, x + 54, ty + 36, [[0, '#d7d3c9'], [1, '#b9b4a8']]), alpha('#2b2118', 0.3), 2.5);
    ell(c, x, ty + 2, 8, 8, alpha('#fff6e0', 0.55));
    if (a.working) glow(c, x, ty - 36, 70, '#cfe9ff', 0.28);
  } else if (f.tisch === 'notizbuch') {
    const wob = a.working ? Math.sin(a.t / 140 + a.seed * 7) * 7 : 0;
    path(c, (k) => { k.moveTo(x - 66, ty + 28); k.lineTo(x, ty + 20); k.lineTo(x, ty + 56); k.lineTo(x - 70, ty + 50); k.closePath(); }, '#f6efdc', alpha('#2b2118', 0.3), 2);
    path(c, (k) => { k.moveTo(x + 66, ty + 28); k.lineTo(x, ty + 20); k.lineTo(x, ty + 56); k.lineTo(x + 70, ty + 50); k.closePath(); }, '#fbf6e8', alpha('#2b2118', 0.3), 2);
    c.strokeStyle = alpha('#9a8b6e', 0.5); c.lineWidth = 2; for (let i = 0; i < 4; i += 1) { c.beginPath(); c.moveTo(x - 58, ty + 32 + i * 5); c.lineTo(x - 8, ty + 28 + i * 5); c.moveTo(x + 8, ty + 28 + i * 5); c.lineTo(x + 58, ty + 32 + i * 5); c.stroke(); }
    c.strokeStyle = '#6b8aa3'; c.lineWidth = 4; c.beginPath(); c.moveTo(x + 24 + wob, ty + 36); c.lineTo(x + 46 + wob, ty + 18); c.stroke();
    hand(x + 22 + wob, ty + 40); hand(x - 40, ty + 44);
  } else { // Schreibmaschine
    rr(c, x - 36, ty - 52, 72, 64, 4, '#fbf6e8', alpha('#2b2118', 0.28), 2);
    c.strokeStyle = alpha('#7a6e58', 0.55); c.lineWidth = 2.4; for (let i = 0; i < 5; i += 1) { c.beginPath(); c.moveTo(x - 26, ty - 40 + i * 9); c.lineTo(x + 26 - (i === 4 ? 24 : 0), ty - 40 + i * 9); c.stroke(); }
    rr(c, x - 62, ty + 2, 124, 50, 14, lg(c, 0, ty, 0, ty + 52, [[0, '#6f8486'], [1, '#52666a']]), alpha('#2b2118', 0.3), 2.5);
    ell(c, x, ty + 4, 68, 9, '#3d4d50');
    for (let r = 0; r < 2; r += 1) for (let i = 0; i < 8; i += 1) ell(c, x - 42 + i * 12 + r * 6, ty + 24 + r * 14, 4.6, 4.6, '#e6dfcc', '#3d4d50', 1.4);
    if (a.working && Math.floor(a.t / 160) % 2) ell(c, x + 10, ty + 24, 4.6, 4.6, '#cfc7b0', '#3d4d50', 1.4);
  }
  // Getränk
  const cx = x + 88, cy = ty + 34;
  ell(c, cx, cy + 12, 28, 8, alpha('#f4eee2', 0.95), alpha('#2b2118', 0.2), 1.5);
  rr(c, cx - 15, cy - 16, 30, 28, 9, lg(c, cx - 15, 0, cx + 15, 0, [[0, '#fbf6ea'], [1, '#e1d9c8']]), alpha('#2b2118', 0.28), 2);
  path(c, (k) => { k.arc(cx + 16, cy - 3, 8, -Math.PI / 2, Math.PI / 2); }, null, '#e1d9c8', 3.5);
  const liquid = f.getraenk === 'kaffee' ? '#5d4030' : f.getraenk === 'kakao' ? '#8f5f48' : '#cf9a55';
  ell(c, cx, cy - 14, 13, 4, liquid);
  if (f.getraenk === 'kakao') { ell(c, cx - 4, cy - 15, 4, 3, '#fbf6ea'); ell(c, cx + 4, cy - 14, 3.4, 2.6, '#f4dfe0'); }
  steam(c, cx, cy - 20, a.t, a.sip, a.seed);
  // Tier
  if (f.tier === 'katze') {
    const tail = Math.sin(a.t / 700 + a.seed * 6) * 8;
    c.strokeStyle = '#a6a095'; c.lineWidth = 10; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - 94, ty + 30); c.quadraticCurveTo(x - 128, ty + 30, x - 124 + tail, ty + 4); c.stroke();
    ell(c, x - 98, ty + 12, 24, 28, lg(c, x - 120, 0, x - 78, 0, [[0, '#b2ada2'], [1, '#948e84']]), alpha('#2b2118', 0.3), 2); ell(c, x - 98, ty + 20, 13, 16, '#e9e3d6');
    ell(c, x - 98, ty - 16, 21, 18, '#b2ada2', alpha('#2b2118', 0.3), 2);
    for (const sd of [-1, 1]) path(c, (k) => { k.moveTo(x - 98 + sd * 8, ty - 28); k.lineTo(x - 98 + sd * 19, ty - 42); k.lineTo(x - 98 + sd * 20, ty - 24); k.closePath(); }, '#b2ada2', alpha('#2b2118', 0.3), 2);
    c.strokeStyle = '#3b2d2a'; c.lineWidth = 2.6; for (const sd of [-1, 1]) { c.beginPath(); c.arc(x - 98 + sd * 8, ty - 17, 4.2, Math.PI * 0.15, Math.PI * 0.85); c.stroke(); }
    ell(c, x - 98, ty - 10, 2.6, 2, '#d99a95');
  } else if (f.tier === 'eule') {
    ell(c, x - 98, ty + 6, 24, 34, lg(c, x - 122, 0, x - 74, 0, [[0, '#a98664'], [1, '#85694c']]), alpha('#2b2118', 0.3), 2);
    ell(c, x - 98, ty + 12, 15, 22, '#eadcc0');
    for (const i of [0, 1, 2]) { c.strokeStyle = alpha('#a98664', 0.6); c.lineWidth = 2; c.beginPath(); c.arc(x - 98, ty + 6 + i * 9, 6, 0.2, Math.PI - 0.2); c.stroke(); }
    for (const sd of [-1, 1]) { path(c, (k) => { k.moveTo(x - 98 + sd * 12, ty - 26); k.lineTo(x - 98 + sd * 20, ty - 42); k.lineTo(x - 98 + sd * 22, ty - 22); k.closePath(); }, '#85694c'); ell(c, x - 98 + sd * 10, ty - 14, 11, 11, '#fbf6ea', alpha('#2b2118', 0.3), 2); ell(c, x - 98 + sd * 10, ty - 13, 5.4, 5.4, '#3b2d2a'); ell(c, x - 98 + sd * 11, ty - 15, 1.8, 1.8, '#fff'); }
    path(c, (k) => { k.moveTo(x - 104, ty - 6); k.lineTo(x - 98, ty + 4); k.lineTo(x - 92, ty - 6); k.closePath(); }, '#d9ad63');
  }
}

// ---------------------------------------------------------------- Module

function drawFlower(c, x, y, p, t) {
  const potH = 70;
  pot(c, x, y, 100, potH, '#c58f70');
  const by = y - potH - 4;
  const grow = clamp01(p);
  const h = 16 + 168 * Math.pow(grow, 0.8);
  const sway = Math.sin(t / 1500) * 3 * grow;
  const tx = x + sway * 2, ty = by - h;
  c.strokeStyle = '#6a8a5c'; c.lineWidth = 6 + grow * 3; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x, by); c.quadraticCurveTo(x + sway * 3, by - h * 0.5, tx, ty); c.stroke();
  const at = (f) => [x + (tx - x) * f * f + sway * 2.4 * f * (1 - f), by - h * f];
  const pairs = [[0.3, 0.1], [0.5, 0.28], [0.7, 0.5]];
  for (const [f, need] of pairs) {
    const k = clamp01((grow - need) / 0.18);
    if (k <= 0) continue;
    const [lx, ly] = at(f), s = (30 + 36 * f) * k;
    leaf(c, lx, ly, s, s * 0.42, -1.05 + sway * 0.02, '#7f9d6f'); leaf(c, lx, ly, s * 0.92, s * 0.4, 1.05 + sway * 0.02, '#6f8f62');
  }
  if (grow < 0.1) { leaf(c, x, by, 22 + grow * 120, 9, -0.7, '#8fb07f'); leaf(c, x, by, 22 + grow * 120, 9, 0.7, '#7f9d6f'); }
  if (grow >= 0.45) {
    const o = clamp01((grow - 0.45) / 0.55);
    if (o < 0.18) { // Knospe
      path(c, (k) => { k.moveTo(tx - 12, ty + 6); k.quadraticCurveTo(tx - 16, ty - 26, tx, ty - 34); k.quadraticCurveTo(tx + 16, ty - 26, tx + 12, ty + 6); k.closePath(); }, '#d6a7a2', alpha('#2b2118', 0.2), 2);
      leaf(c, tx - 4, ty + 8, 24, 9, -0.5, '#7f9d6f'); leaf(c, tx + 4, ty + 8, 24, 9, 0.5, '#7f9d6f');
    } else {
      const pl = 14 + 38 * o, n = 10;
      for (let i = 0; i < n; i += 1) { const a = (i / n) * TAU + sway * 0.02; ell(c, tx + Math.cos(a) * pl * 0.62, ty + Math.sin(a) * pl * 0.62, pl * 0.52, pl * 0.26, i % 2 ? '#e4b8b2' : '#edc7c0', alpha('#a8736d', 0.35), 1.5, a); }
      ell(c, tx, ty, 11 + 7 * o, 11 + 7 * o, '#e0b95c', alpha('#8a6a2a', 0.4), 2);
      for (let i = 0; i < 6; i += 1) ell(c, tx + Math.cos(i * 1.7) * 6 * o, ty + Math.sin(i * 1.7) * 6 * o, 1.8, 1.8, '#b9893a');
      if (grow >= 0.999) for (let i = 0; i < 4; i += 1) { const ph = t / 900 + i * 1.6; const sx = tx + Math.cos(ph) * 60, sy = ty - 24 + Math.sin(ph * 1.3) * 36; glow(c, sx, sy, 20, '#fff2c4', 0.6); }
    }
  }
}

function drawCandle(c, x, y, state, t) {
  // state: { phase, fraction }
  ell(c, x, y - 2, 52, 11, '#b99a62'); ell(c, x, y - 8, 46, 9, '#d3b680');
  const maxH = 130;
  const frac = state.phase === 'focus' ? clamp01(state.fraction) : state.phase === 'break' ? 0.12 : 1;
  const hgt = Math.max(16, maxH * (0.1 + 0.9 * frac));
  const top = y - 12 - hgt;
  rr(c, x - 26, top, 52, hgt, 12, lg(c, x - 26, 0, x + 26, 0, [[0, '#efe6d2'], [0.5, '#fbf6ea'], [1, '#e2d7be']]), alpha('#2b2118', 0.25), 2);
  ell(c, x, top + 2, 26, 8, '#f6efdc', alpha('#2b2118', 0.18), 1.5);
  if (frac < 0.95) { path(c, (k) => { k.moveTo(x - 20, top + 6); k.quadraticCurveTo(x - 24, top + 34, x - 16, top + 36); k.quadraticCurveTo(x - 10, top + 30, x - 12, top + 8); k.closePath(); }, '#fbf6ea'); }
  c.strokeStyle = '#4a3a30'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, top + 2); c.lineTo(x + 1, top - 12); c.stroke();
  if (state.phase === 'focus') {
    const fl = Math.sin(t / 130) * 2 + Math.sin(t / 77) * 1.3;
    glow(c, x, top - 30, 120, '#ffd88a', 0.55);
    path(c, (k) => { k.moveTo(x, top - 12); k.quadraticCurveTo(x - 17 + fl, top - 30, x + fl * 0.6, top - 62); k.quadraticCurveTo(x + 17 + fl, top - 30, x, top - 12); k.closePath(); }, lg(c, 0, top - 62, 0, top - 12, [[0, '#ffe9a8'], [0.6, '#f3b65c'], [1, '#e9854f']]));
    ell(c, x + fl * 0.2, top - 24, 5, 9, alpha('#fff8dd', 0.9));
  } else if (state.phase === 'break') {
    c.strokeStyle = alpha('#d8d2c6', 0.55); c.lineWidth = 3.5;
    for (let i = 0; i < 2; i += 1) { const ph = t / 700 + i * 2; c.beginPath(); c.moveTo(x, top - 12); c.bezierCurveTo(x + Math.sin(ph) * 14, top - 34, x - Math.sin(ph) * 14, top - 54, x + Math.sin(ph + 1) * 10, top - 80 - i * 10); c.stroke(); }
  }
}

function drawBooks(c, x, y, n, t) {
  const cols = ['#a8786b', '#7f98a6', '#c9b27a', '#8fa584', '#b59ab1', '#cf9a7a', '#7d8fa8', '#b8a07a'];
  const count = Math.max(1, Math.min(8, n));
  let yy = y - 2;
  for (let i = 0; i < count; i += 1) {
    const w = 120 - (i % 3) * 14, h = 22 + (i % 2) * 6, ox = ((i * 37) % 17) - 8;
    rr(c, x - w / 2 + ox, yy - h, w, h, 6, lg(c, 0, yy - h, 0, yy, [[0, shade(cols[i], 0.1)], [1, shade(cols[i], -0.1)]]), alpha('#2b2118', 0.3), 2);
    rr(c, x - w / 2 + ox + 8, yy - h + 6, w - 24, 4, 2, alpha('#fff6e0', 0.45));
    rr(c, x - w / 2 + ox + w - 12, yy - h + 3, 5, h - 6, 2, alpha('#fff6e0', 0.25));
    yy -= h;
  }
  // Ein kleines Pflänzchen oben drauf
  const sway = Math.sin(t / 1800) * 2;
  pot(c, x + 6, yy, 34, 26, '#d8c7a8');
  leaf(c, x + 6, yy - 24, 30, 11, -0.6 + sway * 0.02, '#7f9d6f'); leaf(c, x + 6, yy - 24, 36, 12, 0.1, '#6f8f62'); leaf(c, x + 6, yy - 24, 28, 10, 0.75, '#8fb07f');
}

// ---------------------------------------------------------------- Szene
function finishLayer() {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  c.fillStyle = rg(c, W / 2, H * 0.48, H * 0.45, H * 1.05, [[0, 'rgba(40,28,18,0)'], [1, 'rgba(40,28,18,0.3)']]); c.fillRect(0, 0, W, H);
  const n = document.createElement('canvas'); n.width = 200; n.height = 200;
  const nc = n.getContext('2d'); const img = nc.createImageData(200, 200); const r = rng(77);
  for (let i = 0; i < img.data.length; i += 4) { const v = r() > 0.5 ? 255 : 30; img.data[i] = v; img.data[i + 1] = v - 6; img.data[i + 2] = v - 18; img.data[i + 3] = r() * 11; }
  nc.putImageData(img, 0, 0);
  c.fillStyle = c.createPattern(n, 'repeat'); c.fillRect(0, 0, W, H);
  return cv;
}

// Holzbrett unter einem Modul (Wachstums-Modus, wo es kein Regal gibt)
function plank(c, w) {
  ell(c, 0, 18, w * 0.52, 12, alpha('#2b2118', 0.16));
  rr(c, -w / 2, -2, w, 24, 10, lg(c, 0, -2, 0, 22, [[0, '#d2b083'], [1, '#a98660']]), alpha('#2b2118', 0.25), 2);
  c.fillStyle = alpha('#fff6e0', 0.3); c.fillRect(-w / 2 + 12, 1, w - 24, 3);
}

// Rahmen um das Kamerabild. Das Innere wird durchsichtig geschnitten: In OBS liegt die Kamera unter dem Overlay.
function cameraFrame(c, k) {
  const { x, y, w, h } = k;
  rr(c, x - 22, y - 22, w + 44, h + 44, 34, lg(c, x, y - 22, x, y + h + 22, [[0, '#d9bf94'], [1, '#a88660']]), alpha('#2b2118', 0.3), 3);
  rr(c, x - 12, y - 12, w + 24, h + 24, 26, null, alpha('#fff6e0', 0.35), 3);
  for (const [lx, ly, a] of [[x - 14, y + 30, -0.4], [x - 8, y + 56, -0.9], [x + w + 14, y + h - 30, 2.7], [x + w + 8, y + h - 56, 2.2], [x + w * 0.3, y - 18, 0.9], [x + w * 0.7, y + h + 18, 3.9]]) leaf(c, lx, ly, 48, 17, a, '#7f9d6f');
  c.globalCompositeOperation = 'destination-out';
  rr(c, x, y, w, h, 20, '#000000');
  c.globalCompositeOperation = 'source-over';
}

export class Szene {
  constructor(canvas) {
    this.canvas = canvas;
    canvas.width = W; canvas.height = H;
    this.c = canvas.getContext('2d');
    this.cache = document.createElement('canvas'); this.cache.width = W; this.cache.height = H;
    this.cacheKey = '';
    this.finish = finishLayer();
    this.wachstum = new Wachstum();
    this.view = { scene: 'cafe', deco: [], seats: [], timer: { phase: 'idle' }, modules: {} };
    this.seen = new Map();
    this.effects = [];
    this.motes = Array.from({ length: 26 }, (_, i) => { const r = rng(i * 13 + 5); return { x: r() * W, y: 120 + r() * 800, s: 0.2 + r() * 0.5, sz: 3 + r() * 5, ph: r() * 6 }; });
  }

  update(view) {
    this.view = view;
    this.offset = (view.now ?? Date.now()) - Date.now();
    const now = performance.now();
    const ids = new Set(view.seats.map((s) => s.id));
    for (const s of view.seats) if (!this.seen.has(s.id)) this.seen.set(s.id, now);
    for (const id of [...this.seen.keys()]) if (!ids.has(id)) this.seen.delete(id);
  }

  event(ev) {
    const pos = ev.slot != null ? seatPos(ev.slot) : null;
    if (ev.type === 'sit' && pos) this.effects.push({ kind: 'spark', x: pos.x, y: pos.ty - 130, t0: performance.now() });
    if (ev.type === 'leave' && pos) this.effects.push({ kind: 'puff', x: pos.x, y: pos.ty - 70, t0: performance.now() });
    if (ev.type === 'goal') this.effects.push({ kind: 'bloom', t0: performance.now() });
  }

  background() {
    const { scene, deco } = this.view;
    const key = `${scene}|${deco.join(',')}`;
    if (key === this.cacheKey) return;
    this.cacheKey = key;
    const c = this.cache.getContext('2d');
    c.clearRect(0, 0, W, H);
    const sc = BACKGROUNDS[scene] ? scene : 'cafe';
    BACKGROUNDS[sc](c);
    decoStatic(c, sc, deco);
  }

  draw(t = performance.now()) {
    const { c } = this;
    const { scene, deco, seats, timer, modules, modus, layout } = this.view;
    const wachs = modus === 'wachstum';
    c.clearRect(0, 0, W, H);
    if (wachs) {
      this.wachstum.draw(c, this.view, t);
    } else {
      this.background();
      c.drawImage(this.cache, 0, 0);
      this.rays(c, t);
      this.live(c, STYLE[scene] ? scene : 'cafe', deco, t);
    }
    this.drawModules(c, t, modules ?? {}, timer);
    if (!wachs) this.drawSeats(c, t, scene, seats, timer);
    this.drawEffects(c, t);
    if (!wachs) this.particles(c, t);
    c.drawImage(this.finish, 0, 0);
    if (layout?.kamera?.on) cameraFrame(c, layout.kamera);
  }

  drawSeats(c, t, scene, seats, timer) {
    const sc = STYLE[scene] ? scene : 'cafe';
    const st = STYLE[sc];
    const phase = timer?.phase;
    const ordered = [...seats].sort((p, q) => seatPos(p.slot).ty - seatPos(q.slot).ty);
    for (const s of ordered) {
      const { x, ty } = seatPos(s.slot);
      const age = t - (this.seen.get(s.id) ?? t);
      const drop = age < 600 ? Math.round((1 - age / 600) ** 2 * 120) : 0;
      const seed = [...s.id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 997, 7) / 997;
      const sip = phase === 'break';
      const a = { t, seed, working: phase === 'focus', sip: sip && Math.floor(t / 2600 + seed * 5) % 3 === 0, happy: sip && Math.floor(t / 3000 + seed * 3) % 2 === 0, blink: Math.floor(t / 120 + seed * 40) % 34 === 0, bob: Math.sin(t / 900 + seed * 6) * 2 };
      c.save();
      c.translate(0, -drop);
      if (drop) c.globalAlpha = Math.min(1, age / 350);
      drawChair(c, x, ty, st);
      drawFigure(c, s.figure, x, ty, a, st);
      drawTable(c, x, ty, st);
      drawDesk(c, s.figure, x, ty, a);
      c.restore();
    }
  }

  rays(c, t) {
    for (let i = 0; i < 3; i += 1) {
      const x = 260 + i * 520 + Math.sin(t / 5000 + i) * 40;
      c.fillStyle = lg(c, x, 0, x + 380, 900, [[0, 'rgba(255,240,200,0.11)'], [1, 'rgba(255,240,200,0)']]);
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 170, 0); c.lineTo(x + 640, 1000); c.lineTo(x + 380, 1000); c.closePath(); c.fill();
    }
  }

  particles(c, t) {
    for (const m of this.motes) {
      const x = (m.x + (t / 1000) * 14 * m.s) % W, y = m.y + Math.sin(t / 1400 + m.ph) * 26;
      glow(c, x, y, m.sz * 2.6, '#fff4cf', 0.42 + 0.25 * Math.sin(t / 700 + m.ph));
    }
  }

  // bewegte Teile: Lichterkette, Zimmerkatze, Vögel
  live(c, scene, deco, t) {
    if (deco.includes('lichter')) {
      const cols = ['#ffd890', '#f2b9a6', '#bfe0e6', '#d6e8b4'];
      c.strokeStyle = alpha('#4a3a30', 0.55); c.lineWidth = 3; c.beginPath();
      for (let x = 0; x <= W; x += 20) { const y = 22 + Math.sin(((x % 480) / 480) * Math.PI) * 52; x ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.stroke();
      for (let i = 0, x = 40; x < W; i += 1, x += 60) {
        const y = 22 + Math.sin(((x % 480) / 480) * Math.PI) * 52 + 8;
        const on = Math.floor(t / 600 + i * 1.7) % 5 !== 0;
        ell(c, x, y + 6, 7, 10, on ? cols[i % 4] : '#8c7d68');
        if (on) glow(c, x, y + 6, 42, cols[i % 4], 0.5);
      }
    }
    if (deco.includes('katze')) {
      const [x, y] = scene === 'cafe' ? [1040, 880] : scene === 'garten' ? [560, 872] : [1400, 880];
      const br = Math.sin(t / 900) * 2.2;
      ell(c, x, y + 4, 62, 14, alpha('#2b2118', 0.16));
      ell(c, x, y - 12 - br * 0.5, 54, 30 + br, lg(c, 0, y - 44, 0, y + 10, [[0, '#e6b878'], [1, '#c99a5e']]), alpha('#2b2118', 0.3), 2.5);
      ell(c, x - 38, y - 18, 24, 22, '#e6b878', alpha('#2b2118', 0.3), 2.5);
      for (const sd of [-1, 1]) path(c, (k) => { k.moveTo(x - 38 + sd * 8, y - 34); k.lineTo(x - 38 + sd * 17, y - 48); k.lineTo(x - 38 + sd * 19, y - 30); k.closePath(); }, '#e6b878', alpha('#2b2118', 0.3), 2);
      c.strokeStyle = '#3b2d2a'; c.lineWidth = 2.6; for (const sd of [-1, 1]) { c.beginPath(); c.arc(x - 38 + sd * 8, y - 20, 4, Math.PI * 0.15, Math.PI * 0.85); c.stroke(); }
      c.strokeStyle = '#c99a5e'; c.lineWidth = 10; c.lineCap = 'round'; c.beginPath(); c.moveTo(x + 50, y - 6); c.quadraticCurveTo(x + 84, y - 10 + Math.sin(t / 800) * 4, x + 70, y - 34); c.stroke();
      if (Math.floor(t / 2000) % 3 === 0) { c.fillStyle = alpha('#fff', 0.7); c.font = '600 22px Fredoka, sans-serif'; c.fillText('z', x - 10, y - 56 - (t % 2000) / 90); c.fillText('z', x + 8, y - 74 - (t % 2000) / 90); }
    }
    if (deco.includes('voegel')) {
      for (let i = 0; i < 3; i += 1) {
        const span = W + 200, p = ((t / (scene === 'cafe' ? 22 : 16)) + i * 620) % span;
        const x = scene === 'cafe' ? 190 + (p % 340) : p - 100, y = (scene === 'cafe' ? 180 : 130) + i * 54 + Math.sin(t / 420 + i) * 12;
        const flap = Math.sin(t / 110 + i * 2) * 9, col = i === 1 ? '#a98a9a' : '#5f5a63';
        if (scene === 'cafe' && x > 500) continue;
        c.strokeStyle = col; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - 16, y + flap); c.quadraticCurveTo(x - 8, y - 6, x, y); c.quadraticCurveTo(x + 8, y - 6, x + 16, y + flap); c.stroke();
      }
    }
  }

  drawModules(c, t, modules, timer) {
    const view = this.view;
    const wachs = view.modus === 'wachstum';
    for (const m of moduleLayout(modules, view.layout, view.modus)) {
      c.save(); c.translate(m.x, m.y); c.scale(m.s, m.s);
      if (wachs) plank(c, m.id === 'buecher' ? 230 : 210);
      if (m.id === 'blume') drawFlower(c, 0, 0, view.words?.goal ? view.words.today / view.words.goal : (view.words?.today ?? 0) / 1000, t);
      else if (m.id === 'kerze') {
        const len = timer?.endsAt && timer?.startedAt ? timer.endsAt - timer.startedAt : 1;
        const elapsed = Date.now() + (this.offset ?? 0) - (timer?.startedAt ?? 0);
        drawCandle(c, 0, 0, { phase: timer?.phase ?? 'idle', fraction: 1 - elapsed / len }, t);
      } else drawBooks(c, 0, 0, view.sprintsToday ?? 0, t);
      c.restore();
    }
  }

  drawEffects(c, t) {
    this.effects = this.effects.filter((e) => t - e.t0 < (e.kind === 'bloom' ? 2600 : 1100));
    for (const e of this.effects) {
      if (e.kind === 'bloom') { const p = (t - e.t0) / 2600; c.fillStyle = alpha('#fff2c4', 0.28 * (1 - p)); c.fillRect(0, 0, W, H); continue; }
      const p = (t - e.t0) / 1100;
      c.globalAlpha = 1 - p;
      if (e.kind === 'spark') {
        for (let i = 0; i < 7; i += 1) {
          const ang = (i / 7) * TAU + p * 1.5, d = 30 + p * 80, sx = e.x + Math.cos(ang) * d, sy = e.y + Math.sin(ang) * d - p * 30, r = 10 * (1 - p * 0.5);
          path(c, (k) => { k.moveTo(sx, sy - r); k.quadraticCurveTo(sx, sy, sx + r, sy); k.quadraticCurveTo(sx, sy, sx, sy + r); k.quadraticCurveTo(sx, sy, sx - r, sy); k.quadraticCurveTo(sx, sy, sx, sy - r); }, i % 2 ? '#ffe9a8' : '#ffffff');
        }
        glow(c, e.x, e.y, 120 * (1 - p * 0.4), '#fff2c4', 0.5);
      } else { ell(c, e.x - 30 + p * 14, e.y - p * 60, 14 + p * 20, 14 + p * 20, '#f4eee2'); ell(c, e.x + 28 - p * 14, e.y - p * 44, 10 + p * 18, 10 + p * 18, '#e8e1d2'); }
      c.globalAlpha = 1;
    }
  }
}
