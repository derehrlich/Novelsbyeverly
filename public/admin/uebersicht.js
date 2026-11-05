// Übersicht: Einrichtung (Twitch-App, Verbindungen, Status, Adressen).
import { $, api, esc, initSeite, meldung, run, show } from './common.js';

// ---- Status
let state = null, current = null;
const punkt = (cls, text) => `<li><span class="punkt ${cls}"></span>${text}</li>`;
async function loadState() {
  state = await api('GET', 'state');
  const e = state.env;
  const envOk = e.TWITCH_CLIENT_ID;
  const rows = [
    envOk ? punkt('ok', 'Twitch-App eingetragen') : punkt('fehler', 'Twitch-Client-ID fehlt – oben unter „Twitch-App“ eintragen'),
    state.connectedAs ? punkt(state.missingScopes.length ? 'warn' : 'ok', `Kanal verbunden als <b>${esc(state.connectedAs)}</b>${state.missingScopes.length ? ` – Berechtigungen fehlen (${esc(state.missingScopes.join(', '))}), bitte neu verbinden` : ''}`) : punkt('fehler', 'Kanal nicht verbunden'),
    state.botAs ? punkt(state.botMissingScopes.length ? 'warn' : 'ok', `Bot-Account verbunden als <b>${esc(state.botAs)}</b>${state.botMissingScopes.length ? ' – Berechtigungen fehlen, bitte neu verbinden' : ''}`) : punkt('warn', 'Kein Bot-Account verbunden – der Bot schreibt dann unter dem Kanalnamen'),
    (() => { const v = state.eventsub; if (!v) return ''; if (v.state === 'verbunden') return punkt(v.warnings.length ? 'warn' : 'ok', `Verbindung zu Twitch steht${v.warnings.length ? ` – ${esc(v.warnings.join(' · '))}` : ''}`); return punkt(v.state === 'nicht verbunden' ? 'warn' : 'fehler', `Verbindung zu Twitch: ${esc(v.state)}${v.error ? ` (${esc(v.error)})` : ''}`); })(),
    state.revoked ? punkt('fehler', `Twitch hat ein Abo widerrufen (${esc(state.revoked)}) – bitte abgleichen`) : '',
  ];
  $('status').innerHTML = rows.join('');
  const u = state.urls;
  const urlRow = (label, url, hint = '') => `<div class="url"><b>${label}</b> <code>${esc(url)}</code><button class="hell" data-copy="${esc(url)}">Kopieren</button></div>${hint ? `<div class="leise">${hint}</div>` : ''}`;
  $('urls').innerHTML = urlRow('OBS-Overlay', u.overlay, 'Browser-Quelle 1920×1080, „Audio über OBS steuern“ aktivieren. Die Kamera in OBS <b>unter</b> das Overlay legen. Nur einzelne Teile: <code>?teile=uhr,woerter,tasks,musik,szene</code>')
    + urlRow('Wörter-Schnittstelle', u.words, `Für ein Hilfsprogramm (Papyrus): <code>POST</code> mit <code>Authorization: Bearer &lt;INGEST_TOKEN&gt;</code> und <code>{"absolute": 4231}</code>. ${e.INGEST_TOKEN ? 'INGEST_TOKEN ist gesetzt.' : 'INGEST_TOKEN ist noch nicht gesetzt.'}`);
  for (const b of document.querySelectorAll('[data-copy]')) b.onclick = () => navigator.clipboard.writeText(b.dataset.copy).then(() => meldung('Kopiert'));
}

// ---- Twitch-App (Client-ID und Secret)
async function loadApp() {
  const a = await api('GET', 'twitch-app');
  $('appId').value = a.clientId;
  $('appSecret').value = '';
  $('appSecret').placeholder = a.hasSecret ? '•••••••••• (gespeichert)' : 'leer lassen bei „Public“';
  $('appSecretHinweis').textContent = a.hasSecret ? `Ein Secret ist gespeichert${a.secretQuelle === 'env' ? ' (aus novelsbyeverly.env)' : ''}. Leer lassen, um es zu behalten.` : 'Kein Secret gesetzt.';
  $('appSecretWeg').hidden = a.secretQuelle !== 'admin';
  $('appStatus').textContent = a.idQuelle === 'env' ? 'Die Client-ID kommt aus novelsbyeverly.env. Was du hier speicherst, hat Vorrang.' : '';
}
$('appSpeichern').onclick = run(async () => {
  const body = { clientId: $('appId').value };
  if ($('appSecret').value.trim()) body.clientSecret = $('appSecret').value;
  const r = await api('PUT', 'twitch-app', body);
  await loadApp(); await loadState();
  meldung(r.disconnected ? 'Gespeichert. Die Client-ID hat sich geändert – bitte Kanal und Bot neu verbinden.' : 'Gespeichert');
});
$('appSecretWeg').onclick = run(async () => { if (!confirm('Gespeichertes Secret entfernen?')) return; await api('PUT', 'twitch-app', { clearSecret: true }); await loadApp(); meldung('Secret entfernt'); });
$('appPruefen').onclick = run(async () => {
  $('appStatus').textContent = 'Prüfe …';
  const r = await api('POST', 'twitch-app/test');
  $('appStatus').textContent = r.message; $('appStatus').style.color = r.ok ? 'var(--gruen)' : 'var(--rot)';
});

// ---- Mit Twitch verbinden (Code auf twitch.tv/activate bestätigen)
let geraet = null;
async function verbinden(role) {
  const d = await fetch('/api/auth/device/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ role }) }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? `Fehler ${r.status}`); return j; });
  geraet = d;
  const box = $('geraet'); box.hidden = false;
  box.innerHTML = `<p><b>${role === 'bot' ? 'Bot-Account' : 'Kanal'} verbinden:</b> Öffne <a href="${esc(d.verification_uri)}" target="_blank" rel="noopener">${esc(d.verification_uri)}</a>, gib den Code <code class="code">${esc(d.user_code)}</code> ein und bestätige. ${role === 'bot' ? 'Melde dich dort mit dem <b>Bot-Konto</b> an (privates Fenster).' : ''} Diese Seite wartet darauf.</p>`;
  const stop = Date.now() + d.expires_in * 1000;
  while (geraet === d && Date.now() < stop) {
    await new Promise((r) => setTimeout(r, d.interval * 1000));
    if (geraet !== d) return;
    const res = await fetch('/api/auth/device/poll', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ role, device_code: d.device_code }) });
    const j = await res.json();
    if (j.pending) continue;
    box.hidden = true; geraet = null;
    if (!res.ok) throw new Error(j.error ?? `Fehler ${res.status}`);
    meldung(`Verbunden als ${j.login}`); await loadState(); return;
  }
  if (geraet === d) { box.hidden = true; geraet = null; throw new Error('Der Code ist abgelaufen, bitte noch einmal starten'); }
}
$('verbindeKanal').onclick = run(() => verbinden('broadcaster'));
$('verbindeBot').onclick = run(() => verbinden('bot'));

$('abgleich').onclick = run(async () => {
  const r = await api('POST', 'setup');
  meldung(r.warnings?.length ? `Eingerichtet, aber: ${r.warnings.join(' · ')}` : `Eingerichtet${r.reward ? ` (Reward „${r.reward}“)` : ''}`, Boolean(r.warnings?.length));
  await loadState();
});


setInterval(() => { if (!$('app').hidden) loadState().catch(() => {}); }, 15000);

async function start() {
  await loadState(); // ohne Anmeldung bricht das hier ab und zeigt den Login
  show(true);
  await loadApp();
}
initSeite(start);
