// Gemeinsames für alle Admin-Seiten: Aufrufe der API, Meldungen, Anmeldung, Menü.
export const $ = (id) => document.getElementById(id);
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export async function api(method, path, body) {
  const res = await fetch(`/api/admin/${path}`, { method, headers: body ? { 'content-type': 'application/json' } : (method === 'GET' ? {} : { 'content-type': 'application/json' }), body: body ? JSON.stringify(body) : (method === 'GET' ? undefined : '{}') });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== 'login') { show(false); throw new Error('Nicht angemeldet'); }
  if (!res.ok) throw new Error(data.error ?? `Fehler ${res.status}`);
  return data;
}
let toastTimer;
export function meldung(text, fehler = false) {
  const el = $('meldung');
  el.textContent = text; el.className = `meldung${fehler ? ' fehler' : ''}`; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, fehler ? 7000 : 3000);
}
export const run = (fn) => async (...a) => { try { await fn(...a); } catch (e) { meldung(e.message, true); } };
export function show(app) { $('app').hidden = !app; $('login').hidden = app; }
export const fmtN = (n) => new Intl.NumberFormat('de-DE').format(n);

// Startet eine Seite: Anmeldung prüfen, dann start() ausführen. Ohne Login erscheint die Anmeldung.
export function initSeite(start) {
  const los = () => start().catch((e) => { if (e.message !== 'Nicht angemeldet') meldung(e.message, true); });
  $('anmelden').onclick = run(async () => { await api('POST', 'login', { password: $('passwort').value }); $('passwort').value = ''; await los(); });
  $('passwort').onkeydown = (e) => { if (e.key === 'Enter') $('anmelden').click(); };
  $('abmelden').onclick = run(async () => { await api('POST', 'logout'); show(false); });
  los();
}
