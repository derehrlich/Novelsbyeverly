// Jahreszeiten-Landschaft: je Jahreszeit ein Anfangs- und ein Endbild (vom Anwender, Himmel in Magenta), dazwischen blendet der Bot mit dem Fortschritt über.
// Darauf wachsen Blumen, fallen Blätter (Herbst) und Blüten (Frühling). Himmel, Tageszeit und Wetter kommen aus dem Code (wie bei den Szenen mit Fenster).
//
// Ebenen von hinten nach vorn: Himmel (Code) → Landschaftsbild (Magenta ausgeschnitten, nach Tageszeit und Wetter eingefärbt, mit Fortschritt überblendet)
// → liegende Blätter → Blumen (wachsen, schwanken) → fallende Blätter und Blüten → Wetter (Regen, Schnee, Nebel, Blitz).
import { Kulisse, ZEIT, WET, sky, css, clamp, rng, makeParticles, cutWindow, loadImage } from './kulisse.mjs';

const W = 1920, H = 1080;
const FLOWER_MAX = 110;
const ease = (v) => { const x = v - 1; return 1 + 2.4 * x * x * x + 1.4 * x * x; }; // wächst mit kleinem Überschwingen

// Einzelteile aus einem Blatt mit Magenta-Hintergrund holen: zusammenhängende Flächen, nach Zeilen und von links nach rechts sortiert
function extractSprites(cut) {
  const c = cut.getContext('2d', { willReadFrequently: true }); const d = c.getImageData(0, 0, W, H).data; const S = 4, gw = W / S, gh = H / S;
  let mask = new Uint8Array(gw * gh);
  for (let y = 0; y < gh; y += 1) for (let x = 0; x < gw; x += 1) { let on = 0; for (let k = 0; k < 4; k += 1) if (d[(((y * S + (k & 1) * 2) * W) + x * S + (k >> 1) * 2) * 4 + 3] > 100) on += 1; mask[y * gw + x] = on >= 1 ? 1 : 0; }
  // Nahe Teile zusammenfassen (zwei Zellen aufblähen), damit eine Blume mit Blättern ein Stück bleibt
  const grown = new Uint8Array(gw * gh);
  for (let y = 0; y < gh; y += 1) for (let x = 0; x < gw; x += 1) if (mask[y * gw + x]) for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < gw && ny < gh) grown[ny * gw + nx] = 1; }
  const seen = new Uint8Array(gw * gh); const boxes = [];
  for (let s0 = 0; s0 < grown.length; s0 += 1) {
    if (!grown[s0] || seen[s0]) continue;
    const stack = [s0]; seen[s0] = 1; let minX = gw, minY = gh, maxX = 0, maxY = 0, n = 0;
    while (stack.length) { const p = stack.pop(); const x = p % gw, y = (p / gw) | 0; n += 1; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      for (const q of [p - 1, p + 1, p - gw, p + gw]) if (q >= 0 && q < grown.length && grown[q] && !seen[q] && Math.abs((q % gw) - x) <= 1) { seen[q] = 1; stack.push(q); } }
    if (n >= 40) boxes.push({ x: minX * S, y: minY * S, w: (maxX - minX + 1) * S, h: (maxY - minY + 1) * S });
  }
  const out = [];
  for (const b of boxes) { // genau zuschneiden (nur sichtbare Bildpunkte)
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (let y = Math.max(0, b.y - 4); y < Math.min(H, b.y + b.h + 4); y += 1) for (let x = Math.max(0, b.x - 4); x < Math.min(W, b.x + b.w + 4); x += 1) if (d[(y * W + x) * 4 + 3] > 30) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 <= x0 || y1 <= y0) continue;
    const cv = document.createElement('canvas'); cv.width = x1 - x0 + 1; cv.height = y1 - y0 + 1; cv.getContext('2d').drawImage(cut, x0, y0, cv.width, cv.height, 0, 0, cv.width, cv.height);
    out.push({ cv, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 });
  }
  // Zeilen bilden
  out.sort((a, b) => a.cy - b.cy); const rows = [];
  for (const s of out) { const row = rows.find((r) => Math.abs(r.cy - s.cy) < H * 0.1); if (row) { row.items.push(s); row.cy = (row.cy * (row.items.length - 1) + s.cy) / row.items.length; } else rows.push({ cy: s.cy, items: [s] }); }
  return rows.flatMap((r) => r.items.sort((a, b) => a.cx - b.cx)).map((s) => s.cv);
}

// Bild nach Tageszeit und Wetter einfärben (einmal, nicht in jedem Bild)
function grade(src, zeit, wetter) {
  const pal = ZEIT[zeit] ?? ZEIT.mittag, w = WET[wetter] ?? WET.klar;
  const out = document.createElement('canvas'); out.width = src.width; out.height = src.height; const g = out.getContext('2d');
  if ('filter' in g) g.filter = `brightness(${(pal.bright * w.bright).toFixed(3)}) saturate(${(1 - w.gray * 0.3).toFixed(3)})`;
  g.drawImage(src, 0, 0); g.filter = 'none';
  if (pal.tint) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = css(pal.tint[0], pal.tint[1]); g.fillRect(0, 0, out.width, out.height); }
  return out;
}

export class Landschaft {
  constructor(canvas) {
    this.cv = canvas; this.c = canvas.getContext('2d'); this.cfg = null; this.store = new Map(); // url → { cut } oder { sprites }
    this.graded = { key: '', a: null, b: null }; this.mixCv = document.createElement('canvas'); this.mixCv.width = W; this.mixCv.height = H; this.mixKey = '';
    this.gradedSprites = { key: '', blumen: [], blaetter: [], bluete: [] };
    this.p = makeParticles(W, H); this.flash = 0; this.nextFlash = 5000; this.flash2 = 0; this.last = 0;
    this.flowers = []; this.zoneKey = ''; this.falling = []; this.landed = []; this.spawn = 0;
  }

  set(cfg) { this.cfg = cfg; for (const u of [cfg.a, cfg.b]) this.need(u, 'cut'); for (const u of Object.values(cfg.sprites ?? {})) this.need(u, 'sprites'); }

  need(url, kind) {
    if (!url || this.store.has(url)) return;
    this.store.set(url, { loading: true });
    loadImage(url).then((img) => {
      const cut = cutWindow(img, 'streng');
      this.store.set(url, kind === 'cut' ? { cut: cut.cv } : { sprites: extractSprites(cut.cv) });
      this.graded.key = ''; this.mixKey = ''; this.gradedSprites.key = '';
    }).catch(() => this.store.set(url, { failed: true }));
  }

  // Landschaft nach Tageszeit und Wetter einfärben und mit dem Fortschritt überblenden (Anfang ↔ Ende)
  composeLandscape() {
    const { a, b, zeit, wetter, fortschritt } = this.cfg; const A = this.store.get(a)?.cut, B = this.store.get(b)?.cut;
    if (!A && !B) return false;
    const gkey = `${a}|${b}|${zeit}|${wetter}|${!!A}${!!B}`;
    if (this.graded.key !== gkey) { this.graded = { key: gkey, a: A ? grade(A, zeit, wetter) : null, b: B ? grade(B, zeit, wetter) : null }; this.mixKey = ''; }
    const f = this.graded.a && this.graded.b ? clamp(fortschritt, 0, 1) : this.graded.b ? 1 : 0;
    const mkey = `${gkey}|${f.toFixed(3)}`;
    if (this.mixKey !== mkey) {
      const m = this.mixCv.getContext('2d'); m.clearRect(0, 0, W, H);
      if (this.graded.a && this.graded.b) { // Anfang mit (1−f), Ende mit f addieren: dort, wo beide Bilder Himmel haben, bleibt der Himmel frei
        m.globalAlpha = 1 - f; m.drawImage(this.graded.a, 0, 0); m.globalCompositeOperation = 'lighter'; m.globalAlpha = f; m.drawImage(this.graded.b, 0, 0); m.globalCompositeOperation = 'source-over'; m.globalAlpha = 1;
      } else m.drawImage(this.graded.b ?? this.graded.a, 0, 0);
      this.mixKey = mkey;
    }
    return true;
  }

  sprites() { // eingefärbte Einzelteile je Tageszeit und Wetter
    const { zeit, wetter, sprites } = this.cfg; const key = `${zeit}|${wetter}|${Object.values(sprites ?? {}).join(',')}|${[...this.store.values()].filter((v) => v.sprites).length}`;
    if (this.gradedSprites.key !== key) {
      const get = (u) => (this.store.get(u)?.sprites ?? []).map((cv) => grade(cv, zeit, wetter));
      this.gradedSprites = { key, blumen: get(sprites?.blumen), blaetter: get(sprites?.blaetter), bluete: get(sprites?.bluete) };
    }
    return this.gradedSprites;
  }

  zone() {
    const z = this.cfg.zone; const y0 = (z.wieseVon / 100) * H, y1 = Math.max(y0 + 10, (z.wieseBis / 100) * H);
    return { y0, y1, ex0: ((z.baumX - z.stamm / 2) / 100) * W, ex1: ((z.baumX + z.stamm / 2) / 100) * W, cx: (z.baumX / 100) * W, kw: (z.kroneBreite / 100) * W, ky: (z.kroneVon / 100) * H };
  }

  // Blumen: feste Plätze im Wiesenstreifen, nach Fortschritt kommen mehr dazu
  plantFlowers(n) {
    const Z = this.zone(); const key = `${Z.y0}|${Z.y1}|${Z.ex0}|${Z.ex1}|${n}`; if (this.zoneKey === key) return; this.zoneKey = key;
    const r = rng(77); const old = this.flowers; this.flowers = [];
    for (let i = 0; i < FLOWER_MAX * 3 && this.flowers.length < FLOWER_MAX; i += 1) {
      const x = 20 + r() * (W - 40), y = Z.y0 + Math.pow(r(), 0.8) * (Z.y1 - Z.y0);
      if (x > Z.ex0 && x < Z.ex1) continue;
      this.flowers.push({ x, y, k: r(), ph: r() * 6.28, spr: Math.floor(r() * 1000), v: old[this.flowers.length]?.v ?? 0 });
    }
    this.flowers.sort((p, q) => p.y - q.y);
  }

  flowerCount() {
    const { saison, fortschritt, dichte } = this.cfg; const d = dichte / 100, f = clamp(fortschritt, 0, 1);
    const n = saison === 'fruehling' ? Math.pow(f, 1.2) * 0.9 : saison === 'sommer' ? 0.6 + 0.4 * f : saison === 'herbst' ? 0.45 * (1 - f) : 0;
    return Math.round(FLOWER_MAX * d * n);
  }

  draw(t) {
    if (!this.cfg) return;
    const dt = Math.min(0.1, this.last ? (t - this.last) / 1000 : 0.016); this.last = t;
    const { zeit, wetter, wind: windPct, saison } = this.cfg; const pal = ZEIT[zeit] ?? ZEIT.mittag, w = WET[wetter] ?? WET.klar, wind = (windPct ?? 30) / 100;
    const c = this.c; c.clearRect(0, 0, W, H);
    sky(c, W, H, t, pal, w, 321, 0.7 + wind * 2);
    if (!this.composeLandscape()) return; // Bilder laden noch
    c.drawImage(this.mixCv, 0, 0);
    Kulisse.prototype.mist.call(this, c, W, H, t, pal, w, H * 0.66, 0.8);
    const S = this.sprites(); const Z = this.zone();
    this.drawLanded(c, dt);
    this.drawFlowers(c, t, dt, S, Z, wind);
    this.spawnFalling(dt, S, Z, wind, saison);
    this.drawFalling(c, t, dt, wind);
    Kulisse.prototype.weather.call(this, c, W, H, t, dt, { pal, w, name: 'jz' }, wind);
  }

  drawFlowers(c, t, dt, S, Z, wind) {
    const set = S.blumen; if (!set.length) return;
    this.plantFlowers(set.length); const count = this.flowerCount();
    const spring = set.length === 15 ? [0, 1, 2, 5, 6, 7, 10, 11, 13, 9] : null; // Gänseblümchen, Tulpen, Glockenblumen, Löwenzahn, Hahnenfuß, Flieder: im Frühling ohne Sonnenblume und Mohn
    this.flowers.forEach((f, i) => {
      const target = i < count ? 1 : 0; f.v = clamp(f.v + (target ? dt / 1.8 : -dt / 1.0), 0, 1); if (f.v <= 0) return;
      const pool = this.cfg.saison === 'fruehling' && spring ? spring : null; const idx = pool ? pool[f.spr % pool.length] : f.spr % set.length; const spr = set[idx];
      const ty = (f.y - Z.y0) / Math.max(1, Z.y1 - Z.y0); const hh = 46 + 78 * ty * (0.8 + 0.4 * f.k); const sc = (hh / spr.height) * ease(f.v);
      c.save(); c.translate(f.x, f.y); c.rotate(Math.sin(t / 900 + f.ph) * 0.05 * (0.3 + wind * 2)); c.scale(sc, sc); c.drawImage(spr, -spr.width / 2, -spr.height); c.restore();
    });
  }

  // Blätter im Herbst, Blüten im Frühling lösen sich aus der Krone und fallen schaukelnd zu Boden
  spawnFalling(dt, S, Z, wind, saison) {
    const set = saison === 'herbst' ? S.blaetter : saison === 'fruehling' ? S.bluete : []; if (!set.length) return;
    const f = clamp(this.cfg.fortschritt, 0, 1); const rate = (this.cfg.fall / 50) * (saison === 'herbst' ? 0.5 + 3 * f : 0.4 + 2.5 * f);
    this.spawn += rate * dt; const r = Math.random;
    while (this.spawn >= 1 && this.falling.length < 140) {
      this.spawn -= 1;
      this.falling.push({ x: Z.cx + (r() - 0.5) * Z.kw, y: Z.ky + r() * H * 0.4, vx: (r() - 0.5) * 24 + wind * 46, vy: 34 + r() * 46, rot: r() * 6.28, vr: (r() - 0.5) * 2.2, h: saison === 'herbst' ? 30 + r() * 24 : 18 + r() * 14, spr: Math.floor(r() * set.length), ph: r() * 6.28, land: Z.y0 + r() * (Z.y1 - Z.y0), set: saison });
    }
    if (this.spawn > 3) this.spawn = 0;
  }

  drawFalling(c, t, dt, wind) {
    const S = this.gradedSprites;
    for (let i = this.falling.length - 1; i >= 0; i -= 1) {
      const p = this.falling[i]; p.y += p.vy * dt; p.x += (p.vx + Math.sin(t / 700 + p.ph) * 26) * dt; p.rot += p.vr * dt;
      const set = p.set === 'herbst' ? S.blaetter : S.bluete; const spr = set[p.spr % Math.max(1, set.length)];
      if (!spr) { this.falling.splice(i, 1); continue; }
      if (p.y >= p.land) { this.falling.splice(i, 1); if (this.landed.length < 180) this.landed.push({ x: p.x, y: p.land, rot: p.rot, h: p.h, spr: p.spr, set: p.set, age: 0, life: p.set === 'herbst' ? 40 + Math.random() * 40 : 12 + Math.random() * 12 }); continue; }
      const sc = p.h / spr.height; c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.scale(sc, sc * (0.55 + 0.45 * Math.abs(Math.cos(t / 500 + p.ph)))); c.drawImage(spr, -spr.width / 2, -spr.height / 2); c.restore();
    }
  }

  // Gelandete Blätter liegen flach auf der Wiese und verschwinden nach einer Weile wieder
  drawLanded(c, dt) {
    const S = this.gradedSprites;
    for (let i = this.landed.length - 1; i >= 0; i -= 1) {
      const p = this.landed[i]; p.age += dt; if (p.age > p.life) { this.landed.splice(i, 1); continue; }
      const set = p.set === 'herbst' ? S.blaetter : S.bluete; const spr = set[p.spr % Math.max(1, set.length)]; if (!spr) continue;
      const a = clamp((p.life - p.age) / 3, 0, 1); const sc = p.h / spr.height;
      c.save(); c.globalAlpha = a; c.translate(p.x, p.y); c.rotate(p.rot); c.scale(sc, sc * 0.4); c.drawImage(spr, -spr.width / 2, -spr.height / 2); c.restore();
    }
  }
}
