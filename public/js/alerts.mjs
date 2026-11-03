// Die Alerts (Buch, das aufklappt): Arten, Standardtexte, Schrift, Größe, Position.
// Wird von der OBS-Quelle (alertquelle.html), vom Admin (Alerts-Seite) und vom Server (Prüfung der Eingaben) benutzt.
export const ARTEN = {
  follow: { name: 'Follow', beispiel: { name: 'Lena' }, platzhalter: ['name'] },
  sub: { name: 'Abo', beispiel: { name: 'Lena', monate: 1 }, platzhalter: ['name', 'monate'] },
  giftsub: { name: 'Geschenk-Abos', beispiel: { name: 'Lena', anzahl: 5 }, platzhalter: ['name', 'anzahl'] },
  cheer: { name: 'Bits', beispiel: { name: 'Lena', bits: 500, nachricht: 'Viel Erfolg beim Schreiben!' }, platzhalter: ['name', 'bits', 'nachricht'] },
  raid: { name: 'Raid', beispiel: { name: 'Lena', zuschauer: 42 }, platzhalter: ['name', 'zuschauer'] },
};
export const PLATZHALTER = { name: 'Name', monate: 'Monate', anzahl: 'Anzahl', bits: 'Bits', nachricht: 'Nachricht', zuschauer: 'Zuschauer' };

// Seite des Buchs: links „Beschriftung“ und „Nebentext“, rechts der große „Name“. Texte dürfen Platzhalter in {geschweiften Klammern} enthalten.
export const DEFAULT_ARTEN = {
  follow: { an: true, label: 'Neu im Garten', name: '{name}', sub: 'Schön, dass du da bist', dauer: 4, konfetti: 70 },
  sub: { an: true, label: 'Neues Abo', name: '{name}', sub: 'Danke von Herzen', labelWieder: '{monate} Monate dabei', subWieder: 'Danke für deine Treue', dauer: 5, konfetti: 110 },
  giftsub: { an: true, label: 'Geschenkte Abos', name: '{anzahl}×', sub: 'von {name}', dauer: 5, konfetti: 120 },
  cheer: { an: true, label: '{bits} Bits', name: '{name}', sub: '{nachricht}', dauer: 4, konfetti: 90 },
  raid: { an: true, label: 'Raid', name: '{name}', sub: '{zuschauer} Zuschauer', dauer: 6, konfetti: 160 },
};

// Schriften, die es in OBS (Browser-Quelle) auf jedem PC gibt, plus „Eigene“: der Name einer auf dem PC installierten Schrift.
export const ALERT_SCHRIFTEN = {
  rund: ['Rund (Fredoka)', 'Fredoka, system-ui, sans-serif'],
  schlicht: ['Schlicht', "system-ui, 'Segoe UI', Roboto, sans-serif"],
  serif: ['Buchschrift', "Georgia, 'Times New Roman', serif"],
  mono: ['Schreibmaschine', "'Courier New', ui-monospace, monospace"],
  hand: ['Handschrift', "'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive"],
  schreib: ['Schreibschrift', "'Segoe Script', 'Brush Script MT', 'Snell Roundhand', cursive"],
  eigene: ['Eigene (Name unten eintragen)', null],
};

export const DEFAULT_ALERTS = {
  an: true,
  schrift: 'rund',
  eigeneSchrift: '', // Name einer installierten Schrift, gilt bei schrift = 'eigene'
  groesseName: 100, // Prozent
  groesseLabel: 100,
  groesseSub: 100,
  groesseBuch: 100, // Prozent
  x: 0, // Verschiebung der Buchmitte nach rechts (px, 1920 breit)
  y: 0, // Verschiebung nach unten (px, 1080 hoch)
  textFarbe: '#4d4236', // Name
  labelFarbe: '#b0745a', // Beschriftung
  subFarbe: '#7a6b57', // Nebentext
  arten: DEFAULT_ARTEN,
};

const HEX = /^#[0-9a-f]{6}$/i;
const clamp = (v, lo, hi, def) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : def; };
const text = (v, def, max = 80) => (typeof v === 'string' ? v.slice(0, max) : def);
const farbe = (v, def) => (typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : def);

// Prüft Eingaben und ergänzt Fehlendes mit dem Standard. Unbekanntes fällt weg.
export function normalizeAlerts(input, base = DEFAULT_ALERTS) {
  const i = input && typeof input === 'object' ? input : {};
  const b = base && typeof base === 'object' ? base : DEFAULT_ALERTS;
  const arten = {};
  for (const [art, std] of Object.entries(DEFAULT_ARTEN)) {
    const alt = { ...std, ...(b.arten?.[art] ?? {}) }, neu = i.arten?.[art] && typeof i.arten[art] === 'object' ? i.arten[art] : {};
    const out = {
      an: 'an' in neu ? Boolean(neu.an) : Boolean(alt.an),
      label: text(neu.label, alt.label), name: text(neu.name, alt.name), sub: text(neu.sub, alt.sub, 120),
      dauer: clamp(neu.dauer ?? alt.dauer, 1, 30, std.dauer), konfetti: clamp(neu.konfetti ?? alt.konfetti, 0, 300, std.konfetti),
    };
    if ('labelWieder' in std) { out.labelWieder = text(neu.labelWieder, alt.labelWieder); out.subWieder = text(neu.subWieder, alt.subWieder, 120); }
    arten[art] = out;
  }
  const eigene = typeof i.eigeneSchrift === 'string' ? i.eigeneSchrift.replace(/[^\p{L}\p{N} \-]/gu, '').trim().slice(0, 60) : (b.eigeneSchrift ?? '');
  return {
    an: 'an' in i ? Boolean(i.an) : Boolean(b.an ?? true),
    schrift: i.schrift in ALERT_SCHRIFTEN ? i.schrift : (b.schrift in ALERT_SCHRIFTEN ? b.schrift : 'rund'),
    eigeneSchrift: eigene,
    groesseName: clamp(i.groesseName ?? b.groesseName, 40, 250, 100), groesseLabel: clamp(i.groesseLabel ?? b.groesseLabel, 40, 250, 100), groesseSub: clamp(i.groesseSub ?? b.groesseSub, 40, 250, 100),
    groesseBuch: clamp(i.groesseBuch ?? b.groesseBuch, 40, 200, 100),
    x: clamp(i.x ?? b.x, -960, 960, 0), y: clamp(i.y ?? b.y, -400, 700, 0),
    textFarbe: farbe(i.textFarbe ?? b.textFarbe, DEFAULT_ALERTS.textFarbe), labelFarbe: farbe(i.labelFarbe ?? b.labelFarbe, DEFAULT_ALERTS.labelFarbe), subFarbe: farbe(i.subFarbe ?? b.subFarbe, DEFAULT_ALERTS.subFarbe),
    arten,
  };
}

export const alertSchrift = (a) => (a.schrift === 'eigene' && a.eigeneSchrift ? `'${a.eigeneSchrift}', Fredoka, sans-serif` : (ALERT_SCHRIFTEN[a.schrift]?.[1] ?? ALERT_SCHRIFTEN.rund[1]));

// {name} usw. ersetzen; Fehlendes bleibt leer
export const fuelle = (tpl, vars) => String(tpl ?? '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? '')).replace(/\s+/g, ' ').trim();

// Aus einem Ereignis ({type, name, …}) die drei Texte für das Buch machen; null, wenn es kein Alert ist oder die Art aus ist.
export function alertTexte(ev, alerts, { test = false } = {}) {
  const cfg = normalizeAlerts(alerts), art = cfg.arten[ev?.type];
  if (!art || (!test && (!cfg.an || !art.an))) return null;
  const wieder = ev.type === 'sub' && Number(ev.monate) > 1;
  const vars = { name: ev.name, monate: ev.monate, anzahl: ev.anzahl, bits: ev.bits, nachricht: ev.nachricht, zuschauer: ev.zuschauer };
  return {
    label: fuelle(wieder ? art.labelWieder : art.label, vars), name: fuelle(art.name, vars), sub: fuelle(wieder ? art.subWieder : art.sub, vars),
    dauer: art.dauer * 1000, konfetti: art.konfetti,
  };
}
