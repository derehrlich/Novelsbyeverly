// Das Aussehen der Karten im Overlay (Uhr, Wörter, To-Do, Musik, Banner): Farbschema, Rundung, Rahmen, Schrift.
// Wird vom Overlay, vom Admin (Vorschau) und vom Server (Prüfung der Eingaben) benutzt.
export const THEMES = {
  warm: { name: 'Warm (Standard)', papier: '#fbf6eb', rand: '#bba98a', text: '#4d4236', leise: '#8a7b66', fokus: '#7f9a74', pause: '#c9985c', akzent: '#c08a72' },
  nacht: { name: 'Nacht', papier: '#2c2a3a', rand: '#6f6a8f', text: '#f0e9dc', leise: '#b0a8c4', fokus: '#7fb39a', pause: '#d9a35f', akzent: '#c98fb0' },
  mint: { name: 'Mint', papier: '#f1f8f3', rand: '#8fb5a0', text: '#2f4a3e', leise: '#6b8a7a', fokus: '#4f9a7b', pause: '#d1a24f', akzent: '#6fa7b8' },
  rosa: { name: 'Rosa', papier: '#fff3f4', rand: '#d6a0ab', text: '#5a3a42', leise: '#9a7580', fokus: '#8fa87f', pause: '#d99a5a', akzent: '#d1708a' },
  klar: { name: 'Klar und schlicht', papier: '#ffffff', rand: '#d0d0d0', text: '#222222', leise: '#6b6b6b', fokus: '#3f8f5f', pause: '#d08a2a', akzent: '#3a6fd0' },
};
export const FARB_NAMEN = { papier: 'Karte (Hintergrund)', rand: 'Rahmen', text: 'Text', leise: 'Nebentext', fokus: 'Fokus (grün)', pause: 'Pause (orange)', akzent: 'Akzent' };
export const SCHRIFTEN = {
  rund: ['Rund (Fredoka)', 'Fredoka, system-ui, sans-serif'],
  schlicht: ['Schlicht', "system-ui, 'Segoe UI', Roboto, sans-serif"],
  serif: ['Buchschrift', "Georgia, 'Times New Roman', serif"],
  mono: ['Schreibmaschine', "'Courier New', ui-monospace, monospace"],
};
export const DEFAULT_DESIGN = { theme: 'warm', farben: {}, deckkraft: 92, radius: 26, randBreite: 3, schrift: 'rund', schatten: true };

const HEX = /^#[0-9a-f]{6}$/i;
const clamp = (v, lo, hi, def) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : def; };

// Prüft Eingaben und ergänzt Fehlendes mit dem Standard. Unbekanntes fällt weg.
export function normalizeDesign(input, base = DEFAULT_DESIGN) {
  const i = input && typeof input === 'object' ? input : {};
  const farben = {};
  for (const k of Object.keys(FARB_NAMEN)) {
    const v = i.farben && k in i.farben ? i.farben[k] : base.farben?.[k];
    if (typeof v === 'string' && HEX.test(v)) farben[k] = v.toLowerCase();
  }
  return {
    theme: i.theme in THEMES ? i.theme : (base.theme in THEMES ? base.theme : 'warm'),
    farben: 'farben' in i && i.farben === null ? {} : farben,
    deckkraft: clamp(i.deckkraft ?? base.deckkraft, 40, 100, DEFAULT_DESIGN.deckkraft),
    radius: clamp(i.radius ?? base.radius, 0, 44, DEFAULT_DESIGN.radius),
    randBreite: clamp(i.randBreite ?? base.randBreite, 0, 8, DEFAULT_DESIGN.randBreite),
    schrift: i.schrift in SCHRIFTEN ? i.schrift : (base.schrift in SCHRIFTEN ? base.schrift : 'rund'),
    schatten: 'schatten' in i ? Boolean(i.schatten) : Boolean(base.schatten ?? true),
  };
}

// Die Farben, die tatsächlich gelten: Farbschema, darüber die eigenen Anpassungen
export const effektiveFarben = (d) => ({ ...THEMES[d?.theme in THEMES ? d.theme : 'warm'], ...(d?.farben ?? {}) });

const rgba = (h, a) => `rgba(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)}, ${a})`;

// CSS-Variablen für das Overlay
export function designVars(design) {
  const d = normalizeDesign(design), c = effektiveFarben(d);
  return {
    '--papier': rgba(c.papier, d.deckkraft / 100), '--rand': c.rand, '--text': c.text, '--leise': c.leise, '--fokus': c.fokus, '--pause': c.pause, '--bereit': c.leise, '--akzent': c.akzent,
    '--radius': `${d.radius}px`, '--randbreite': `${d.randBreite}px`, '--schrift': SCHRIFTEN[d.schrift][1],
    '--schatten': d.schatten ? '0 10px 26px rgba(50, 40, 28, .22)' : 'none',
  };
}
export function applyDesign(el, design) { for (const [k, v] of Object.entries(designVars(design))) el.style.setProperty(k, v); }
