// Kulissen: Raumbild mit Fenster (vom Anwender erzeugt, die Fensterfläche in Magenta) plus bewegter Ausblick per Code.
// Vier Szenen: zug (vorbeiziehende Landschaft), sitzecke (Wald), stadt (Hochhäuser), see (Berge und Wasser).
// Dazu Tageszeit (morgen, mittag, abend, nacht) und Wetter (klar, wolkig, regen, gewitter, schnee, nebel).
// Ohne eigenes Raumbild malt der Code einen einfachen Raum mit Fenster.
//
// Ablauf pro Bild: Ausblick im Fenster (Himmel, Schichten, Wetter) → Regentropfen am Glas → Raumbild darüber (Fenster ausgeschnitten)
// → Licht (Flackern, Staub, Blitz). Das Raumbild wird einmal geladen und eingefärbt, nicht in jedem Bild neu.
const W = 1920, H = 1080;
export const SZENEN = ['zug', 'sitzecke', 'stadt', 'see'];
export const WETTER = ['klar', 'wolkig', 'regen', 'gewitter', 'schnee', 'nebel'];
export const ZEITEN = ['morgen', 'mittag', 'abend', 'nacht'];

// ---- Farben
const hex = (h) => { const s = h.replace('#', ''); return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]; };
const col = (a) => (typeof a === 'string' ? hex(a) : a);
const mix = (a, b, k) => { const x = col(a), y = col(b); return [x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k]; };
const css = (a, al = 1) => { const x = col(a); return `rgba(${x[0] | 0},${x[1] | 0},${x[2] | 0},${al})`; };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const ZEIT = {
  morgen: { sky: ['#5e72ad', '#e9a3a0', '#fbe0b4'], sun: { x: 0.74, y: 0.6, c: '#ffe3b4', r: 54 }, cloud: '#f6cdc6', far: '#8a8bb5', mid: '#5c6a8f', near: '#2b3350', haze: '#f7d2bc', stars: 0, lit: 0.2, light: '#ffd4a8', bright: 1, tint: ['#ffc9a8', 0.08] },
  mittag: { sky: ['#3f86d4', '#82bdea', '#d3ebf7'], sun: { x: 0.6, y: 0.2, c: '#fffbe6', r: 46 }, cloud: '#ffffff', far: '#93b4d0', mid: '#628fa6', near: '#2f5f5c', haze: '#e8f4fb', stars: 0, lit: 0, light: '#fff4d8', bright: 1.06, tint: null },
  abend: { sky: ['#2f3067', '#a0608a', '#f4a672'], sun: { x: 0.24, y: 0.62, c: '#ffc890', r: 64 }, cloud: '#d58fa4', far: '#6c5584', mid: '#473a66', near: '#1d1b38', haze: '#f2a98b', stars: 0.25, lit: 0.75, light: '#ffb878', bright: 0.9, tint: ['#6a3f7a', 0.13] },
  nacht: { sky: ['#050a1a', '#0d1730', '#1a2a50'], sun: { x: 0.3, y: 0.24, c: '#e8eefc', r: 36, moon: true }, cloud: '#2b3860', far: '#1b2848', mid: '#121b36', near: '#080d1c', haze: '#1d2c52', stars: 1, lit: 1, light: '#ffcc88', bright: 0.74, tint: ['#18285a', 0.24] },
};
// Wetter: gray = zur Graufärbung, dark = abdunkeln, regen/schnee/nebel = Stärke der Teilchen
const WET = {
  klar: { gray: 0, dark: 0, clouds: 0.35, regen: 0, schnee: 0, nebel: 0, blitz: 0, bright: 1 },
  wolkig: { gray: 0.28, dark: 0.08, clouds: 1, regen: 0, schnee: 0, nebel: 0, blitz: 0, bright: 0.96 },
  regen: { gray: 0.5, dark: 0.22, clouds: 1, regen: 1, schnee: 0, nebel: 0.12, blitz: 0, bright: 0.9 },
  gewitter: { gray: 0.62, dark: 0.4, clouds: 1, regen: 1.4, schnee: 0, nebel: 0.1, blitz: 1, bright: 0.84 },
  schnee: { gray: 0.34, dark: 0.04, clouds: 1, regen: 0, schnee: 1, nebel: 0.2, blitz: 0, bright: 1.02 },
  nebel: { gray: 0.55, dark: 0.1, clouds: 0.6, regen: 0, schnee: 0, nebel: 1, blitz: 0, bright: 0.94 },
};
// Farbe an das Wetter anpassen (grauer, dunkler)
function tone(c, w) {
  const x = col(c); const l = x[0] * 0.3 + x[1] * 0.55 + x[2] * 0.15;
  return mix(mix(x, [l * 0.96, l * 1.0, l * 1.08], w.gray), [0, 0, 0], w.dark);
}

// ---- Bausteine zum Zeichnen
function strip(w, h, fn) { const cv = document.createElement('canvas'); cv.width = Math.ceil(w); cv.height = Math.ceil(h); fn(cv.getContext('2d'), cv.width, cv.height); return cv; }
function drawStrip(c, cv, offset, y) { let x = -(((offset % cv.width) + cv.width) % cv.width); while (x < c.canvas.width) { c.drawImage(cv, x, y); x += cv.width; } }
// An beiden Rändern doppelt zeichnen, damit die Schicht nahtlos wiederkehrt
const wrap = (w, x, fn) => { fn(x); if (x < 160) fn(x + w); if (x > w - 160) fn(x - w); };

// Hügelkette, die sich nahtlos wiederholt (nur ganze Wellen über die Breite)
function ridge(c, w, h, { color, base, amp, seed, waves = 5, minWave = 1 }) {
  const r = rng(seed); const ph = Array.from({ length: waves }, () => r() * 6.28);
  const y = (x) => { let v = 0; for (let k = 0; k < waves; k += 1) v += (amp / (k + 1.4)) * Math.sin(((k + minWave) * 2 * Math.PI * x) / w + ph[k]); return base + v; };
  c.fillStyle = css(color); c.beginPath(); c.moveTo(0, h);
  for (let x = 0; x <= w; x += 6) c.lineTo(x, y(x));
  c.lineTo(w, h); c.closePath(); c.fill();
  return y;
}
const h0 = (sh) => sh + 10;
function pine(c, x, y, s, color) {
  c.fillStyle = css(color);
  const hash = (k) => { const v = Math.sin(x * 12.9898 + y * 78.233 + k * 37.719) * 43758.5453; return v - Math.floor(v); };
  for (let i = 0; i < 6; i += 1) { // sechs unregelmäßige Etagen
    const t = y - i * 21 * s, bw = (44 - i * 6 + (hash(i) - 0.5) * 9) * s, up = (34 + hash(i + 9) * 11) * s, sk = (hash(i + 4) - 0.5) * 7 * s;
    c.beginPath(); c.moveTo(x - bw, t + 2 * s); c.quadraticCurveTo(x - bw * 0.4 + sk, t - 3 * s, x + sk, t - up); c.quadraticCurveTo(x + bw * 0.4 + sk, t - 3 * s, x + bw, t + 2 * s); c.quadraticCurveTo(x, t + 7 * s, x - bw, t + 2 * s); c.fill();
  }
  c.fillRect(x - 3 * s, y, 6 * s, 14 * s);
}
const glowDot = (c, x, y, r, color, a) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, css(color, a)); g.addColorStop(1, css(color, 0)); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); };
function blob(c, x, y, rx, ry) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 6.2832); c.fill(); }

function sunMoon(c, ww, wh, pal, w) {
  const s = pal.sun; const x = s.x * ww, y = s.y * wh; const k = clamp(1 - w.gray * 1.25, 0, 1);
  const g = c.createRadialGradient(x, y, 0, x, y, s.r * 6);
  g.addColorStop(0, css(s.c, 0.5 * k)); g.addColorStop(1, css(s.c, 0)); c.fillStyle = g; c.fillRect(x - s.r * 6, y - s.r * 6, s.r * 12, s.r * 12);
  c.fillStyle = css(s.c, 0.95 * k); blob(c, x, y, s.r, s.r);
  if (s.moon) { c.fillStyle = css(tone(pal.sky[1], { gray: 0, dark: 0 }), 0.0); }
}
function clouds(c, ww, wh, t, pal, w, seed, speed) {
  const r = rng(seed); const n = 3 + Math.round(w.clouds * 8);
  for (let i = 0; i < n; i += 1) {
    const sc = 0.7 + r() * 1.1, baseX = r() * (ww + 600), y = wh * (0.08 + r() * 0.34), v = (6 + r() * 10) * speed;
    const x = ((baseX + t * 0.001 * v) % (ww + 600)) - 300;
    const col1 = mix(pal.cloud, pal.sky[1], 0.15 + w.gray * 0.2); const a = (0.3 + w.clouds * 0.45) * (i < n * (0.35 + w.clouds * 0.65) ? 1 : 0.25);
    c.fillStyle = css(tone(col1, w), a);
    for (const [dx, dy, rx, ry] of [[0, 0, 130, 30], [-80, 10, 80, 24], [90, 8, 96, 26], [10, -22, 80, 30]]) blob(c, x + dx * sc, y + dy * sc, rx * sc, ry * sc);
  }
}
function sky(c, ww, wh, t, pal, w, seed, cloudSpeed = 1) {
  const g = c.createLinearGradient(0, 0, 0, wh);
  pal.sky.forEach((s, i) => g.addColorStop(i / (pal.sky.length - 1), css(tone(s, w))));
  c.fillStyle = g; c.fillRect(0, 0, ww, wh);
  if (pal.stars > 0.1 && w.gray < 0.5) { const r = rng(seed + 9); c.fillStyle = '#fff'; for (let i = 0; i < 90; i += 1) { const x = r() * ww, y = r() * wh * 0.6, tw = 0.5 + 0.5 * Math.sin(t / 700 + i); c.globalAlpha = pal.stars * (0.3 + 0.7 * tw) * (1 - w.gray * 1.4); c.fillRect(x, y, 1.6, 1.6); } c.globalAlpha = 1; }
  sunMoon(c, ww, wh, pal, w);
  clouds(c, ww, wh, t, pal, w, seed, cloudSpeed);
}
// Lichter in Gebäuden und Häusern: Anteil je nach Tageszeit
function lit(c, x, y, wd, ht, pal, r, density) {
  const gx = 9, gy = 12; c.fillStyle = css(pal.light, 0.95);
  for (let yy = y + 8; yy < y + ht - 8; yy += gy) for (let xx = x + 6; xx < x + wd - 8; xx += gx) if (r() < density) c.fillRect(xx, yy, 4, 6);
}

// ---- Szenen: jede liefert build(pal, w) → Schichten und draw(c, ww, wh, t, dt, ctx)
const SCENES = {
  zug(ww, wh, pal, w, seed) {
    const SW = Math.max(ww * 2, 2400); const hor = wh * 0.7; const L = {};
    L.far = strip(SW, wh, (c, sw, sh) => ridge(c, sw, sh, { color: tone(pal.far, w), base: hor - 70, amp: 46, seed: seed + 1, waves: 4 }));
    L.mid = strip(SW, wh, (c, sw, sh) => { const y = ridge(c, sw, sh, { color: tone(pal.mid, w), base: hor - 20, amp: 24, seed: seed + 2 }); const r = rng(seed + 3); c.fillStyle = css(tone(pal.near, w), 0.9); for (let x = 0; x < sw; x += 14 + r() * 18) wrap(sw, x, (px) => pine(c, px, y(x) + 6, 0.5 + r() * 0.35, tone(mix(pal.mid, pal.near, 0.55), w))); });
    L.dorf = strip(SW, wh, (c, sw, sh) => { const r = rng(seed + 4); c.fillStyle = css(tone(pal.near, w), 1); for (let x = 60; x < sw - 80; x += 420 + r() * 520) { const n = 3 + Math.floor(r() * 4); for (let i = 0; i < n; i += 1) { const bx = x + i * 46, bw = 34 + r() * 22, bh = 30 + r() * 30; const by = hor + 10 - bh; c.fillStyle = css(tone(pal.near, w)); c.fillRect(bx, by, bw, bh); c.beginPath(); c.moveTo(bx - 4, by); c.lineTo(bx + bw / 2, by - 22); c.lineTo(bx + bw + 4, by); c.fill(); lit(c, bx, by, bw, bh, pal, r, pal.lit * 0.9); } } });
    L.nah = strip(SW, wh, (c, sw, sh) => { const r = rng(seed + 5); const ground = tone(mix(pal.near, pal.mid, 0.25), w);
      // Felder in Streifen: nach unten werden sie breiter (Perspektive)
      let y = hor + 18; let k = 0; while (y < sh) { const hh = 6 + k * 5; c.fillStyle = css(mix(ground, k % 2 ? '#000000' : pal.haze, k % 2 ? 0.18 : 0.12)); c.fillRect(0, y, sw, hh); y += hh; k += 1; }
      for (let x = 140; x < sw; x += 360) { c.fillStyle = css(tone(pal.near, w)); c.fillRect(x - 5, hor - 250, 10, 290); c.fillRect(x - 54, hor - 226, 108, 8); c.fillRect(x - 38, hor - 196, 76, 6); for (const dx of [-46, -24, 24, 46]) c.fillRect(x + dx - 3, hor - 226, 6, -9); }
      c.strokeStyle = css(tone(pal.near, w), 0.9); c.lineWidth = 2; for (const dy of [-226, -196]) for (let x = 140; x < sw; x += 360) { c.beginPath(); c.moveTo(x, hor + dy); c.quadraticCurveTo(x + 180, hor + dy + 46, x + 360, hor + dy); c.stroke(); }
      for (let x = 40; x < sw; x += 220 + r() * 300) { const s2 = 1.2 + r() * 0.8; pine(c, x, hor + 40, s2, tone(mix(pal.near, '#000000', 0.2), w)); } });
    // Ganz vorne: Büsche und Zaunpfähle, sehr schnell und unscharf (Bewegungsgefühl)
    L.busch = strip(SW, wh, (c, sw, sh) => { const r = rng(seed + 6); if ('filter' in c) c.filter = 'blur(3px)'; c.fillStyle = css(tone(mix(pal.near, '#000000', 0.45), w), 0.95);
      for (let x = 0; x < sw; x += 70 + r() * 210) { const n = 6 + Math.floor(r() * 6); for (let i = 0; i < n; i += 1) wrap(sw, x + i * 14, (px) => blob(c, px, sh - 10 - r() * 22, 12 + r() * 16, 10 + r() * 16)); }
      for (let x = 60; x < sw; x += 150) { c.fillRect(x, sh - 150, 8, 150); } c.fillRect(0, sh - 118, sw, 5); c.fillRect(0, sh - 84, sw, 4); c.filter = 'none'; });
    return { layers: L, hor };
  },
  sitzecke(ww, wh, pal, w, seed) {
    const SW = ww + 400; const hor = wh * 0.74; const L = [];
    const SC = [0.42, 0.7, 1.05, 1.5, 2.1], GAP = [14, 22, 34, 58, 96], BASE = [-30, -14, 8, 40, 84];
    for (let i = 0; i < 5; i += 1) {
      const k = i / 4; const color = tone(mix(mix(pal.far, pal.haze, 0.35 * (1 - k)), pal.near, 0.15 + k * 0.85), w);
      L.push(strip(SW, wh, (c, sw, sh) => { const r = rng(seed + 20 + i); const gy = hor + BASE[i]; const gg = c.createLinearGradient(0, gy, 0, sh); gg.addColorStop(0, css(color)); gg.addColorStop(1, css(mix(color, '#000000', 0.4))); c.fillStyle = gg; c.fillRect(0, gy, sw, sh);
        for (let x = -30; x < sw + 30; x += GAP[i] * (0.7 + r() * 0.6)) pine(c, x, gy + 4, SC[i] * (0.8 + r() * 0.45), color); }));
    }
    return { layers: L, hor, fire: Array.from({ length: 34 }, (_, i) => ({ x: rng(seed + i)() * ww, y: wh * (0.5 + rng(seed + i + 50)() * 0.45), p: i })) };
  },
  stadt(ww, wh, pal, w, seed) {
    const SW = ww + 260; const hor = wh * 0.8;
    // Drei Reihen Hochhäuser von fern nach nah: ferne sind blasser (Dunst), nahe dunkel und detailreicher
    const DEFS = [
      { minH: 130, maxH: 320, minW: 34, maxW: 82, depth: 0.05, haze: 0.62, win: [3, 4, 7, 9], dens: 0.5, yoff: 0 },
      { minH: 180, maxH: 400, minW: 46, maxW: 104, depth: 0.4, haze: 0.36, win: [4, 5, 9, 11], dens: 0.55, yoff: 16 },
      { minH: 230, maxH: 520, minW: 62, maxW: 132, depth: 0.85, haze: 0.1, win: [5, 6, 11, 13], dens: 0.62, yoff: 34 },
    ];
    const gaps = [SW * 0.2, SW * 0.52, SW * 0.82];
    const WARM = css(pal.light), COOL = '#9fdcff', PINK = '#ffb0d0', WHITE = '#fff4e0';
    const L = DEFS.map((D, i) => {
      const body = tone(mix(mix(pal.far, pal.near, D.depth), pal.haze, D.haze), w); const top = mix(body, pal.haze, 0.2);
      const out = { blink: [], signs: [], twinkle: [], body, windows: [] };
      out.strip = strip(SW, wh, (c, sw, sh) => {
        const r = rng(seed + 30 + i); let x = -12;
        while (x < sw) {
          // In der vordersten Reihe bleiben drei Lücken (Straßenschluchten), durch die man die Hochstraße und die Reihen dahinter sieht
          const bw = D.minW + r() * (D.maxW - D.minW), bh = D.minH + r() * (D.maxH - D.minH), bx = x, by = hor - bh + D.yoff;
          const gp = i === 2 ? gaps.find((g) => g >= x && g < x + bw) : undefined; if (gp !== undefined) { x = gp + 70 + r() * 50; continue; }
          x += bw + 2 + r() * 8;
          const g = c.createLinearGradient(0, by, 0, by + bh); g.addColorStop(0, css(top)); g.addColorStop(1, css(body)); c.fillStyle = g; c.fillRect(bx, by, bw, bh + 220);
          c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(bx + bw * 0.78, by, bw * 0.22, bh + 220); // Schattenseite
          c.fillStyle = css(mix(top, '#ffffff', 0.12)); c.fillRect(bx, by, bw, 3); // Dachkante
          const [ww2, wh2, gx, gy] = D.win; const dens = pal.lit * D.dens * (0.1 + r() * 0.9);
          for (let yy = by + 10; yy < by + bh - 8; yy += gy) for (let xx = bx + 5; xx < bx + bw * 0.78 - ww2; xx += gx) {
            if (r() < dens) { const q = r(); const col = q < 0.84 ? WARM : q < 0.92 ? COOL : q < 0.96 ? PINK : WHITE; c.fillStyle = col; c.fillRect(xx, yy, ww2, wh2); out.windows.push([xx, yy, ww2, wh2, col]); if (out.twinkle.length < 40 && r() < 0.05) out.twinkle.push([xx, yy, ww2, wh2]); }
            else if (pal.lit < 0.35) { c.fillStyle = css(mix(body, pal.sky[1], 0.45), 0.5); c.fillRect(xx, yy, ww2, wh2); } // tagsüber spiegelt das Glas den Himmel
          }
          const q = r();
          if (q < 0.34) { const aH = 16 + r() * 34; c.fillStyle = css(mix(body, '#000000', 0.25)); c.fillRect(bx + bw / 2 - 1, by - aH, 2.4, aH); if (i >= 1) out.blink.push([bx + bw / 2 + 0.2, by - aH, r() * 6]); }
          else if (q < 0.5) { c.fillStyle = css(mix(body, '#000000', 0.2)); c.fillRect(bx + bw * 0.2, by - 16, bw * 0.3, 16); c.fillRect(bx + bw * 0.25, by - 26, bw * 0.2, 10); }
          else if (q < 0.62) { c.fillStyle = css(mix(body, '#000000', 0.3)); c.fillRect(bx + bw * 0.3, by - 9, bw * 0.34, 9); }
          if (i === 2 && out.signs.length < 3 && r() < 0.22 && pal.lit > 0.3) { out.signs.push({ x: bx + bw * 0.62, y: by + 40 + r() * 60, w: 5, h: 64 + r() * 40, c: out.signs.length % 2 ? '#ff6fb0' : '#5fe0ff', p: r() * 6 }); }
        }
      });
      // Lichtschein der Fenster: unscharfe Kopie, wird später additiv darübergelegt
      out.glow = strip(SW, wh, (c) => { for (const [x2, y2, w3, h3, col] of out.windows) { c.fillStyle = col; c.fillRect(x2 - 1, y2 - 1, w3 + 2, h3 + 2); } });
      const g2 = document.createElement('canvas'); g2.width = out.glow.width; g2.height = out.glow.height; const gc = g2.getContext('2d'); if ('filter' in gc) gc.filter = `blur(${4 + i}px)`; gc.drawImage(out.glow, 0, 0); out.glow = g2;
      return out;
    });
    // Autos auf einer Hochstraße zwischen mittlerer und vorderer Reihe
    const roadY = hor - 96; const cars = Array.from({ length: 22 }, (_, i) => { const r = rng(seed + 90 + i); return { dir: i % 2 ? 1 : -1, x: r() * (ww + 120), v: 34 + r() * 46, lane: i % 2 ? 0 : 1, big: r() < 0.12, c: ['#ffd9a0', '#fff1d0', '#cfe8ff'][i % 3], day: ['#c0453a', '#e8e0d0', '#3f6aa8', '#2a2a30', '#d9a03a'][i % 5] }; });
    return { layers: L, hor, roadY, cars, DEFS };
  },
  see(ww, wh, pal, w, seed) {
    const SW = ww * 1.5; const hor = wh * 0.58; const L = {};
    L.berge2 = strip(SW, hor + 4, (c, sw, sh) => { ridge(c, sw, sh, { color: tone(mix(pal.far, pal.haze, 0.55), w), base: hor - 95, amp: 70, seed: seed + 47, waves: 5, minWave: 2 }); });
    L.berge = strip(SW, hor + 4, (c, sw, sh) => {
      const y = ridge(c, sw, sh, { color: tone(pal.far, w), base: hor - 120, amp: 130, seed: seed + 41, waves: 5, minWave: 3 });
      // Schneekappen: alles über der unregelmäßigen Schneegrenze, aber nur dort, wo der Berg ist
      const r = rng(seed + 45); const lineY = []; for (let x = 0; x <= sw; x += 10) lineY.push(hor - 205 + Math.sin(x * 0.05) * 10 + r() * 14);
      c.save(); c.beginPath(); c.moveTo(0, h0(sh)); for (let x = 0; x <= sw; x += 10) c.lineTo(x, y(x)); c.lineTo(sw, h0(sh)); c.closePath(); c.clip();
      c.fillStyle = css(tone(mix(pal.far, '#ffffff', pal.lit > 0.6 ? 0.12 : 0.6), w), 0.85); c.beginPath(); c.moveTo(0, 0);
      for (let x = 0; x <= sw; x += 10) c.lineTo(x, lineY[x / 10]); c.lineTo(sw, 0); c.closePath(); c.fill(); c.restore();
    });
    L.wald = strip(SW, hor + 4, (c, sw, sh) => { const y = ridge(c, sw, sh, { color: tone(pal.mid, w), base: hor - 36, amp: 16, seed: seed + 42 }); const r = rng(seed + 43); for (let x = 0; x < sw; x += 12 + r() * 12) wrap(sw, x, (px) => pine(c, px, y(x) + 8, 0.55 + r() * 0.4, tone(mix(pal.mid, pal.near, 0.6), w)));
      // Ein paar Hütten am anderen Ufer, abends und nachts mit Licht
      for (let i = 0; i < 5; i += 1) { const x = 120 + i * (sw / 5) + r() * 90, by = y(x) + 14; c.fillStyle = css(tone(mix(pal.near, '#000000', 0.3), w)); c.fillRect(x, by - 9, 16, 9); c.beginPath(); c.moveTo(x - 2, by - 9); c.lineTo(x + 8, by - 16); c.lineTo(x + 18, by - 9); c.fill(); if (pal.lit > 0.4) { c.fillStyle = css(pal.light, 0.95); c.fillRect(x + 6, by - 7, 4, 4); } } });
    L.schilf = strip(ww, 200, (c, sw, sh) => { const r = rng(seed + 44); c.strokeStyle = css(tone(pal.near, w)); c.lineWidth = 3; for (let i = 0; i < 80; i += 1) { const x = r() < 0.5 ? r() * sw * 0.22 : sw - r() * sw * 0.2, hh = 50 + r() * 120; c.beginPath(); c.moveTo(x, sh); c.quadraticCurveTo(x + (r() - 0.5) * 20, sh - hh * 0.6, x + (r() - 0.5) * 36, sh - hh); c.stroke(); } });
    return { layers: L, hor, oben: document.createElement('canvas') };
  },
};

// ---- Wetterteilchen im Fenster
function makeParticles(ww, wh) {
  const r = rng(7);
  return {
    regen: Array.from({ length: 420 }, () => ({ x: r() * ww * 1.3, y: r() * wh, l: 12 + r() * 26, v: 900 + r() * 700, a: 0.2 + r() * 0.3 })),
    schnee: Array.from({ length: 220 }, () => ({ x: r() * ww, y: r() * wh, r: 1 + r() * 2.6, v: 30 + r() * 60, p: r() * 6.28 })),
    tropfen: Array.from({ length: 34 }, () => ({ x: r() * ww, y: r() * wh, r: 2 + r() * 5, vy: 0, wait: r() * 8 })),
  };
}

// ---- Raumbild
const ROOM = {
  zug: { win: { x: 520, y: 150, w: 880, h: 560, r: 150 }, wall: ['#3a2418', '#1c110b'], frame: '#6e4a2c', accent: '#c07a38' },
  sitzecke: { win: { x: 600, y: 90, w: 780, h: 520, r: 12 }, wall: ['#9a6a3a', '#5a3a1e'], frame: '#8a5a2c', accent: '#d68a3a', kreuz: true },
  stadt: { win: { x: 330, y: 70, w: 1260, h: 650, r: 10 }, wall: ['#4a3426', '#241812'], frame: '#2a1c14', accent: '#e0a050', pfosten: 3 },
  see: { win: { x: 190, y: 100, w: 1540, h: 580, r: 24 }, wall: ['#5a3d26', '#2c1d12'], frame: '#4a2f1c', accent: '#d9964a', pfosten: 2 },
};
function placeholderRoom(name) {
  const R = ROOM[name]; const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, R.wall[0]); g.addColorStop(1, R.wall[1]); c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 3; for (let x = 0; x < W; x += 96) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
  const { x, y, w, h, r } = R.win; const rr = (px, py, pw, ph, pr) => { c.beginPath(); c.roundRect(px, py, pw, ph, pr); };
  c.fillStyle = R.frame; rr(x - 36, y - 36, w + 72, h + 72, r + 30); c.fill();
  c.fillStyle = 'rgba(255,220,160,.18)'; rr(x - 36, y - 36, w + 72, 10, 5); c.fill();
  c.save(); c.globalCompositeOperation = 'destination-out'; c.fillStyle = '#000'; rr(x, y, w, h, r); c.fill(); c.restore();
  c.fillStyle = R.frame; if (R.kreuz) { c.fillRect(x + w / 2 - 8, y, 16, h); c.fillRect(x, y + h / 2 - 8, w, 16); }
  for (let i = 1; i <= (R.pfosten ?? 0); i += 1) c.fillRect(x + (w * i) / (R.pfosten + 1) - 9, y, 18, h);
  // Fensterbank und Tisch
  const by = y + h + 36; const bg = c.createLinearGradient(0, by, 0, H); bg.addColorStop(0, '#7a5230'); bg.addColorStop(1, '#3a2414'); c.fillStyle = bg; c.fillRect(0, by, W, H - by);
  c.fillStyle = 'rgba(255,220,160,.22)'; c.fillRect(0, by, W, 6);
  // Lampe mit warmem Schein
  const lx = name === 'see' ? 1620 : 300, ly = by - 40; const lg = c.createRadialGradient(lx, ly - 80, 10, lx, ly - 80, 360); lg.addColorStop(0, 'rgba(255,200,120,.5)'); lg.addColorStop(1, 'rgba(255,200,120,0)'); c.fillStyle = lg; c.fillRect(lx - 360, ly - 440, 720, 720);
  c.fillStyle = '#f4d490'; c.beginPath(); c.moveTo(lx - 56, ly - 90); c.lineTo(lx + 56, ly - 90); c.lineTo(lx + 38, ly - 190); c.lineTo(lx - 38, ly - 190); c.fill();
  c.fillStyle = '#5a3a20'; c.fillRect(lx - 7, ly - 90, 14, 90); c.fillRect(lx - 34, ly - 6, 68, 8);
  // Tasse und Buch
  c.fillStyle = '#f0e6d2'; c.beginPath(); c.roundRect(880, by - 26, 66, 56, 12); c.fill(); c.fillStyle = '#e6d6b8'; c.fillRect(880, by - 20, 66, 10);
  c.fillStyle = '#d8c8a0'; c.beginPath(); c.moveTo(1000, by + 26); c.lineTo(1100, by + 10); c.lineTo(1200, by + 26); c.lineTo(1100, by + 44); c.fill();
  return cv;
}
// Magenta-Fläche im Bild in Durchsichtigkeit umwandeln (mit weichem Rand und ohne rosa Saum).
// Erkannt wird alles, was „magenta-artig“ ist: Rot und Blau hoch, Grün deutlich niedriger. Auch der helle, rosa Lichtschein einer Lampe auf der Fläche zählt dazu.
function cutWindow(img) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d', { willReadFrequently: true });
  const f = Math.max(W / img.width, H / img.height); const dw = img.width * f, dh = img.height * f; c.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  const id = c.getImageData(0, 0, W, H), d = id.data; const N = W * H;
  // Abstand jedes Pixels zur durchsichtigen Fläche (Näherung in zwei Durchgängen)
  const distance = () => {
    const dist = new Uint8Array(N); for (let p = 0; p < N; p += 1) dist[p] = d[p * 4 + 3] < 128 ? 0 : 255;
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) { const p = y * W + x; let v = dist[p]; if (x > 0) v = Math.min(v, dist[p - 1] + 1); if (y > 0) v = Math.min(v, dist[p - W] + 1); dist[p] = v; }
    for (let y = H - 1; y >= 0; y -= 1) for (let x = W - 1; x >= 0; x -= 1) { const p = y * W + x; let v = dist[p]; if (x < W - 1) v = Math.min(v, dist[p + 1] + 1); if (y < H - 1) v = Math.min(v, dist[p + W] + 1); dist[p] = v; }
    return dist;
  };
  // 1) Magenta-artige Pixel: Rot und Blau hoch, Grün deutlich niedriger
  for (let p = 0; p < N; p += 1) {
    const i = p * 4, r = d[i], g = d[i + 1], b = d[i + 2], m = Math.min(r, b) - g;
    if (m > 20 && r > 170 && b > 170 && Math.abs(r - b) < 70) d[i + 3] = Math.round(clamp(1 - (m - 24) / 28, 0, 1) * 255);
  }
  // 2) Der helle rosa Lichtschein einer Lampe auf der Fläche: nahe am Fenster zählt jedes blasse Rosa dazu
  let dist = distance();
  for (let p = 0; p < N; p += 1) { if (dist[p] > 140 || d[p * 4 + 3] < 128) continue; const i = p * 4; if (d[i] > 130 && d[i + 2] > 130 && Math.min(d[i], d[i + 2]) - d[i + 1] > 6) d[i + 3] = 0; }
  // 2b) Fast weißer Schein direkt am Rand der Fläche (Mitte des Lampenscheins) ebenfalls ausschneiden
  for (let p = 0; p < N; p += 1) { if (dist[p] > 26 || d[p * 4 + 3] < 128) continue; const i = p * 4; if (d[i] > 215 && d[i + 2] > 215 && d[i + 1] > 185 && d[i] - d[i + 1] < 70) d[i + 3] = 0; }
  dist = distance();
  // 3) Rosa Saum an der Kante entfernen und Fensterfläche vermessen
  let n = 0, minX = W, minY = H, maxX = 0, maxY = 0;
  for (let p = 0; p < N; p += 1) {
    const i = p * 4;
    if (dist[p] === 0) { n += 1; const x = p % W, y = (p / W) | 0; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; continue; }
    if (dist[p] > 4) continue;
    const g = d[i + 1], m = Math.min(d[i], d[i + 2]) - g;
    if (m > 6) { const k = clamp(m / 40, 0, 1); d[i] -= (d[i] - Math.min(d[i], g + 8)) * k; d[i + 2] -= (d[i + 2] - Math.min(d[i + 2], g + 8)) * k; }
  }
  c.putImageData(id, 0, 0);
  return { cv, found: n > W * H * 0.01, win: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } };
}
const loadImage = (url) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });

export class Kulisse {
  constructor(canvas) {
    this.cv = canvas; this.c = canvas.getContext('2d'); this.cfg = null; this.key = ''; this.scene = null; this.room = null; this.graded = null;
    this.p = null; this.last = 0; this.flash = 0; this.nextFlash = 4000; this.dust = Array.from({ length: 46 }, (_, i) => ({ x: rng(i)() * W, y: rng(i + 99)() * H, v: 4 + rng(i + 7)() * 10, p: i }));
    this.roomKey = '';
  }

  // Neue Einstellungen übernehmen. cfg = { name, zeit, wetter, wind, tempo, saison, plate }
  set(cfg) {
    const old = this.cfg; this.cfg = cfg;
    if (!old || old.name !== cfg.name || old.plate !== cfg.plate) this.loadRoom(cfg);
    const key = `${cfg.name}|${cfg.zeit}|${cfg.wetter}`;
    if (key !== this.key) { this.key = key; this.scene = null; this.graded = null; }
  }

  async loadRoom(cfg) {
    const k = `${cfg.name}|${cfg.plate ?? ''}`; this.roomKey = k;
    let room;
    try {
      if (cfg.plate) { const cut = cutWindow(await loadImage(cfg.plate)); room = cut.found ? { cv: cut.cv, win: cut.win, own: true } : { cv: cut.cv, win: null, own: true }; }
    } catch { room = null; }
    if (!room) { const cv = placeholderRoom(cfg.name); const w = ROOM[cfg.name].win; room = { cv, win: { x: w.x, y: w.y, w: w.w, h: w.h }, own: false }; }
    if (this.roomKey !== k) return;
    this.room = room; this.graded = null;
  }

  buildScene() {
    const { name, zeit, wetter } = this.cfg; const win = this.room.win;
    const pal = ZEIT[zeit] ?? ZEIT.abend; const w = WET[wetter] ?? WET.klar; const seed = 1234 + name.length * 77;
    this.scene = { name, pal, w, ...SCENES[name](win.w, win.h, pal, w, seed) };
    this.p = makeParticles(win.w, win.h);
  }

  // Raumbild je Tageszeit und Wetter einfärben (einmal, nicht in jedem Bild)
  gradeRoom() {
    const { zeit, wetter } = this.cfg; const pal = ZEIT[zeit] ?? ZEIT.abend; const w = WET[wetter] ?? WET.klar;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
    c.filter = `brightness(${(pal.bright * w.bright).toFixed(3)}) saturate(${(1 - w.gray * 0.3).toFixed(3)})`; c.drawImage(this.room.cv, 0, 0); c.filter = 'none';
    if (pal.tint) { c.globalCompositeOperation = 'source-atop'; c.fillStyle = css(pal.tint[0], pal.tint[1]); c.fillRect(0, 0, W, H); }
    this.graded = cv;
  }

  draw(t) {
    if (!this.cfg || !this.room) return;
    const dt = Math.min(0.1, this.last ? (t - this.last) / 1000 : 0.016); this.last = t;
    const c = this.c; c.clearRect(0, 0, W, H);
    if (!this.graded) this.gradeRoom();
    const win = this.room.win;
    if (win) {
      if (!this.scene) this.buildScene();
      c.save(); c.beginPath(); c.rect(win.x, win.y, win.w, win.h); c.clip(); c.translate(win.x, win.y);
      this.drawOutside(c, win.w, win.h, t, dt);
      c.restore();
    }
    c.drawImage(this.graded, 0, 0);
    this.drawRoomLight(c, t, dt);
  }

  drawOutside(c, ww, wh, t, dt) {
    const S = this.scene; const { pal, w } = S; const cfg = this.cfg; const tempo = (cfg.tempo ?? 50) / 50; const wind = (cfg.wind ?? 30) / 100;
    sky(c, ww, wh, t, pal, w, 99 + S.name.length, 0.7 + wind * 2);
    c.save();
    if (S.name === 'zug') {
      c.translate(0, Math.sin(t / 37) * 0.7 + Math.sin(t / 91) * 0.9); // leichtes Rattern
      const base = 420 * tempo, L = S.layers;
      drawStrip(c, L.far, t * 0.001 * base * 0.03, 0); drawStrip(c, L.mid, t * 0.001 * base * 0.1, 0); drawStrip(c, L.dorf, t * 0.001 * base * 0.28, 0);
      this.mist(c, ww, wh, t, pal, w, S.hor);
      drawStrip(c, L.nah, t * 0.001 * base, 0);
      drawStrip(c, L.busch, t * 0.001 * base * 2.4, 0);
      if (pal.sun.y < 0.7 && !pal.sun.moon && w.gray < 0.4) { const sx = pal.sun.x * ww, sy = pal.sun.y * wh; c.save(); c.globalCompositeOperation = 'lighter'; glowDot(c, sx, sy, ww * 0.7, pal.sun.c, 0.07 + 0.03 * Math.sin(t / 900)); c.restore(); } // Gegenlicht, das mit den Masten flackert
    } else if (S.name === 'sitzecke') {
      const L = S.layers;
      L.forEach((l, i) => { const k = i / 4; c.save(); c.translate(Math.sin(t / 1900 + i * 1.2) * (1.5 + k * 5) * (0.4 + wind * 1.6) - 200, Math.sin(t / 2600 + i) * 1.5); c.drawImage(l, 0, 0); c.restore(); if (i < 4) this.mist(c, ww, wh, t, pal, w, S.hor + i * 30, 0.55); });
      if (pal.lit < 0.9 && w.gray < 0.45) { // Lichtstrahlen zwischen den Bäumen (morgens und abends)
        const sx = pal.sun.x * ww; c.save(); c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 5; i += 1) { const x = sx + (i - 2) * 90, a = (0.05 + 0.03 * Math.sin(t / 1500 + i)) * (1 - w.gray * 1.8); const g = c.createLinearGradient(x, 0, x + 200, wh); g.addColorStop(0, css(pal.light, a)); g.addColorStop(1, css(pal.light, 0)); c.fillStyle = g; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 60, 0); c.lineTo(x + 360, wh); c.lineTo(x + 160, wh); c.fill(); }
        c.restore();
      }
      if (pal.lit > 0.9) { c.save(); c.globalCompositeOperation = 'lighter'; for (const f of S.fire) { const x = f.x + Math.sin(t / 2000 + f.p) * 30, y = f.y + Math.cos(t / 1700 + f.p * 2) * 20, a = 0.35 + 0.65 * Math.max(0, Math.sin(t / 600 + f.p * 3)); const g = c.createRadialGradient(x, y, 0, x, y, 9); g.addColorStop(0, `rgba(210,255,140,${a})`); g.addColorStop(1, 'rgba(210,255,140,0)'); c.fillStyle = g; c.fillRect(x - 9, y - 9, 18, 18); } c.restore(); }
      if (cfg.saison === 'herbst' && w.schnee === 0) this.leaves(c, ww, wh, t);
    } else if (S.name === 'stadt') {
      const [A, B, C] = S.layers; const hor = S.hor; const night = pal.lit;
      // Glühen am Horizont (Stadtlicht) und Dunst
      if (night > 0.3) { const g = c.createLinearGradient(0, hor - 380, 0, hor); g.addColorStop(0, css(pal.light, 0)); g.addColorStop(1, css(pal.light, 0.26 * night)); c.fillStyle = g; c.fillRect(0, hor - 380, ww, 380); }
      const ox = (k) => -130 + Math.sin(t / 7000 + k) * 4 * k; // ganz leichtes Schwanken, keine Sprünge
      const layer = (Ly, k) => { const o = ox(k); c.drawImage(Ly.strip, o, 0); if (night > 0.15) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.75 * night; c.drawImage(Ly.glow, o, 0); c.restore(); } return o; };
      const oA = layer(A, 0.4); this.mist(c, ww, wh, t, pal, w, hor - 90, 0.9);
      const oB = layer(B, 0.8); this.mist(c, ww, wh, t, pal, w, hor - 40, 0.55);
      this.traffic(c, ww, wh, t, S, night);
      const oC = layer(C, 1.2);
      // Blinklichter auf den Antennen: weich ein- und ausblenden, nicht an und aus
      for (const [Ly, o] of [[B, oB], [C, oC]]) for (const [bx, by, p] of Ly.blink) { const a = Math.pow(0.5 + 0.5 * Math.sin(t / 650 + p), 2.2); c.fillStyle = css('#ff5a4a', 0.25 + 0.7 * a); c.fillRect(bx + o - 1.2, by - 1.2, 2.6, 2.6); if (a > 0.05) { c.save(); c.globalCompositeOperation = 'lighter'; glowDot(c, bx + o, by, 9, '#ff3a2a', 0.5 * a); c.restore(); } }
      // Einzelne Fenster gehen an und aus
      for (const [Ly, o] of [[B, oB], [C, oC]]) Ly.twinkle.forEach(([x2, y2, w3, h3], i) => { const on = (((Math.floor(t / (3200 + (i % 5) * 900) + i * 3.1)) * 2654435761) >>> 0) % 100 < 55; if (night > 0.3 || on) { c.fillStyle = on && night > 0.2 ? css(pal.light) : css(Ly.body); c.fillRect(x2 + o, y2, w3, h3); } });
      // Leuchtreklame an der vordersten Reihe, leicht flackernd
      c.save(); c.globalCompositeOperation = 'lighter';
      for (const sg of C.signs) { const fl = 0.75 + 0.25 * Math.sin(t / 400 + sg.p) - (Math.sin(t / 91 + sg.p * 9) > 0.96 ? 0.5 : 0); c.fillStyle = css(sg.c, 0.85 * fl); c.fillRect(sg.x + oC, sg.y, sg.w, sg.h); glowDot(c, sg.x + oC + sg.w / 2, sg.y + sg.h / 2, 46, sg.c, 0.28 * fl); }
      c.restore();
      // Flugzeug mit blinkenden Positionslichtern, nur wenn es nicht regnet
      if (night > 0.3 && !w.regen && !w.schnee) { const px = ((t * 0.014) % (ww + 80)) - 40, py = wh * 0.13 + Math.sin(px / 140) * 6; c.save(); c.globalCompositeOperation = 'lighter'; const bl = Math.sin(t / 380) > 0.55; glowDot(c, px, py, 7, bl ? '#ffffff' : '#ff4a3a', bl ? 0.9 : 0.5); glowDot(c, px - 6, py + 1, 4, '#7dff9a', 0.55); c.restore(); }
    } else if (S.name === 'see') {
      const L = S.layers, hor = S.hor;
      const up = S.oben; if (up.width !== ww) { up.width = ww; up.height = Math.ceil(hor); } const u = up.getContext('2d'); u.clearRect(0, 0, ww, hor);
      sky(u, ww, hor, t, pal, w, 99 + S.name.length, 0.7 + wind * 2); drawStrip(u, L.berge2, t * 0.001 * 1, 0); drawStrip(u, L.berge, t * 0.001 * 2, 0); this.mist(u, ww, hor, t, pal, w, hor - 30, 0.6); drawStrip(u, L.wald, t * 0.001 * 4, 0);
      c.drawImage(up, 0, 0);
      // Wasser: Spiegelbild in dünnen Streifen mit Wellen
      const wg = c.createLinearGradient(0, hor, 0, wh); wg.addColorStop(0, css(tone(mix(pal.sky[2], pal.mid, 0.5), w))); wg.addColorStop(1, css(tone(mix(pal.sky[1], pal.near, 0.6), w))); c.fillStyle = wg; c.fillRect(0, hor, ww, wh - hor);
      const depth = wh - hor; c.globalAlpha = 0.62;
      for (let y = 0; y < depth; y += 3) { const sy = hor - 1 - (y / depth) * hor * 0.9; const off = Math.sin(y * 0.09 + t / 700) * (0.6 + y * 0.012) * (0.4 + wind * 1.4); c.drawImage(up, 0, Math.max(0, sy), ww, 3, off, hor + y, ww, 3); }
      c.globalAlpha = 1;
      // Glitzern unter Sonne oder Mond
      const sx = pal.sun.x * ww; c.save(); c.globalCompositeOperation = 'lighter';
      if (w.gray < 0.5) for (let i = 0; i < 70; i += 1) { const y = hor + 6 + ((i * 53) % depth), sp = 20 + (y - hor) * 0.5; const x = sx + Math.sin(i * 12.9 + t / 900 + y * 0.02) * sp, a = (0.2 + 0.6 * Math.max(0, Math.sin(t / 300 + i * 2.1))) * (1 - w.gray * 1.6); c.fillStyle = css(pal.sun.c, a); c.fillRect(x, y, 8 + (y - hor) * 0.05, 1.5); }
      c.restore();
      c.drawImage(L.schilf, 0, wh - 200 + Math.sin(t / 1300) * 2);
      this.birds(c, ww, wh, t, pal, w);
    }
    c.restore();
    this.weather(c, ww, wh, t, dt, S, wind);
    // Glas: leichte Spiegelung
    const gl = c.createLinearGradient(0, 0, ww, wh); gl.addColorStop(0, 'rgba(255,255,255,.07)'); gl.addColorStop(0.4, 'rgba(255,255,255,0)'); gl.addColorStop(1, 'rgba(255,255,255,.03)'); c.fillStyle = gl; c.fillRect(0, 0, ww, wh);
  }

  // Hochstraße mit Verkehr: Lampen am Rand und Autos mit Scheinwerfern (weiß) und Rücklichtern (rot), tagsüber kleine bunte Autos
  traffic(c, ww, wh, t, S, night) {
    const y = S.roadY, w = S.w; const dark = css(mix(S.layers[1].body, '#000000', 0.35));
    c.fillStyle = dark; c.fillRect(0, y - 2, ww, 9); c.fillStyle = css(mix(S.layers[1].body, S.pal.haze, 0.3)); c.fillRect(0, y - 3, ww, 1.5);
    for (let x = 18; x < ww; x += 78) { c.fillStyle = dark; c.fillRect(x, y - 15, 1.6, 13); if (night > 0.25) { c.save(); c.globalCompositeOperation = 'lighter'; glowDot(c, x + 1, y - 16, 9, S.pal.light, 0.5 * night); c.restore(); } }
    const streak = w.regen ? 26 : 15;
    for (const car of S.cars) {
      const x = ((car.x + t * 0.001 * car.v * car.dir) % (ww + 120) + ww + 120) % (ww + 120) - 60, ly = y + 1 + car.lane * 3;
      if (night > 0.25) {
        c.save(); c.globalCompositeOperation = 'lighter';
        const col = car.dir > 0 ? car.c : '#ff3a2a', back = -car.dir * streak;
        const g = c.createLinearGradient(x, 0, x + back, 0); g.addColorStop(0, css(col, 0.5 * night)); g.addColorStop(1, css(col, 0)); c.fillStyle = g; c.fillRect(Math.min(x, x + back), ly - 0.8, Math.abs(back), 1.6);
        for (const dx of car.big ? [-5, 5] : [-2.4, 2.4]) { glowDot(c, x + dx, ly, car.big ? 6 : 4.5, col, 0.55 * night); c.fillStyle = css(col, 0.95); c.fillRect(x + dx - 0.9, ly - 0.9, 1.8, 1.8); }
        c.restore();
      } else { c.fillStyle = car.day; c.fillRect(x - (car.big ? 8 : 4.5), ly - 2.4, car.big ? 16 : 9, 3.4); c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(x - 2, ly - 3.2, 4, 1.4); }
    }
  }

  mist(c, ww, wh, t, pal, w, y, k = 1) {
    const a = (0.1 + w.nebel * 0.35) * k; if (a < 0.03) return;
    for (let i = 0; i < 3; i += 1) { const x = ((t * 0.001 * (8 + i * 5) + i * 500) % (ww + 800)) - 400; const g = c.createRadialGradient(x, y, 0, x, y, 520); g.addColorStop(0, css(pal.haze, a)); g.addColorStop(1, css(pal.haze, 0)); c.save(); c.translate(0, 0); c.scale(1, 0.22); c.fillStyle = g; c.fillRect(x - 520, (y - 520 * 0.22) / 0.22 - 100, 1040, 1100); c.restore(); }
  }

  leaves(c, ww, wh, t) {
    for (let i = 0; i < 18; i += 1) { const x = ((i * 211 + t * 0.001 * (20 + (i % 4) * 8)) % (ww + 60)) - 30, y = ((i * 97 + t * 0.001 * (40 + (i % 5) * 14)) % (wh + 40)) - 20; c.fillStyle = ['#d98a3a', '#c25a2a', '#e0b050'][i % 3]; c.save(); c.translate(x, y); c.rotate(t / 700 + i); c.beginPath(); c.ellipse(0, 0, 6, 3, 0, 0, 6.28); c.fill(); c.restore(); }
  }

  birds(c, ww, wh, t, pal, w) {
    if (w.regen || w.schnee) return;
    const cyc = (t / 1000) % 40; if (cyc > 12) return; const x = (cyc / 12) * (ww + 200) - 100;
    c.strokeStyle = css(tone(pal.near, w), 0.9); c.lineWidth = 2;
    for (let i = 0; i < 7; i += 1) { const bx = x - i * 26, by = wh * 0.22 + Math.abs(i - 3) * 12 + Math.sin(t / 400 + i) * 3, f = Math.sin(t / 130 + i) * 5; c.beginPath(); c.moveTo(bx - 9, by + f); c.quadraticCurveTo(bx - 4, by - 4, bx, by); c.quadraticCurveTo(bx + 4, by - 4, bx + 9, by + f); c.stroke(); }
  }

  weather(c, ww, wh, t, dt, S, wind) {
    const w = S.w, P = this.p, speed = S.name === 'zug' ? (this.cfg.tempo ?? 50) / 50 : 0;
    const slant = 0.12 + wind * 0.5 + speed * 0.7; // Regen fällt schräg, im Zug stärker
    if (w.regen > 0) {
      c.lineWidth = 1.3; const n = Math.round(P.regen.length * Math.min(1, w.regen));
      for (let i = 0; i < n; i += 1) { const r = P.regen[i]; r.y += r.v * dt; r.x -= r.v * dt * slant; if (r.y > wh) { r.y = -r.l; r.x = Math.random() * ww * 1.3; } if (r.x < -40) r.x += ww + 80; c.strokeStyle = `rgba(205,225,255,${r.a})`; c.beginPath(); c.moveTo(r.x, r.y); c.lineTo(r.x + r.l * slant, r.y - r.l); c.stroke(); }
      for (const d of P.tropfen) { // Tropfen am Glas, einzelne laufen herunter
        d.wait -= dt; if (d.wait < 0 && d.vy === 0) { d.vy = 25 + Math.random() * 40; d.wait = 1 + Math.random() * 2; } if (d.vy > 0) { d.y += d.vy * dt; d.wait -= dt; if (d.wait < 0) { d.vy = 0; d.wait = 2 + Math.random() * 8; } } if (d.y > wh + 10) { d.y = -10; d.x = Math.random() * ww; }
        const g = c.createRadialGradient(d.x - d.r * 0.3, d.y - d.r * 0.3, 0, d.x, d.y, d.r * 1.3); g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(180,205,230,.12)'); c.fillStyle = g; c.beginPath(); c.ellipse(d.x, d.y, d.r * 0.8, d.r * 1.15, 0, 0, 6.28); c.fill();
        if (d.vy > 0) { c.strokeStyle = 'rgba(200,220,240,.12)'; c.lineWidth = d.r * 0.5; c.beginPath(); c.moveTo(d.x, d.y - d.r * 6); c.lineTo(d.x, d.y); c.stroke(); } }
    }
    if (w.schnee > 0) for (const f of P.schnee) { f.y += f.v * dt; f.p += dt; f.x += Math.sin(f.p) * 16 * dt + wind * 24 * dt; if (f.y > wh) { f.y = -4; f.x = Math.random() * ww; } c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.arc(f.x, f.y, f.r, 0, 6.28); c.fill(); }
    if (w.nebel > 0.4) { c.fillStyle = css(S.pal.haze, 0.28 * w.nebel); c.fillRect(0, 0, ww, wh); }
    if (w.blitz) { // Blitz in unregelmäßigen Abständen, doppelt aufflackernd
      this.nextFlash -= dt * 1000; if (this.nextFlash < 0) { this.flash = 1; this.nextFlash = 5000 + Math.random() * 11000; this.flash2 = 0.45; }
      this.flash = Math.max(0, this.flash - dt * 3.2); if (this.flash2 > 0 && this.flash < 0.35) { this.flash = 0.9; this.flash2 = 0; }
      if (this.flash > 0) { c.fillStyle = `rgba(235,240,255,${this.flash * 0.6})`; c.fillRect(0, 0, ww, wh); }
    } else this.flash = 0;
  }

  drawRoomLight(c, t, dt) {
    const pal = ZEIT[this.cfg.zeit] ?? ZEIT.abend;
    c.save(); c.globalCompositeOperation = 'screen';
    if (pal.lit > 0.2) { c.fillStyle = css(pal.light, (0.025 + 0.012 * Math.sin(t / 330) + 0.008 * Math.sin(t / 97)) * pal.lit); c.fillRect(0, 0, W, H); }
    if (this.flash > 0) { c.fillStyle = `rgba(190,205,255,${this.flash * 0.1})`; c.fillRect(0, 0, W, H); }
    c.globalCompositeOperation = 'lighter';
    for (const d of this.dust) { d.y -= d.v * dt; d.x += Math.sin(t / 2500 + d.p) * 6 * dt; if (d.y < -4) { d.y = H + 4; d.x = Math.random() * W; } c.fillStyle = `rgba(255,230,190,${0.1 + 0.18 * Math.max(0, Math.sin(t / 1100 + d.p))})`; c.fillRect(d.x, d.y, 2, 2); }
    c.restore();
  }
}
