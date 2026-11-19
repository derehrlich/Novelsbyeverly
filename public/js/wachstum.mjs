// Die wachsende Landschaft: Eine leere Wiese, die mit dem Fortschritt (Wörter oder Pomodoros) zuwächst.
// Jahreszeit bestimmt, was wächst (Frühling: Blüten und Rosen, Sommer: Sonnenblumen und Lavendel,
// Herbst: ein Baum verliert seine Blätter, Winter: es schneit zu), die Tageszeit bestimmt Himmel und Licht.
import { H, TAU, W, alpha, clamp01, ell, glow, grassStrokes, leaf, lg, mixc, path, rng, rr, shade, smooth } from './malerei.mjs';
import { STYLE, drawChair, drawDesk, drawFigure, drawTable } from './figur.mjs';

export const JAHRESZEITEN = { fruehling: 'Frühling', sommer: 'Sommer', herbst: 'Herbst', winter: 'Winter' };
export const TAGESZEITEN = { morgen: 'Morgengrauen', mittag: 'Mittag', abend: 'Abend' };

const canvas = () => { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; return cv; };

const SKY = {
  morgen: { top: '#b7a8d2', mid: '#efbdb1', hor: '#f9e3bb', sun: [1360, 650, '#ffd9a0'], r: 460, disc: [1360, 660, 64, '#ffe4b4'], cloud: '#f8d8cf', tint: ['#ffc4a4', 0.1] },
  mittag: { top: '#9bc2d9', mid: '#cde3e1', hor: '#f4eed4', sun: [1500, 170, '#fff4cc'], r: 600, disc: [1500, 170, 48, '#fff9de'], cloud: '#fbf6ea', tint: null },
  abend: { top: '#403f6c', mid: '#a76f8d', hor: '#f1b184', sun: [470, 660, '#ffb878'], r: 560, disc: [470, 672, 78, '#ffd5a2'], cloud: '#cf93a6', tint: ['#3e2f6c', 0.2] },
};
const PAL = {
  fruehling: { hills: ['#bad4aa', '#a5c896', '#90b983'], far: ['#9dc08f', '#8db37f'], ground: ['#abcd94', '#86ad72'], blades: ['#6f9a5a', '#86b06f', '#5c8a52'], tree: ['#9cc17a', '#b2d08a', '#88b06a', '#a6c885'] },
  sommer: { hills: ['#b7cb8c', '#a1bd76', '#8cab62'], far: ['#86a866', '#789b5b'], ground: ['#aac671', '#869f56'], blades: ['#6f9448', '#8cb15c', '#5b8040'], tree: ['#5f8a48', '#6f9a58', '#4e7a3e', '#7ba462'] },
  herbst: { hills: ['#d3b47c', '#bc9862', '#a47d4e'], far: ['#b88a58', '#a97848'], ground: ['#c2a56a', '#9e8250'], blades: ['#a98a4a', '#c0a25c', '#8a6e3e'], tree: ['#d8a850', '#c98a3e', '#b8692f', '#a2552b'] },
  winter: { hills: ['#c9d2c8', '#b9c3bb', '#a8b3ac'], far: ['#8a9a90', '#7b8c84'], ground: ['#a3a891', '#8c917b'], blades: ['#9aa07f', '#8a9070', '#a8ad90'], tree: ['#e8eef2', '#dde5ea', '#f2f5f7', '#cfd9df'] },
};

// ---- Himmel, Hügel, Boden (ändern sich nur mit Jahreszeit, Tageszeit und Schnee)
function paintBackground(c, season, zeit, snow) {
  const S = SKY[zeit], P = PAL[season];
  const sc = (h) => (season === 'winter' ? mixc(h, '#dfe4e8', 0.38) : season === 'herbst' ? mixc(h, '#f0d4a8', 0.14) : h);
  c.fillStyle = lg(c, 0, 0, 0, 700, [[0, sc(S.top)], [0.55, sc(S.mid)], [1, sc(S.hor)]]); c.fillRect(0, 0, W, H);
  if (zeit === 'abend') {
    const r = rng(9);
    for (let i = 0; i < 110; i += 1) { const y = r() * 380; ell(c, r() * W, y, 1.2 + r() * 1.8, 1.2 + r() * 1.8, alpha('#fff8e4', 0.25 + r() * 0.6 * (1 - y / 420))); }
    glow(c, 1480, 190, 260, '#f6f0d6', 0.3); ell(c, 1480, 190, 46, 46, lg(c, 1440, 150, 1520, 230, [[0, '#fbf6e2'], [1, '#e6dfc4']])); ell(c, 1466, 178, 9, 8, alpha('#c9c2a6', 0.5)); ell(c, 1494, 204, 7, 6, alpha('#c9c2a6', 0.45));
  }
  glow(c, S.sun[0], S.sun[1], S.r, S.sun[2], 0.8);
  glow(c, S.sun[0], S.sun[1], S.r * 0.42, '#fff4d8', 0.55);
  ell(c, S.disc[0], S.disc[1], S.disc[2], S.disc[2], S.disc[3]);
  const cl = (x, y, s) => { for (const [dx, dy, rx, ry] of [[0, 0, 110, 32], [-70, 8, 70, 24], [84, 8, 80, 26], [20, -22, 70, 32]]) ell(c, x + dx * s, y + dy * s, rx * s, ry * s, alpha(S.cloud, zeit === 'abend' ? 0.55 : 0.8)); };
  cl(300, 150, 1.1); cl(980, 90, 0.9); cl(1560, 270, 0.85); cl(720, 300, 0.7);
  const snowC = (h) => (snow ? mixc(h, '#f4f7fa', snow * 0.88) : h);
  const hillPath = (y, seed, wave, amp, col) => { const r = rng(seed); const ph = [r() * 6, r() * 6]; path(c, (k) => { k.moveTo(0, H); k.lineTo(0, y); for (let x = 0; x <= W; x += 40) k.lineTo(x, y + Math.sin(x / wave + ph[0]) * amp + Math.sin(x / (wave * 0.45) + ph[1]) * amp * 0.4); k.lineTo(W, H); k.closePath(); }, col); };
  hillPath(560, 2, 250, 44, snowC(P.hills[0])); hillPath(612, 5, 210, 38, snowC(P.hills[1])); hillPath(664, 8, 180, 30, snowC(P.hills[2]));
  const r2 = rng(33);
  for (let i = 0; i < 26; i += 1) ell(c, i * 76 + r2() * 30, 650 + r2() * 24, 56 + r2() * 28, 40 + r2() * 18, snowC(P.far[i % 2]));
  const g0 = season === 'winter' ? mixc(P.ground[0], '#f1f5f8', snow * 0.96) : P.ground[0];
  const g1 = season === 'winter' ? mixc(P.ground[1], '#dfe7ee', snow * 0.96) : P.ground[1];
  c.fillStyle = lg(c, 0, 690, 0, H, [[0, g0], [1, g1]]); c.fillRect(0, 690, W, H - 690);
  const strokes = season === 'winter' ? Math.round(520 * (1 - snow)) : 560;
  if (strokes > 0) grassStrokes(c, 0, 700, W, H, strokes, 17, P.blades);
  const r3 = rng(41);
  for (let i = 0; i < 18; i += 1) ell(c, r3() * W, 720 + r3() * 340, 90 + r3() * 120, 14 + r3() * 18, alpha(season === 'winter' ? '#ffffff' : '#fff3c8', 0.1));
}

// ---- Pflanzen auf der Wiese
const hk = (g) => smooth(clamp01(g / 0.7));
const bk = (g) => smooth(clamp01((g - 0.5) / 0.5));
const stalk = (c, x, y, h, w, col, bend = 0) => { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + bend, y - h * 0.55, x + bend * 1.4, y - h); c.stroke(); return [x + bend * 1.4, y - h]; };

function tuft(c, x, y, s, g, r, cols, snow = 0) {
  const h = hk(g);
  if (h <= 0.02) return;
  for (let i = 0; i < 7; i += 1) {
    const ang = (i - 3) * 0.2 + (r - 0.5) * 0.3, len = (26 + (i % 3) * 9) * s * h;
    c.strokeStyle = cols[i % cols.length]; c.lineWidth = 3.2 * s; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x + (i - 3) * 3 * s, y); c.quadraticCurveTo(x + Math.sin(ang) * len * 0.5, y - len * 0.6, x + Math.sin(ang) * len, y - len); c.stroke();
  }
  if (snow > 0.05) ell(c, x, y - 4 * s, 18 * s, 6 * s * snow, alpha('#ffffff', 0.9 * snow));
}
function daisy(c, x, y, s, g, r) {
  const [hx, hy] = stalk(c, x, y, (46 + r * 16) * s * hk(g), 2.6 * s, '#6f9a5a', (r - 0.5) * 10 * s);
  leaf(c, x, y - 10 * s, 16 * s * hk(g), 6 * s, -0.9, '#7ea867', { veins: false });
  const o = bk(g);
  if (o < 0.15) { ell(c, hx, hy, 4 * s, 6 * s, '#8fb27a'); return; }
  for (let i = 0; i < 9; i += 1) { const a = (i / 9) * TAU; ell(c, hx + Math.cos(a) * 8 * s * o, hy + Math.sin(a) * 8 * s * o, 7 * s * o, 3.2 * s * o, '#fbf6ea', alpha('#8a7a62', 0.25), 1, a); }
  ell(c, hx, hy, 4.6 * s * o + 1, 4.6 * s * o + 1, '#e9c867');
}
function tulip(c, x, y, s, g, r) {
  const cols = ['#d9808a', '#e8a07a', '#efd9a0', '#b99ad0'];
  const col = cols[Math.floor(r * 4) % 4];
  const [hx, hy] = stalk(c, x, y, (58 + r * 18) * s * hk(g), 3 * s, '#6f9a5a', (r - 0.5) * 8 * s);
  leaf(c, x - 2 * s, y - 4 * s, 34 * s * hk(g), 8 * s, -0.3, '#7ea867', { veins: false }); leaf(c, x + 2 * s, y - 4 * s, 30 * s * hk(g), 7 * s, 0.35, '#6f9a5a', { veins: false });
  const o = bk(g);
  const w = (7 + 6 * o) * s, h = (10 + 8 * o) * s;
  path(c, (k) => { k.moveTo(hx - w, hy); k.quadraticCurveTo(hx - w * 1.1, hy - h, hx - w * 0.3, hy - h * 1.3); k.lineTo(hx, hy - h * 0.9); k.lineTo(hx + w * 0.3, hy - h * 1.3); k.quadraticCurveTo(hx + w * 1.1, hy - h, hx + w, hy); k.quadraticCurveTo(hx, hy + h * 0.45, hx - w, hy); k.closePath(); }, lg(c, hx - w, 0, hx + w, 0, [[0, shade(col, 0.1)], [1, shade(col, -0.1)]]), alpha('#2b2118', 0.22), 1.4);
}
function bell(c, x, y, s, g, r) {
  const hh = (52 + r * 14) * s * hk(g);
  c.strokeStyle = '#6f9a5a'; c.lineWidth = 2.4 * s; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 14 * s, y - hh * 0.8, x + 4 * s, y - hh); c.stroke();
  const o = bk(g);
  for (let i = 0; i < 3; i += 1) { const t = 0.5 + i * 0.22, bx = x + 10 * s * t + (i - 1) * 3 * s, by = y - hh * t; ell(c, bx, by + 6 * s, 5.4 * s * o + 1, 8 * s * o + 1, i % 2 ? '#a597d3' : '#8f86c8', alpha('#2b2118', 0.2), 1); ell(c, bx, by + 13 * s * o, 5 * s * o, 1.6 * s * o, '#d9d2ee'); }
}
function sunflower(c, x, y, s, g, r) {
  const h = (112 + r * 40) * s * hk(g);
  const [hx, hy] = stalk(c, x, y, h, 5.5 * s, '#5f8a48', (r - 0.5) * 16 * s);
  leaf(c, x, y - h * 0.3, 40 * s * hk(g), 15 * s, -1.0, '#6f9a58'); leaf(c, x, y - h * 0.5, 36 * s * hk(g), 14 * s, 1.0, '#5f8a48');
  const o = bk(g);
  if (o < 0.1) { ell(c, hx, hy, 8 * s, 10 * s, '#7ea867'); return; }
  const pr = 26 * s * o + 6;
  for (let i = 0; i < 16; i += 1) { const a = (i / 16) * TAU + r; ell(c, hx + Math.cos(a) * pr * 0.78, hy + Math.sin(a) * pr * 0.78, pr * 0.46, pr * 0.2, i % 2 ? '#e9bb54' : '#f0c961', alpha('#8a6a22', 0.3), 1, a); }
  ell(c, hx, hy, pr * 0.5, pr * 0.5, lg(c, hx - pr, hy - pr, hx + pr, hy + pr, [[0, '#8a5f3a'], [1, '#5d3e28']]));
  for (let i = 0; i < 9; i += 1) ell(c, hx + Math.cos(i * 2.4) * pr * 0.26, hy + Math.sin(i * 2.4) * pr * 0.26, 1.8 * s, 1.8 * s, alpha('#c79a62', 0.7));
}
function lavender(c, x, y, s, g, r) {
  const o = bk(g);
  for (let i = 0; i < 4; i += 1) {
    const h = (56 + i * 7 + r * 12) * s * hk(g), bx = (i - 1.5) * 6 * s;
    const [tx, ty] = stalk(c, x + bx, y, h, 2.2 * s, '#6f9a5a', (i - 1.5) * 4 * s);
    for (let k = 0; k < 8; k += 1) { const t = k / 8; ell(c, tx - (tx - x - bx) * t * 0.35 + (k % 2 ? 2 : -2) * s, ty + (h * 0.42) * t, (3.3 - t * 1.2) * s * (0.4 + o * 0.6), (4.8 - t) * s * (0.4 + o * 0.6), k % 2 ? '#a28ec9' : '#b8a6dc'); }
  }
}
function poppy(c, x, y, s, g, r) {
  const [hx, hy] = stalk(c, x, y, (62 + r * 16) * s * hk(g), 2.4 * s, '#6f9a5a', (r - 0.5) * 12 * s);
  const o = bk(g);
  if (o < 0.15) { ell(c, hx, hy, 4 * s, 6 * s, '#8fb27a'); return; }
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 0.4]]) ell(c, hx + dx * 8 * s * o, hy + dy * 6 * s * o, 9 * s * o, 8 * s * o, '#d8645a', alpha('#7a2e2a', 0.3), 1);
  ell(c, hx, hy, 3.4 * s, 3.4 * s, '#3a2c2a');
}
function cornflower(c, x, y, s, g, r) {
  const [hx, hy] = stalk(c, x, y, (56 + r * 14) * s * hk(g), 2.2 * s, '#6f9a5a', (r - 0.5) * 10 * s);
  const o = bk(g);
  if (o < 0.15) return;
  for (let i = 0; i < 8; i += 1) { const a = (i / 8) * TAU; ell(c, hx + Math.cos(a) * 7 * s * o, hy + Math.sin(a) * 7 * s * o, 6 * s * o, 2.4 * s * o, '#7d98d2', null, 0, a); }
  ell(c, hx, hy, 2.6 * s, 2.6 * s, '#4a5a9a');
}
function aster(c, x, y, s, g, r) {
  const [hx, hy] = stalk(c, x, y, (40 + r * 12) * s * hk(g), 2 * s, '#7a8a52', (r - 0.5) * 8 * s);
  const o = bk(g); if (o < 0.15) return;
  for (let i = 0; i < 12; i += 1) { const a = (i / 12) * TAU; ell(c, hx + Math.cos(a) * 6 * s * o, hy + Math.sin(a) * 6 * s * o, 5 * s * o, 1.8 * s * o, r > 0.5 ? '#b49ad0' : '#d6a0b4', null, 0, a); }
  ell(c, hx, hy, 2.6 * s, 2.6 * s, '#e3b95a');
}
function pumpkin(c, x, y, s, g) {
  const k = smooth(clamp01(g / 0.9));
  if (k < 0.05) return;
  const rx = 26 * s * k, ry = 20 * s * k;
  ell(c, x, y + 4 * s, rx * 1.1, ry * 0.4, alpha('#2b2118', 0.16));
  ell(c, x, y - ry * 0.9, rx, ry, lg(c, x - rx, y, x + rx, y, [[0, '#c9753e'], [0.5, '#e29a55'], [1, '#bf6c38']]), alpha('#7a3e1c', 0.4), 1.5);
  c.strokeStyle = alpha('#9a5028', 0.5); c.lineWidth = 1.6; for (const f of [-0.5, 0, 0.5]) { c.beginPath(); c.ellipse(x, y - ry * 0.9, rx * Math.abs(f) + 3, ry, 0, Math.PI * 1.5, Math.PI * 2.5); c.stroke(); }
  rr(c, x - 2 * s, y - ry * 1.9, 4 * s, 7 * s, 2, '#6a5a30'); leaf(c, x + 2 * s, y - ry * 1.7, 14 * s * k, 5 * s, 0.9, '#7a9a4a', { veins: false });
}
function mushroom(c, x, y, s, g, r) {
  const k = smooth(clamp01(g / 0.9)); if (k < 0.05) return;
  const red = r > 0.45;
  rr(c, x - 4 * s * k, y - 18 * s * k, 8 * s * k, 18 * s * k, 4 * s, '#efe4cc', alpha('#2b2118', 0.2), 1);
  path(c, (kk) => { kk.moveTo(x - 17 * s * k, y - 16 * s * k); kk.quadraticCurveTo(x, y - 40 * s * k, x + 17 * s * k, y - 16 * s * k); kk.quadraticCurveTo(x, y - 12 * s * k, x - 17 * s * k, y - 16 * s * k); kk.closePath(); }, red ? '#c4615a' : '#a98a64', alpha('#2b2118', 0.25), 1.4);
  if (red) for (const [dx, dy] of [[-7, -22], [3, -28], [9, -20]]) ell(c, x + dx * s * k, y + dy * s * k, 2.6 * s * k, 2.2 * s * k, '#f6efe0');
}
function frond(c, x, y, s, g, r) {
  const k = hk(g); if (k < 0.05) return;
  for (let i = 0; i < 6; i += 1) { const a = (i - 2.5) * 0.34 + (r - 0.5) * 0.2; leaf(c, x, y, (46 + (i % 3) * 8) * s * k, 8 * s * k, a, i % 2 ? '#7a9a5a' : '#6a8a50', { veins: false }); }
}
function shrubWinter(c, x, y, s, snow, r) {
  ell(c, x, y - 12 * s, 28 * s, 18 * s, '#5f7d5a', alpha('#2b2118', 0.2), 1.5);
  ell(c, x - 12 * s, y - 20 * s, 18 * s, 14 * s, '#6f8d68'); ell(c, x + 12 * s, y - 18 * s, 16 * s, 12 * s, '#58765a');
  if (r > 0.4) for (let i = 0; i < 6; i += 1) ell(c, x + Math.cos(i * 2.1) * 14 * s, y - 16 * s + Math.sin(i * 2.7) * 8 * s, 2.6 * s, 2.6 * s, '#c4605a');
  ell(c, x, y - 26 * s, 24 * s, 9 * s * snow + 1, alpha('#ffffff', 0.55 + 0.4 * snow));
}

// Mehrere Pilze zusammen (Fliegenpilze, Steinpilze, kleine Gruppen)
function pilze(c, x, y, s, g, r) {
  const n = 2 + Math.floor(r * 3);
  for (let i = 0; i < n; i += 1) { const rr2 = (r * 7 + i * 0.37) % 1; mushroom(c, x + (i - (n - 1) / 2) * 15 * s + (rr2 - 0.5) * 6, y + (i % 2) * 5 * s, s * (0.62 + rr2 * 0.55), clamp01(g - i * 0.05), rr2 > 0.4 ? 0.9 : 0.1); }
}

const DRAW = { daisy, tulip, bell, sunflower, lavender, poppy, cornflower, aster, pumpkin, mushroom, pilze, frond };
const MIX = {
  fruehling: ['tuft', 'tuft', 'daisy', 'daisy', 'tulip', 'tulip', 'bell', 'tuft', 'daisy'],
  sommer: ['tuft', 'sunflower', 'sunflower', 'lavender', 'lavender', 'poppy', 'cornflower', 'tuft', 'poppy'],
  herbst: ['tuft', 'aster', 'aster', 'pumpkin', 'pilze', 'pilze', 'pilze', 'frond', 'pilze', 'aster', 'pilze'],
  winter: ['shrub', 'tuft', 'shrub', 'tuft', 'tuft'],
};
const slotCache = new Map();
function slotsFor(season) {
  if (slotCache.has(season)) return slotCache.get(season);
  const r = rng(season.length * 101 + 7);
  const n = season === 'winter' ? 60 : season === 'sommer' ? 130 : 150;
  const list = [];
  for (let i = 0; i < n; i += 1) {
    const u = r();
    const y = 700 + Math.pow(u, 0.85) * 360;
    const s = 0.5 + ((y - 700) / 360) * 0.95;
    list.push({ x: 20 + r() * (W - 40), y, s, thr: season === 'winter' ? 0 : r() * 0.88, r: r(), type: MIX[season][Math.floor(r() * MIX[season].length)] });
  }
  list.sort((a, b) => a.y - b.y);
  slotCache.set(season, list);
  return list;
}

// ---- Die große Eiche: mächtiger Stamm mit Wurzelanläufen, schwere Äste, ausladende Krone aus vielen einzelnen Blättern
export const BAUM = { x: 600, y: 716, s: 0.9 };
const treeModels = new Map();
function treeModel(seed) {
  if (treeModels.has(seed)) return treeModels.get(seed);
  const r = rng(seed), segs = [], tips = [];
  const grow = (x, y, ang, len, w, depth) => {
    const bend = (r() - 0.5) * 0.5, a2 = ang + bend;
    const x1 = x + Math.sin(a2) * len, y1 = y - Math.cos(a2) * len;
    const cx = x + Math.sin(ang + bend * 0.3) * len * 0.5 + (r() - 0.5) * len * 0.18, cy = y - Math.cos(ang + bend * 0.3) * len * 0.5;
    const w1 = w * 0.68;
    segs.push([x, y, cx, cy, x1, y1, w, w1, depth]);
    if (depth >= 6) { tips.push([x1, y1, a2]); return; }
    const n = depth < 2 ? 2 : r() < 0.35 ? 3 : 2;
    for (let i = 0; i < n; i += 1) grow(x1, y1, a2 + (i - (n - 1) / 2) * (0.5 + r() * 0.4) + (r() - 0.5) * 0.35, len * (0.74 + r() * 0.1), w1, depth + 1);
    if (depth >= 2 && depth < 6 && r() < 0.5) grow(x + (x1 - x) * 0.55, y + (y1 - y) * 0.55, a2 + (r() < 0.5 ? -1 : 1) * (0.9 + r() * 0.4), len * 0.52, w * 0.4, depth + 2);
  };
  // fünf Hauptäste aus der Stammgabel: breit ausladend wie bei einer Solitär-Eiche
  for (const [ang, len, w, dx, y0] of [[-1.1, 120, 36, -34, -128], [-0.5, 148, 38, -14, -165], [0.04, 128, 34, 0, -185], [0.5, 148, 38, 16, -150], [1.1, 120, 36, 34, -122]]) grow(dx, y0, ang, len, w, 1);
  const leaves = [];
  for (const [tx, ty, ang] of tips) {
    for (let i = 0; i < 15; i += 1) {
      const rad = 10 + r() * 50, a = r() * TAU;
      leaves.push({ x: tx + Math.cos(a) * rad * 1.2 + Math.sin(ang) * 16, y: ty + Math.sin(a) * rad * 0.9 - 10, size: 17 + r() * 11, rot: r() * TAU, tone: r(), th: r(), lobed: r() < 0.75, acorn: r() < 0.05, katze: r() < 0.08 });
    }
  }
  leaves.sort((a, b) => a.y - b.y);
  const model = { segs, tips, leaves };
  treeModels.set(seed, model);
  return model;
}
// Eichenblatt mit Buchten
function eichenblatt(c, x, y, size, rot, col) {
  const w = size * 0.42;
  c.save(); c.translate(x, y); c.rotate(rot);
  c.beginPath(); c.moveTo(0, 0);
  c.quadraticCurveTo(w * 0.5, -size * 0.1, w * 0.3, -size * 0.24); c.quadraticCurveTo(w * 1.05, -size * 0.34, w * 0.4, -size * 0.5);
  c.quadraticCurveTo(w * 0.9, -size * 0.66, w * 0.28, -size * 0.78); c.quadraticCurveTo(w * 0.34, -size * 0.94, 0, -size);
  c.quadraticCurveTo(-w * 0.34, -size * 0.94, -w * 0.28, -size * 0.78); c.quadraticCurveTo(-w * 0.9, -size * 0.66, -w * 0.4, -size * 0.5);
  c.quadraticCurveTo(-w * 1.05, -size * 0.34, -w * 0.3, -size * 0.24); c.quadraticCurveTo(-w * 0.5, -size * 0.1, 0, 0); c.closePath();
  c.fillStyle = col; c.fill();
  c.strokeStyle = alpha(shade(col, 0.3), 0.5); c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, -size * 0.04); c.lineTo(0, -size * 0.9); c.stroke();
  c.restore();
}
export function drawTree(c, x, y, s, { leafAmt, tones, season, p, snow = 0 }) {
  const { segs, tips, leaves } = treeModel(9);
  c.save(); c.translate(x, y); c.scale(s, s);
  ell(c, 0, 10, 210, 26, alpha('#2b2118', 0.22));
  c.lineCap = 'round'; c.lineJoin = 'round';
  // Wurzelanläufe
  for (const [dx, wx, wy, w] of [[-44, -118, 12, 34], [-14, -60, 22, 26], [30, 70, 20, 28], [50, 128, 10, 34], [4, 8, 24, 22]]) { c.strokeStyle = '#6a5038'; c.lineWidth = w; c.beginPath(); c.moveTo(dx * 0.6, -60); c.quadraticCurveTo(dx, -8, wx, wy); c.stroke(); }
  // mächtiger Stamm
  path(c, (k) => { k.moveTo(-64, 12); k.bezierCurveTo(-46, -50, -42, -110, -40, -176); k.lineTo(40, -176); k.bezierCurveTo(44, -110, 50, -50, 66, 12); k.closePath(); }, lg(c, -66, 0, 66, 0, [[0, '#9a7b5c'], [0.38, '#806246'], [0.75, '#664c36'], [1, '#52402e']]));
  const rb = rng(3);
  c.strokeStyle = alpha('#33261a', 0.6); c.lineWidth = 2.6;
  for (let i = 0; i < 26; i += 1) { const t = rb(), px = -52 + t * 104, y0 = -4 - rb() * 50, len = 70 + rb() * 90, sway = (rb() - 0.5) * 12; c.beginPath(); c.moveTo(px * 0.95, y0); c.bezierCurveTo(px * 0.88 + sway, y0 - len * 0.35, px * 0.8 - sway, y0 - len * 0.7, px * 0.74, y0 - len); c.stroke(); }
  c.strokeStyle = alpha('#c9ad8c', 0.35); c.lineWidth = 2;
  for (let i = 0; i < 14; i += 1) { const px = -48 + rb() * 70, y0 = -10 - rb() * 60, len = 50 + rb() * 70; c.beginPath(); c.moveTo(px, y0); c.bezierCurveTo(px - 2, y0 - len * 0.4, px + 3, y0 - len * 0.8, px, y0 - len); c.stroke(); }
  for (let i = 0; i < 5; i += 1) { c.strokeStyle = alpha('#33261a', 0.4); c.lineWidth = 2; c.beginPath(); const yy = -30 - i * 30, xl = -44 + i * 2; c.moveTo(xl, yy); c.quadraticCurveTo(0, yy + 6 + (i % 2) * 4, -xl + 4, yy - 2); c.stroke(); }
  ell(c, -14, -92, 13, 20, alpha('#2f2218', 0.7)); ell(c, -14, -88, 8, 14, alpha('#150f0a', 0.7)); // Astloch
  if (season !== 'winter') { ell(c, -48, -26, 16, 30, alpha('#6f8f55', 0.5), null, 0, 0.1); ell(c, -40, -60, 10, 20, alpha('#7f9d62', 0.4)); } // Moos auf der Wetterseite
  if (snow > 0.05) for (const [dx, dy, w] of [[-38, 8, 40], [42, 10, 44]]) ell(c, dx, dy, w, 8 * snow + 2, alpha('#ffffff', 0.9 * snow));
  // Äste: gebogen und nach oben dünner
  for (const [x0, y0, cx, cy, x1, y1, w0, w1, d] of segs) {
    c.strokeStyle = d > 4 ? '#6b5440' : '#725843'; c.lineWidth = (w0 + w1) / 2; c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(cx, cy, x1, y1); c.stroke();
    if (w0 > 6) { c.strokeStyle = alpha('#b79c7c', 0.38); c.lineWidth = Math.max(1, w0 * 0.2); c.beginPath(); c.moveTo(x0 - w0 * 0.22, y0); c.quadraticCurveTo(cx - w0 * 0.22, cy, x1 - w1 * 0.22, y1); c.stroke(); }
    if (snow > 0.05 && w0 > 3) { c.strokeStyle = alpha('#ffffff', 0.92 * snow); c.lineWidth = Math.max(2, w0 * 0.34); c.beginPath(); c.moveTo(x0 - w0 * 0.28, y0 - w0 * 0.14); c.quadraticCurveTo(cx - w0 * 0.28, cy - w0 * 0.14, x1 - w1 * 0.28, y1 - w1 * 0.14); c.stroke(); }
  }
  if (leafAmt > 0.02) {
    for (const [tx, ty] of tips) { const k = smooth(clamp01((leafAmt - 0.06) / 0.5)); if (k > 0.02) ell(c, tx, ty - 8, 54 * k, 44 * k, alpha(shade(tones[2], -0.28), 0.2 * k)); }
    for (const lf of leaves) {
      const k = smooth(clamp01((leafAmt - lf.th * 0.92) / 0.14));
      if (k <= 0.02) continue;
      const ti = season === 'herbst' ? Math.min(tones.length - 1, Math.floor(lf.tone * (tones.length - 1) + p * 1.6)) : Math.floor(lf.tone * tones.length) % tones.length;
      const lift = clamp01((lf.y + 420) / 460);
      const col = shade(tones[ti], -0.2 + lift * 0.32 + (lf.tone - 0.5) * 0.1);
      if (lf.lobed) eichenblatt(c, lf.x, lf.y, lf.size * k, lf.rot, col); else leaf(c, lf.x, lf.y, lf.size * 1.3 * k, lf.size * 0.5 * k, lf.rot, col, { veins: false });
      if (season === 'fruehling' && lf.katze && k > 0.5) { c.strokeStyle = '#c9cf7e'; c.lineWidth = 3.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(lf.x, lf.y); c.quadraticCurveTo(lf.x + 3, lf.y + 10, lf.x + 1, lf.y + 20); c.stroke(); }
      if (lf.acorn && season === 'sommer' && p > 0.25 + lf.th * 0.5) { ell(c, lf.x + 3, lf.y + 14, 4.4, 6.4, '#9a7a4a', alpha('#4a3520', 0.5), 1); path(c, (kk) => { kk.moveTo(lf.x - 2, lf.y + 11); kk.quadraticCurveTo(lf.x + 3, lf.y + 6, lf.x + 8, lf.y + 11); kk.closePath(); }, '#6a5238'); }
    }
  }
  c.restore();
}

// ---- Runder Gartenpavillon mit Kegeldach; Stefanie sitzt darin
export const PAVILLON = { x: 1150, y: 836 };
const PAV = { R: 215, ry: 46, post: 262 };
function pfosten(c, px, py, h, dark) {
  rr(c, px - 11, py - h, 22, h, 6, lg(c, px - 11, 0, px + 11, 0, [[0, dark ? '#d9cfb8' : '#f6efde'], [1, dark ? '#bdb199' : '#d8cdb2']]), alpha('#2b2118', 0.28), 2);
  rr(c, px - 16, py - 10, 32, 14, 5, dark ? '#bdb199' : '#d2c7ac', alpha('#2b2118', 0.25), 1.6);
  rr(c, px - 17, py - h - 4, 34, 12, 5, dark ? '#c9bea4' : '#e9dfc6', alpha('#2b2118', 0.25), 1.6);
}
function kegeldach(c, x, top, snow, season, p) {
  const rx = 270, rye = PAV.ry + 16, ey = top - 8, apex = top - 196;
  const outline = (k) => { k.moveTo(x - rx, ey); k.bezierCurveTo(x - 190, top - 40, x - 60, top - 120, x, apex); k.bezierCurveTo(x + 60, top - 120, x + 190, top - 40, x + rx, ey); k.ellipse(x, ey, rx, rye, 0, 0, Math.PI, false); k.closePath(); };
  path(c, outline, lg(c, x - rx, 0, x + rx, 0, [[0, '#a3bfae'], [0.5, '#86a592'], [1, '#69887a']]), alpha('#2b2118', 0.4), 3);
  c.save(); c.beginPath(); outline(c); c.clip();
  // Schindelreihen und Rippen
  for (let i = 1; i < 10; i += 1) { const u = i / 10, yy = apex + (ey - apex) * u, half = 12 + (rx - 12) * Math.pow(u, 0.9); c.strokeStyle = alpha('#2f4a3c', 0.22); c.lineWidth = 2; c.beginPath(); c.moveTo(x - half, yy); c.quadraticCurveTo(x, yy + rye * u * 1.15, x + half, yy); c.stroke(); }
  for (let i = -4; i <= 4; i += 1) { const ex = x + (i / 4) * rx, ey2 = ey + rye * Math.sqrt(Math.max(0, 1 - ((ex - x) / rx) ** 2)); c.strokeStyle = alpha('#2f4a3c', 0.18); c.lineWidth = 2; c.beginPath(); c.moveTo(x, apex); c.lineTo(ex, ey2); c.stroke(); }
  const r = rng(31);
  if (season === 'herbst') for (let i = 0, n = Math.round(p * 80); i < n; i += 1) leaf(c, x + (r() - 0.5) * rx * 1.8, apex + 30 + r() * (ey - apex + rye), 22, 9, r() * TAU, ['#c98a3e', '#b8692f', '#d8a850', '#a2552b'][i % 4], { veins: false });
  if (season === 'fruehling') for (let i = 0, n = Math.round(p * 60); i < n; i += 1) ell(c, x + (r() - 0.5) * rx * 1.8, apex + 30 + r() * (ey - apex + rye), 5, 3, ['#f0cdd0', '#f6efe0'][i % 2], null, 0, r() * 3);
  if (season === 'sommer') { for (let i = 0; i < 18; i += 1) ell(c, x + (r() - 0.5) * rx * 1.6, ey + rye * 0.1 + r() * rye * 0.9, 24, 6, alpha('#6f9a58', 0.3)); }
  if (snow > 0.04) { // Schnee liegt auf dem Kegel und hängt an der Traufe
    const depth = (ey - apex) * (0.15 + 0.85 * snow);
    path(c, (k) => { k.moveTo(x - rx - 10, apex - 10); k.lineTo(x + rx + 10, apex - 10); k.lineTo(x + rx + 10, apex + depth); for (let xx = x + rx + 10; xx >= x - rx - 10; xx -= 22) k.lineTo(xx, apex + depth + Math.sin(xx * 0.06) * 8 + (Math.abs(xx - x) / rx) * depth * 0.35); k.closePath(); }, '#fbfcfe');
    if (snow > 0.5) { c.strokeStyle = alpha('#ffffff', 0.95); c.lineWidth = 12 * snow; c.beginPath(); c.ellipse(x, ey, rx - 4, rye - 2, 0, 0.05, Math.PI - 0.05); c.stroke(); }
  }
  c.restore();
  // Traufe mit Zierbogen
  c.strokeStyle = '#557062'; c.lineWidth = 7; c.beginPath(); c.ellipse(x, ey, rx, rye, 0, 0, Math.PI, false); c.stroke();
  for (let i = 0; i <= 22; i += 1) { const th = (i / 22) * Math.PI, px = x + Math.cos(th) * rx, py = ey + Math.sin(th) * rye; ell(c, px, py + 7, 11, 9, '#7a9a89', alpha('#2f4a3c', 0.45), 1.6); }
  path(c, (k) => { k.moveTo(x - 7, apex + 12); k.lineTo(x + 7, apex + 12); k.lineTo(x + 3, apex - 20); k.lineTo(x - 3, apex - 20); k.closePath(); }, '#8a7a56');
  ell(c, x, apex - 24, 11, 11, lg(c, x - 11, apex - 35, x + 11, apex - 13, [[0, '#f0dfa0'], [1, '#b99a4a']]), alpha('#5a4520', 0.5), 1.6);
  path(c, (k) => { k.moveTo(x - 2.5, apex - 34); k.lineTo(x + 2.5, apex - 34); k.lineTo(x, apex - 58); k.closePath(); }, '#b99a4a');
  if (snow > 0.04) ell(c, x, apex - 12, 12, 5 * snow + 1, alpha('#ffffff', 0.95));
}
function kletter(c, x, yBase, yTop, grow, bloom, leafAmt, season, seed) {
  const pts = [];
  for (let i = 0; i <= 50; i += 1) { const t = i / 50; pts.push([x + Math.sin(t * 11 + seed) * 9, yBase - t * (yBase - yTop)]); }
  const n = Math.floor(clamp01(grow) * pts.length);
  c.strokeStyle = leafAmt < 0.3 && (season === 'herbst' || season === 'winter') ? '#6a5a40' : '#5f7d4a'; c.lineWidth = 4.5; c.lineCap = 'round'; c.beginPath();
  pts.slice(0, n).forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.stroke();
  const lc = season === 'herbst' ? ['#c9654a', '#d98a4a', '#b8553f'] : ['#6f9a58', '#82ac66', '#5f8a4c'];
  for (let i = 2; i < n; i += 2) { if (((i * 37 + seed * 7) % 100) / 100 > leafAmt) continue; leaf(c, pts[i][0], pts[i][1], 26, 10, (i % 4 === 0 ? 1 : -1) * 1.2 + (i % 3) * 0.3, lc[i % 3], { veins: false }); }
  const roses = ['#d98a94', '#e8b0b0', '#c76f7e', '#f0d0c8'];
  for (let i = 6; i < n; i += 8) { const k = smooth(clamp01((bloom - ((i * 13) % 50) / 100) / 0.3)); if (k <= 0.05 || season === 'winter') continue; const col = roses[(i / 8) % 4 | 0]; ell(c, pts[i][0], pts[i][1], 14 * k, 12 * k, col, alpha('#7a3a44', 0.35), 1.4); ell(c, pts[i][0], pts[i][1], 8 * k, 7 * k, shade(col, 0.12)); }
}
function drawPavillon(c, season, zeit, p, snow) {
  const { x, y } = PAVILLON, { R, ry, post } = PAV;
  const deck = y - 40, top = deck - post;
  ell(c, x, y + 8, R + 70, 36, alpha('#2b2118', 0.2));
  // Steinsockel und Holzboden (Ellipse = Grundriss von schräg oben)
  ell(c, x, y + 2, R + 38, ry + 16, '#9a917d'); ell(c, x, y - 12, R + 38, ry + 16, lg(c, 0, y - 60, 0, y + 20, [[0, '#d9d0ba'], [1, '#bdb39d']]), alpha('#2b2118', 0.25), 2);
  ell(c, x, deck + 2, R + 14, ry + 6, lg(c, 0, deck - 50, 0, deck + 50, [[0, '#d6b88c'], [1, '#b08e62']]), alpha('#2b2118', 0.3), 2);
  c.strokeStyle = alpha('#6a4c2e', 0.25); c.lineWidth = 2;
  for (let i = -5; i <= 5; i += 1) { c.beginPath(); c.ellipse(x, deck + 2, (R + 14) * (1 - Math.abs(i) / 7.5), (ry + 6), 0, 0, TAU); c.stroke(); }
  // Treppe vorne
  for (let i = 0; i < 3; i += 1) rr(c, x - 78 - i * 8, deck + ry - 2 + i * 12, 156 + i * 16, 14, 5, ['#c9ab7e', '#b99a6e', '#a98a60'][i], alpha('#2b2118', 0.28), 1.8);
  // hintere Pfosten und Gitterwand (luftig, Diamantmuster)
  const bx = R * 0.866, by = deck - ry * 0.5 + 2, fy = deck + ry * 0.5 + 2;
  rr(c, x - bx, by - 128, bx * 2, 128, 4, alpha('#f6efde', 0.3), alpha('#d8cdb2', 0.9), 3);
  c.save(); c.beginPath(); c.rect(x - bx, by - 128, bx * 2, 128); c.clip(); c.strokeStyle = alpha('#e9dfc6', 0.95); c.lineWidth = 3.4;
  for (let i = -14; i <= 14; i += 1) { c.beginPath(); c.moveTo(x + i * 24, by); c.lineTo(x + i * 24 + 128, by - 128); c.moveTo(x + i * 24, by - 128); c.lineTo(x + i * 24 + 128, by); c.stroke(); }
  c.restore();
  rr(c, x - bx, by - 134, bx * 2, 12, 5, '#efe6d2', alpha('#2b2118', 0.25), 1.6);
  pfosten(c, x - bx, by, post - 8, true); pfosten(c, x + bx, by, post - 8, true); pfosten(c, x, by - 4, post - 12, true);
  // Ringbalken (der Boden der Dachkonstruktion), dann das Dach
  c.strokeStyle = '#e9dfc6'; c.lineWidth = 12; c.beginPath(); c.ellipse(x, top + 4, R * 0.866 + 10, ry * 0.92, 0, 0, Math.PI, false); c.stroke();
  c.strokeStyle = alpha('#2b2118', 0.25); c.lineWidth = 2; c.beginPath(); c.ellipse(x, top + 11, R * 0.866 + 10, ry * 0.92, 0, 0.02, Math.PI - 0.02, false); c.stroke();
  // Lichterkette und Laternen am vorderen Ringbalken
  const glowK = zeit === 'abend' ? 1 : zeit === 'morgen' ? 0.55 : season === 'winter' ? 0.4 : 0;
  for (let i = 1; i < 14; i += 1) { const th = (i / 14) * Math.PI, px = x + Math.cos(th) * (R * 0.866 + 10), py = top + 14 + Math.sin(th) * ry * 0.92 + Math.sin(i * 1.7) * 3; ell(c, px, py + 5, 4, 5.5, mixc('#f2d9a0', '#fff2c4', glowK)); if (glowK) glow(c, px, py + 5, 22, '#ffd98a', 0.5 * glowK); }
  for (const sx of [-1, 1]) { const lx = x + sx * 120, ly = top + 4 + ry * 0.92 * Math.sqrt(1 - (120 / (R * 0.866 + 10)) ** 2); if (glowK || zeit === 'morgen') glow(c, lx, ly + 54, 120, '#ffd08a', 0.5); c.strokeStyle = '#6a5a40'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(lx, ly); c.lineTo(lx, ly + 20); c.stroke(); rr(c, lx - 13, ly + 20, 26, 34, 11, mixc('#e8a45a', '#ffe0a0', glowK), alpha('#7a4a22', 0.5), 2); }
  if (season === 'sommer') for (const sx of [-1, 1]) { const hx = x + sx * 60, hy = top + 14 + ry * 0.92 * Math.sqrt(1 - (60 / (R * 0.866 + 10)) ** 2); c.strokeStyle = '#6a5a40'; c.lineWidth = 2; c.beginPath(); c.moveTo(hx - 14, hy); c.lineTo(hx, hy + 30); c.lineTo(hx + 14, hy); c.stroke(); rr(c, hx - 21, hy + 28, 42, 24, 9, '#c58f70'); for (let i = 0; i < 5; i += 1) ell(c, hx - 17 + i * 8.5, hy + 27 + (i % 2) * 4, 6, 6, ['#e8a0a8', '#f2d98a', '#c9b0e0'][i % 3]); }
  kegeldach(c, x, top, snow, season, p);
  // vordere Pfosten mit Geländer zur Seite (Eingang bleibt frei)
  for (const sx of [-1, 1]) {
    const px = x + sx * bx;
    rr(c, Math.min(px, px - sx * 70) , fy - 66, 70, 8, 4, '#efe6d2', alpha('#2b2118', 0.25), 1.4); rr(c, Math.min(px, px - sx * 70), fy - 14, 70, 8, 4, '#efe6d2', alpha('#2b2118', 0.25), 1.4);
    for (let i = 1; i < 5; i += 1) rr(c, px - sx * i * 14 - 3, fy - 60, 6, 48, 3, '#f6efde', alpha('#2b2118', 0.22), 1.2);
    pfosten(c, px, fy, post, false);
  }
  const grow = season === 'fruehling' ? clamp01(0.1 + p) : 1;
  const bloom = season === 'fruehling' ? clamp01((p - 0.3) / 0.7) : season === 'sommer' ? clamp01(0.3 + p) : season === 'herbst' ? clamp01(0.5 - p) : 0;
  const lAmt = season === 'winter' ? 0 : season === 'herbst' ? clamp01(1 - p * 1.1) : season === 'fruehling' ? clamp01(p * 1.2) : 1;
  kletter(c, x - bx, fy, top + 20, grow, bloom, lAmt, season, 1); kletter(c, x + bx, fy, top + 20, grow, bloom, lAmt, season, 2);
  if (snow > 0.05) for (const sx of [-1, 1]) ell(c, x + sx * bx, fy - 66, 20, 6 * snow + 2, alpha('#ffffff', 0.9));
}
export function drawStefanie(c, view, t) {
  const st = view.stefanie;
  if (!st) return;
  const phase = view.timer?.phase;
  const f = { ...st.figur, tisch: st.taetigkeit === 'buch' ? 'buch' : (st.figur.tisch === 'buch' ? 'laptop' : st.figur.tisch) };
  const a = { t, seed: 0.37, working: phase === 'focus' && st.taetigkeit !== 'buch', reading: st.taetigkeit === 'buch', sip: phase === 'break' && Math.floor(t / 2600) % 3 === 0, happy: phase === 'break' && Math.floor(t / 3000) % 2 === 0, blink: Math.floor(t / 120 + 14) % 34 === 0, bob: Math.sin(t / 900) * 2 };
  const sc = 0.92, ty = PAVILLON.y - 36 - 106 * sc;
  c.save(); c.translate(PAVILLON.x, ty); c.scale(sc, sc);
  drawChair(c, 0, 0, STYLE.pavillon); drawFigure(c, f, 0, 0, a, STYLE.pavillon); drawTable(c, 0, 0, STYLE.pavillon); drawDesk(c, f, 0, 0, a);
  c.restore();
}

// ---- Bewuchs auf den fernen Hügeln: kleine Pflanzen und bunte Flecken, die mit dem Fortschritt erscheinen
const HILLS = [{ y: 560, seed: 2, wave: 250, amp: 44 }, { y: 612, seed: 5, wave: 210, amp: 38 }];
const hillPh = HILLS.map((h) => { const r = rng(h.seed); return [r() * 6, r() * 6]; });
const hillY = (i, x) => HILLS[i].y + Math.sin(x / HILLS[i].wave + hillPh[i][0]) * HILLS[i].amp + Math.sin(x / (HILLS[i].wave * 0.45) + hillPh[i][1]) * HILLS[i].amp * 0.4;
function hillLife(c, season, p) {
  if (season === 'winter') return;
  const fleck = { fruehling: ['#f0cdd0', '#f4e8a8', '#fbf6ea', '#c5b3de'], sommer: ['#e9bb54', '#b8a2d8', '#d8645a', '#7d98d2'], herbst: ['#d98a4a', '#c9654a', '#e3b055', '#a2552b', '#b49ad0'] }[season];
  const types = { fruehling: ['daisy', 'tulip', 'bell', 'tuft', 'daisy'], sommer: ['sunflower', 'lavender', 'poppy', 'cornflower', 'tuft'], herbst: ['aster', 'tuft', 'pilze', 'aster', 'pumpkin'] }[season];
  const P = PAL[season];
  const r = rng(515);
  HILLS.forEach((h, i) => {
    const y1 = (x) => (i === 0 ? hillY(1, x) - 6 : 598);
    for (let k = 0; k < 46; k += 1) { // weiche bunte Flecken, wie ein Blumenteppich in der Ferne
      const x = r() * W, a = hillY(i, x) + 8, b = y1(x); if (b - a < 8) continue;
      const th = r() * 0.8, g = clamp01((p - th) / 0.2), col = fleck[k % fleck.length];
      if (g > 0.02) ell(c, x, a + r() * (b - a), (22 + r() * 60) * g, (4 + r() * 6) * g, alpha(col, 0.5));
    }
    for (let k = 0; k < 150; k += 1) {
      const x = r() * W, a = hillY(i, x) + 6, b = y1(x); if (b - a < 6) continue;
      const y = a + r() * (b - a), th = r() * 0.85, g = clamp01((p - th) / 0.2), rnd = r(), type = types[Math.floor(r() * types.length)];
      if (g <= 0.02) continue;
      const sc = (i === 0 ? 0.15 : 0.23) + rnd * 0.05;
      c.globalAlpha = 0.9;
      if (type === 'tuft') tuft(c, x, y, sc * 1.6, g, rnd, P.blades); else DRAW[type](c, x, y, sc * (type === 'sunflower' ? 0.9 : 1.15), g, rnd);
      c.globalAlpha = 1;
    }
  });
}

function fir(c, x, y, s, snow) {
  ell(c, x, y + 4, 62 * s, 10 * s, alpha('#2b2118', 0.16));
  rr(c, x - 8 * s, y - 40 * s, 16 * s, 44 * s, 4, '#6b523c');
  for (let i = 0; i < 4; i += 1) {
    const yy = y - 30 * s - i * 62 * s, wd = (92 - i * 18) * s;
    path(c, (k) => { k.moveTo(x - wd, yy); k.quadraticCurveTo(x - wd * 0.2, yy - 40 * s, x, yy - 96 * s); k.quadraticCurveTo(x + wd * 0.2, yy - 40 * s, x + wd, yy); k.quadraticCurveTo(x, yy + 12 * s, x - wd, yy); k.closePath(); }, lg(c, x - wd, 0, x + wd, 0, [[0, '#4f6e55'], [1, '#3f5a46']]), alpha('#2b2118', 0.2), 1.5);
    if (snow > 0.05) path(c, (k) => { k.moveTo(x - wd * 0.8, yy - 8 * s); k.quadraticCurveTo(x - wd * 0.2, yy - 44 * s, x, yy - 96 * s * (0.7 + 0.3 * snow)); k.quadraticCurveTo(x + wd * 0.2, yy - 44 * s, x + wd * 0.8, yy - 8 * s); k.quadraticCurveTo(x, yy - 18 * s, x - wd * 0.8, yy - 8 * s); k.closePath(); }, alpha('#ffffff', 0.92 * snow));
  }
}
function snowman(c, x, y, p) {
  const a = smooth(clamp01((p - 0.5) / 0.14)), b = smooth(clamp01((p - 0.66) / 0.14)), h = smooth(clamp01((p - 0.82) / 0.12)), d = smooth(clamp01((p - 0.93) / 0.07));
  ell(c, x, y + 6, 70, 12, alpha('#2b2118', 0.16));
  const ball = (cx, cy, r, k) => { if (k <= 0.02) return; ell(c, cx, cy, r * k, r * k, lg(c, cx - r, cy - r, cx + r, cy + r, [[0, '#ffffff'], [1, '#d9e2ea']]), alpha('#7a8a9a', 0.35), 2); };
  ball(x, y - 40 * a, 46, a); ball(x, y - 104 * b, 34, b); ball(x, y - 150 * h, 25, h);
  if (d > 0.1) {
    ell(c, x - 8, y - 154, 2.6, 2.6, '#3b2d2a'); ell(c, x + 8, y - 154, 2.6, 2.6, '#3b2d2a');
    path(c, (k) => { k.moveTo(x, y - 148); k.lineTo(x + 20 * d, y - 143); k.lineTo(x, y - 140); k.closePath(); }, '#e0894a');
    rr(c, x - 24, y - 130, 48, 10, 5, '#b86a6a'); rr(c, x + 8, y - 124, 12, 26, 5, '#b86a6a');
    rr(c, x - 18, y - 186, 36, 30, 6, '#4a4350'); rr(c, x - 28, y - 160, 56, 8, 4, '#4a4350');
    for (const dy of [-96, -84, -72]) ell(c, x, y + dy * 0.9, 2.6, 2.6, '#3b2d2a');
  }
}

// ---- Die Wachstumsebene (alles, was mit dem Fortschritt wächst)
function paintGrowth(c, season, zeit, p, pavillon = true) {
  const P = PAL[season];
  const snow = season === 'winter' ? p : 0;
  if (season === 'winter') { // Schnee deckt den Boden nach und nach zu
    const r = rng(77);
    for (let i = 0; i < 230; i += 1) { const x = r() * W, y = 700 + Math.pow(r(), 0.8) * 380, th = r() * 0.85, w = 70 + r() * 150; const k = smooth(clamp01((p - th) / 0.15)); if (k > 0.02) ell(c, x, y, w * k, (14 + (y - 700) * 0.05) * k, alpha('#ffffff', 0.95)); }
  }
  if (season === 'herbst') { // Laub sammelt sich am Boden
    const r = rng(88), cols = ['#d98a4a', '#c9654a', '#e3b055', '#b8553f', '#c9a05a'];
    for (let i = 0; i < 300; i += 1) { const x = r() * W, y = 705 + Math.pow(r(), 0.8) * 360, th = r() * 0.95; if (p < th) continue; const s = 0.55 + ((y - 700) / 360) * 0.9; leaf(c, x, y, 22 * s, 8 * s, r() * TAU, cols[i % 5], { veins: false }); }
  }
  const leafAmt = season === 'fruehling' ? clamp01(0.04 + p * 1.05) : season === 'sommer' ? 0.88 + 0.12 * p : season === 'herbst' ? clamp01(1.02 - p * 1.04) : 0;
  hillLife(c, season, p);
  const things = [];
  things.push({ y: BAUM.y, draw: () => drawTree(c, BAUM.x, BAUM.y, BAUM.s, { leafAmt, tones: P.tree, season, p, snow }) });
  if (pavillon) things.push({ y: PAVILLON.y, draw: () => drawPavillon(c, season, zeit, p, snow) });
  if (season === 'winter') {
    things.push({ y: 712, draw: () => { fir(c, 90, 712, 1.1, snow); fir(c, 1530, 704, 0.9, snow); fir(c, 1850, 716, 1.15, snow); } });
    things.push({ y: 900, draw: () => snowman(c, 1480, 910, p) });
  }
  if (season === 'herbst') { // zusätzliche Pilzgruppen am Baum, am Pavillon und im Gras
    const r = rng(404);
    for (let i = 0; i < 22; i += 1) {
      const nearTree = i < 8, nearPav = i >= 8 && i < 16;
      const x = nearTree ? BAUM.x - 170 + r() * 340 : nearPav && pavillon ? PAVILLON.x - 230 + r() * 460 : 40 + r() * (W - 80);
      const y = nearTree ? 730 + r() * 40 : nearPav ? 850 + r() * 50 : 720 + r() * 330;
      const th = 0.06 + r() * 0.6, g = clamp01((p - th) / 0.16);
      if (g > 0.02) things.push({ y, draw: () => pilze(c, x, y, 0.7 + (y - 700) / 360 * 0.9, g, r() * 0 + ((i * 0.37) % 1)) });
    }
  }
  for (const s of slotsFor(season)) {
    if (season === 'winter') things.push({ y: s.y, draw: () => (s.type === 'shrub' ? shrubWinter(c, s.x, s.y, s.s, snow, s.r) : tuft(c, s.x, s.y, s.s, 1, s.r, P.blades, snow)) });
    else {
      if (pavillon && s.x > PAVILLON.x - 290 && s.x < PAVILLON.x + 290 && s.y < PAVILLON.y + 140 && s.y > PAVILLON.y - 80) continue; // nichts vor oder im Pavillon (Stefanie soll zu sehen sein)
      const g = clamp01((p - s.thr) / 0.16);
      if (g <= 0.01) continue;
      things.push({ y: s.y, draw: () => (s.type === 'tuft' ? tuft(c, s.x, s.y, s.s, g, s.r, P.blades) : DRAW[s.type](c, s.x, s.y, s.s, g, s.r)) });
    }
  }
  things.sort((a, b) => a.y - b.y);
  for (const t of things) t.draw();
}

// ---- Bewegtes: Schmetterlinge, Blütenblätter, Laub, Schnee, Glühwürmchen, Nebel
const fall = (c, t, n, seed, draw, speed, sway) => {
  const r = rng(seed);
  for (let i = 0; i < n; i += 1) {
    const x0 = r() * W, y0 = r() * H, sp = speed * (0.6 + r() * 0.8), ph = r() * 6, sz = 0.6 + r() * 0.8;
    const y = (y0 + (t / 1000) * sp) % (H + 60) - 30, x = (x0 + Math.sin(t / 1200 + ph) * sway + (t / 1000) * sp * 0.25) % (W + 40);
    draw(x, y, sz, ph, t);
  }
};
// Fallende Blätter/Blüten, die aus der Baumkrone kommen und im Gras landen
const vomBaum = (c, t, n, seed, draw) => {
  const r = rng(seed);
  for (let i = 0; i < n; i += 1) {
    const cx = BAUM.x + (r() - 0.5) * 640, cy = BAUM.y - 560 + r() * 230, ground = 735 + r() * 300, dur = 7000 + r() * 6000, ph = r() * 6, off = r() * dur;
    const k = ((t + off) % dur) / dur;
    draw(cx + Math.sin(k * 9 + ph) * 46 + k * 120, cy + (ground - cy) * k, 0.7 + r() * 0.6, ph, k, t);
  }
};

export class Wachstum {
  constructor() {
    this.bg = canvas(); this.gl = canvas(); this.bgKey = ''; this.glKey = '';
  }

  draw(c, view, t) {
    const season = PAL[view.jahreszeit] ? view.jahreszeit : 'fruehling';
    const zeit = SKY[view.tageszeit] ? view.tageszeit : 'mittag';
    const p = clamp01(view.progress ?? 0);
    const snowQ = season === 'winter' ? Math.round(p * 30) / 30 : 0;
    const bgKey = `${season}|${zeit}|${snowQ}`;
    if (bgKey !== this.bgKey) { this.bgKey = bgKey; const k = this.bg.getContext('2d'); k.clearRect(0, 0, W, H); paintBackground(k, season, zeit, snowQ); this.glKey = ''; }
    const pq = Math.round(p * 80) / 80;
    const pav = view.pavillon !== false;
    const glKey = `${bgKey}|${pq}|${pav}`;
    if (glKey !== this.glKey) { this.glKey = glKey; const k = this.gl.getContext('2d'); k.clearRect(0, 0, W, H); paintGrowth(k, season, zeit, pq, pav); }
    c.drawImage(this.bg, 0, 0);
    if (zeit === 'morgen') for (let i = 0; i < 4; i += 1) ell(c, 300 + i * 480 + Math.sin(t / 5000 + i) * 60, 700 + (i % 2) * 24, 380, 36, alpha('#fff4ee', 0.2));
    c.drawImage(this.gl, 0, 0);
    if (pav) drawStefanie(c, view, t);
    this.living(c, season, zeit, pq, t);
    const tint = SKY[zeit].tint;
    if (tint) { c.fillStyle = alpha(tint[0], tint[1]); c.fillRect(0, 0, W, H); }
  }

  living(c, season, zeit, p, t) {
    if (season === 'fruehling') {
      vomBaum(c, t, 14, 3, (x, y, s, ph, k) => { c.save(); c.translate(x, y); c.globalAlpha = Math.min(1, (1 - k) * 4); glow(c, 0, 0, 10 * s, '#f6f2b0', 0.6); ell(c, 0, 0, 2.2 * s, 2.2 * s, alpha('#fffbd0', 0.8)); c.restore(); });
      this.butterflies(c, t, 3, ['#f6efe0', '#f2d98a', '#d9a6c4']);
    }
    if (season === 'sommer') { this.butterflies(c, t, 4, ['#e8a05a', '#8fb3e0', '#f6efe0', '#d98a94']); this.bees(c, t); fall(c, t, 14, 5, (x, y, s, ph) => glow(c, x, y * 0.6 + 380, 12 * s, '#fff2c0', 0.5), 4, 30); }
    if (season === 'herbst') {
      const n = Math.round(8 + 28 * Math.sin(Math.PI * p));
      vomBaum(c, t, n, 7, (x, y, s, ph, k) => { c.save(); c.translate(x, y); c.rotate(t / 600 + ph); c.scale(1, 0.5 + 0.5 * Math.abs(Math.sin(t / 500 + ph))); c.globalAlpha = Math.min(1, (1 - k) * 6); leaf(c, 0, 0, 26 * s, 10 * s, 0, ['#d8a850', '#c98a3e', '#b8692f', '#a2552b'][Math.floor(ph) % 4], { veins: false }); c.restore(); });
      fall(c, t, 6, 17, (x, y, s, ph) => { c.save(); c.translate(x, y); c.rotate(t / 700 + ph); leaf(c, 0, 0, 20 * s, 8 * s, 0, '#c9654a', { veins: false }); c.restore(); }, 50, 60);
    }
    if (season === 'winter') {
      const n = Math.round(40 + 170 * p);
      fall(c, t, n, 11, (x, y, s) => ell(c, x, y, 3.2 * s, 3.2 * s, alpha('#ffffff', 0.85)), 70, 26);
    }
    if (zeit === 'abend') {
      const r = rng(21);
      for (let i = 0; i < 16; i += 1) { const bx = r() * W, by = 720 + r() * 300, ph = r() * 6; const x = bx + Math.sin(t / 1900 + ph) * 60, y = by + Math.cos(t / 1500 + ph) * 34, a = 0.4 + 0.5 * Math.sin(t / 600 + ph); glow(c, x, y, 26, '#f6f0a0', Math.max(0.05, a)); ell(c, x, y, 2.2, 2.2, alpha('#fffbd0', Math.max(0.2, a))); }
    }
  }

  butterflies(c, t, n, cols) {
    for (let i = 0; i < n; i += 1) {
      const x = 200 + ((i * 520 + t / 14) % 1700), y = 560 + i * 70 + Math.sin(t / 700 + i * 2) * 46, flap = Math.abs(Math.sin(t / 110 + i));
      c.save(); c.translate(x, y); ell(c, 0, 0, 2.4, 8, '#4a3a30');
      for (const sd of [-1, 1]) { ell(c, sd * 9 * flap, -4, 9 * flap + 1, 8, cols[i % cols.length], alpha('#2b2118', 0.25), 1); ell(c, sd * 7 * flap, 6, 6 * flap + 1, 5, shade(cols[i % cols.length], -0.08)); }
      c.restore();
    }
  }

  bees(c, t) {
    for (let i = 0; i < 3; i += 1) {
      const x = 400 + i * 480 + Math.sin(t / 900 + i) * 90, y = 780 + i * 60 + Math.cos(t / 700 + i * 2) * 40;
      ell(c, x, y, 9, 6.4, '#e3b13f'); c.strokeStyle = '#4a3a30'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(x - 2, y - 5); c.lineTo(x - 2, y + 5); c.moveTo(x + 3, y - 5); c.lineTo(x + 3, y + 5); c.stroke();
      ell(c, x - 3, y - 8, 6, 3.4, alpha('#ffffff', 0.7)); ell(c, x + 3, y - 8, 6, 3.4, alpha('#ffffff', 0.7));
    }
  }
}
