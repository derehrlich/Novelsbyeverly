// Standard-Anordnung der Überlagerungen (Koordinaten im 1920×1080-Bild) und Prüfung für gespeicherte Anordnungen.
// x, y = linke obere Ecke (Karten, Kamera) bzw. Standfläche (Module); s = Größe (1 = normal); w, h = Größe der Kamera.
export const DEFAULT_LAYOUT = {
  uhr: { x: 36, y: 28, s: 1, on: true },
  woerter: { x: 1524, y: 28, s: 1, on: true },
  tasks: { x: 36, y: 300, s: 1, on: true },
  kamera: { x: 1440, y: 290, w: 420, h: 420, on: true }, // immer quadratisch (1:1)
  musik: { x: 36, y: 700, s: 1, on: true },
  blume: { x: 700, y: 930, s: 1, on: true },
  kerze: { x: 960, y: 930, s: 1, on: true },
  buecher: { x: 1220, y: 930, s: 1, on: true },
};

const LIMITS = { x: [-400, 2200], y: [-200, 1300], s: [0.4, 2.5], w: [160, 1080], h: [160, 1080] };

// Nimmt eine (teilweise) Anordnung und liefert eine vollständige, geprüfte. Unbekannte Schlüssel fallen weg.
export function normalizeLayout(input, base = DEFAULT_LAYOUT) {
  const out = {};
  for (const [key, def] of Object.entries(DEFAULT_LAYOUT)) {
    const from = { ...def, ...(base?.[key] ?? {}) };
    const given = input?.[key] ?? {};
    const item = {};
    for (const prop of Object.keys(def)) {
      const v = prop in given ? given[prop] : from[prop];
      if (prop === 'on') item.on = Boolean(v);
      else {
        const n = Number(v);
        item[prop] = Number.isFinite(n) ? Math.min(LIMITS[prop][1], Math.max(LIMITS[prop][0], Math.round(n * 100) / 100)) : def[prop];
      }
    }
    out[key] = item;
  }
  out.kamera.h = out.kamera.w; // das Kamerabild ist immer quadratisch
  return out;
}
