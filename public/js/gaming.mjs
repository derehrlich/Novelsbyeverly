// Gaming-Szene: Rahmen für das Spiel (16:9) und bis zu vier quadratische Kamerafenster in den Ecken, Koordinaten im 1920×1080-Bild.
// In OBS liegen Spiel (unten) und Kamera (darüber) UNTER diesem Overlay; die Fenster werden durchsichtig ausgeschnitten.
import { alpha, leaf, lg, rg, rr } from './malerei.mjs';

export const RAHMEN = 14; // Dicke des Holzrahmens (bewusst dünn)
export const KAMERA = 340; // Seitenlänge des Kamerabilds (1:1)
export const UEBER = 40; // so weit ragt das Kamerafenster (Standard) in das Spielfenster hinein
const RAND_X = 60, RAND_Y = 58; // Rand um das Spielfenster ohne Kamera
const ABSTAND = 44; // Abstand zwischen Bildrand und Kamerabild (der Holzrahmen liegt darin, 30 px bis zum Rahmen)
export const DESIGNS = ['gemuetlich', 'glas'];
export const ECKEN = ['oben-links', 'oben-rechts', 'unten-links', 'unten-rechts'];
export const TODE_POS = ['oben-links', 'oben-mitte', 'oben-rechts', 'unten-links', 'unten-mitte', 'unten-rechts'];

export function kameraRect(ecke, size = KAMERA) {
  const links = ecke.endsWith('links'), oben = ecke.startsWith('oben');
  return { x: links ? ABSTAND : 1920 - ABSTAND - size, y: oben ? ABSTAND : 1080 - ABSTAND - size, w: size, h: size };
}

// Das Spielfenster (immer 16:9) macht den Kameras Platz: Sitzt links bzw. rechts eine Kamera, rückt die Spielkante so weit zur Mitte,
// dass die Kamera es nur um `ueber` Pixel überlappt. Ohne Kamera füllt es das Bild bis auf einen schmalen Rand.
export function spielRect(ecken = [], size = KAMERA, ueber = UEBER) {
  const u = Math.max(0, Math.min(ueber, size));
  const l = ecken.some((e) => e.endsWith('links')), r = ecken.some((e) => e.endsWith('rechts'));
  const links = l ? ABSTAND + size - u : RAND_X;
  const rechts = r ? 1920 - ABSTAND - size + u : 1920 - RAND_X;
  const maxW = Math.min(rechts - links, Math.floor(((1080 - 2 * RAND_Y) * 16) / 9));
  const w = Math.max(320, Math.floor(maxW / 16) * 16), h = (w * 9) / 16; // Vielfaches von 16, damit 16:9 exakt aufgeht
  const x = r && !l ? rechts - w : l && !r ? links : links + Math.floor((rechts - links - w) / 2);
  return { x, y: Math.floor((1080 - h) / 2), w, h };
}

// Liest "oben-rechts,unten-links" oder "aus" (Adressparameter). Ohne Angabe: oben-rechts.
export function parseEcken(text) {
  if (text == null) return ['oben-rechts'];
  return [...new Set(text.split(',').map((s) => s.trim()).filter((s) => ECKEN.includes(s)))];
}

// Ein dünner Holzrahmen mit weicher Innenkante und ein paar Blättern.
function holzrahmen(c, { x, y, w, h }, r, blaetter) {
  const d = RAHMEN;
  rr(c, x - d + 2, y - d + 6, w + 2 * d - 4, h + 2 * d - 4, r + d, alpha('#2b2118', 0.22)); // Schatten
  rr(c, x - d, y - d, w + 2 * d, h + 2 * d, r + d, lg(c, x, y - d, x, y + h + d, [[0, '#dcc399'], [1, '#a88660']]), alpha('#2b2118', 0.32), 2);
  rr(c, x - d + 4, y - d + 4, w + 2 * d - 8, h + 2 * d - 8, r + d - 4, null, alpha('#fff6e0', 0.38), 2); // helle Kante
  rr(c, x - 3, y - 3, w + 6, h + 6, r + 3, null, alpha('#2b2118', 0.28), 3); // Innenschatten
  for (const [lx, ly, a, len] of blaetter) leaf(c, x + lx * w, y + ly * h, len, len * 0.36, a, '#7f9d6f');
}

const BLAETTER_KAMERA = { links: [[0, 0.5, -1.2, 40], [0.2, 1, 3.9, 34]], rechts: [[1, 0.5, 2.2, 40], [0.8, 1, 3.9, 34]] };

// ---- Design „Glas“ (angelehnt an Apples Liquid Glass): ruhiger Farbverlauf, durchscheinende Rahmen mit feiner Lichtkante
export const RADIUS = { gemuetlich: { spiel: 10, kamera: 18 }, glas: { spiel: 24, kamera: 40 } };
const GLAS_D = 10; // Dicke des Glasrahmens
const PALETTEN = { // je Tageszeit: Grundverlauf oben/unten und drei weiche Lichtflecken
  morgen: { top: '#a99bb8', bot: '#5f7399', flecken: ['#f0cbc0', '#c9b1d6', '#86a3cb'] },
  mittag: { top: '#8498b2', bot: '#4b5e77', flecken: ['#c9d8ec', '#8fa7c8', '#5d7594'] },
  abend: { top: '#3d4170', bot: '#1b2040', flecken: ['#7b60aa', '#3f5ca3', '#c47b90'] },
};
export function glasHintergrund(c, tageszeit, t = 0) {
  const p = PALETTEN[tageszeit] ?? PALETTEN.mittag;
  c.fillStyle = lg(c, 0, 0, 0, 1080, [[0, p.top], [1, p.bot]]); c.fillRect(0, 0, 1920, 1080);
  p.flecken.forEach((col, i) => { // langsam wandernde, weiche Flecken
    const x = 480 + i * 480 + Math.sin(t / 9000 + i * 2.1) * 220, y = 300 + (i % 2) * 460 + Math.cos(t / 11000 + i) * 130;
    c.fillStyle = rg(c, x, y, 0, 620, [[0, alpha(col, 0.55)], [1, alpha(col, 0)]]); c.fillRect(0, 0, 1920, 1080);
  });
}
function glasrahmen(c, { x, y, w, h }, r) {
  const d = GLAS_D, X = x - d, Y = y - d, W = w + 2 * d, H = h + 2 * d;
  c.save(); c.shadowColor = 'rgba(8,14,30,0.38)'; c.shadowBlur = 38; c.shadowOffsetY = 14;
  rr(c, X, Y, W, H, r + d, lg(c, X, Y, X + W, Y + H, [[0, 'rgba(255,255,255,0.40)'], [0.5, 'rgba(255,255,255,0.14)'], [1, 'rgba(255,255,255,0.26)']]));
  c.restore();
  rr(c, X, Y, W, H, r + d, null, lg(c, X, Y, X + W, Y + H, [[0, 'rgba(255,255,255,0.95)'], [0.35, 'rgba(255,255,255,0.2)'], [0.65, 'rgba(255,255,255,0.12)'], [1, 'rgba(255,255,255,0.7)']]), 1.8); // Lichtkante außen
  rr(c, x - 1, y - 1, w + 2, h + 2, r + 1, null, 'rgba(255,255,255,0.42)', 1.2); // feine Kante innen
}

// Schneidet die durchsichtigen Fenster (Spiel und Kameras) aus dem, was schon auf dem Canvas liegt
export function schneideFenster(c, ecken = ['oben-rechts'], size = KAMERA, design = 'gemuetlich', ueber = UEBER) {
  const rad = RADIUS[design === 'glas' ? 'glas' : 'gemuetlich'], SPIEL = spielRect(ecken, size, ueber);
  c.globalCompositeOperation = 'destination-out';
  rr(c, SPIEL.x, SPIEL.y, SPIEL.w, SPIEL.h, rad.spiel, '#000000');
  for (const e of ecken) { const k = kameraRect(e, size); rr(c, k.x, k.y, k.w, k.h, rad.kamera, '#000000'); }
  c.globalCompositeOperation = 'source-over';
}

// Malt Rahmen (Holz oder Glas) mit Fenstern. Auf eine eigene, durchsichtige Ebene gemalt, die über dem Hintergrund liegt.
export function drawGamingFrames(c, ecken = ['oben-rechts'], size = KAMERA, design = 'gemuetlich', ueber = UEBER) {
  const glas = design === 'glas', rad = RADIUS[glas ? 'glas' : 'gemuetlich'], SPIEL = spielRect(ecken, size, ueber);
  if (glas) glasrahmen(c, SPIEL, rad.spiel); else holzrahmen(c, SPIEL, rad.spiel, [[0.34, 0, 0.9, 40], [0.78, 1, 3.9, 40], [0.5, 1, 3.4, 34]]);
  c.globalCompositeOperation = 'destination-out';
  rr(c, SPIEL.x, SPIEL.y, SPIEL.w, SPIEL.h, rad.spiel, '#000000');
  c.globalCompositeOperation = 'source-over';
  for (const e of ecken) { // Kamera liegt über dem Spielrahmen
    const k = kameraRect(e, size);
    if (glas) glasrahmen(c, k, rad.kamera); else holzrahmen(c, k, rad.kamera, BLAETTER_KAMERA[e.endsWith('links') ? 'links' : 'rechts']);
    c.globalCompositeOperation = 'destination-out';
    rr(c, k.x, k.y, k.w, k.h, rad.kamera, '#000000');
    c.globalCompositeOperation = 'source-over';
  }
}
