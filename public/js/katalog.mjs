// Katalog für Figuren, Ränge, Zimmer-Dekoration und Szenen. Wird vom Server (Befehle, Freischaltungen) und vom Overlay
// (Zeichnen) gemeinsam genutzt, deshalb ohne jede Abhängigkeit.

export const norm = (s) => String(s ?? '').toLowerCase().trim()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');

export const FARBEN = {
  schwarz: '#3a3036', braun: '#7a5640', blond: '#d9bd86', rot: '#b5604f', orange: '#cf9060', gelb: '#dcc47a',
  gruen: '#7f9a74', blau: '#7b9bb0', lila: '#9a86ad', rosa: '#d9a6a4', weiss: '#ece5d6', grau: '#9a9aa0',
};
export const HAUT = { 1: '#f3d9c3', 2: '#e8c1a0', 3: '#cf9f7a', 4: '#a67352', 5: '#7a4f38' };
export const FRISUREN = ['kurz', 'lang', 'zopf', 'locken', 'dutt', 'glatze'];

// Freischaltbare Gegenstände einer Person (Stunden = persönliche Arbeitszeit)
export const ITEMS = [
  { id: 'muetze', slot: 'kopf', label: 'Mütze', hours: 1 },
  { id: 'brille', slot: 'gesicht', label: 'Brille', hours: 3 },
  { id: 'kakao', slot: 'getraenk', label: 'Kakao', hours: 5 },
  { id: 'kopfhoerer', slot: 'kopf', label: 'Kopfhörer', hours: 6 },
  { id: 'schal', slot: 'hals', label: 'Schal', hours: 10 },
  { id: 'sonnenbrille', slot: 'gesicht', label: 'Sonnenbrille', hours: 12 },
  { id: 'katze', slot: 'tier', label: 'Katze', hours: 15 },
  { id: 'blumenkranz', slot: 'kopf', label: 'Blumenkranz', hours: 25 },
  { id: 'schreibmaschine', slot: 'tisch', label: 'Schreibmaschine', hours: 30 },
  { id: 'eule', slot: 'tier', label: 'Eule', hours: 40 },
];

// Wahlmöglichkeiten je Platz. "farbe"-Plätze nehmen einen Farbnamen, die anderen eine feste Liste.
export const SLOTS = {
  haare: { label: 'Haarfarbe', farben: true },
  frisur: { label: 'Frisur', werte: FRISUREN },
  haut: { label: 'Hautton', werte: ['1', '2', '3', '4', '5'] },
  oberteil: { label: 'Oberteil', farben: true },
  kopf: { label: 'Kopf', werte: ['keine', ...ITEMS.filter((i) => i.slot === 'kopf').map((i) => i.id)] },
  gesicht: { label: 'Gesicht', werte: ['keine', ...ITEMS.filter((i) => i.slot === 'gesicht').map((i) => i.id)] },
  hals: { label: 'Hals', werte: ['keine', ...ITEMS.filter((i) => i.slot === 'hals').map((i) => i.id)] },
  tier: { label: 'Tier', werte: ['keine', ...ITEMS.filter((i) => i.slot === 'tier').map((i) => i.id)] },
  tisch: { label: 'Tisch', werte: ['laptop', 'notizbuch', 'schreibmaschine'] },
  getraenk: { label: 'Getränk', werte: ['tee', 'kaffee', 'kakao'] },
};
// Schreibweisen, die im Chat statt des Platznamens erlaubt sind
export const SLOT_ALIASE = { haar: 'haare', haarfarbe: 'haare', farbe: 'oberteil', shirt: 'oberteil', pulli: 'oberteil', hut: 'kopf', kopfbedeckung: 'kopf', schmuck: 'gesicht', hautfarbe: 'haut', drink: 'getraenk', trinken: 'getraenk', haustier: 'tier', pet: 'tier', schreibtisch: 'tisch', geraet: 'tisch' };

export const DEFAULT_FIGUR = { haut: '2', haare: 'braun', frisur: 'kurz', oberteil: 'blau', kopf: 'keine', gesicht: 'keine', hals: 'keine', tier: 'keine', tisch: 'laptop', getraenk: 'tee' };

// Ränge nach persönlicher Arbeitszeit
export const RAENGE = [
  { id: 'tintenfleck', label: 'Tintenfleck', hours: 0 },
  { id: 'notizbuch', label: 'Notizbuch', hours: 1 },
  { id: 'federkiel', label: 'Federkiel', hours: 3 },
  { id: 'schreibstube', label: 'Schreibstube', hours: 6 },
  { id: 'lektorat', label: 'Lektorat', hours: 12 },
  { id: 'manuskript', label: 'Manuskript', hours: 25 },
  { id: 'bestseller', label: 'Bestseller', hours: 50 },
  { id: 'bibliothek', label: 'Bibliothek', hours: 100 },
  { id: 'legende', label: 'Legende', hours: 200 },
];

// Dekoration des gemeinsamen Zimmers nach gemeinsamer Arbeitszeit aller Mitschreibenden
export const DEKO = [
  { id: 'lichter', label: 'Lichterkette', hours: 2 },
  { id: 'pflanzen', label: 'Pflanzen', hours: 5 },
  { id: 'katze', label: 'Zimmerkatze', hours: 10 },
  { id: 'buecher', label: 'Bücherstapel', hours: 20 },
  { id: 'voegel', label: 'Vögel & Schmetterlinge', hours: 40 },
  { id: 'regenbogen', label: 'Regenbogen', hours: 80 },
];

export const SZENEN = {
  cafe: { label: 'Café', ort: 'ins Café' },
  garten: { label: 'Garten', ort: 'in den Garten' },
  park: { label: 'Park', ort: 'in den Park' },
};
export const MAX_PLAETZE = 10;

export const rankFor = (minutes) => [...RAENGE].reverse().find((r) => minutes >= r.hours * 60) ?? RAENGE[0];
export const nextRank = (minutes) => RAENGE.find((r) => r.hours * 60 > minutes) ?? null;
export const unlockedItems = (minutes) => ITEMS.filter((i) => minutes >= i.hours * 60).map((i) => i.id);
export const unlockedDeko = (minutes) => DEKO.filter((d) => minutes >= d.hours * 60).map((d) => d.id);

// Wertebereich eines Platzes: Farben, feste Liste oder Items
export function slotValues(slot) {
  const s = SLOTS[slot];
  return s?.farben ? Object.keys(FARBEN) : s?.werte ?? [];
}

// Prüft eine Figur auf bekannte Werte und fehlende Freischaltungen; unbekanntes wird auf den Standard gesetzt.
export function cleanFigur(figur, minutes = Infinity) {
  const out = { ...DEFAULT_FIGUR };
  for (const slot of Object.keys(SLOTS)) {
    const v = norm(figur?.[slot]);
    if (!slotValues(slot).includes(v)) continue;
    const item = ITEMS.find((i) => i.id === v && i.slot === slot);
    if (item && minutes < item.hours * 60) continue;
    out[slot] = v;
  }
  return out;
}

// Stabile Zufallsfigur aus der Twitch-ID, damit nicht alle gleich aussehen
export function startFigur(id) {
  const hash = (salt) => {
    let h = 2166136261 ^ salt;
    for (const c of String(id)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
    h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13;
    return h >>> 0;
  };
  const pick = (list, salt) => list[hash(salt) % list.length];
  const farben = Object.keys(FARBEN);
  return {
    ...DEFAULT_FIGUR,
    haut: pick(['1', '2', '3', '4', '5'], 1),
    haare: pick(farben.filter((f) => !['weiss', 'grau'].includes(f)), 2),
    frisur: pick(FRISUREN.filter((f) => f !== 'glatze'), 3),
    oberteil: pick(farben, 4),
  };
}
