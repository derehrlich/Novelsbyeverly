// Overlay-Studio: Darstellung, Design und Anordnung des Overlays mit Live-Vorschau. Gespeichert wird erst mit „Speichern“.
import { DEFAULT_LAYOUT, normalizeLayout } from '../js/layout.mjs';
import { DEFAULT_DESIGN, FARB_NAMEN, SCHRIFTEN, THEMES, effektiveFarben, normalizeDesign } from '../js/design.mjs';
import { $, api, esc, initSeite, meldung, run, show } from './common.js';

// ---- Auswahlfelder (Schaltflächen). key = Einstellung, Werte = [Wert, Beschriftung]
const AUSWAHL = {
  modi: ['szeneModus', [['wachstum', 'Wachsende Landschaft'], ['fenster', 'Fenster-Ansicht'], ['zimmer', 'Zimmer mit Figuren (pausiert)']]],
  jahreszeiten: ['jahreszeit', [['auto', 'Auto'], ['fruehling', 'Frühling'], ['sommer', 'Sommer'], ['herbst', 'Herbst'], ['winter', 'Winter']]],
  tageszeiten: ['tageszeit', [['auto', 'Auto'], ['morgen', 'Morgengrauen'], ['mittag', 'Mittag'], ['abend', 'Abend']]],
  quellen: ['wachstumQuelle', [['ziel', 'Ziel-Karte'], ['zeit', 'Streamzeit'], ['woerter', 'Wörter'], ['pomodoro', 'Pomodoros'], ['kombi', 'Zeit + Ziel']]],
  fensterOrte: ['fensterOrt', [['lese', 'Gemütliche Leseecke'], ['arbeit', 'Arbeitsplatz']]],
  fensterBlicke: ['fensterBlick', [['stadt', 'Stadt'], ['landschaft', 'Landschaft'], ['wald', 'Wald'], ['see', 'See']]],
  fensterWetter: ['fensterWetter', [['auto', 'Auto (Winter: Schnee)'], ['klar', 'Klar'], ['regen', 'Regen'], ['schnee', 'Schnee']]],
};
const MODULE = [['moduleBlume', 'Blume (wächst mit den Wörtern)'], ['moduleKerze', 'Kerze (brennt mit dem Pomodoro)'], ['moduleBuecher', 'Bücher (wachsen mit den Pomodoros)']];

let draft = null, gespeichert = null, jetzt = { jahreszeit: 'fruehling', tageszeit: 'mittag' }, vorschauFortschritt = null, geaendert = false;

// ---- Vorschau: schickt den Entwurf an das Overlay im Rahmen
let frame = 0;
function pushVorschau() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    if (!draft) return;
    const d = draft;
    const jahr = d.jahreszeit === 'auto' ? jetzt.jahreszeit : d.jahreszeit;
    const patch = {
      modus: d.szeneModus, layout: layoutState, design: d.design,
      fenster: { ort: d.fensterOrt, blick: d.fensterBlick, wetter: d.fensterWetter === 'auto' ? (jahr === 'winter' ? 'schnee' : 'klar') : d.fensterWetter },
      modules: { blume: d.moduleBlume, kerze: d.moduleKerze, buecher: d.moduleBuecher },
    };
    if (d.jahreszeit !== 'auto') patch.jahreszeit = d.jahreszeit;
    if (d.tageszeit !== 'auto') patch.tageszeit = d.tageszeit;
    if (vorschauFortschritt !== null) patch.progress = vorschauFortschritt;
    $('editorFrame').contentWindow?.postMessage({ type: 'vorschau', patch }, location.origin);
  });
}
function aendern() { geaendert = true; $('speicherLeiste').classList.add('offen'); pushVorschau(); }

// ---- Auswahl-Schaltflächen
function renderAuswahl() {
  for (const [boxId, [key, opts]] of Object.entries(AUSWAHL)) {
    $(boxId).innerHTML = opts.map(([v, label]) => `<button data-v="${v}" class="${draft[key] === v ? 'aktiv' : ''}">${label}</button>`).join('');
    for (const b of $(boxId).querySelectorAll('button')) b.onclick = () => { draft[key] = b.dataset.v; renderAuswahl(); aendern(); };
  }
  $('fensterKarte').hidden = draft.szeneModus !== 'fenster';
  $('quellenBlock').hidden = draft.szeneModus !== 'wachstum';
  $('moduleListe').innerHTML = MODULE.map(([k, label]) => `<label class="zeile"><input type="checkbox" data-m="${k}" ${draft[k] ? 'checked' : ''}> ${label}</label>`).join('');
  for (const el of $('moduleListe').querySelectorAll('[data-m]')) el.onchange = () => { draft[el.dataset.m] = el.checked; aendern(); };
}

// ---- Design
function renderDesign() {
  const d = draft.design, farben = effektiveFarben(d);
  $('themen').innerHTML = Object.entries(THEMES).map(([k, t]) => `<button data-t="${k}" class="thema ${d.theme === k && !Object.keys(d.farben).length ? 'aktiv' : ''}" style="--p:${t.papier};--r:${t.rand};--t:${t.text};--a:${t.akzent}"><span class="muster"><i></i><i></i></span>${esc(t.name)}</button>`).join('');
  for (const b of $('themen').querySelectorAll('button')) b.onclick = () => { draft.design = normalizeDesign({ theme: b.dataset.t, farben: null }, draft.design); renderDesign(); aendern(); };
  $('farben').innerHTML = Object.entries(FARB_NAMEN).map(([k, name]) => `<label class="farbe"><input type="color" data-f="${k}" value="${farben[k]}"> ${esc(name)}</label>`).join('');
  for (const el of $('farben').querySelectorAll('[data-f]')) el.oninput = () => { draft.design = normalizeDesign({ farben: { ...draft.design.farben, [el.dataset.f]: el.value } }, draft.design); aendern(); markiereThema(); };
  $('dDeckkraft').value = d.deckkraft; $('dRadius').value = d.radius; $('dRand').value = d.randBreite; $('dSchatten').checked = d.schatten;
  $('dSchrift').innerHTML = Object.entries(SCHRIFTEN).map(([k, [name]]) => `<option value="${k}" ${d.schrift === k ? 'selected' : ''}>${esc(name)}</option>`).join('');
  for (const [id, key] of [['dDeckkraft', 'deckkraft'], ['dRadius', 'radius'], ['dRand', 'randBreite']]) {
    $(id + 'Wert').textContent = d[key];
    $(id).oninput = () => { draft.design = normalizeDesign({ [key]: Number($(id).value) }, draft.design); $(id + 'Wert').textContent = draft.design[key]; aendern(); };
  }
  $('dSchatten').onchange = () => { draft.design = normalizeDesign({ schatten: $('dSchatten').checked }, draft.design); aendern(); };
  $('dSchrift').onchange = () => { draft.design = normalizeDesign({ schrift: $('dSchrift').value }, draft.design); aendern(); };
}
function markiereThema() { for (const b of $('themen').querySelectorAll('button')) b.classList.remove('aktiv'); }
$('designZurueck').onclick = () => { draft.design = normalizeDesign(DEFAULT_DESIGN); renderDesign(); aendern(); };

// ---- Anordnung: Karten, Module und Kamerafenster per Ziehen verschieben
const BOXEN = {
  uhr: { label: 'Uhr + Pomodoro', w: 366, h: 300 }, woerter: { label: 'Wörter', w: 366, h: 215 }, tasks: { label: 'To-Do', w: 366, h: 210 }, musik: { label: 'Musik', w: 380, h: 110 },
  kamera: { label: 'Kamera' },
  blume: { label: 'Blume', w: 210, h: 270, modul: true }, kerze: { label: 'Kerze', w: 150, h: 220, modul: true }, buecher: { label: 'Bücher', w: 230, h: 210, modul: true },
};
let layoutState = null, gewaehlt = null, editScale = 0.5;
function geom(id) {
  const b = BOXEN[id], l = layoutState[id];
  if (id === 'kamera') return { x: l.x - 22, y: l.y - 22, w: l.w + 44, h: l.w + 44 };
  if (b.modul) return { x: l.x - (b.w * l.s) / 2, y: l.y - (b.h - 30) * l.s, w: b.w * l.s, h: b.h * l.s };
  return { x: l.x, y: l.y, w: b.w * l.s, h: b.h * l.s };
}
function renderBoxen() {
  const box = $('editorBoxen');
  if (!box.children.length) {
    for (const id of Object.keys(BOXEN)) {
      const el = document.createElement('div');
      el.className = 'ebox'; el.dataset.id = id; el.textContent = BOXEN[id].label;
      el.onpointerdown = (e) => startDrag(e, id, el);
      box.append(el);
    }
  }
  for (const el of box.children) {
    const id = el.dataset.id, g = geom(id);
    el.style.left = `${g.x * editScale}px`; el.style.top = `${g.y * editScale}px`; el.style.width = `${g.w * editScale}px`; el.style.height = `${g.h * editScale}px`;
    el.classList.toggle('aktiv', id === gewaehlt); el.classList.toggle('aus', !layoutState[id].on);
  }
  zeigeZahlen();
}
function startDrag(e, id, el) {
  e.preventDefault(); select(id);
  const l = layoutState[id], sx = e.clientX, sy = e.clientY, x0 = l.x, y0 = l.y;
  el.setPointerCapture(e.pointerId);
  el.onpointermove = (m) => {
    layoutState[id].x = Math.round((x0 + (m.clientX - sx) / editScale) / 4) * 4;
    layoutState[id].y = Math.round((y0 + (m.clientY - sy) / editScale) / 4) * 4;
    layoutState = normalizeLayout(layoutState); renderBoxen(); aendern(); // aendern() zeigt auch die Speichern-Leiste
  };
  el.onpointerup = () => { el.onpointermove = null; el.onpointerup = null; };
}
function select(id) {
  gewaehlt = id;
  const l = layoutState[id];
  $('editorName').textContent = BOXEN[id].label;
  $('edAn').checked = l.on; $('edAn').disabled = false;
  $('edGroesse').hidden = id === 'kamera'; $('edGroesse').parentElement.hidden = id === 'kamera';
  if (id !== 'kamera') $('edGroesse').value = l.s;
  $('edKamera').hidden = id !== 'kamera';
  if (id === 'kamera') $('edW').value = l.w;
  renderBoxen();
}
function fitEditor() {
  editScale = $('editor').clientWidth / 1920;
  $('editorFrame').style.transform = `scale(${editScale})`;
  if (layoutState) renderBoxen();
}

const edChange = () => { if (!gewaehlt) return; const l = layoutState[gewaehlt]; l.on = $('edAn').checked; if ($('edX').value !== '') l.x = Number($('edX').value); if ($('edY').value !== '') l.y = Number($('edY').value); if (gewaehlt !== 'kamera') l.s = Number($('edGroesse').value); else { l.w = Number($('edW').value); l.h = l.w; } layoutState = normalizeLayout(layoutState); renderBoxen(); aendern(); };
for (const id of ['edAn', 'edGroesse', 'edW', 'edX', 'edY']) $(id).oninput = edChange;
// Zahlen der gewählten Box anzeigen (nicht in ein Feld schreiben, in dem gerade getippt wird); für die Kamera mit Hinweis für OBS
function zeigeZahlen() {
  if (!gewaehlt) return;
  const l = layoutState[gewaehlt];
  if (document.activeElement !== $('edX')) $('edX').value = l.x;
  if (document.activeElement !== $('edY')) $('edY').value = l.y;
  $('edObs').hidden = gewaehlt !== 'kamera';
  if (gewaehlt === 'kamera') $('edObs').innerHTML = `<b>Für OBS:</b> Kamera auf Position X <b>${l.x}</b>, Y <b>${l.y}</b>, Größe <b>${l.w} × ${l.w}</b> stellen (Leinwand 1920 × 1080, Overlay darüber).`;
}
addEventListener('resize', fitEditor);
$('layoutZurueck').onclick = () => { layoutState = normalizeLayout(structuredClone(DEFAULT_LAYOUT)); if (gewaehlt) select(gewaehlt); else renderBoxen(); aendern(); };
$('vorschauFortschritt').oninput = () => { vorschauFortschritt = Number($('vorschauFortschritt').value) / 100; $('vorschauFortschrittWert').textContent = `${$('vorschauFortschritt').value} %`; pushVorschau(); };
$('vorschauReset').onclick = () => { vorschauFortschritt = null; $('vorschauFortschrittWert').textContent = 'echter Stand'; pushVorschau(); };

// ---- Speichern und Verwerfen
const KEYS = ['szeneModus', 'jahreszeit', 'tageszeit', 'wachstumQuelle', 'fensterOrt', 'fensterBlick', 'fensterWetter', 'moduleBlume', 'moduleKerze', 'moduleBuecher', 'design', 'layout'];
$('speichern').onclick = run(async () => {
  const body = Object.fromEntries(KEYS.map((k) => [k, k === 'layout' ? layoutState : draft[k]]));
  const { settings } = await api('PUT', 'settings', body);
  laden(settings); meldung('Gespeichert – das Overlay zeigt es sofort');
});
$('verwerfen').onclick = () => { laden(gespeichert); meldung('Änderungen verworfen'); };
addEventListener('beforeunload', (e) => { if (geaendert) { e.preventDefault(); e.returnValue = ''; } });

function laden(settings) {
  gespeichert = settings;
  draft = Object.fromEntries(KEYS.filter((k) => k !== 'layout').map((k) => [k, structuredClone(settings[k])]));
  layoutState = normalizeLayout(settings.layout); draft.design = normalizeDesign(settings.design);
  geaendert = false; $('speicherLeiste').classList.remove('offen');
  renderAuswahl(); renderDesign(); fitEditor(); renderBoxen(); pushVorschau();
}

async function start() {
  await api('GET', 'state'); // ohne Anmeldung bricht das hier ab und zeigt den Login
  show(true);
  const ov = await fetch('/api/overlay', { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
  if (ov) jetzt = { jahreszeit: ov.jahreszeit, tageszeit: ov.tageszeit };
  const { settings } = await api('GET', 'settings');
  const f = $('editorFrame');
  f.src = '/overlay.html?editor=1&kamera=1&ton=aus';
  f.onload = () => { setTimeout(pushVorschau, 600); setTimeout(pushVorschau, 2500); }; // nach dem ersten Abruf des Overlays
  laden(settings);
}
initSeite(start);
