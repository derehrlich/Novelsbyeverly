// Die Fenster-Ansicht: ein gemütliches Zimmer mit großem Fenster. Du wählst den Ort (Leseecke oder Arbeitsplatz),
// den Blick nach draußen (Stadt, Landschaft, Wald, See) und das Wetter; Jahreszeit und Tageszeit kommen wie bei der
// Landschaft aus den Einstellungen. Alles wird mit Canvas-Pfaden gemalt (1920×1080), der ruhende Teil wird zwischengespeichert.
import { H, TAU, W, alpha, clamp01, ell, fern, glow, leaf, lg, mixc, monstera, path, pot, rng, rr, shade, smooth, snakePlant } from './malerei.mjs';
import { PAL, SKY, drawTree, fir, paintBackground } from './wachstum.mjs';

export const FENSTER_ORTE = { lese: 'Leseecke', arbeit: 'Arbeitsplatz' };
export const FENSTER_BLICKE = { stadt: 'Stadt', landschaft: 'Landschaft', wald: 'Wald', see: 'See' };
export const FENSTER_WETTER = { klar: 'Klar', regen: 'Regen', schnee: 'Schnee' };

const FW = { x: 380, y: 60, w: 1160, h: 690 }; // Glasfläche des Fensters
const FLOOR = 820; // Oberkante des Bodens
const fxCanvas = () => { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; return cv; };
const fxClip = (c, r = FW) => { c.beginPath(); c.rect(r.x, r.y, r.w, r.h); c.clip(); };

// ---------------------------------------------------------------- Himmel (für alle Ausblicke)
function fxSky(c, season, zeit, wetter) {
  const S = SKY[zeit], wn = FW;
  const grey = wetter === 'regen' ? 0.6 : wetter === 'schnee' ? 0.45 : 0;
  const tone = (h) => { const w = season === 'winter' ? mixc(h, '#dfe4e8', 0.3) : h; return grey ? mixc(w, zeit === 'abend' ? '#454c66' : '#9aa6b2', grey) : w; };
  c.fillStyle = lg(c, 0, wn.y, 0, wn.y + wn.h * 0.72, [[0, tone(S.top)], [0.55, tone(S.mid)], [1, tone(S.hor)]]); c.fillRect(wn.x, wn.y, wn.w, wn.h);
  const sx = { morgen: 0.72, mittag: 0.7, abend: 0.27 }[zeit], sy = { morgen: 0.6, mittag: 0.2, abend: 0.58 }[zeit];
  const px = wn.x + wn.w * sx, py = wn.y + wn.h * sy;
  if (zeit === 'abend') {
    const r = rng(9);
    if (!grey) for (let i = 0; i < 130; i += 1) { const y = r() * wn.h * 0.5; ell(c, wn.x + r() * wn.w, wn.y + y, 1 + r() * 1.6, 1 + r() * 1.6, alpha('#fff8e4', 0.25 + 0.6 * r() * (1 - y / (wn.h * 0.55)))); }
    const mx = wn.x + wn.w * 0.76, my = wn.y + wn.h * 0.2;
    glow(c, mx, my, 220, '#f6f0d6', grey ? 0.14 : 0.32);
    if (!grey) { ell(c, mx, my, 40, 40, lg(c, mx - 40, my - 40, mx + 40, my + 40, [[0, '#fbf6e2'], [1, '#e6dfc4']])); ell(c, mx - 12, my - 8, 8, 7, alpha('#c9c2a6', 0.5)); ell(c, mx + 10, my + 14, 6, 5, alpha('#c9c2a6', 0.45)); }
  }
  if (!grey) {
    glow(c, px, py, S.r * 0.8, S.sun[2], 0.7); glow(c, px, py, S.r * 0.32, '#fff4d8', 0.5);
    ell(c, px, py, S.disc[2] * 0.85, S.disc[2] * 0.85, S.disc[3]);
  }
  const cc = grey ? mixc(S.cloud, zeit === 'abend' ? '#3d435a' : '#7f8896', 0.65) : S.cloud;
  const cl = (x, y, s, a) => { for (const [dx, dy, rx, ry] of [[0, 0, 110, 32], [-70, 8, 70, 24], [84, 8, 80, 26], [20, -22, 70, 32]]) ell(c, x + dx * s, y + dy * s, rx * s, ry * s, alpha(cc, a)); };
  const spots = grey ? [[0.12, 0.12, 1.5], [0.36, 0.2, 1.7], [0.62, 0.1, 1.6], [0.86, 0.22, 1.5], [0.2, 0.34, 1.3], [0.5, 0.36, 1.4], [0.8, 0.4, 1.3]] : [[0.18, 0.2, 1.0], [0.5, 0.1, 0.8], [0.84, 0.3, 0.85], [0.4, 0.4, 0.6]];
  for (const [u, v, s] of spots) cl(wn.x + wn.w * u, wn.y + wn.h * v, s, grey ? 0.85 : zeit === 'abend' ? 0.5 : 0.8);
}

// Wetter über dem Ausblick (Dunst bei Regen und Schnee)
function fxVeil(c, zeit, wetter) {
  if (wetter === 'regen') { c.fillStyle = alpha(zeit === 'abend' ? '#1d2438' : '#7c8998', zeit === 'abend' ? 0.28 : 0.26); c.fillRect(FW.x, FW.y, FW.w, FW.h); }
  if (wetter === 'schnee') { c.fillStyle = alpha('#eef3f8', zeit === 'abend' ? 0.08 : 0.2); c.fillRect(FW.x, FW.y, FW.w, FW.h); }
}

// ---------------------------------------------------------------- Ausblick: Stadt
function fxStadt(c, season, zeit, wetter, meta) {
  const wn = FW, S = SKY[zeit], bottom = wn.y + wn.h;
  const hy = wn.y + wn.h * 0.62;
  const haze = zeit === 'abend' ? '#a76f8d' : zeit === 'morgen' ? '#efbdb1' : '#d9e6e6';
  const base = { mittag: ['#b3bfd0', '#97a5bd', '#7d8ba6'], morgen: ['#b6a6c4', '#9a8bb0', '#7d6f98'], abend: ['#4d4a7a', '#383a68', '#262a52'] }[zeit];
  const winter = season === 'winter', lit = { mittag: 0, morgen: 0.14, abend: 0.5 }[zeit] + (wetter === 'regen' && zeit === 'mittag' ? 0.12 : 0);
  const layers = [{ n: 17, lo: 90, hi: 240, dy: 0, k: 0.5 }, { n: 11, lo: 150, hi: 340, dy: 36, k: 0.3 }, { n: 7, lo: 230, hi: 470, dy: 80, k: 0.1 }];
  layers.forEach((L, li) => {
    const r = rng(100 + li * 17); let x = wn.x - 30;
    const col = mixc(base[li], haze, L.k + (wetter === 'regen' ? 0.12 : 0));
    while (x < wn.x + wn.w + 30) {
      const bw = (wn.w / L.n) * (0.75 + r() * 0.6), bh = L.lo + r() * (L.hi - L.lo), top = hy + L.dy - bh, by = bottom + 4;
      rr(c, x, top, bw, by - top, 3, lg(c, x, 0, x + bw, 0, [[0, shade(col, 0.05)], [1, shade(col, -0.08)]]));
      if (r() < 0.3) { rr(c, x + bw * 0.4, top - 26, bw * 0.2, 28, 2, shade(col, -0.05)); if (li >= 1 && bh > L.hi * 0.8) meta.towers.push([x + bw * 0.5, top - 28]); }
      // Fenster: ein Raster aus kleinen Rechtecken, nachts viele warm erleuchtet
      const cw = 12 + li * 3, chh = 16 + li * 3, gx = cw + 8 + li * 2, gy = chh + 10 + li * 2;
      for (let yy = top + 14; yy < by - 10; yy += gy) for (let xx = x + 10; xx < x + bw - cw - 4; xx += gx) {
        if (r() < lit * (0.6 + li * 0.2)) { rr(c, xx, yy, cw, chh, 2, ['#ffd98a', '#ffe9b0', '#f6c46f', '#ffefc8'][Math.floor(r() * 4)]); if (zeit === 'abend' && li === 2) glow(c, xx + cw / 2, yy + chh / 2, 20, '#ffd98a', 0.2); } else rr(c, xx, yy, cw, chh, 2, alpha(zeit === 'abend' ? '#0f1230' : '#ffffff', zeit === 'abend' ? 0.35 : 0.16));
      }
      if (winter) rr(c, x - 2, top - 2, bw + 4, 8, 3, '#f7fafc');
      x += bw + (r() < 0.4 ? 6 : -4);
    }
    if (li < 2) { c.fillStyle = alpha(haze, 0.22 + L.k * 0.2); c.fillRect(wn.x, hy - 220, wn.w, bottom - hy + 240); }
  });
  if (zeit === 'abend') glow(c, wn.x + wn.w * 0.3, hy + 10, 420, '#ffb878', 0.3);
  // Straßenbäume ganz unten
  const tones = PAL[season].tree, r = rng(55);
  for (let i = 0; i < 14; i += 1) {
    const x = wn.x + 40 + i * (wn.w / 13) + (r() - 0.5) * 40, y = bottom - 26 + r() * 20;
    c.strokeStyle = '#4d3f33'; c.lineWidth = 7; c.beginPath(); c.moveTo(x, bottom + 10); c.lineTo(x, y); c.stroke();
    if (winter) { c.lineWidth = 3; for (let b = 0; b < 5; b += 1) { c.beginPath(); c.moveTo(x, y + 8); c.quadraticCurveTo(x + (b - 2) * 14, y - 22, x + (b - 2) * 26, y - 44 - r() * 20); c.stroke(); } ell(c, x, y - 30, 30, 7, alpha('#ffffff', 0.85)); }
    else for (let k = 0; k < 4; k += 1) ell(c, x + (k - 1.5) * 20, y - 20 - (k % 2) * 14, 26, 22, shade(tones[k % tones.length], zeit === 'abend' ? -0.45 : -0.1 + k * 0.04));
    if (season === 'fruehling' && !winter) for (let k = 0; k < 7; k += 1) ell(c, x + (r() - 0.5) * 70, y - 12 - r() * 40, 4, 4, alpha('#f6d6dc', 0.9));
  }
}

// ---------------------------------------------------------------- Ausblick: Landschaft (Hügel, Eiche, Weg)
function fxLandschaft(c, season, zeit, wetter) {
  const wn = FW, s = 0.6;
  c.save(); c.translate(wn.x + (wn.w - W * s) / 2, wn.y - 6); c.scale(s, s);
  paintBackground(c, season, zeit, season === 'winter' ? 1 : 0);
  c.restore();
  const winter = season === 'winter';
  // Eiche und Bäumchen
  const leafAmt = { fruehling: 0.75, sommer: 1, herbst: 0.7, winter: 0 }[season];
  drawTree(c, wn.x + wn.w * 0.2, wn.y + wn.h * 0.9, 0.5, { leafAmt, tones: PAL[season].tree, season, p: 0.5, snow: winter ? 1 : 0 });
  if (winter) { fir(c, wn.x + wn.w * 0.86, wn.y + wn.h * 0.82, 0.8, 1); fir(c, wn.x + wn.w * 0.95, wn.y + wn.h * 0.78, 0.6, 1); }
  else { const r = rng(7), cols = { fruehling: ['#f0cdd0', '#fbf6ea', '#f4e8a8'], sommer: ['#e9bb54', '#d8645a', '#b8a2d8'], herbst: ['#d98a4a', '#c9654a', '#b49ad0'] }[season]; for (let i = 0; i < 70; i += 1) { const y = wn.y + wn.h * 0.78 + r() * wn.h * 0.22, x = wn.x + r() * wn.w; if (Math.abs(x - (wn.x + wn.w * 0.5)) < 90 + (y - wn.y - wn.h * 0.7) * 0.2) continue; ell(c, x, y, 3 + r() * 3, 3 + r() * 3, cols[i % 3]); } }
}

// ---------------------------------------------------------------- Ausblick: Wald
function fxWald(c, season, zeit, wetter) {
  fxSky(c, season, zeit, wetter);
  const wn = FW, P = PAL[season], winter = season === 'winter', bottom = wn.y + wn.h;
  const fog = mixc(SKY[zeit].hor, wetter === 'regen' ? '#9aa6b2' : '#ffffff', zeit === 'abend' ? 0.05 : 0.3);
  const layers = [{ y: wn.y + wn.h * 0.56, s: 0.5, n: 20, fog: 0.55 }, { y: wn.y + wn.h * 0.68, s: 0.75, n: 14, fog: 0.4 }, { y: wn.y + wn.h * 0.82, s: 1.05, n: 9, fog: 0.22 }, { y: bottom + 20, s: 1.7, n: 5, fog: 0 }];
  const dark = zeit === 'abend' ? -0.45 : zeit === 'morgen' ? -0.05 : 0;
  const ground = (y0) => { const g0 = winter ? '#e6edf2' : P.ground[0], g1 = winter ? '#cfdbe4' : P.ground[1]; c.fillStyle = lg(c, 0, y0, 0, bottom, [[0, shade(mixc(g0, fog, 0.3), dark)], [1, shade(g1, dark)]]); c.fillRect(wn.x, y0, wn.w, bottom - y0); };
  layers.forEach((L, li) => {
    if (li === 1) ground(layers[0].y);
    if (li === 2) ground(layers[1].y);
    const r = rng(300 + li * 11);
    for (let j = 0; j < L.n; j += 1) {
      const x = wn.x + (j + 0.1 + r() * 0.8) * (wn.w / L.n), s = L.s * (0.85 + r() * 0.35), y = L.y + (r() - 0.5) * 14;
      if (r() < (winter ? 0.7 : 0.4)) { c.save(); fir(c, x, y, s, winter ? 1 : 0); c.restore(); } else {
        const th = 20 * s, h = 150 * s;
        rr(c, x - th / 2, y - h, th, h + 6, 4, lg(c, x - th, 0, x + th, 0, [[0, shade('#8a6c52', dark)], [1, shade('#5a4636', dark)]]));
        if (winter) { c.strokeStyle = shade('#5a4636', dark); c.lineWidth = 4 * s; c.lineCap = 'round'; for (let b = 0; b < 6; b += 1) { c.beginPath(); c.moveTo(x, y - h * (0.5 + b * 0.08)); c.quadraticCurveTo(x + (b % 2 ? 1 : -1) * 40 * s, y - h * 0.75 - b * 12 * s, x + (b % 2 ? 1 : -1) * 70 * s, y - h * 0.95 - b * 18 * s); c.stroke(); } ell(c, x, y - h * 0.5, th * 0.6, 4 * s, alpha('#ffffff', 0.9)); } else for (let k = 0; k < 6; k += 1) ell(c, x + Math.cos(k * 1.1) * 52 * s, y - h - 20 * s + Math.sin(k * 1.9) * 34 * s, (50 + (k % 3) * 8) * s, (42 + (k % 2) * 8) * s, shade(P.tree[k % P.tree.length], dark + (k % 3) * 0.04));
      }
      if (li >= 1 && !winter) for (let k = 0; k < 3; k += 1) ell(c, x + (r() - 0.5) * 120 * s, y + 4, 26 * s, 14 * s, shade(P.blades[k % 3], dark - 0.05));
      if (season === 'fruehling' && li >= 1) for (let k = 0; k < 6; k += 1) ell(c, x + (r() - 0.5) * 160 * s, y + 6 + r() * 20, 3.2, 3.2, '#fbf6ea');
      if (season === 'herbst' && li >= 1) for (let k = 0; k < 8; k += 1) ell(c, x + (r() - 0.5) * 160 * s, y + 6 + r() * 26, 14 * s, 5 * s, shade(['#d98a4a', '#c9654a', '#e3b055'][k % 3], dark), null, 0, r());
    }
    if (li < 3) { c.fillStyle = alpha(fog, L.fog * 0.5); c.fillRect(wn.x, wn.y + wn.h * 0.3, wn.w, bottom - wn.y - wn.h * 0.3); }
  });
  if (zeit !== 'abend' && wetter === 'klar') for (let i = 0; i < 4; i += 1) { const x = wn.x + wn.w * (0.45 + i * 0.12); c.fillStyle = lg(c, x, wn.y, x - 160, bottom, [[0, alpha(zeit === 'morgen' ? '#ffd7b0' : '#fff3c8', 0.2)], [1, alpha('#fff3c8', 0)]]); c.beginPath(); c.moveTo(x, wn.y); c.lineTo(x + 70, wn.y); c.lineTo(x - 110, bottom); c.lineTo(x - 230, bottom); c.closePath(); c.fill(); }
}

// ---------------------------------------------------------------- Ausblick: See
function fxSee(c, season, zeit, wetter) {
  fxSky(c, season, zeit, wetter);
  const wn = FW, S = SKY[zeit], P = PAL[season], winter = season === 'winter', bottom = wn.y + wn.h;
  const hy = wn.y + wn.h * 0.5, haze = zeit === 'abend' ? '#a76f8d' : zeit === 'morgen' ? '#efbdb1' : '#d9e6e6';
  const dark = zeit === 'abend' ? -0.35 : 0;
  // Berge in zwei Reihen
  const mount = (seed, amp, base, col, cap) => { const r = rng(seed), ph = [r() * 6, r() * 6, r() * 6]; const yAt = (x) => hy - base - amp * (0.6 + 0.4 * Math.sin(x / 190 + ph[0])) * (0.5 + 0.5 * Math.sin(x / 520 + ph[1])) - Math.abs(Math.sin(x / 90 + ph[2])) * amp * 0.12; path(c, (k) => { k.moveTo(wn.x, hy + 4); for (let x = wn.x; x <= wn.x + wn.w; x += 16) k.lineTo(x, yAt(x)); k.lineTo(wn.x + wn.w, hy + 4); k.closePath(); }, col); if (cap) { c.save(); c.beginPath(); c.moveTo(wn.x, hy); for (let x = wn.x; x <= wn.x + wn.w; x += 16) c.lineTo(x, yAt(x)); c.lineTo(wn.x + wn.w, hy); c.clip(); for (let x = wn.x; x < wn.x + wn.w; x += 16) { const y = yAt(x); if (y < hy - base - amp * 0.55) ell(c, x, y + 14, 26, 18, alpha('#ffffff', 0.9)); } c.restore(); } };
  mount(21, 190, 20, mixc({ mittag: '#a8b6cc', morgen: '#b9a7c2', abend: '#4a4a78' }[zeit], haze, 0.4), winter);
  mount(34, 110, 6, mixc({ mittag: '#8ea3a4', morgen: '#9a8fa4', abend: '#34385f' }[zeit], haze, 0.22), winter);
  // Ufer gegenüber: Baumreihe
  const r = rng(77);
  for (let i = 0; i < 44; i += 1) { const x = wn.x + i * (wn.w / 43) + r() * 10, s = 0.7 + r() * 0.6; if (winter) { rr(c, x - 1.5, hy - 24 * s, 3, 26 * s, 1, shade('#5a4636', dark)); ell(c, x, hy - 24 * s, 9 * s, 3, alpha('#ffffff', 0.9)); } else ell(c, x, hy - 8 * s, 15 * s, 18 * s, shade(P.tree[i % P.tree.length], dark - 0.08)); }
  // Wasser
  const wTop = winter ? mixc(S.hor, '#e3eef5', 0.6) : mixc(S.mid, '#6fa3ad', 0.4), wBot = winter ? mixc(S.mid, '#c9dbe6', 0.5) : mixc(S.top, '#4a8089', 0.55);
  c.fillStyle = lg(c, 0, hy, 0, bottom, [[0, shade(wTop, dark * 0.5)], [1, shade(wBot, dark * 0.6)]]); c.fillRect(wn.x, hy, wn.w, bottom - hy);
  const sx = wn.x + wn.w * { morgen: 0.72, mittag: 0.7, abend: 0.27 }[zeit];
  if (wetter === 'klar') { const col = zeit === 'abend' ? '#ffd5a2' : '#fff4d8'; glow(c, sx, hy + 60, 260, col, 0.4); for (let i = 0; i < 26; i += 1) { const y = hy + 8 + i * 12, w = 20 + i * 5 + r() * 30; c.fillStyle = alpha(col, 0.5 - i * 0.012); c.fillRect(sx - w / 2 + (r() - 0.5) * 16, y, w, 3); } }
  if (zeit === 'abend') { const mx = wn.x + wn.w * 0.76; for (let i = 0; i < 14; i += 1) { c.fillStyle = alpha('#f6f0d6', wetter === 'regen' ? 0.12 : 0.3 - i * 0.015); c.fillRect(mx - (14 + i * 2), hy + 10 + i * 12, 28 + i * 4, 2.6); } }
  c.strokeStyle = alpha('#ffffff', winter ? 0.5 : 0.22); c.lineWidth = 2;
  for (let i = 0; i < 40; i += 1) { const y = hy + 10 + Math.pow(r(), 1.4) * (bottom - hy - 20), xx = wn.x + r() * wn.w, w = 20 + (y - hy) * 0.4 * r(); c.beginPath(); c.moveTo(xx, y); c.quadraticCurveTo(xx + w / 2, y - 3, xx + w, y); c.stroke(); }
  if (winter) { c.strokeStyle = alpha('#9db4c4', 0.55); for (let i = 0; i < 8; i += 1) { const x0 = wn.x + r() * wn.w, y0 = hy + 20 + r() * (bottom - hy - 40); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + (r() - 0.5) * 220, y0 + (r() - 0.2) * 90); c.stroke(); } for (let i = 0; i < 9; i += 1) ell(c, wn.x + r() * wn.w, hy + 40 + r() * (bottom - hy - 60), 60 + r() * 110, 6 + r() * 12, alpha('#ffffff', 0.85)); }
  // Holzsteg von links unten
  const j0 = { x: wn.x, y: bottom }, edge = (t, side) => [wn.x + 30 + t * 390 + (side ? 220 - t * 205 : 0), bottom - t * (bottom - hy - 90)];
  path(c, (k) => { const a = edge(0, 0), b = edge(0, 1), d = edge(1, 1), e = edge(1, 0); k.moveTo(a[0], a[1]); k.lineTo(b[0], b[1]); k.lineTo(d[0], d[1]); k.lineTo(e[0], e[1]); k.closePath(); }, lg(c, 0, hy, 0, bottom, [[0, shade('#9a7b58', dark)], [1, shade('#b89368', dark)]]));
  for (let i = 1; i < 22; i += 1) { const t = Math.pow(i / 22, 1.5), a = edge(t, 0), b = edge(t, 1); c.strokeStyle = alpha('#3d2c1c', 0.4); c.lineWidth = 1.5 + (1 - t) * 3; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
  for (const t of [0.06, 0.32, 0.62, 0.92]) { const a = edge(t, 0), b = edge(t, 1), h = 54 * (1 - t * 0.7); rr(c, a[0] - 5, a[1] - h, 10, h + 4, 3, shade('#6a4c34', dark)); rr(c, b[0] - 5, b[1] - h, 10, h + 4, 3, shade('#6a4c34', dark)); if (winter) { ell(c, a[0], a[1] - h, 8, 3, '#fff'); ell(c, b[0], b[1] - h, 8, 3, '#fff'); } }
  if (winter) path(c, (k) => { const a = edge(0, 0), b = edge(0, 1), d = edge(1, 1), e = edge(1, 0); k.moveTo(a[0], a[1]); k.lineTo(b[0], b[1]); k.lineTo(d[0], d[1]); k.lineTo(e[0], e[1]); k.closePath(); }, alpha('#ffffff', 0.7));
  // Schilf unten rechts
  const reedCol = winter ? '#b8a982' : season === 'herbst' ? '#b0903f' : '#6f9448';
  for (let i = 0; i < 26; i += 1) { const x = wn.x + wn.w - 20 - r() * 330, y = bottom + 6, h = 80 + r() * 150, b = (r() - 0.5) * 50; c.strokeStyle = shade(reedCol, dark + (r() - 0.5) * 0.1); c.lineWidth = 3.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + b * 0.4, y - h * 0.6, x + b, y - h); c.stroke(); if (r() < 0.5) { ell(c, x + b, y - h - 10, 4.6, 14, shade('#7a5a3a', dark)); if (winter) ell(c, x + b, y - h - 22, 7, 3, '#fff'); } }
}

// ---------------------------------------------------------------- Zimmer: Wand, Boden, Regal, Dekoration
const BOOK = ['#a8786b', '#7f98a6', '#c9b27a', '#8fa584', '#b59ab1', '#cf9a7a', '#7d8fa8', '#d9c6a0', '#9c6b5b', '#6f8a7a'];
function fxBuecherRegal(c, x0, y0, w, h) {
  rr(c, x0, y0, w, h, 8, lg(c, x0, 0, x0 + w, 0, [[0, '#6e5038'], [1, '#5a4130']]));
  const rows = 4, rh = (h - 24) / rows, r = rng(12);
  for (let i = 0; i < rows; i += 1) {
    const by = y0 + 12 + (i + 1) * rh - 8;
    rr(c, x0 + 8, y0 + 12 + i * rh + 6, w - 16, rh - 14, 4, alpha('#2b1f14', 0.5));
    let x = x0 + 16;
    while (x < x0 + w - 30) {
      const roll = r();
      if (roll < 0.08) { pot(c, x + 22, by, 40, 30, '#d8c7a8'); leaf(c, x + 22, by - 28, 36, 12, -0.5, '#7f9d6f'); leaf(c, x + 22, by - 28, 40, 13, 0.4, '#6f8f62'); leaf(c, x + 22, by - 28, 30, 10, 1.0, '#8fb07f'); x += 52; continue; }
      if (roll < 0.13) { rr(c, x, by - 66, 54, 66, 3, '#d9c6a0', alpha('#2b2118', 0.4), 2); rr(c, x + 8, by - 58, 38, 50, 2, '#9db4bf'); x += 66; continue; }
      const bw = 14 + r() * 14, bh = rh - 46 - r() * 34, col = BOOK[Math.floor(r() * BOOK.length)];
      rr(c, x, by - bh, bw, bh, 2, lg(c, x, 0, x + bw, 0, [[0, shade(col, 0.1)], [1, shade(col, -0.12)]]), alpha('#2b2118', 0.35), 1.4);
      c.fillStyle = alpha('#fff6e0', 0.4); c.fillRect(x + 3, by - bh + 8, bw - 6, 3);
      x += bw + 2;
    }
    rr(c, x0 + 6, y0 + 12 + (i + 1) * rh - 8, w - 12, 10, 3, '#8a6a4a');
  }
}

function fxWand(c, o, meta) {
  c.fillStyle = lg(c, 0, 0, 0, FLOOR, [[0, '#eadfc8'], [1, '#dccaa8']]); c.fillRect(0, 0, W, FLOOR);
  c.fillStyle = alpha('#ffffff', 0.06); for (let x = 0; x < W; x += 120) c.fillRect(x, 0, 60, FLOOR);
  // Boden
  c.fillStyle = lg(c, 0, FLOOR, 0, H, [[0, '#b08a5e'], [1, '#8f6a46']]); c.fillRect(0, FLOOR, W, H - FLOOR);
  c.strokeStyle = alpha('#4d3520', 0.2); c.lineWidth = 2;
  for (let y = FLOOR + 22, i = 0; y < H; y += 24 + i * 6, i += 1) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  const r = rng(4); for (let i = 0; i < 60; i += 1) { const y = FLOOR + 10 + r() * (H - FLOOR); const x = r() * W; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 40 + r() * 100, y); c.stroke(); }
  rr(c, -10, FLOOR - 16, W + 20, 26, 6, '#efe6d2', alpha('#2b2118', 0.18), 2);
  // Teppich
  const rugX = o.ort === 'lese' ? 900 : 940, rugY = 960;
  ell(c, rugX, rugY + 10, 640, 112, alpha('#2b2118', 0.14));
  ell(c, rugX, rugY, 620, 100, '#b9806e'); ell(c, rugX, rugY, 580, 88, '#d4ab94', alpha('#fff6e8', 0.5), 4);
  for (let i = 0; i < 5; i += 1) ell(c, rugX, rugY, 520 - i * 70, 74 - i * 11, null, alpha(i % 2 ? '#a8695a' : '#e9d3b6', 0.6), 5);
  // Bücherregal links, Bilder rechts
  fxBuecherRegal(c, 22, 70, 330, FLOOR - 70 - 6);
  for (const [fx, fy, fw, fh, kind] of [[1590, 110, 150, 190, 0], [1770, 150, 120, 150, 1]]) {
    rr(c, fx, fy, fw, fh, 6, '#c5a678', alpha('#6a4f33', 0.5), 3); rr(c, fx + 12, fy + 12, fw - 24, fh - 24, 3, kind ? '#e3d6bb' : '#c9d6cf');
    c.save(); c.beginPath(); c.rect(fx + 12, fy + 12, fw - 24, fh - 24); c.clip();
    if (kind) { ell(c, fx + fw / 2, fy + fh * 0.45, 28, 28, '#e6b08a'); path(c, (k) => { k.moveTo(fx, fy + fh); k.lineTo(fx + fw * 0.4, fy + fh * 0.55); k.lineTo(fx + fw, fy + fh); k.closePath(); }, '#8fa584'); } else { path(c, (k) => { k.moveTo(fx, fy + fh); k.lineTo(fx + fw * 0.3, fy + fh * 0.4); k.lineTo(fx + fw * 0.6, fy + fh * 0.75); k.lineTo(fx + fw * 0.8, fy + fh * 0.5); k.lineTo(fx + fw, fy + fh); k.closePath(); }, '#7f9a94'); ell(c, fx + fw * 0.7, fy + fh * 0.28, 16, 16, '#f2d9a0'); }
    c.restore();
  }
  rr(c, 1590, 440, 310, 20, 8, lg(c, 0, 440, 0, 460, [[0, '#d2b083'], [1, '#a98660']]));
  for (const [px, col] of [[1640, '#d8c7a8'], [1760, '#c9a08a'], [1850, '#d8c7a8']]) { for (const [a, l] of [[-0.7, 44], [0.1, 58], [0.8, 46]]) leaf(c, px, 405, l, l * 0.38, a, '#7f9d6f'); pot(c, px, 440, 56, 42, col); }
  // Lichterkette quer über die Wand (die Lämpchen flackern im Live-Teil)
  c.strokeStyle = alpha('#4a3a30', 0.6); c.lineWidth = 3; c.beginPath();
  const lampY = (x) => 34 + Math.sin(((x % 480) / 480) * Math.PI) * 42;
  for (let x = 0; x <= W; x += 20) (x ? c.lineTo(x, lampY(x)) : c.moveTo(x, lampY(x)));
  c.stroke();
  for (let i = 0, x = 36; x < W; i += 1, x += 64) meta.lights.push([x, lampY(x) + 12, i]);
}

// ---------------------------------------------------------------- Fenster: Rahmen, Vorhänge, Sims
function fxRahmen(c) {
  const wn = FW, wood = '#5b4332', hi = alpha('#c9a77c', 0.45);
  c.strokeStyle = wood; c.lineWidth = 26; c.strokeRect(wn.x - 13, wn.y - 13, wn.w + 26, wn.h + 26);
  c.strokeStyle = hi; c.lineWidth = 3; c.strokeRect(wn.x - 3, wn.y - 3, wn.w + 6, wn.h + 6);
  for (const x of [wn.x + wn.w / 3, wn.x + (wn.w * 2) / 3]) { rr(c, x - 8, wn.y, 16, wn.h, 3, lg(c, x - 8, 0, x + 8, 0, [[0, '#6b5240'], [1, '#4c3a2b']])); c.fillStyle = hi; c.fillRect(x - 6, wn.y, 2, wn.h); }
  rr(c, wn.x, wn.y + wn.h * 0.6 - 7, wn.w, 14, 3, lg(c, 0, wn.y + wn.h * 0.6 - 7, 0, wn.y + wn.h * 0.6 + 7, [[0, '#6b5240'], [1, '#4c3a2b']]));
  rr(c, wn.x + wn.w / 3 + 18, wn.y + wn.h * 0.5, 8, 44, 4, '#c9a46b');
  // matte Spiegelung auf dem Glas
  c.fillStyle = alpha('#ffffff', 0.05);
  for (const x of [wn.x + 120, wn.x + 560, wn.x + 880]) { c.beginPath(); c.moveTo(x, wn.y); c.lineTo(x + 70, wn.y); c.lineTo(x - 90, wn.y + wn.h); c.lineTo(x - 160, wn.y + wn.h); c.closePath(); c.fill(); }
  // Sims
  rr(c, wn.x - 44, wn.y + wn.h + 6, wn.w + 88, 30, 9, lg(c, 0, wn.y + wn.h + 6, 0, wn.y + wn.h + 36, [[0, '#d5b78a'], [1, '#a98660']]), alpha('#2b2118', 0.3), 2);
  c.fillStyle = alpha('#fff6e0', 0.3); c.fillRect(wn.x - 36, wn.y + wn.h + 9, wn.w + 72, 3);
}

function fxVorhang(c, x, side) {
  const wn = FW, w = 112, top = wn.y - 44, h = wn.h + 74;
  path(c, (k) => { k.moveTo(x, top); k.lineTo(x + side * w, top); k.bezierCurveTo(x + side * (w - 6), top + h * 0.45, x + side * w * 0.45, top + h * 0.62, x + side * w * 0.55, top + h * 0.7); k.bezierCurveTo(x + side * w * 0.5, top + h * 0.85, x + side * w * 0.8, top + h * 0.95, x + side * w * 0.7, top + h); k.lineTo(x, top + h); k.closePath(); }, lg(c, x, 0, x + side * w, 0, [[0, '#c4b290'], [0.5, '#d8c9a8'], [1, '#bba883']]), alpha('#6a5a3a', 0.35), 2);
  c.strokeStyle = alpha('#7d6a48', 0.3); c.lineWidth = 3;
  for (let i = 1; i < 5; i += 1) { c.beginPath(); c.moveTo(x + side * ((w * i) / 5), top + 6); c.quadraticCurveTo(x + side * ((w * i) / 5 + 6), top + h * 0.5, x + side * ((w * i) / 5 - 3), top + h * 0.7); c.stroke(); }
  rr(c, x + side * w * 0.2 - 14, top + h * 0.57, 28, 12, 6, '#a98660');
}
function fxStange(c) { const wn = FW; rr(c, wn.x - 150, wn.y - 56, wn.w + 300, 10, 5, lg(c, 0, wn.y - 56, 0, wn.y - 46, [[0, '#8a6a4a'], [1, '#5f4630']])); for (const x of [wn.x - 150, wn.x + wn.w + 150]) ell(c, x, wn.y - 51, 11, 11, '#c9a46b', alpha('#2b2118', 0.3), 1.5); }

// Pflanze auf dem Sims: wächst mit dem Fortschritt (mehr Blätter, am Ende Blüten)
function fxWachsPflanze(c, x, y, p) {
  pot(c, x, y, 70, 52, '#c58f70');
  const by = y - 50, n = Math.round(2 + p * 12);
  c.strokeStyle = '#6a8a5c'; c.lineWidth = 5; c.lineCap = 'round';
  const h = 40 + 130 * smooth(p);
  c.beginPath(); c.moveTo(x, by); c.quadraticCurveTo(x - 24, by - h * 0.55, x + 10, by - h); c.stroke();
  for (let i = 0; i < n; i += 1) { const t = (i + 1) / (n + 1), lx = x - 24 * 2 * t * (1 - t) * 1.6 + 10 * t * t, ly = by - h * t, side = i % 2 ? 1 : -1; leaf(c, lx, ly, 34 + 20 * (1 - t), 14, side * (1.0 + 0.15 * (i % 3)), i % 3 ? '#6f8f62' : '#82ac66'); }
  if (p > 0.95) for (const [dx, dy] of [[10, -h - 6], [-16, -h * 0.7]]) { for (let k = 0; k < 6; k += 1) ell(c, x + dx + Math.cos(k * 1.05) * 7, by + dy + Math.sin(k * 1.05) * 7, 6, 3.2, '#f2cfd4', null, 0, k * 1.05); ell(c, x + dx, by + dy, 3.4, 3.4, '#e9c867'); }
}
function fxSimsDeko(c, o) {
  const y = FW.y + FW.h + 8;
  pot(c, 470, y, 58, 44, '#d8c7a8'); for (const [a, l] of [[-0.6, 42], [0.1, 54], [0.8, 44]]) leaf(c, 470, y - 42, l, l * 0.38, a, '#7f9d6f');
  fxWachsPflanze(c, 1330, y, o.p);
  // kleine Laterne
  rr(c, 1440, y - 44, 26, 44, 6, '#6c5a45'); rr(c, 1445, y - 40, 16, 30, 4, '#ffe8b0');
}

// ---------------------------------------------------------------- Möbel
function fxTasse(c, x, y) {
  ell(c, x, y + 1, 36, 8, '#efe6d2', alpha('#2b2118', 0.3), 1.6);
  path(c, (k) => { k.moveTo(x - 24, y - 36); k.lineTo(x + 24, y - 36); k.lineTo(x + 20, y - 4); k.quadraticCurveTo(x, y + 6, x - 20, y - 4); k.closePath(); }, lg(c, x - 24, 0, x + 24, 0, [[0, '#f8f1e4'], [1, '#e2d6bf']]), alpha('#2b2118', 0.3), 1.8);
  c.strokeStyle = '#e9dfca'; c.lineWidth = 5; c.beginPath(); c.arc(x + 26, y - 20, 11, -1.2, 1.2); c.stroke();
  ell(c, x, y - 36, 24, 6, '#b07a42', alpha('#2b2118', 0.25), 1.4);
}
function fxBuchStapel(c, x, y, n = 3) { const cols = ['#a8786b', '#7f98a6', '#c9b27a', '#8fa584']; for (let i = 0; i < n; i += 1) { const w = 120 - i * 10, h = 22; rr(c, x - w / 2 + (i % 2) * 6, y - (i + 1) * h, w, h, 5, lg(c, 0, y - (i + 1) * h, 0, y - i * h, [[0, shade(cols[i], 0.1)], [1, shade(cols[i], -0.1)]]), alpha('#2b2118', 0.3), 2); rr(c, x - w / 2 + 12 + (i % 2) * 6, y - (i + 1) * h + 6, w - 28, 4, 2, alpha('#fff6e0', 0.45)); } }

function fxKaro(c, x, y, w, h, base, line) {
  rr(c, x, y, w, h, 18, base, alpha('#2b2118', 0.28), 2);
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.strokeStyle = alpha(line, 0.7); c.lineWidth = 7;
  for (let i = 1; i < 5; i += 1) { c.beginPath(); c.moveTo(x + (w * i) / 5, y); c.lineTo(x + (w * i) / 5, y + h); c.stroke(); c.beginPath(); c.moveTo(x, y + (h * i) / 5); c.lineTo(x + w, y + (h * i) / 5); c.stroke(); }
  c.restore();
}
function fxStrickDecke(c, x, y, w, h, rot) {
  c.save(); c.translate(x, y); c.rotate(rot);
  rr(c, -w / 2, 0, w, h, 14, lg(c, 0, 0, 0, h, [[0, '#f1e6d0'], [1, '#d8c8a8']]), alpha('#7a6a4a', 0.4), 2);
  c.strokeStyle = alpha('#9a8660', 0.45); c.lineWidth = 2.4;
  for (let i = 0; i < 5; i += 1) { const px = -w / 2 + 22 + (i * (w - 44)) / 4; c.beginPath(); for (let yy = 8; yy < h - 8; yy += 6) c.lineTo(px + Math.sin(yy / 5 + i) * 4, yy); c.stroke(); }
  for (let i = 0; i < 9; i += 1) { const px = -w / 2 + 10 + (i * (w - 20)) / 8; c.beginPath(); c.moveTo(px, h); c.lineTo(px + 2, h + 22); c.stroke(); }
  c.restore();
}

function fxLese(c, meta) {
  const x = 730, y = 1010;
  ell(c, x, y - 4, 300, 36, alpha('#2b2118', 0.2));
  for (const dx of [-140, 140]) rr(c, x + dx - 10, y - 56, 20, 58, 7, '#6a4c34');
  const fab = (x0, w) => lg(c, x0, 0, x0 + w, 0, [[0, '#cfa088'], [0.5, '#c4937a'], [1, '#b2806a']]);
  rr(c, x - 160, y - 410, 320, 350, 90, fab(x - 160, 320), alpha('#5a3a2a', 0.4), 3);
  rr(c, x - 124, y - 372, 248, 250, 70, alpha('#ffffff', 0.08));
  rr(c, x - 218, y - 270, 96, 220, 46, fab(x - 218, 96), alpha('#5a3a2a', 0.4), 3);
  rr(c, x + 122, y - 270, 96, 220, 46, fab(x + 122, 96), alpha('#5a3a2a', 0.4), 3);
  rr(c, x - 150, y - 190, 300, 130, 44, lg(c, 0, y - 190, 0, y - 60, [[0, '#d3a690'], [1, '#b98570']]), alpha('#5a3a2a', 0.4), 3);
  rr(c, x - 124, y - 206, 248, 60, 30, '#dab4a0', alpha('#5a3a2a', 0.3), 2);
  fxKaro(c, x + 14, y - 330, 120, 112, '#d9c4a0', '#b95f4a');
  fxStrickDecke(c, x - 172, y - 292, 120, 190, 0.06);
  // Beistelltisch
  const tx = 1250, ty = 870;
  rr(c, tx - 7, ty, 14, 130, 5, '#6a4c34'); ell(c, tx, ty + 134, 62, 12, '#6a4c34');
  ell(c, tx, ty + 8, 108, 20, alpha('#2b2118', 0.18)); ell(c, tx, ty, 104, 19, lg(c, 0, ty - 19, 0, ty + 19, [[0, '#d9b98c'], [1, '#b08e62']]), alpha('#2b2118', 0.3), 2);
  fxTasse(c, tx - 36, ty - 2); fxBuchStapel(c, tx + 40, ty - 2, 3);
  pot(c, tx + 40, ty - 68, 34, 26, '#d8c7a8'); for (const [a, l] of [[-0.6, 28], [0.1, 34], [0.8, 28]]) leaf(c, tx + 40, ty - 90, l, l * 0.38, a, '#7f9d6f');
  meta.cup = [tx - 36, ty - 40];
  // Stehlampe
  const lx = 1030;
  ell(c, lx, y - 2, 60, 10, alpha('#2b2118', 0.2)); rr(c, lx - 4, y - 470, 8, 468, 4, '#6a5a45'); ell(c, lx, y - 4, 40, 8, '#4a3a30');
  path(c, (k) => { k.moveTo(lx - 32, y - 470); k.lineTo(lx + 32, y - 470); k.lineTo(lx + 62, y - 560); k.lineTo(lx - 62, y - 560); k.closePath(); }, lg(c, lx - 60, 0, lx + 60, 0, [[0, '#f3e2b4'], [0.5, '#ffeec2'], [1, '#e6cf98']]), alpha('#6a5a45', 0.5), 2.5);
  meta.lamps.push({ x: lx, y: y - 500, r: 520, base: 1 });
  // Pflanzen am Boden
  monstera(c, 190, 1010, 0.95, 3); fern(c, 1470, 1000, 0.95, 5); snakePlant(c, 1700, 1000, 1.0, 4);
  // Zimmerpflanze hinten
  pot(c, 1620, FLOOR - 4, 80, 60, '#c9a08a');
}

function fxArbeit(c, meta) {
  const dy = 800, x0 = 520, x1 = 1420;
  // Beine und Tischplatte
  for (const x of [x0 + 24, x1 - 24]) rr(c, x - 12, dy + 20, 24, 200, 6, lg(c, x - 12, 0, x + 12, 0, [[0, '#9a7650'], [1, '#6d5238']]), alpha('#2b2118', 0.3), 2);
  ell(c, (x0 + x1) / 2, 1012, 520, 22, alpha('#2b2118', 0.18));
  rr(c, x0 + 20, dy + 14, x1 - x0 - 40, 30, 8, '#8a6a46', alpha('#2b2118', 0.25), 2);
  rr(c, x0, dy - 8, x1 - x0, 28, 10, lg(c, 0, dy - 8, 0, dy + 20, [[0, '#d9b98c'], [1, '#b8946a']]), alpha('#2b2118', 0.3), 2.4);
  c.fillStyle = alpha('#fff6e0', 0.35); c.fillRect(x0 + 14, dy - 5, x1 - x0 - 28, 3);
  const top = dy - 8;
  // Laptop (Rückseite des Deckels) mit leuchtendem Zeichen
  rr(c, 760, top - 168, 270, 170, 14, lg(c, 0, top - 168, 0, top, [[0, '#b8bcc2'], [1, '#8f949c']]), alpha('#2b2118', 0.4), 3);
  rr(c, 770, top - 158, 250, 6, 3, alpha('#ffffff', 0.45)); ell(c, 895, top - 86, 15, 15, '#f4f0e4'); glow(c, 895, top - 86, 60, '#fff2c4', 0.28);
  rr(c, 748, top - 6, 294, 12, 6, '#7a7f86', alpha('#2b2118', 0.35), 2);
  // aufgeschlagenes Notizbuch und Stift
  path(c, (k) => { k.moveTo(572, top - 2); k.lineTo(700, top - 2); k.lineTo(690, top - 26); k.lineTo(588, top - 26); k.closePath(); }, '#f6efdc', alpha('#2b2118', 0.4), 2);
  c.strokeStyle = alpha('#7a6a4a', 0.5); c.lineWidth = 1.6; for (let i = 0; i < 4; i += 1) { c.beginPath(); c.moveTo(596 + i * 2, top - 8 - i * 4.4); c.lineTo(636 - i * 2, top - 8 - i * 4.4); c.moveTo(650 + i * 2, top - 8 - i * 4.4); c.lineTo(684 - i * 2, top - 8 - i * 4.4); c.stroke(); }
  rr(c, 706, top - 8, 60, 6, 3, '#b95f4a');
  // Tasse, Schreibtischlampe, Pflänzchen
  fxTasse(c, 1130, top); meta.cup = [1130, top - 38];
  const lx = 1270;
  ell(c, lx, top, 46, 9, '#4a3a30'); c.strokeStyle = '#6a5a45'; c.lineWidth = 9; c.lineCap = 'round'; c.beginPath(); c.moveTo(lx, top); c.lineTo(lx - 40, top - 140); c.lineTo(lx - 130, top - 200); c.stroke();
  path(c, (k) => { k.moveTo(lx - 148, top - 218); k.lineTo(lx - 100, top - 186); k.lineTo(lx - 126, top - 150); k.lineTo(lx - 190, top - 186); k.closePath(); }, lg(c, lx - 190, 0, lx - 100, 0, [[0, '#d98c5a'], [1, '#b8693a']]), alpha('#2b2118', 0.35), 2);
  meta.lamps.push({ x: lx - 120, y: top - 150, r: 480, base: 1 });
  pot(c, 1350, top, 44, 34, '#d8c7a8'); for (const [a, l] of [[-0.6, 32], [0.1, 40], [0.8, 32]]) leaf(c, 1350, top - 32, l, l * 0.38, a, '#7f9d6f');
  pot(c, 640, top - 30, 30, 24, '#c58f70');
  // Stuhl von hinten, mit Decke und Kissen
  const sx = 830, sy = 1030;
  for (const dx of [-70, 70]) rr(c, sx + dx - 7, sy - 80, 14, 84, 5, '#6a4c34');
  rr(c, sx - 110, sy - 300, 220, 230, 60, lg(c, sx - 110, 0, sx + 110, 0, [[0, '#cfa088'], [0.5, '#c4937a'], [1, '#b2806a']]), alpha('#5a3a2a', 0.4), 3);
  rr(c, sx - 84, sy - 274, 168, 160, 44, alpha('#ffffff', 0.08));
  fxStrickDecke(c, sx + 22, sy - 300, 150, 150, -0.05);
  // Pflanzen
  monstera(c, 190, 1010, 0.95, 3); fern(c, 1490, 1000, 0.95, 5); snakePlant(c, 1690, 1000, 1.0, 4);
}

// ---------------------------------------------------------------- Licht und Stimmung
function fxTint(c, zeit, wetter, atop) {
  const layers = [];
  if (zeit === 'morgen') layers.push(['#ffb79a', 0.15]);
  if (zeit === 'abend') layers.push(['#1c2150', 0.5]);
  if (wetter === 'regen' && zeit !== 'abend') layers.push(['#566a82', 0.16]);
  if (wetter === 'schnee' && zeit !== 'abend') layers.push(['#c9dcec', 0.08]);
  c.save(); if (atop) c.globalCompositeOperation = 'source-atop';
  for (const [col, a] of layers) { c.fillStyle = alpha(col, a); c.fillRect(0, 0, W, H); }
  c.restore();
}
const lampStrength = (zeit, wetter) => (zeit === 'abend' ? 1 : zeit === 'morgen' ? 0.45 : wetter === 'regen' ? 0.4 : 0.14);

function fxLicht(c, o, meta) {
  const k = lampStrength(o.zeit, o.wetter);
  for (const l of meta.lamps) { glow(c, l.x, l.y, l.r * 0.8, '#ffd9a0', 0.5 * k); glow(c, l.x, l.y + 30, l.r * 0.35, '#fff0c4', 0.3 * k); }
  // Fensterlicht auf dem Boden
  if (o.zeit !== 'abend' && o.wetter !== 'regen') {
    c.fillStyle = alpha(o.zeit === 'morgen' ? '#ffd2a8' : '#fff4d0', o.zeit === 'morgen' ? 0.14 : 0.12);
    for (const x of [FW.x + 60, FW.x + 450, FW.x + 780]) { c.beginPath(); c.moveTo(x, FLOOR + 20); c.lineTo(x + 330, FLOOR + 20); c.lineTo(x + 330 - 230, H); c.lineTo(x - 230, H); c.closePath(); c.fill(); }
  } else if (o.zeit === 'abend' && o.wetter !== 'regen') glow(c, FW.x + FW.w * 0.76, FLOOR + 80, 480, '#b9c8ee', 0.1);
  glow(c, FW.x + FW.w / 2, FW.y + FW.h, 560, o.zeit === 'abend' ? '#8fa0d8' : '#fff4d0', o.zeit === 'abend' ? 0.05 : 0.12);
}

// ---------------------------------------------------------------- Die Szene
export class Fenster {
  constructor() {
    this.cache = fxCanvas(); this.key = ''; this.meta = { towers: [], lamps: [], lights: [], cup: null };
    const r = rng(2024);
    this.rain = Array.from({ length: 180 }, () => ({ x: r() * FW.w * 1.3, y: r() * (FW.h + 80), v: 700 + r() * 500, l: 14 + r() * 14 }));
    this.snow = Array.from({ length: 170 }, () => ({ x: r() * FW.w, y: r() * FW.h, v: 40 + r() * 60, s: 1.4 + r() * 2.4, ph: r() * 6 }));
    this.pane = Array.from({ length: 16 }, () => ({ x: FW.x + 20 + r() * (FW.w - 40), y0: r() * FW.h, v: 6 + r() * 14, l: 14 + r() * 40 }));
    this.rings = Array.from({ length: 16 }, () => ({ x: FW.x + 80 + r() * (FW.w - 160), y: FW.y + FW.h * 0.55 + r() * FW.h * 0.38, ph: r() }));
    this.flies = Array.from({ length: 14 }, () => ({ x: FW.x + r() * FW.w, y: FW.y + FW.h * 0.45 + r() * FW.h * 0.5, ph: r() * 6 }));
  }

  options(view) {
    const f = view.fenster ?? {};
    return {
      ort: f.ort === 'arbeit' ? 'arbeit' : 'lese',
      blick: ['stadt', 'landschaft', 'wald', 'see'].includes(f.blick) ? f.blick : 'stadt',
      wetter: ['klar', 'regen', 'schnee'].includes(f.wetter) ? f.wetter : 'klar',
      season: PAL[view.jahreszeit] ? view.jahreszeit : 'fruehling',
      zeit: SKY[view.tageszeit] ? view.tageszeit : 'mittag',
      p: Math.round(clamp01(view.progress ?? 0) * 12) / 12,
    };
  }

  compose(o) {
    const meta = { towers: [], lamps: [], lights: [], cup: null }; this.meta = meta;
    const c = this.cache.getContext('2d'); c.clearRect(0, 0, W, H);
    fxWand(c, o, meta);
    fxTint(c, o.zeit, o.wetter, false);
    // Ausblick
    c.save(); fxClip(c);
    if (o.blick === 'stadt') { fxSky(c, o.season, o.zeit, o.wetter); fxStadt(c, o.season, o.zeit, o.wetter, meta); }
    else if (o.blick === 'landschaft') fxLandschaft(c, o.season, o.zeit, o.wetter);
    else if (o.blick === 'wald') fxWald(c, o.season, o.zeit, o.wetter);
    else fxSee(c, o.season, o.zeit, o.wetter);
    fxVeil(c, o.zeit, o.wetter);
    c.restore();
    // Vordergrund: Rahmen, Vorhänge, Möbel (eigene Ebene, damit die Abenddämmerung nur sie färbt)
    const fg = fxCanvas(), g = fg.getContext('2d');
    fxRahmen(g); fxStange(g); fxVorhang(g, FW.x - 30, -1); fxVorhang(g, FW.x + FW.w + 30, 1); fxSimsDeko(g, o);
    if (o.ort === 'lese') fxLese(g, meta); else fxArbeit(g, meta);
    fxTint(g, o.zeit, o.wetter, true);
    c.drawImage(fg, 0, 0);
    fxLicht(c, o, meta);
  }

  // Ruhender Teil (Zimmer, Ausblick, Licht, Vignette) in this.cache; gibt einen Schlüssel zurück, der sich bei Änderungen ändert.
  vorbereiten(view, finish = null) {
    const o = this.options(view);
    const key = `${o.ort}|${o.blick}|${o.wetter}|${o.season}|${o.zeit}|${o.p}`;
    if (key !== this.key) { this.key = key; this.compose(o); if (finish) this.cache.getContext('2d').drawImage(finish, 0, 0); } // Vignette und Körnung gleich mit einbacken
    this.aktuell = o;
    return key;
  }

  // Nur das, was sich bewegt (Wetter, Lichterkette, Dampf, Katze, Vögel)
  animiere(c, t) { this.live(c, this.aktuell, t); }

  live(c, o, t) {
    const { meta } = this, k = lampStrength(o.zeit, o.wetter);
    c.save(); fxClip(c);
    // Ausblick: Wetter und Bewegung
    if (o.blick === 'stadt' && o.zeit !== 'mittag') for (const [x, y] of meta.towers) { const a = 0.35 + 0.65 * Math.max(0, Math.sin(t / 700 + x)); glow(c, x, y, 18, '#ff5a4a', 0.7 * a); ell(c, x, y, 3.2, 3.2, alpha('#ff7060', 0.5 + 0.5 * a)); }
    if (o.blick === 'wald' && o.zeit === 'abend' && o.season !== 'winter' && o.wetter !== 'regen') for (const f of this.flies) { const x = f.x + Math.sin(t / 1900 + f.ph) * 40, y = f.y + Math.cos(t / 1500 + f.ph) * 26, a = Math.max(0.1, 0.5 + 0.5 * Math.sin(t / 600 + f.ph)); glow(c, x, y, 20, '#f6f0a0', a * 0.8); ell(c, x, y, 2, 2, alpha('#fffbd0', Math.max(0.3, a))); }
    if (o.blick === 'wald' && o.zeit !== 'abend' && o.wetter === 'klar') for (const f of this.flies) { const x = f.x + Math.sin(t / 2600 + f.ph) * 30, y = ((f.y - t / 60 * (0.4 + (f.ph % 1) * 0.4)) % (FW.h * 0.8)) + FW.y + FW.h * 0.2; glow(c, x, y < FW.y ? y + FW.h : y, 9, '#fff3c8', 0.55); }
    if (o.blick === 'see' && o.wetter === 'regen') for (const rg2 of this.rings) { const q = (t / 1600 + rg2.ph) % 1; c.strokeStyle = alpha('#ffffff', 0.5 * (1 - q)); c.lineWidth = 1.6; c.beginPath(); c.ellipse(rg2.x, rg2.y, 3 + q * 28, (3 + q * 28) * 0.28, 0, 0, TAU); c.stroke(); }
    if (o.blick !== 'wald' && o.wetter === 'klar' && o.zeit !== 'abend') for (let i = 0; i < 3; i += 1) { const x = FW.x + ((t / 26 + i * 420) % (FW.w + 200)) - 100, y = FW.y + 90 + i * 46 + Math.sin(t / 420 + i) * 10, fl = Math.sin(t / 110 + i * 2) * 8; c.strokeStyle = alpha('#4f4a58', 0.8); c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - 14, y + fl); c.quadraticCurveTo(x - 7, y - 5, x, y); c.quadraticCurveTo(x + 7, y - 5, x + 14, y + fl); c.stroke(); }
    if (o.wetter === 'regen') {
      c.strokeStyle = alpha('#e6eef6', o.zeit === 'abend' ? 0.32 : 0.5); c.lineWidth = 1.5; c.lineCap = 'round'; c.beginPath();
      for (const d of this.rain) { const y = (d.y + (t / 1000) * d.v) % (FW.h + 80) - 40, x = FW.x + ((d.x - y * 0.18 + FW.w * 4) % (FW.w + 80)); c.moveTo(x, FW.y + y); c.lineTo(x - 4, FW.y + y + d.l); }
      c.stroke();
    }
    if (o.wetter === 'schnee') for (const f of this.snow) { const y = (f.y + (t / 1000) * f.v) % (FW.h + 20) - 10, x = FW.x + ((f.x + Math.sin(t / 1100 + f.ph) * 22 + FW.w * 2) % (FW.w + 10)); ell(c, x, FW.y + y, f.s, f.s, alpha('#ffffff', 0.88)); }
    c.restore();
    // Tropfen am Glas
    if (o.wetter === 'regen') for (const d of this.pane) { const y = FW.y + ((d.y0 + (t / 1000) * d.v) % (FW.h - 20)) + 10; c.strokeStyle = alpha('#ffffff', 0.16); c.lineWidth = 2.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(d.x, y - d.l); c.lineTo(d.x, y); c.stroke(); ell(c, d.x, y + 1, 3, 4.4, alpha('#ffffff', 0.3)); }
    // Zimmer: Lichterkette, Lampenflackern, Dampf, Katze
    const lk = o.zeit === 'abend' ? 1 : o.zeit === 'morgen' ? 0.5 : 0.18, cols = ['#ffd890', '#f2b9a6', '#bfe0e6', '#d6e8b4'];
    for (const [x, y, i] of meta.lights) { const on = Math.floor(t / 600 + i * 1.7) % 5 !== 0; ell(c, x, y + 6, 6.4, 9, on ? cols[i % 4] : '#8c7d68'); if (on) glow(c, x, y + 6, 38, cols[i % 4], 0.5 * lk); }
    for (const l of meta.lamps) glow(c, l.x, l.y, l.r * 0.42, '#ffd9a0', k * (0.1 + 0.04 * Math.sin(t / 380) + 0.02 * Math.sin(t / 170)));
    if (meta.cup) { const [x, y] = meta.cup; c.strokeStyle = alpha('#ffffff', 0.4); c.lineWidth = 3.4; c.lineCap = 'round'; for (let i = 0; i < 2; i += 1) { const ph = t / 700 + i * 2; c.beginPath(); c.moveTo(x - 6 + i * 12, y); c.bezierCurveTo(x - 6 + i * 12 + Math.sin(ph) * 10, y - 22, x - 6 + i * 12 - Math.sin(ph) * 10, y - 44, x - 6 + i * 12 + Math.sin(ph + 1) * 8, y - 66 - i * 8); c.stroke(); } }
    if (o.ort === 'lese') this.katze(c, 1130, 992, t, o.zeit);
    // Staubflöckchen im Licht
    if (o.zeit !== 'abend' && o.wetter === 'klar') for (let i = 0; i < 18; i += 1) { const x = FW.x + 140 + ((i * 197 + t / 40) % 900), y = FW.y + FW.h * 0.35 + ((i * 83) % 420) + Math.sin(t / 1400 + i) * 22; glow(c, x, y, 7, '#fff4cf', 0.4 + 0.25 * Math.sin(t / 700 + i)); }
  }

  katze(c, x, y, t, zeit) {
    const br = Math.sin(t / 900) * 2.4, dk = zeit === 'abend' ? -0.3 : 0;
    ell(c, x, y + 6, 70, 14, alpha('#2b2118', 0.2));
    ell(c, x, y - 14 - br * 0.5, 58, 32 + br, lg(c, 0, y - 48, 0, y + 12, [[0, shade('#d9a86a', dk)], [1, shade('#b98450', dk)]]), alpha('#2b2118', 0.3), 2.5);
    c.strokeStyle = alpha('#7a5230', 0.55); c.lineWidth = 4; for (let i = -2; i <= 2; i += 1) { c.beginPath(); c.moveTo(x + i * 16, y - 40 - br); c.quadraticCurveTo(x + i * 16 + 6, y - 26, x + i * 16 + 2, y - 12); c.stroke(); }
    ell(c, x - 42, y - 18, 25, 22, shade('#d9a86a', dk), alpha('#2b2118', 0.3), 2.5);
    for (const sd of [-1, 1]) path(c, (k) => { k.moveTo(x - 42 + sd * 9, y - 34); k.lineTo(x - 42 + sd * 18, y - 49); k.lineTo(x - 42 + sd * 20, y - 30); k.closePath(); }, shade('#d9a86a', dk), alpha('#2b2118', 0.3), 2);
    c.strokeStyle = '#3b2d2a'; c.lineWidth = 2.6; for (const sd of [-1, 1]) { c.beginPath(); c.arc(x - 42 + sd * 8, y - 20, 4, Math.PI * 0.15, Math.PI * 0.85); c.stroke(); }
    c.strokeStyle = shade('#b98450', dk); c.lineWidth = 11; c.lineCap = 'round'; c.beginPath(); c.moveTo(x + 52, y - 6); c.quadraticCurveTo(x + 86, y - 10 + Math.sin(t / 800) * 4, x + 72, y - 34); c.stroke();
    if (Math.floor(t / 2000) % 3 === 0) { c.fillStyle = alpha('#fff', 0.75); c.font = '600 22px Fredoka, sans-serif'; c.fillText('z', x - 14, y - 58 - (t % 2000) / 90); c.fillText('z', x + 4, y - 76 - (t % 2000) / 90); }
  }
}
