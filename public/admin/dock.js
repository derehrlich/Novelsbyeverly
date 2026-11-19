// Gemeinsame Hilfen der kleinen OBS-Docks: Anfragen an den Admin, Anmeldung, Meldungen.
export const $ = (id) => document.getElementById(id);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let onLogin = () => {};
export async function api(method, path, body) {
  const res = await fetch(`/api/admin/${path}`, { method, headers: method === 'GET' ? {} : { 'content-type': 'application/json' }, body: method === 'GET' ? undefined : JSON.stringify(body ?? {}) });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== 'login') { zeigeLogin(true); throw new Error('Nicht angemeldet'); }
  if (!res.ok) throw new Error(data.error ?? `Fehler ${res.status}`);
  return data;
}

let timer;
export function meldung(text, fehler = false) {
  let el = $('meldung');
  if (!el) { el = document.createElement('div'); el.id = 'meldung'; document.body.append(el); }
  el.className = 'meldung' + (fehler ? ' fehler' : ''); el.textContent = text; el.hidden = false;
  clearTimeout(timer); timer = setTimeout(() => { el.hidden = true; }, 2500);
}
// Knopf-Aktion mit Fehlermeldung verpacken
export const run = (fn) => async (...a) => { try { await fn(...a); } catch (e) { if (e.message !== 'Nicht angemeldet') meldung(e.message, true); } };

function zeigeLogin(an) {
  $('login').hidden = !an; $('app').hidden = an;
}
// Seite starten: zeigt ein kleines Anmeldefeld, wenn man nicht angemeldet ist.
export function start(laden) {
  onLogin = laden;
  $('anmelden').onclick = run(async () => { await api('POST', 'login', { password: $('passwort').value }); $('passwort').value = ''; zeigeLogin(false); await laden(); });
  $('passwort').onkeydown = (e) => { if (e.key === 'Enter') $('anmelden').click(); };
  zeigeLogin(false);
  return run(laden)();
}
export const loginHtml = `<section id="login" hidden><h1>Everly-Bot</h1><p class="leise">Bitte einmal anmelden.</p><div class="reihe"><input type="password" id="passwort" placeholder="Passwort" autocomplete="current-password"><button id="anmelden">Anmelden</button></div></section>`;
