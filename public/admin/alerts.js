// Alerts: OBS-Adresse, Vorschau mit Testknöpfen, Texte, Schrift, Größe, Position. Speichert erst mit „Speichern“.
import { $, api, esc, initSeite, meldung, run, show } from './common.js';
import { ALERT_SCHRIFTEN, ARTEN, DEFAULT_ALERTS, PLATZHALTER, normalizeAlerts } from '../js/alerts.mjs';

let saved = null, draft = null;
const rahmen = () => $('vorschauRahmen').contentWindow;
const kopie = (o) => JSON.parse(JSON.stringify(o));

function fitVorschau() { const box = $('vorschau'); $('vorschauRahmen').style.transform = `scale(${box.clientWidth / 1920})`; }
addEventListener('resize', fitVorschau);

function aendern() {
  draft = normalizeAlerts(draft, DEFAULT_ALERTS);
  rahmen()?.postMessage({ type: 'alerts', alerts: draft }, location.origin);
  const offen = JSON.stringify(draft) !== JSON.stringify(saved);
  $('speicherLeiste').classList.toggle('offen', offen);
}

// Ein Feld aus einer Beschreibung: pfad ist z. B. ['groesseName'] oder ['arten', 'follow', 'label']
function feld([pfad, label, art, hinweis, opt = {}]) {
  const id = `f-${pfad.join('-')}`, v = pfad.reduce((o, k) => o?.[k], draft);
  let input;
  if (art === 'bool') input = `<input type="checkbox" id="${id}" ${v ? 'checked' : ''}>`;
  else if (art === 'select') input = `<select id="${id}">${opt.optionen.map(([val, t]) => `<option value="${val}" ${val === v ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  else if (art === 'range') input = `<input type="range" id="${id}" min="${opt.min}" max="${opt.max}" step="${opt.step ?? 1}" value="${esc(v)}"> <span class="wert" id="${id}-w">${esc(v)}${opt.einheit ?? ''}</span>`;
  else if (art === 'color') input = `<input type="color" id="${id}" value="${esc(v)}">`;
  else if (art === 'number') input = `<input type="number" id="${id}" min="${opt.min}" max="${opt.max}" value="${esc(v)}">`;
  else input = `<input type="text" id="${id}" value="${esc(v ?? '')}" maxlength="${opt.max ?? 80}">`;
  return { html: `<div class="feld ${opt.breit ? 'breit' : ''}"><label for="${id}">${esc(label)}</label>${input}${hinweis ? `<div class="hinweis">${hinweis}</div>` : ''}</div>`, id, pfad, art, opt };
}
function verbinde(felder) {
  for (const { id, pfad, art, opt } of felder) {
    const el = $(id);
    el.oninput = el.onchange = () => {
      const wert = art === 'bool' ? el.checked : (art === 'range' || art === 'number') ? Number(el.value) : el.value;
      let o = draft; for (const k of pfad.slice(0, -1)) o = o[k]; o[pfad.at(-1)] = wert;
      if (art === 'range') $(`${id}-w`).textContent = `${el.value}${opt.einheit ?? ''}`;
      if (id === 'f-schrift') $('f-eigeneSchrift').closest('.feld').hidden = el.value !== 'eigene';
      aendern();
    };
  }
}

function zeichne() {
  const prozent = { einheit: ' %' };
  const allg = [
    [['an'], 'Alerts eingeschaltet', 'bool', 'Aus = es erscheint kein Alert (auch nicht bei echten Ereignissen).'],
    [['schrift'], 'Schrift', 'select', null, { optionen: Object.entries(ALERT_SCHRIFTEN).map(([k, [n]]) => [k, n]) }],
    [['eigeneSchrift'], 'Name der eigenen Schrift', 'text', 'Genau so, wie die Schrift auf dem PC heißt, auf dem OBS läuft (z. B. „Lobster“). Nur Buchstaben, Zahlen, Leerzeichen und Bindestrich. Ist sie dort nicht installiert, nimmt OBS die runde Standardschrift.', { max: 60 }],
    [['groesseName'], 'Größe des Namens', 'range', null, { min: 40, max: 250, step: 5, ...prozent }],
    [['groesseLabel'], 'Größe der Beschriftung', 'range', null, { min: 40, max: 250, step: 5, ...prozent }],
    [['groesseSub'], 'Größe des Nebentextes', 'range', null, { min: 40, max: 250, step: 5, ...prozent }],
    [['textFarbe'], 'Farbe des Namens', 'color'], [['labelFarbe'], 'Farbe der Beschriftung', 'color'], [['subFarbe'], 'Farbe des Nebentextes', 'color'],
    [['groesseBuch'], 'Größe des Buchs', 'range', null, { min: 40, max: 200, step: 5, ...prozent }],
    [['x'], 'Position: nach rechts (negativ = links)', 'range', 'Das Buch sitzt standardmäßig in der Bildmitte.', { min: -960, max: 960, step: 10, einheit: ' px' }],
    [['y'], 'Position: nach unten (negativ = höher)', 'range', null, { min: -400, max: 700, step: 10, einheit: ' px' }],
  ].map(feld);
  $('allgemein').innerHTML = allg.map((f) => f.html).join('');
  verbinde(allg);
  $('f-eigeneSchrift').closest('.feld').hidden = draft.schrift !== 'eigene';

  const alle = [];
  $('arten').innerHTML = Object.entries(ARTEN).map(([art, info]) => {
    const phs = info.platzhalter.map((p) => `<code>{${p}}</code>`).join(' ');
    const fs = [
      [['arten', art, 'label'], 'Beschriftung (links oben)', 'text', `Platzhalter: ${phs}`],
      [['arten', art, 'name'], 'Name (rechts, groß)', 'text', `Platzhalter: ${phs}`],
      [['arten', art, 'sub'], 'Nebentext (links unten)', 'text', `Platzhalter: ${phs}`, { max: 120 }],
      ...(art === 'sub' ? [
        [['arten', art, 'labelWieder'], 'Beschriftung bei Verlängerung (mehr als 1 Monat)', 'text', `Platzhalter: ${phs}`],
        [['arten', art, 'subWieder'], 'Nebentext bei Verlängerung', 'text', `Platzhalter: ${phs}`, { max: 120 }],
      ] : []),
      [['arten', art, 'dauer'], 'So lange bleibt der Text sichtbar', 'range', null, { min: 1, max: 30, einheit: ' s' }],
      [['arten', art, 'konfetti'], 'Konfetti (Menge, 0 = keins)', 'range', null, { min: 0, max: 300, step: 10 }],
    ].map(feld);
    alle.push(...fs);
    return `<section class="karte art"><h2>${esc(info.name)} <label><input type="checkbox" id="f-arten-${art}-an" ${draft.arten[art].an ? 'checked' : ''}> eingeschaltet</label></h2><div class="felder">${fs.map((f) => f.html).join('')}</div></section>`;
  }).join('');
  verbinde(Object.keys(ARTEN).map((art) => ({ id: `f-arten-${art}-an`, pfad: ['arten', art, 'an'], art: 'bool', opt: {} })));
  verbinde(alle);
}

function ereignis(art) {
  const ev = { type: art, ...ARTEN[art].beispiel, test: true }, name = $('testName').value.trim();
  if (name) ev.name = name;
  return ev;
}
function knoepfe() {
  $('probeKnoepfe').innerHTML = Object.entries(ARTEN).map(([a, i]) => `<button data-a="${a}">▶ ${esc(i.name)}</button>`).join('');
  $('sendeKnoepfe').innerHTML = Object.entries(ARTEN).map(([a, i]) => `<button class="hell" data-a="${a}">📺 ${esc(i.name)}</button>`).join('');
  $('probeKnoepfe').onclick = (e) => { const a = e.target.dataset?.a; if (a) rahmen().postMessage({ type: 'abspielen', ereignis: ereignis(a) }, location.origin); };
  $('sendeKnoepfe').onclick = run(async (e) => {
    const a = e.target.dataset?.a; if (!a) return;
    await api('POST', 'test/event', { kind: a, name: $('testName').value.trim() });
    meldung(`${ARTEN[a].name}-Alert an OBS gesendet`);
  });
}

async function start() {
  await api('GET', 'state'); // ohne Anmeldung bricht das hier ab und zeigt den Login
  show(true);
  const { settings } = await api('GET', 'settings');
  saved = normalizeAlerts(settings.alerts); draft = kopie(saved);
  $('alertUrl').textContent = `${location.origin}/alerts`;
  zeichne(); knoepfe(); fitVorschau();
  $('vorschauRahmen').onload = () => { fitVorschau(); rahmen().postMessage({ type: 'alerts', alerts: draft }, location.origin); };
  rahmen()?.postMessage({ type: 'alerts', alerts: draft }, location.origin);
  aendern();
}

$('alertKopieren').onclick = run(async () => { await navigator.clipboard.writeText($('alertUrl').textContent); meldung('Adresse kopiert'); });
$('speichern').onclick = run(async () => {
  const r = await api('PUT', 'settings', { alerts: draft });
  saved = normalizeAlerts(r.settings.alerts); draft = kopie(saved); zeichne(); aendern();
  meldung('Gespeichert – die OBS-Quelle übernimmt es sofort');
});
$('verwerfen').onclick = () => { draft = kopie(saved); zeichne(); aendern(); };
$('standard').onclick = () => { if (!confirm('Alle Alert-Einstellungen auf Standard zurücksetzen? (Erst mit „Speichern“ gilt es.)')) return; draft = kopie(DEFAULT_ALERTS); zeichne(); aendern(); };
initSeite(start);
