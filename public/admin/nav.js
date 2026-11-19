// Menü der Verwaltung: Gruppen mit Seiten, Suche über alle Seiten und Einstellungen, Schublade am Handy.
// Eine neue Seite braucht hier eine Zeile und in index.html einen <div class="tab-panel" data-panel="…">.
export const NAV = [
  ['', [['start', '🏠', 'Übersicht']]],
  ['Stream', [['pomodoro', '🍅', 'Pomodoro'], ['ziel', '🎯', 'Ziel'], ['landschaft', '🌳', 'Landschaft und Stefanie'], ['todo', '📝', 'To-Do-Liste'], ['musik', '🎵', 'Musik'], ['alerts', '🔔', 'Alerts und Raids'], ['auszeit', '☕', 'Stream-Pause'], ['startscreen', '🚀', 'Startbildschirm']]],
  ['Overlay', [['anordnung', '🧩', 'Anordnung'], ['design', '🎨', 'Design und Hintergrund'], ['adressen', '🔗', 'OBS-Adressen und Test']]],
  ['Zuschauer', [['checkin', '✅', 'Check-in, Streak und Punkte'], ['mitschreibende', '👥', 'Mitschreibende']]],
  ['Chat', [['chat', '💬', 'Chat und Befehle'], ['befehle', '🗨️', 'Eigene Befehle und Zitate']]],
  ['Verwaltung', [['einrichtung', '🔌', 'Einrichtung'], ['system', '⚙️', 'System']]],
];
// Seiten, auf denen rechts die Live-Vorschau des Overlays steht („Anordnung“ hat ihre eigene)
export const PREVIEW_PAGES = ['pomodoro', 'ziel', 'landschaft', 'musik', 'design'];
export const PAGES = NAV.flatMap(([, items]) => items);
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

let onShow = () => {};
export function showPage(key, { focus = null } = {}) {
  if (!PAGES.some((p) => p[0] === key)) key = 'start';
  for (const p of document.querySelectorAll('.tab-panel')) p.hidden = p.dataset.panel !== key;
  for (const a of document.querySelectorAll('#nav a')) a.classList.toggle('aktiv', a.dataset.page === key);
  if (location.hash !== `#${key}`) history.replaceState(null, '', `#${key}`);
  closeDrawer();
  window.scrollTo(0, 0);
  onShow(key);
  if (focus) { // aufgeklappte Karte und Feld hervorheben (Suche)
    const fold = focus.closest('details'); if (fold) fold.open = true;
    focus.scrollIntoView({ block: 'center' }); focus.classList.add('treffer'); setTimeout(() => focus.classList.remove('treffer'), 2500);
  }
}

function openDrawer() { $('nav').classList.add('offen'); $('scrim').hidden = false; $('menue').setAttribute('aria-expanded', 'true'); }
function closeDrawer() { $('nav').classList.remove('offen'); $('scrim').hidden = true; $('menue').setAttribute('aria-expanded', 'false'); }

// Suche: Seitennamen und die Beschriftungen aller Einstellungen (aus dem Seitentext, so bleibt sie immer aktuell)
function search(q) {
  const box = $('sucheTreffer'); const n = norm(q).trim();
  if (n.length < 2) { box.hidden = true; return; }
  const hits = [];
  for (const [key, icon, label] of PAGES) if (norm(label).includes(n)) hits.push({ key, text: `${icon} ${label}`, sub: 'Seite' });
  for (const feld of document.querySelectorAll('.tab-panel .feld')) {
    const l = feld.querySelector('label'); if (!l || !norm(l.textContent).includes(n)) continue;
    const key = feld.closest('.tab-panel').dataset.panel;
    hits.push({ key, text: l.textContent.trim(), sub: PAGES.find((p) => p[0] === key)?.[2] ?? '', feld });
  }
  box.innerHTML = hits.length ? hits.slice(0, 12).map((h, i) => `<button type="button" data-i="${i}"><b>${esc(h.text)}</b><small>${esc(h.sub)}</small></button>`).join('') : '<div class="leise">Nichts gefunden</div>';
  box.hidden = false;
  for (const b of box.querySelectorAll('button')) b.onclick = () => { const h = hits[Number(b.dataset.i)]; box.hidden = true; $('suche').value = ''; showPage(h.key, { focus: h.feld }); };
}

export function initNav({ onShow: cb }) {
  onShow = cb;
  $('nav').innerHTML = NAV.map(([group, items]) => `${group ? `<h4>${esc(group)}</h4>` : ''}${items.map(([k, icon, label]) => `<a href="#${k}" data-page="${k}"><span>${icon}</span>${esc(label)}</a>`).join('')}`).join('');
  for (const a of $('nav').querySelectorAll('a')) a.onclick = (e) => { e.preventDefault(); showPage(a.dataset.page); };
  $('menue').onclick = () => ($('nav').classList.contains('offen') ? closeDrawer() : openDrawer());
  $('scrim').onclick = closeDrawer;
  $('suche').oninput = (e) => search(e.target.value);
  $('suche').onkeydown = (e) => { if (e.key === 'Escape') { $('sucheTreffer').hidden = true; e.target.value = ''; } };
  document.addEventListener('click', (e) => { if (!e.target.closest('.suche')) $('sucheTreffer').hidden = true; });
  addEventListener('hashchange', () => showPage(location.hash.slice(1)));
  document.addEventListener('click', (e) => { const a = e.target.closest('[data-nav]'); if (a) { e.preventDefault(); showPage(a.dataset.nav); } });
  showPage(location.hash.slice(1));
}
