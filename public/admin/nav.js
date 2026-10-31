// Rahmen für alle Admin-Seiten: Seitenleiste am PC, Burger-Menü am Handy, Seitenüberschrift.
// Jede Seite hat <body data-seite="…" data-titel="…">; der Inhalt (<main>) wird in den Rahmen gesetzt.
const SEITEN = [
  ['index', '🏠', 'Übersicht', '/admin/'],
  ['pomodoro', '⏱️', 'Pomodoro & Ziele', '/admin/pomodoro.html'],
  ['studio', '🎨', 'Overlay', '/admin/studio.html'],
  ['musik', '🎵', 'Musik', '/admin/musik.html'],
  ['chat', '💬', 'Chat & Zimmer', '/admin/chat.html'],
  ['system', '⚙️', 'System', '/admin/system.html'],
];

export function baueRahmen() {
  const main = document.querySelector('main');
  if (!main || !document.body.dataset.seite || document.querySelector('.rahmen')) return; // das Stream-Panel hat bewusst keinen Rahmen
  const aktiv = document.body.dataset.seite;
  const rahmen = document.createElement('div');
  rahmen.className = 'rahmen';
  rahmen.innerHTML = `
    <aside class="seitenleiste" id="seitenleiste" aria-label="Menü">
      <div class="marke">✍️ Co-Working</div>
      ${SEITEN.map(([id, sym, name, href]) => `<a href="${href}" class="${id === aktiv ? 'aktiv' : ''}"><span class="sym">${sym}</span>${name}</a>`).join('')}
      <a href="/admin/panel.html"><span class="sym">📱</span>Stream-Panel</a>
      <a href="/overlay" target="_blank" rel="noopener"><span class="sym">📺</span>Overlay öffnen</a>
      <div class="abstand"></div>
      <button class="hell" id="abmelden">Abmelden</button>
    </aside>
    <div class="haupt">
      <header class="kopfzeile"><button class="hell" id="burger" aria-label="Menü öffnen" aria-expanded="false">☰</button><h1>${document.body.dataset.titel ?? ''}</h1></header>
    </div>
    <div id="hintergrund"></div>`;
  main.before(rahmen);
  rahmen.querySelector('.haupt').append(main);
  const zu = () => { document.body.classList.remove('menue-offen'); rahmen.querySelector('#burger').setAttribute('aria-expanded', 'false'); };
  rahmen.querySelector('#burger').onclick = () => { const an = document.body.classList.toggle('menue-offen'); rahmen.querySelector('#burger').setAttribute('aria-expanded', String(an)); };
  rahmen.querySelector('#hintergrund').onclick = zu;
  for (const a of rahmen.querySelectorAll('.seitenleiste a')) a.addEventListener('click', zu);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') zu(); });
}
