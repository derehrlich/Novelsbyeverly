// Gaming-Szene: Rahmen für das Spiel (16:9) und bis zu vier quadratische Kamerafenster in den Ecken, Koordinaten im 1920×1080-Bild.
// In OBS liegen Spiel (unten) und Kamera (darüber) UNTER diesem Overlay; die Fenster werden durchsichtig ausgeschnitten.
import { alpha, leaf, lg, rr } from './malerei.mjs';

export const RAHMEN = 14; // Dicke des Holzrahmens (bewusst dünn)
export const SPIEL = { x: 80, y: 45, w: 1760, h: 990 }; // 1760 : 990 = 16 : 9 (schmaler Rand)
export const KAMERA = 340; // Seitenlänge des Kamerabilds (1:1)
const UEBER = 32; // so weit ragt das Kamerafenster über die Ecke des Spielrahmens hinaus
export const ECKEN = ['oben-links', 'oben-rechts', 'unten-links', 'unten-rechts'];
export const TODE_POS = ['oben-links', 'oben-mitte', 'oben-rechts', 'unten-links', 'unten-mitte', 'unten-rechts'];

export function kameraRect(ecke, size = KAMERA) {
  const links = ecke.endsWith('links'), oben = ecke.startsWith('oben');
  return { x: links ? SPIEL.x - UEBER : SPIEL.x + SPIEL.w - size + UEBER, y: oben ? SPIEL.y - UEBER : SPIEL.y + SPIEL.h - size + UEBER, w: size, h: size };
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

export function drawGamingFrames(c, ecken = ['oben-rechts'], size = KAMERA) {
  holzrahmen(c, SPIEL, 10, [[0.34, 0, 0.9, 40], [0.78, 1, 3.9, 40], [0.5, 1, 3.4, 34]]);
  c.globalCompositeOperation = 'destination-out';
  rr(c, SPIEL.x, SPIEL.y, SPIEL.w, SPIEL.h, 10, '#000000');
  c.globalCompositeOperation = 'source-over';
  for (const e of ecken) { // Kamera liegt über dem Spielrahmen
    const k = kameraRect(e, size);
    holzrahmen(c, k, 18, BLAETTER_KAMERA[e.endsWith('links') ? 'links' : 'rechts']);
    c.globalCompositeOperation = 'destination-out';
    rr(c, k.x, k.y, k.w, k.h, 18, '#000000');
    c.globalCompositeOperation = 'source-over';
  }
}
