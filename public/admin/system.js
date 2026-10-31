// System-Seite: Version, Update per ZIP, älterer Programmstand, Datensicherungen.
import { $, esc, initSeite, meldung, run, show } from './common.js';

async function sys(method, pfad = '', body, type = 'application/json') {
  const res = await fetch(`/api/system/${pfad}`, { method, headers: body !== undefined ? { 'content-type': type } : (method === 'GET' ? {} : { 'content-type': 'application/json' }), body: body === undefined ? (method === 'GET' ? undefined : '{}') : (type === 'application/json' ? JSON.stringify(body) : body) });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { show(false); throw new Error('Nicht angemeldet'); }
  if (!res.ok) throw new Error(data.error ?? `Fehler ${res.status}`);
  return data;
}
const datum = (ms) => new Date(ms).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
const groesse = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const dauer = (ms) => { const m = Math.floor(ms / 60000); return m < 60 ? `${m} Min` : m < 1440 ? `${Math.floor(m / 60)} Std ${m % 60} Min` : `${Math.floor(m / 1440)} Tage ${Math.floor((m % 1440) / 60)} Std`; };

async function laden() {
  const s = await sys('GET');
  $('version').textContent = s.version;
  $('laeuftSeit').textContent = `${datum(s.laeuftSeit)} (${dauer(Date.now() - s.laeuftSeit)})`;
  $('updateStatus').textContent = s.status || 'noch keins';
  $('statusPunkt').className = `punkt ${/fehlgeschlagen/.test(s.status) ? 'fehler' : s.status ? 'ok' : ''}`;
  $('datenordner').textContent = s.datenordner;
  $('programmListe').innerHTML = s.programm.length ? s.programm.map((b) => `<tr><td>${datum(b.zeit)}</td><td>${groesse(b.groesse)}</td><td style="text-align:right"><button class="hell" data-zurueck="${esc(b.name)}">Diesen Stand einspielen</button></td></tr>`).join('') : '<tr><td class="leise">Noch kein Update gemacht, deshalb gibt es noch keinen älteren Stand.</td></tr>';
  $('datenListe').innerHTML = s.daten.length ? s.daten.map((b) => `<tr><td>${datum(b.zeit)}</td><td class="leise">${esc(b.name.replace(/^sicherung_\d{8}_\d{6}_/, '').replace('.zip', '').replaceAll('_', ' '))}</td><td>${groesse(b.groesse)}</td><td style="text-align:right"><a class="knopf hell" href="/api/system/sicherung/${encodeURIComponent(b.name)}">Herunterladen</a> <button class="hell" data-wieder="${esc(b.name)}">Wiederherstellen</button> <button class="hell" data-weg="${esc(b.name)}">Löschen</button></td></tr>`).join('') : '<tr><td class="leise">Noch keine Sicherung.</td></tr>';
  for (const b of document.querySelectorAll('[data-zurueck]')) b.onclick = run(async () => { if (confirm('Diesen älteren Programmstand einspielen? Das Programm startet neu.')) { await sys('POST', 'zurueck', { name: b.dataset.zurueck }); await warteAufNeustart(s.version); } });
  for (const b of document.querySelectorAll('[data-wieder]')) b.onclick = run(async () => { if (confirm('Diese Sicherung wiederherstellen? Die jetzigen Einstellungen werden ersetzt (vorher wird automatisch gesichert). Das Programm startet neu.')) { await sys('POST', 'wiederherstellen', { name: b.dataset.wieder }); await warteAufNeustart(s.version); } });
  for (const b of document.querySelectorAll('[data-weg]')) b.onclick = run(async () => { if (confirm('Sicherung löschen?')) { await sys('DELETE', `sicherung/${encodeURIComponent(b.dataset.weg)}`, {}); await laden(); } });
}

// Wartet, bis das Programm nach einem Neustart wieder antwortet, und lädt dann die Seite neu
async function warteAufNeustart() {
  const m = $('updateMeldung'); m.hidden = false; m.textContent = 'Programm startet neu … bitte warten und nichts weiter anklicken.';
  let weg = false;
  for (let i = 0; i < 120; i += 1) {
    await new Promise((r) => setTimeout(r, 2000));
    try { const r = await fetch('/healthz', { cache: 'no-store' }); if (r.ok && weg) { m.textContent = 'Fertig, die Seite wird neu geladen.'; setTimeout(() => location.reload(), 1200); return; } } catch { weg = true; }
  }
  m.textContent = 'Das Programm antwortet noch nicht. Warte noch etwas und lade die Seite neu. Im CasaOS-Dashboard siehst du, ob der Container läuft.';
}

$('updateHoch').onclick = run(async () => {
  const f = $('updateDatei').files[0];
  if (!f) throw new Error('Bitte zuerst eine ZIP-Datei auswählen');
  $('updateHoch').disabled = true; $('updateMeldung').hidden = false; $('updateMeldung').textContent = 'Wird hochgeladen …';
  try { await sys('POST', 'update', f, 'application/zip'); } catch (e) { $('updateHoch').disabled = false; $('updateMeldung').hidden = true; throw e; }
  await warteAufNeustart();
  $('updateHoch').disabled = false;
});
$('jetztSichern').onclick = run(async () => { await sys('POST', 'sicherung', {}); meldung('Sicherung angelegt'); await laden(); });
$('neustart').onclick = run(async () => { if (confirm('Programm neu starten?')) { await sys('POST', 'neustart', {}); await warteAufNeustart(); } });

async function start() { await sys('GET'); show(true); await laden(); }
initSeite(start);
