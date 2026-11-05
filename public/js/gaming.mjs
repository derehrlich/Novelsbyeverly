// Gaming-Szene: Rahmen für das Spiel (16:9) und die Kamera (1:1), Koordinaten im 1920×1080-Bild.
// In OBS liegen Spiel und Kamera UNTER diesem Overlay; die Fenster werden durchsichtig ausgeschnitten.
import { alpha, leaf, lg, rr } from './malerei.mjs';

export const RAHMEN = 14; // Dicke des Holzrahmens (bewusst dünn)
// x, y, w, h = der durchsichtige Ausschnitt (ohne Rahmen)
export const GAMING = {
  spiel: { x: 40, y: 40, w: 1408, h: 792 }, // 1408 : 792 = 16 : 9
  kamera: { x: 1500, y: 40, w: 384, h: 384 }, // 1 : 1
};

// Ein dünner Holzrahmen mit weicher Innenkante und ein paar Blättern in den Ecken.
function holzrahmen(c, { x, y, w, h }, r, blaetter) {
  const d = RAHMEN;
  rr(c, x - d + 2, y - d + 6, w + 2 * d - 4, h + 2 * d - 4, r + d, alpha('#2b2118', 0.22)); // Schatten
  rr(c, x - d, y - d, w + 2 * d, h + 2 * d, r + d, lg(c, x, y - d, x, y + h + d, [[0, '#dcc399'], [1, '#a88660']]), alpha('#2b2118', 0.32), 2);
  rr(c, x - d + 4, y - d + 4, w + 2 * d - 8, h + 2 * d - 8, r + d - 4, null, alpha('#fff6e0', 0.38), 2); // helle Kante
  rr(c, x - 3, y - 3, w + 6, h + 6, r + 3, null, alpha('#2b2118', 0.28), 3); // Innenschatten
  for (const [lx, ly, a, len] of blaetter) leaf(c, x + lx * w, y + ly * h, len, len * 0.36, a, '#7f9d6f');
}

export function drawGamingFrames(c) {
  const { spiel, kamera } = GAMING;
  holzrahmen(c, spiel, 10, [[0, 0.06, -0.5, 54], [0, 0.11, -1.0, 44], [1, 0.94, 2.6, 54], [1, 0.89, 2.2, 44], [0.34, 0, 0.9, 40], [0.78, 1, 3.9, 40]]);
  holzrahmen(c, kamera, 18, [[0, 0.1, -0.5, 44], [0, 0.17, -1.0, 36], [1, 0.9, 2.6, 44], [1, 0.83, 2.2, 36], [0.5, 1, 3.9, 34]]);
  c.globalCompositeOperation = 'destination-out'; // durchsichtige Fenster
  rr(c, spiel.x, spiel.y, spiel.w, spiel.h, 10, '#000000');
  rr(c, kamera.x, kamera.y, kamera.w, kamera.h, 18, '#000000');
  c.globalCompositeOperation = 'source-over';
}
