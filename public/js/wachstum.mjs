// Die wachsende Landschaft: Eine leere Wiese, die mit dem Fortschritt (Wörter oder Pomodoros) zuwächst.
// Jahreszeit bestimmt, was wächst (Frühling: Blüten und Rosen, Sommer: Sonnenblumen und Lavendel,
// Herbst: ein Baum verliert seine Blätter, Winter: es schneit zu), die Tageszeit bestimmt Himmel und Licht.
import { H, TAU, W, alpha, clamp01, ell, glow, grassStrokes, leaf, lg, mixc, path, rng, rr, shade, smooth } from './malerei.mjs';

export const JAHRESZEITEN = { fruehling: 'Frühling', sommer: 'Sommer', herbst: 'Herbst', winter: 'Winter' };
export const TAGESZEITEN = { morgen: 'Morgengrauen', mittag: 'Mittag', abend: 'Abend' };

const canvas = () => { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; return cv; };

const SKY = {
  morgen: { top: '#b7a8d2', mid: '#efbdb1', hor: '#f9e3bb', sun: [1360, 650, '#ffd9a0'], r: 460, disc: [1360, 660, 64, '#ffe4b4'], cloud: '#f8d8cf', tint: ['#ffc4a4', 0.1] },
  mittag: { top: '#9bc2d9', mid: '#cde3e1', hor: '#f4eed4', sun: [1500, 170, '#fff4cc'], r: 600, disc: [1500, 170, 48, '#fff9de'], cloud: '#fbf6ea', tint: null },
  abend: { top: '#403f6c', mid: '#a76f8d', hor: '#f1b184', sun: [470, 660, '#ffb878'], r: 560, disc: [470, 672, 78, '#ffd5a2'], cloud: '#cf93a6', tint: ['#3e2f6c', 0.2] },
};
const PAL = {
  fruehling: { hills: ['#bad4aa', '#a5c896', '#90b983'], far: ['#9dc08f', '#8db37f'], ground: ['#abcd94', '#86ad72'], blades: ['#6f9a5a', '#86b06f', '#5c8a52'], tree: ['#e7b4bb', '#f0cdd0', '#d99aa5', '#a9c690'] },
  sommer: { hills: ['#b7cb8c', '#a1bd76', '#8cab62'], far: ['#86a866', '#789b5b'], ground: ['#aac671', '#869f56'], blades: ['#6f9448', '#8cb15c', '#5b8040'], tree: ['#6f9a58', '#82ac66', '#5c8a4c', '#97b975'] },
  herbst: { hills: ['#d3b47c', '#bc9862', '#a47d4e'], far: ['#b88a58', '#a97848'], ground: ['#c2a56a', '#9e8250'], blades: ['#a98a4a', '#c0a25c', '#8a6e3e'], tree: ['#d98a4a', '#c9654a', '#e3b055', '#b8553f'] },
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

const DRAW = { daisy, tulip, bell, sunflower, lavender, poppy, cornflower, aster, pumpkin, mushroom, frond };
const MIX = {
  fruehling: ['tuft', 'tuft', 'daisy', 'daisy', 'tulip', 'tulip', 'bell', 'tuft', 'daisy'],
  sommer: ['tuft', 'sunflower', 'sunflower', 'lavender', 'lavender', 'poppy', 'cornflower', 'tuft', 'poppy'],
  herbst: ['tuft', 'aster', 'aster', 'pumpkin', 'mushroom', 'frond', 'frond', 'tuft', 'aster'],
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

// ---- Der große Baum
const treeModels = new Map();
function treeModel(seed) {
  if (treeModels.has(seed)) return treeModels.get(seed);
  const r = rng(seed), segs = [], tips = [];
  const grow = (x, y, ang, len, w, depth) => {
    const x1 = x + Math.sin(ang) * len, y1 = y - Math.cos(ang) * len;
    segs.push([x, y, x1, y1, w, depth]);
    if (depth >= 6) { tips.push([x1, y1, r(), r()]); return; }
    const n = depth < 2 ? 2 : r() < 0.3 ? 3 : 2;
    for (let i = 0; i < n; i += 1) grow(x1, y1, ang + (i - (n - 1) / 2) * (0.55 + r() * 0.35) + (r() - 0.5) * 0.25, len * (0.74 + r() * 0.1), w * 0.68, depth + 1);
  };
  grow(0, 0, 0, 150, 26, 0);
  const model = { segs, tips };
  treeModels.set(seed, model);
  return model;
}
function drawTree(c, x, y, s, leafAmt, tones, { snow = 0, fruit = 0, blossom = false } = {}) {
  const { segs, tips } = treeModel(5);
  c.save(); c.translate(x, y); c.scale(s, s);
  ell(c, 0, 6, 120, 18, alpha('#2b2118', 0.18));
  c.lineCap = 'round';
  for (const [x0, y0, x1, y1, w] of segs) { c.strokeStyle = '#6b523c'; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
  for (const [x0, y0, x1, y1, w] of segs) { c.strokeStyle = alpha('#a58a68', 0.55); c.lineWidth = Math.max(1, w * 0.28); c.beginPath(); c.moveTo(x0 - w * 0.2, y0); c.lineTo(x1 - w * 0.2, y1); c.stroke(); if (snow > 0.05) { c.strokeStyle = alpha('#ffffff', 0.9 * snow); c.lineWidth = Math.max(1.5, w * 0.34); c.beginPath(); c.moveTo(x0 - w * 0.25, y0 - w * 0.1); c.lineTo(x1 - w * 0.25, y1 - w * 0.1); c.stroke(); } }
  const sorted = [...tips].sort((a, b) => a[1] - b[1]);
  for (const [tx, ty, th, tr] of sorted) {
    const k = smooth(clamp01((leafAmt - th * 0.9) / 0.22));
    if (k <= 0) continue;
    const base = tones[Math.floor(tr * tones.length) % tones.length];
    ell(c, tx, ty, 54 * k, 44 * k, lg(c, tx - 40, ty - 40, tx + 40, ty + 40, [[0, shade(base, 0.14)], [1, shade(base, -0.12)]]), null);
    ell(c, tx - 20 * k, ty + 10 * k, 32 * k, 26 * k, shade(tones[(Math.floor(tr * 7) + 1) % tones.length], -0.04));
    ell(c, tx + 14 * k, ty - 14 * k, 26 * k, 20 * k, alpha(shade(base, 0.25), 0.55));
    if (fruit > 0 && tr < fruit * 0.9) ell(c, tx + (tr - 0.5) * 50, ty + 22 * k, 8, 8, '#c75a50', alpha('#6a2a24', 0.4), 1);
  }
  c.restore();
}

// ---- Rosenbogen
function drawArch(c, x, y, season, grow, bloom, leafAmt, snow) {
  const w = 270, h = 380;
  const post = (px) => rr(c, px - 9, y - h + 40, 18, h - 40, 6, lg(c, px - 9, 0, px + 9, 0, [[0, '#cdb48c'], [1, '#a98f68']]));
  post(x - w / 2); post(x + w / 2);
  path(c, (k) => { k.moveTo(x - w / 2, y - h + 60); k.quadraticCurveTo(x, y - h - 90, x + w / 2, y - h + 60); }, null, '#bfa57e', 14);
  const pts = [];
  for (let i = 0; i <= 90; i += 1) {
    const t = i / 90;
    let px, py;
    if (t < 0.38) { const u = t / 0.38; px = x - w / 2 + Math.sin(u * 9) * 8; py = y - u * (h - 50); } else { const u = (t - 0.38) / 0.62; const a = Math.PI - u * Math.PI; px = x + Math.cos(a) * (w / 2) + Math.sin(u * 14) * 6; py = y - h + 60 - Math.sin(a) * 120 * (1 - Math.abs(Math.cos(a)) * 0.18) + 0; }
    pts.push([px, py]);
  }
  const n = Math.floor(grow * pts.length);
  c.strokeStyle = leafAmt < 0.3 && (season === 'herbst' || season === 'winter') ? '#6a5a40' : '#5f7d4a'; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath();
  pts.slice(0, n).forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.stroke();
  const lc = season === 'herbst' ? ['#c9654a', '#d98a4a', '#b8553f'] : ['#6f9a58', '#82ac66', '#5f8a4c'];
  for (let i = 2; i < n; i += 2) {
    if ((i * 37 % 100) / 100 > leafAmt) continue;
    const [px, py] = pts[i], sd = i % 4 === 0 ? 1 : -1;
    leaf(c, px, py, 26, 10, sd * 1.2 + (i % 3) * 0.3, lc[i % 3], { veins: false });
  }
  const roses = ['#d98a94', '#e8b0b0', '#c76f7e', '#f0d0c8'];
  for (let i = 6; i < n; i += 7) {
    const k = smooth(clamp01((bloom - ((i * 13) % 50) / 100) / 0.3));
    if (k <= 0.05 || season === 'winter') continue;
    const [px, py] = pts[i], col = roses[(i / 7) % 4 | 0];
    ell(c, px, py, 15 * k, 13 * k, col, alpha('#7a3a44', 0.35), 1.4); ell(c, px, py, 9 * k, 8 * k, shade(col, 0.12)); ell(c, px + 1, py - 1, 4.6 * k, 4 * k, shade(col, -0.15));
  }
  if (snow > 0.05) { c.strokeStyle = alpha('#ffffff', 0.9 * snow); c.lineWidth = 4; c.beginPath(); c.moveTo(x - w / 2 - 6, y - h + 38); c.lineTo(x - w / 2 + 6, y - h + 38); c.moveTo(x + w / 2 - 6, y - h + 38); c.lineTo(x + w / 2 + 6, y - h + 38); c.stroke(); ell(c, x, y - h - 38, 100, 10 * snow, alpha('#ffffff', 0.85 * snow)); }
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
function paintGrowth(c, season, zeit, p) {
  const P = PAL[season];
  const snow = season === 'winter' ? p : 0;
  if (season === 'winter') { // Schnee deckt den Boden nach und nach zu
    const r = rng(77);
    for (let i = 0; i < 230; i += 1) { const x = r() * W, y = 700 + Math.pow(r(), 0.8) * 380, th = r() * 0.85, w = 70 + r() * 150; const k = smooth(clamp01((p - th) / 0.15)); if (k > 0.02) ell(c, x, y, w * k, (14 + (y - 700) * 0.05) * k, alpha('#ffffff', 0.95)); }
  }
  if (season === 'herbst') { // Laub sammelt sich am Boden
    const r = rng(88), cols = ['#d98a4a', '#c9654a', '#e3b055', '#b8553f', '#c9a05a'];
    for (let i = 0; i < 260; i += 1) { const x = r() * W, y = 705 + Math.pow(r(), 0.8) * 360, th = r() * 0.95; if (p < th) continue; const s = 0.55 + ((y - 700) / 360) * 0.9; leaf(c, x, y, 22 * s, 8 * s, r() * TAU, cols[i % 5], { veins: false }); }
  }
  // Baum, Bogen und Wiesenpflanzen
  const leafAmt = season === 'fruehling' ? clamp01(0.04 + p * 1.05) : season === 'sommer' ? 0.88 + 0.12 * p : season === 'herbst' ? clamp01(1.02 - p * 1.04) : 0;
  const archGrow = season === 'fruehling' ? clamp01(0.1 + p * 0.95) : 1;
  const archBloom = season === 'fruehling' ? clamp01((p - 0.35) / 0.65) : season === 'sommer' ? clamp01(0.25 + p * 0.9) : season === 'herbst' ? clamp01(0.5 - p) : 0;
  const archLeaf = season === 'winter' ? 0 : season === 'herbst' ? clamp01(1 - p * 1.05) : season === 'fruehling' ? clamp01(p * 1.1) : 1;
  const things = [];
  things.push({ y: 706, draw: () => drawTree(c, 640, 706, 0.98, leafAmt, P.tree, { snow, fruit: season === 'sommer' ? clamp01((p - 0.3) / 0.6) : 0, blossom: season === 'fruehling' }) });
  things.push({ y: 770, draw: () => drawArch(c, 1170, 770, season, archGrow, archBloom, archLeaf, snow) });
  if (season === 'winter') {
    things.push({ y: 712, draw: () => { fir(c, 150, 712, 1.1, snow); fir(c, 1010, 700, 0.8, snow); fir(c, 1500, 704, 0.9, snow); fir(c, 1800, 716, 1.15, snow); } });
    things.push({ y: 900, draw: () => snowman(c, 1470, 900, p) });
  }
  for (const s of slotsFor(season)) {
    if (season === 'winter') things.push({ y: s.y, draw: () => (s.type === 'shrub' ? shrubWinter(c, s.x, s.y, s.s, snow, s.r) : tuft(c, s.x, s.y, s.s, 1, s.r, P.blades, snow)) });
    else {
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
    const glKey = `${bgKey}|${pq}`;
    if (glKey !== this.glKey) { this.glKey = glKey; const k = this.gl.getContext('2d'); k.clearRect(0, 0, W, H); paintGrowth(k, season, zeit, pq); }
    c.drawImage(this.bg, 0, 0);
    if (zeit === 'morgen') for (let i = 0; i < 4; i += 1) ell(c, 300 + i * 480 + Math.sin(t / 5000 + i) * 60, 700 + (i % 2) * 24, 380, 36, alpha('#fff4ee', 0.2));
    c.drawImage(this.gl, 0, 0);
    this.living(c, season, zeit, pq, t);
    const tint = SKY[zeit].tint;
    if (tint) { c.fillStyle = alpha(tint[0], tint[1]); c.fillRect(0, 0, W, H); }
  }

  living(c, season, zeit, p, t) {
    if (season === 'fruehling') {
      fall(c, t, 22, 3, (x, y, s, ph) => { c.save(); c.translate(x, y); c.rotate(Math.sin(t / 700 + ph) * 1.2); ell(c, 0, 0, 7 * s, 4 * s, ['#f0cdd0', '#e7b4bb'][ph > 3 ? 1 : 0]); c.restore(); }, 38, 40);
      this.butterflies(c, t, 3, ['#f6efe0', '#f2d98a', '#d9a6c4']);
    }
    if (season === 'sommer') { this.butterflies(c, t, 4, ['#e8a05a', '#8fb3e0', '#f6efe0', '#d98a94']); this.bees(c, t); fall(c, t, 14, 5, (x, y, s, ph) => glow(c, x, y * 0.6 + 380, 12 * s, '#fff2c0', 0.5), 4, 30); }
    if (season === 'herbst') fall(c, t, 20, 7, (x, y, s, ph) => { c.save(); c.translate(x, y); c.rotate(t / 600 + ph); c.scale(1, 0.5 + 0.5 * Math.abs(Math.sin(t / 500 + ph))); leaf(c, 0, 0, 24 * s, 9 * s, 0, ['#d98a4a', '#c9654a', '#e3b055', '#b8553f'][Math.floor(ph) % 4], { veins: false }); c.restore(); }, 60, 70);
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
