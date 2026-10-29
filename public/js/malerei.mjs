// Malwerkzeuge für den weichen, gemalten Look: Farben, Formen, Verläufe, Zimmerpflanzen und Bäume.
// Alles wird mit Canvas-Pfaden gezeichnet (keine Bilddateien), im Koordinatensystem 1920×1080.

export const TAU = Math.PI * 2;

export const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

const rgb = (h) => { const n = parseInt(h.length === 4 ? `${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const hex = (a) => `#${a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
// Mischt zwei Farben (t = 0 → a, 1 → b), Ergebnis wieder als #rrggbb
export const mixc = (a, b, t) => { const A = rgb(a), B = rgb(b); return hex(A.map((v, i) => v + (B[i] - v) * t)); };
// t < 0 dunkler (warmes Braun), t > 0 heller (warmes Creme)
export const shade = (h, t) => (t < 0 ? mixc(h, '#2b2118', -t) : mixc(h, '#fff6e4', t));
export const alpha = (h, a) => { const [r, g, b] = rgb(h); return `rgba(${r},${g},${b},${a})`; };

export function path(c, build, fill, stroke, lw = 2) {
  c.beginPath(); build(c);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.lineJoin = 'round'; c.stroke(); }
}
export const ell = (c, x, y, rx, ry, fill, stroke, lw, rot = 0) => path(c, (k) => k.ellipse(x, y, rx, ry, rot, 0, TAU), fill, stroke, lw);
export function rr(c, x, y, w, h, r, fill, stroke, lw) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  path(c, (k) => { k.moveTo(x + rad, y); k.arcTo(x + w, y, x + w, y + h, rad); k.arcTo(x + w, y + h, x, y + h, rad); k.arcTo(x, y + h, x, y, rad); k.arcTo(x, y, x + w, y, rad); k.closePath(); }, fill, stroke, lw);
}
export const lg = (c, x0, y0, x1, y1, stops) => { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; };
export const rg = (c, x, y, r0, r1, stops) => { const g = c.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; };
// Weiche Lichtkugel (Glühen von Lampen, Sonne)
export function glow(c, x, y, r, col, a = 0.5) { c.fillStyle = rg(c, x, y, 0, r, [[0, alpha(col, a)], [1, alpha(col, 0)]]); c.fillRect(x - r, y - r, r * 2, r * 2); }

// ---- Blätter
// Spitzes Blatt, Stielansatz bei (0,0), Spitze bei (0,-len)
export function leafShape(k, len, wid) {
  k.moveTo(0, 0); k.bezierCurveTo(wid, -len * 0.2, wid * 0.85, -len * 0.7, 0, -len); k.bezierCurveTo(-wid * 0.85, -len * 0.7, -wid, -len * 0.2, 0, 0);
}
export function leaf(c, x, y, len, wid, ang, base, { veins = true } = {}) {
  c.save(); c.translate(x, y); c.rotate(ang);
  path(c, (k) => leafShape(k, len, wid), lg(c, -wid, 0, wid, -len, [[0, shade(base, -0.16)], [0.55, base], [1, shade(base, 0.16)]]));
  if (veins) {
    c.strokeStyle = alpha(shade(base, 0.35), 0.6); c.lineWidth = Math.max(1, len * 0.02);
    c.beginPath(); c.moveTo(0, -len * 0.04); c.lineTo(0, -len * 0.92); c.stroke();
    for (const f of [0.3, 0.5, 0.7]) { c.beginPath(); c.moveTo(0, -len * f); c.quadraticCurveTo(wid * 0.45, -len * (f + 0.05), wid * 0.62 * (1 - f * 0.6), -len * (f + 0.17)); c.moveTo(0, -len * f); c.quadraticCurveTo(-wid * 0.45, -len * (f + 0.05), -wid * 0.62 * (1 - f * 0.6), -len * (f + 0.17)); c.stroke(); }
  }
  c.restore();
}
// Herzblatt (Pothos, Philodendron)
export function heartLeaf(c, x, y, size, ang, base) {
  c.save(); c.translate(x, y); c.rotate(ang);
  path(c, (k) => { k.moveTo(0, 0); k.bezierCurveTo(size * 0.7, size * 0.15, size * 0.9, -size * 0.55, 0, -size); k.bezierCurveTo(-size * 0.9, -size * 0.55, -size * 0.7, size * 0.15, 0, 0); }, lg(c, -size, 0, size, -size, [[0, shade(base, -0.12)], [1, shade(base, 0.18)]]));
  c.strokeStyle = alpha(shade(base, 0.4), 0.55); c.lineWidth = Math.max(1, size * 0.04);
  c.beginPath(); c.moveTo(0, -size * 0.05); c.lineTo(0, -size * 0.85); c.stroke();
  c.restore();
}

// Monstera-Blatt als Bild (einmal gemalt, dann oft gezeichnet): Herzform mit Einschnitten und Löchern
const sprites = new Map();
export function monsteraSprite(L, base) {
  const key = `${L}|${base}`;
  if (sprites.has(key)) return sprites.get(key);
  const w = Math.ceil(L * 1.4), h = Math.ceil(L * 1.2);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  const ox = w / 2, oy = h - L * 0.06;
  c.translate(ox, oy);
  const outline = (k) => {
    k.moveTo(0, -0.04 * L);
    k.bezierCurveTo(-0.3 * L, 0.1 * L, -0.68 * L, -0.06 * L, -0.62 * L, -0.45 * L);
    k.bezierCurveTo(-0.58 * L, -0.78 * L, -0.22 * L, -0.95 * L, 0, -L);
    k.bezierCurveTo(0.22 * L, -0.95 * L, 0.58 * L, -0.78 * L, 0.62 * L, -0.45 * L);
    k.bezierCurveTo(0.68 * L, -0.06 * L, 0.3 * L, 0.1 * L, 0, -0.04 * L);
  };
  path(c, outline, lg(c, -0.6 * L, 0, 0.6 * L, -L, [[0, shade(base, -0.2)], [0.5, base], [1, shade(base, 0.12)]]));
  // Adern
  c.strokeStyle = alpha(shade(base, 0.4), 0.5); c.lineWidth = Math.max(1.5, L * 0.014); c.lineCap = 'round';
  c.beginPath(); c.moveTo(0, -0.03 * L); c.quadraticCurveTo(L * 0.02, -0.5 * L, 0, -0.96 * L); c.stroke();
  for (const f of [0.14, 0.3, 0.46, 0.62, 0.78]) for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(0, -f * L); c.quadraticCurveTo(sd * 0.3 * L, -(f + 0.04) * L, sd * 0.56 * L * (1 - f * 0.5), -(f + 0.15) * L); c.stroke(); }
  // Einschnitte und Löcher ausschneiden
  c.globalCompositeOperation = 'destination-out';
  for (const sd of [-1, 1]) {
    for (const y of [0.2, 0.4, 0.6]) {
      const iX = sd * 0.12 * L, iY = -y * L, eX = sd * 0.8 * L, eY = -(y + 0.13) * L, wd = 0.026 * L;
      c.beginPath(); c.moveTo(iX, iY); c.lineTo(eX, eY - wd * 2.2); c.lineTo(eX, eY + wd * 2.2); c.closePath(); c.fill();
    }
    for (const y of [0.3, 0.5]) { c.beginPath(); c.ellipse(sd * 0.2 * L, -(y + 0.1) * L, 0.028 * L, 0.04 * L, sd * 0.5, 0, TAU); c.fill(); }
  }
  c.globalCompositeOperation = 'source-over';
  const sprite = { cv, ox, oy, L };
  sprites.set(key, sprite);
  return sprite;
}
export function monsteraLeaf(c, x, y, L, ang, base = '#6f8f68') {
  const s = monsteraSprite(Math.round(L / 8) * 8 || 8, base);
  const k = L / s.L;
  c.save(); c.translate(x, y); c.rotate(ang); c.scale(k, k);
  c.drawImage(s.cv, -s.ox, -s.oy); c.restore();
}

export function stem(c, x0, y0, cx, cy, x1, y1, w, col) {
  c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(cx, cy, x1, y1); c.stroke();
}

// ---- Töpfe
export function pot(c, x, y, w, h, col = '#c98a6a') {
  path(c, (k) => { k.moveTo(x - w / 2, y - h); k.lineTo(x + w / 2, y - h); k.quadraticCurveTo(x + w * 0.46, y, x + w * 0.34, y); k.lineTo(x - w * 0.34, y); k.quadraticCurveTo(x - w * 0.46, y, x - w / 2, y - h); k.closePath(); }, lg(c, x - w / 2, 0, x + w / 2, 0, [[0, shade(col, 0.12)], [0.6, col], [1, shade(col, -0.18)]]));
  rr(c, x - w * 0.56, y - h - h * 0.12, w * 1.12, h * 0.22, h * 0.1, shade(col, 0.06), alpha('#2b2118', 0.15), 1.5);
  ell(c, x, y - h - h * 0.02, w * 0.46, h * 0.07, '#5a4333');
}
export function basket(c, x, y, w, h) {
  rr(c, x - w / 2, y - h, w, h, h * 0.18, lg(c, x - w / 2, 0, x + w / 2, 0, [[0, '#d9c29b'], [1, '#b99c70']]));
  c.strokeStyle = alpha('#7d6244', 0.45); c.lineWidth = 2;
  for (let i = 1; i < 5; i += 1) { c.beginPath(); c.moveTo(x - w / 2 + 4, y - (h * i) / 5); c.lineTo(x + w / 2 - 4, y - (h * i) / 5); c.stroke(); }
  for (let i = 1; i < 8; i += 1) { c.beginPath(); c.moveTo(x - w / 2 + (w * i) / 8, y - h + 4); c.lineTo(x - w / 2 + (w * i) / 8 + (i % 2 ? 6 : -6), y - 4); c.stroke(); }
  ell(c, x, y - h, w / 2, h * 0.1, '#6b5238');
}

// ---- Pflanzen (Ursprung = Topfboden)
export function monstera(c, x, y, s = 1, seed = 1) {
  const r = rng(seed);
  const greens = ['#5f7d5c', '#6f8f68', '#7f9a74', '#58765a'];
  const n = 8;
  const leaves = [];
  for (let i = 0; i < n; i += 1) {
    const t = i / (n - 1);
    leaves.push({ ang: (t - 0.5) * 2.1 + (r() - 0.5) * 0.3, len: (150 + r() * 70) * s, size: (118 + r() * 60) * s, col: greens[i % 4], tilt: (r() - 0.5) * 0.5 });
  }
  leaves.sort((a, b) => b.size - a.size);
  for (const lf of leaves) {
    const sx = x + (lf.ang * 18) * s, sy = y - 78 * s;
    const ex = x + Math.sin(lf.ang) * lf.len, ey = y - 78 * s - Math.cos(lf.ang) * lf.len * 0.95;
    stem(c, sx, sy, sx + Math.sin(lf.ang) * lf.len * 0.15, ey + lf.len * 0.35, ex, ey, 6 * s, '#566f50');
    monsteraLeaf(c, ex, ey, lf.size, lf.ang * 1.1 + lf.tilt, lf.col);
  }
  pot(c, x, y, 120 * s, 96 * s, '#c58f70');
}
export function snakePlant(c, x, y, s = 1, seed = 2) {
  const r = rng(seed);
  for (let i = 0; i < 7; i += 1) {
    const ang = (i - 3) * 0.13 + (r() - 0.5) * 0.06, len = (180 + r() * 90) * s, wid = (26 + r() * 6) * s;
    c.save(); c.translate(x + (i - 3) * 9 * s, y - 70 * s); c.rotate(ang);
    path(c, (k) => { k.moveTo(-wid / 2, 0); k.quadraticCurveTo(-wid * 0.6, -len * 0.5, 0, -len); k.quadraticCurveTo(wid * 0.6, -len * 0.5, wid / 2, 0); k.closePath(); }, lg(c, -wid, 0, wid, 0, [[0, '#4f6d50'], [0.5, '#6d8c63'], [1, '#556f52']]), alpha('#d8d6a0', 0.55), 2.5);
    c.strokeStyle = alpha('#2f4a38', 0.28); c.lineWidth = 2;
    for (let k = 1; k < 6; k += 1) { c.beginPath(); c.moveTo(-wid * 0.38, -len * k * 0.15); c.quadraticCurveTo(0, -len * k * 0.15 - 8, wid * 0.38, -len * k * 0.15); c.stroke(); }
    c.restore();
  }
  pot(c, x, y, 118 * s, 90 * s, '#d6c8b0');
}
export function fern(c, x, y, s = 1, seed = 3) {
  const r = rng(seed);
  for (let i = 0; i < 9; i += 1) {
    const dir = (i / 8 - 0.5) * 2.4, len = (150 + r() * 70) * s;
    const bx = x, by = y - 70 * s, ex = x + Math.sin(dir) * len, ey = by - Math.cos(dir) * len * 0.7 + len * 0.25;
    const cx = x + Math.sin(dir) * len * 0.45, cy = by - len * 0.8;
    stem(c, bx, by, cx, cy, ex, ey, 3 * s, '#5f7b55');
    for (let k = 1; k < 13; k += 1) {
      const tt = k / 13, px = (1 - tt) * (1 - tt) * bx + 2 * (1 - tt) * tt * cx + tt * tt * ex, py = (1 - tt) * (1 - tt) * by + 2 * (1 - tt) * tt * cy + tt * tt * ey;
      const size = (30 - tt * 16) * s;
      for (const sd of [-1, 1]) leaf(c, px, py, size, size * 0.34, dir + sd * 1.15, k % 2 ? '#7d9a6f' : '#6a8a62', { veins: false });
    }
  }
  pot(c, x, y, 114 * s, 86 * s, '#bf8c70');
}
export function palm(c, x, y, s = 1, seed = 4) {
  const r = rng(seed);
  for (let i = 0; i < 7; i += 1) {
    const dir = (i / 6 - 0.5) * 2.0, len = (240 + r() * 60) * s;
    const bx = x + (i - 3) * 6 * s, by = y - 80 * s, ex = x + Math.sin(dir) * len, ey = by - Math.cos(dir) * len * 0.78 + 30 * s;
    const cx = x + Math.sin(dir) * len * 0.35, cy = by - len * 0.85;
    stem(c, bx, by, cx, cy, ex, ey, 4 * s, '#667f4f');
    for (let k = 3; k < 16; k += 1) {
      const tt = k / 16, px = (1 - tt) * (1 - tt) * bx + 2 * (1 - tt) * tt * cx + tt * tt * ex, py = (1 - tt) * (1 - tt) * by + 2 * (1 - tt) * tt * cy + tt * tt * ey;
      const size = (52 - tt * 22) * s;
      for (const sd of [-1, 1]) leaf(c, px, py, size, size * 0.2, dir + sd * 1.0 + tt * sd * 0.3, k % 2 ? '#6d8d57' : '#7c9b62', { veins: false });
    }
  }
  pot(c, x, y, 120 * s, 92 * s, '#c9a07c');
}
// Hängende Ranke (Efeutute) von (x,y) nach unten
export function vine(c, x, y, len, seed = 5, scale = 1) {
  const r = rng(seed);
  const pts = [];
  for (let i = 0; i <= 24; i += 1) { const t = i / 24; pts.push([x + Math.sin(t * 5 + seed) * 26 * scale + t * (r() - 0.5) * 8, y + t * len]); }
  c.strokeStyle = '#6a8456'; c.lineWidth = 4 * scale; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.stroke();
  pts.forEach(([px, py], i) => {
    if (i < 1 || i % 2) return;
    const side = i % 4 === 0 ? 1 : -1;
    heartLeaf(c, px, py, (34 + r() * 14) * scale, Math.PI + side * (0.5 + r() * 0.5) + (r() - 0.5) * 0.4, i % 6 === 0 ? '#9db27c' : '#6f8f62');
  });
}
// Eukalyptus-Zweig in der Vase (Zierde)
export function branch(c, x, y, h, s = 1, seed = 6) {
  const r = rng(seed);
  c.strokeStyle = '#6b7f61'; c.lineWidth = 3 * s; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 20 * s, y - h * 0.5, x + 8 * s, y - h); c.stroke();
  for (let i = 1; i < 10; i += 1) { const t = i / 10; for (const sd of [-1, 1]) ell(c, x + 20 * s * t * (1 - t) * 2 + sd * 14 * s, y - h * t, 12 * s, 17 * s, i % 2 ? '#93ab98' : '#7f9b86', null, 0, sd * 0.9); }
}

// ---- Bäume
export function tree(c, x, y, s = 1, seed = 7, tones = ['#6f8f68', '#7f9a74', '#5c7a5a', '#94ad84']) {
  const r = rng(seed);
  path(c, (k) => { k.moveTo(x - 20 * s, y); k.quadraticCurveTo(x - 12 * s, y - 160 * s, x - 7 * s, y - 330 * s); k.lineTo(x + 7 * s, y - 330 * s); k.quadraticCurveTo(x + 14 * s, y - 160 * s, x + 22 * s, y); k.closePath(); }, lg(c, x - 20 * s, 0, x + 22 * s, 0, [[0, '#8a6a4e'], [1, '#6b5039']]));
  const blobs = [];
  for (let i = 0; i < 14; i += 1) blobs.push([x + (r() - 0.5) * 300 * s, y - (330 + (r() - 0.35) * 200) * s, (80 + r() * 70) * s, tones[i % tones.length]]);
  blobs.sort((a, b) => a[1] - b[1]);
  for (const [bx, by, br, col] of blobs) {
    ell(c, bx, by, br, br * 0.88, lg(c, bx - br, by - br, bx + br, by + br, [[0, shade(col, 0.16)], [1, shade(col, -0.14)]]));
  }
  for (let i = 0; i < 40; i += 1) { const [bx, by, br] = blobs[i % blobs.length]; ell(c, bx + (r() - 0.5) * br, by - r() * br * 0.5, 8 + r() * 14, 5 + r() * 7, alpha('#f4efc4', 0.2)); }
}
// Wolke aus weichen Ellipsen
export function cloud(c, x, y, s = 1, col = '#fbf6ea', a = 0.85) {
  for (const [dx, dy, rx, ry] of [[0, 0, 110, 34], [-70, 8, 70, 26], [80, 8, 80, 28], [20, -22, 70, 34]]) ell(c, x + dx * s, y + dy * s, rx * s, ry * s, alpha(col, a));
}
// Pinselstriche für Gras
export function grassStrokes(c, x0, y0, x1, y1, n, seed, cols) {
  const r = rng(seed);
  c.lineCap = 'round';
  for (let i = 0; i < n; i += 1) {
    const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0), h = 10 + r() * 22;
    c.strokeStyle = alpha(cols[i % cols.length], 0.55); c.lineWidth = 2 + r() * 2;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + (r() - 0.5) * 8, y - h * 0.6, x + (r() - 0.5) * 14, y - h); c.stroke();
  }
}
// Kleine Blüten (Beet, Wiese)
export function blossoms(c, x0, y0, x1, y1, n, seed, cols) {
  const r = rng(seed);
  for (let i = 0; i < n; i += 1) {
    const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0), s = 6 + r() * 7, col = cols[Math.floor(r() * cols.length)];
    c.strokeStyle = alpha('#587050', 0.7); c.lineWidth = 2; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * 4, y + 22 + r() * 10); c.stroke();
    for (let k = 0; k < 5; k += 1) ell(c, x + Math.cos((k / 5) * TAU) * s * 0.9, y + Math.sin((k / 5) * TAU) * s * 0.9, s * 0.7, s * 0.55, col, null, 0, (k / 5) * TAU);
    ell(c, x, y, s * 0.45, s * 0.45, '#e6c777');
  }
}
