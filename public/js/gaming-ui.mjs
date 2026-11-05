// Gaming-Szene als wiederverwendbares Bauteil: Landschaft + Rahmen auf dem Canvas, Deathcounter als Karte.
// Wird vom echten Overlay (gaming.html) und von der Demo benutzt.
import { Wachstum } from './wachstum.mjs';
import { KAMERA, RAHMEN, SPIEL, drawGamingFrames, kameraRect } from './gaming.mjs';

export const GAMING_CSS = `
.g-platz { position: absolute; display: none; align-items: center; justify-content: center; background: linear-gradient(135deg, #3d4a45, #2a302d); color: #cdd8d0; font-weight: 600; font-family: Fredoka, system-ui, sans-serif; text-align: center; }
.g-platzhalter .g-platz { display: flex; }
.g-tode { position: absolute; display: flex; align-items: center; gap: 16px; background: rgba(251, 246, 235, .92); border: 3px solid #bba98a; border-radius: 26px; box-shadow: 0 10px 26px rgba(50, 40, 28, .22); padding: 10px 26px 10px 20px; font-family: Fredoka, system-ui, sans-serif; color: #4d4236; }
.g-tode .icon { font-size: 46px; line-height: 1; }
.g-tode .label { font-size: 20px; font-weight: 600; color: #8a7b66; letter-spacing: .06em; text-transform: uppercase; }
.g-tode .zahl { font-weight: 700; font-size: 64px; line-height: 1; font-variant-numeric: tabular-nums; min-width: 1.2ch; }
.g-tode.pop { animation: g-pop .6s cubic-bezier(.2, 1.4, .4, 1); }
@keyframes g-pop { 0% { transform: scale(1); } 30% { transform: scale(1.18) rotate(-2deg); background: #f3d9d2; } 100% { transform: scale(1); } }
@media (prefers-reduced-motion: reduce) { .g-tode.pop { animation: none; } }
`;

const INSET = 28;
// Position der Karte innerhalb des Spielfensters
// Steht in derselben Ecke ein Kamerafenster, rückt die Karte daneben.
function todePos(pos, w, h, kameras = [], size = KAMERA) {
  const links = pos.endsWith('links'), mitte = pos.endsWith('mitte'), oben = pos.startsWith('oben');
  const kam = !mitte && kameras.includes(pos) ? kameraRect(pos, size) : null;
  let left = mitte ? SPIEL.x + (SPIEL.w - w) / 2 : links ? SPIEL.x + INSET : SPIEL.x + SPIEL.w - w - INSET;
  if (kam) left = links ? kam.x + kam.w + RAHMEN + 14 : kam.x - RAHMEN - 14 - w;
  return { left, top: oben ? SPIEL.y + INSET : SPIEL.y + SPIEL.h - h - INSET };
}

export class GamingOverlay {
  // root: das 1920×1080 große Element. opts.platzhalter: graue Fenster anzeigen.
  constructor(root, { platzhalter = false } = {}) {
    this.root = root;
    const style = document.createElement('style'); style.textContent = GAMING_CSS; document.head.append(style);
    this.canvas = document.createElement('canvas'); this.canvas.width = 1920; this.canvas.height = 1080;
    Object.assign(this.canvas.style, { position: 'absolute', inset: '0', width: '1920px', height: '1080px' });
    this.c = this.canvas.getContext('2d');
    this.spielBox = Object.assign(document.createElement('div'), { className: 'g-platz', textContent: 'Spiel (16:9)' });
    this.kamBox = document.createElement('div');
    this.tode = document.createElement('div'); this.tode.className = 'g-tode'; this.tode.hidden = true;
    this.tode.innerHTML = '<span class="icon">💀</span><div><div class="label"></div><div class="zahl">0</div></div>';
    root.append(this.canvas, this.spielBox, this.kamBox, this.tode);
    this.wachstum = new Wachstum();
    this.view = null; this.key = ''; this.todeN = null;
    this.setPlatzhalter(platzhalter);
    requestAnimationFrame((t) => this.loop(t));
  }

  setPlatzhalter(on) { this.root.classList.toggle('g-platzhalter', on); }

  // view: { jahreszeit, tageszeit, progress, stefanie, timer, gaming: { kameras, groesse, tode } }
  update(view) {
    this.view = view;
    const g = view.gaming ?? {};
    const size = g.groesse ?? KAMERA;
    const key = `${(g.kameras ?? []).join(',')}|${size}`;
    if (key !== this.key) {
      this.key = key;
      const place = (el, r, radius) => Object.assign(el.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px`, borderRadius: `${radius}px` });
      place(this.spielBox, SPIEL, 10); this.spielBox.style.fontSize = '34px';
      this.kamBox.textContent = '';
      for (const e of g.kameras ?? []) { const el = document.createElement('div'); el.className = 'g-platz'; el.textContent = `Kamera ${e}`; el.style.fontSize = '26px'; place(el, kameraRect(e, size), 18); this.kamBox.append(el); }
    }
    const t = g.tode;
    this.tode.hidden = !t;
    if (t) {
      this.tode.querySelector('.label').textContent = t.label;
      this.tode.querySelector('.zahl').textContent = new Intl.NumberFormat('de-DE').format(t.n);
      const { width, height } = { width: this.tode.offsetWidth || 260, height: this.tode.offsetHeight || 90 };
      const p = todePos(t.pos, width, height, g.kameras ?? [], size);
      this.tode.style.left = `${p.left}px`; this.tode.style.top = `${p.top}px`;
      if (this.todeN !== null && t.n !== this.todeN) { this.tode.classList.remove('pop'); void this.tode.offsetWidth; this.tode.classList.add('pop'); }
      this.todeN = t.n;
    } else this.todeN = null;
  }

  loop(t) {
    requestAnimationFrame((x) => this.loop(x));
    if (t - (this.last ?? 0) < 70) return;
    this.last = t;
    const { c, view } = this;
    c.clearRect(0, 0, 1920, 1080);
    if (view) this.wachstum.draw(c, view, t); else { c.fillStyle = '#cfdcb8'; c.fillRect(0, 0, 1920, 1080); }
    drawGamingFrames(c, view?.gaming?.kameras ?? [], view?.gaming?.groesse ?? KAMERA);
  }
}

