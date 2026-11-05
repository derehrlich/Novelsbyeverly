// Gaming-Szene: Design, Kamerafenster, Deathcounter.
import { $, api, initSeite, meldung, run, show } from './common.js';
import { sammle, zeichne } from './formular.js';

const OPT = {
  gamingDesign: [['gemuetlich', 'Gemütlich (Landschaft, Holzrahmen)'], ['glas', 'Glas (schlicht, durchscheinend, an Apple angelehnt)']],
  gamingHintergrund: [['design', 'Landschaft bzw. Glasverlauf (je nach Design)'], ['obs', 'Unscharfes Spielbild (Rand durchsichtig, Unschärfe in OBS)']],
  gamingTodePos: [['oben-links', 'Oben links'], ['oben-mitte', 'Oben Mitte'], ['oben-rechts', 'Oben rechts'], ['unten-links', 'Unten links'], ['unten-mitte', 'Unten Mitte'], ['unten-rechts', 'Unten rechts']],
};
const SCHEMA = [
  ['Aussehen', [
    ['gamingDesign', 'Design', 'select', 'Glas: ruhiger Farbverlauf nach Tageszeit, durchscheinende Rahmen mit feiner Lichtkante, Deathcounter als Glaskapsel. Die Farben der Karten (Deathcounter im Design Gemütlich) stellst du unter „Overlay“ ein.'],
    ['gamingHintergrund', 'Hintergrund am Rand', 'select', 'Unscharfes Spielbild: In OBS die Spielaufnahme kopieren („Als Referenz einfügen“), auf Vollbild ziehen (Strg+F), Filter „Unschärfe“ hinzufügen und diese Kopie UNTER das scharfe Spiel legen. Reihenfolge in der OBS-Quellenliste von oben nach unten (oben = vorne): Gaming-Overlay, Kamera, Spiel, unscharfe Kopie.'],
    ['gamingAbdunkeln', 'Rand abdunkeln in % (nur bei unscharfem Spielbild, 0–80)', 'number'],
  ]],
  ['Kamerafenster', [
    ['gamingKameraOL', 'Kamerafenster oben links', 'bool', 'Nicht angehakte Fenster fehlen ganz. Das Kamerabild ist quadratisch und sitzt mit Abstand zum Bildrand in der Ecke, über dem Spielrahmen.'],
    ['gamingKameraOR', 'Kamerafenster oben rechts', 'bool'], ['gamingKameraUL', 'Kamerafenster unten links', 'bool'], ['gamingKameraUR', 'Kamerafenster unten rechts', 'bool'],
    ['gamingKameraGroesse', 'Kamera: Seitenlänge in Pixeln (160–700)', 'number'],
    ['gamingKameraUeberlappung', 'Kamera ragt so viele Pixel ins Spielfenster (0–300)', 'number', 'Das Spielfenster macht den Kameras Platz und wird dafür kleiner (bleibt 16:9). Bei 0 liegt die Kamera daneben, bei größeren Werten überlappt sie mehr vom Spielbild. Ohne Kamerafenster füllt das Spiel fast das ganze Bild.'],
  ]],
  ['Deathcounter', [
    ['gamingTode', 'Deathcounter anzeigen', 'bool', 'Steuerung im Chat (!tod), per Hotkey oder oben.'],
    ['gamingTodeLabel', 'Beschriftung', 'text'], ['gamingTodePos', 'Position im Spielfenster', 'select', 'Steht in derselben Ecke ein Kamerafenster, rückt die Karte daneben.'],
    ['gamingTodeSekunden', 'Blendet nach … Sekunden aus (0 = bleibt sichtbar)', 'number', 'Er erscheint bei jedem Zählen, bei !tode und mit „Einblenden“ und verschwindet nach dieser Zeit wieder.'],
    ['gamingTodeChat', 'Bot schreibt die Zahl bei jeder Änderung in den Chat', 'bool'],
    ['gamingTodeTemplate', 'Chat-Text', 'area', '{n} {label}'],
  ]],
];

const todeUrl = () => `${location.origin}/api/tod?aktion=plus&token=DEIN_INGEST_TOKEN`;
async function ladeTode() { $('todeZahl').textContent = (await api('GET', 'tode')).n; }
const aktion = (a, wert) => run(async () => { $('todeZahl').textContent = (await api('POST', 'tode', { aktion: a, wert })).n; });

$('kopieren').onclick = () => navigator.clipboard.writeText($('gamingUrl').textContent).then(() => meldung('Kopiert')).catch(() => meldung('Bitte von Hand markieren und kopieren', true));
$('todeKopieren').onclick = () => navigator.clipboard.writeText(todeUrl()).then(() => meldung('Kopiert')).catch(() => meldung('Bitte von Hand markieren und kopieren', true));
$('todePlus').onclick = aktion('plus'); $('todeMinus').onclick = aktion('minus'); $('todeZeigen').onclick = aktion('zeigen');
$('todeSetzen').onclick = run(async () => { $('todeZahl').textContent = (await api('POST', 'tode', { aktion: 'set', wert: $('todeWert').value })).n; $('todeWert').value = ''; });
$('todeReset').onclick = run(async () => { if (confirm('Deathcounter auf 0 setzen?')) $('todeZahl').textContent = (await api('POST', 'tode', { aktion: 'reset' })).n; });
$('speichern').onclick = run(async () => { await api('PUT', 'settings', sammle($('formular'))); meldung('Gespeichert – schau ins Overlay'); });

async function start() {
  const state = await api('GET', 'state'); // ohne Anmeldung bricht das hier ab und zeigt den Login
  show(true);
  $('gamingUrl').textContent = `${location.origin}/gaming`;
  $('todeUrl').textContent = todeUrl();
  $('tokenHinweis').textContent = state.env?.INGEST_TOKEN
    ? 'INGEST_TOKEN ist gesetzt. Statt DEIN_INGEST_TOKEN setzt du ihn ein. Weitere Aktionen: aktion=minus, reset, zeigen, set&wert=12.'
    : 'INGEST_TOKEN ist noch nicht gesetzt: in der Datei novelsbyeverly.env im Datenordner eintragen (Zeile INGEST_TOKEN=ein-langes-geheimes-wort) und neu starten.';
  const { settings } = await api('GET', 'settings');
  zeichne($('formular'), SCHEMA, OPT, settings);
  await ladeTode();
}
initSeite(start);
