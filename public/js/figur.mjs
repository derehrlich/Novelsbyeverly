// Chibi-Figur mit Stuhl, Tisch und Schreibgerät: genutzt vom Zimmer-Modus (pausiert).
import { FARBEN, HAUT } from './katalog.mjs';
import { TAU, alpha, ell, glow, leaf, lg, path, rr, shade } from './malerei.mjs';

export const STYLE = {
  cafe: { top: '#cfa877', rim: '#94704a', chair: '#b98574', chairDark: '#9a6a5d' },
  garten: { top: '#f1eadb', rim: '#bfb59e', chair: '#93a98d', chairDark: '#778f73' },
  park: { top: '#d3ae7e', rim: '#957650', chair: '#a3916f', chairDark: '#85734f' },
  pavillon: { top: '#d6b48a', rim: '#8f6c48', chair: '#a98a6a', chairDark: '#8a6c50' },
};

// ---------------------------------------------------------------- Figur
export function drawChair(c, x, ty, st) {
  rr(c, x - 54, ty - 92, 108, 118, 30, lg(c, 0, ty - 92, 0, ty + 26, [[0, st.chair], [1, st.chairDark]]), alpha('#2b2118', 0.25), 2.5);
  rr(c, x - 38, ty - 74, 76, 70, 22, alpha('#fff6e0', 0.1));
}

export function drawHairBack(c, f, hair) {
  if (f.frisur === 'lang') path(c, (k) => { k.moveTo(-50, -110); k.bezierCurveTo(-60, -60, -54, -20, -40, -8); k.lineTo(40, -8); k.bezierCurveTo(54, -20, 60, -60, 50, -110); k.closePath(); }, shade(hair, -0.12), alpha('#2b2118', 0.25), 2);
  if (f.frisur === 'locken') for (const sd of [-1, 1]) for (const dy of [-96, -72, -48]) ell(c, sd * 48, dy, 17, 17, shade(hair, -0.1), alpha('#2b2118', 0.2), 2);
}

export function drawHairFront(c, f, hair) {
  const hi = shade(hair, 0.2), line = alpha('#2b2118', 0.28);
  const cap = (k, lift = 0) => {
    k.moveTo(-45, -96); k.bezierCurveTo(-52, -150 - lift, 52, -150 - lift, 45, -96);
    k.bezierCurveTo(40, -118, 32, -122, 24, -112); k.bezierCurveTo(14, -128, 4, -120, 0, -112); k.bezierCurveTo(-8, -126, -22, -122, -26, -110); k.bezierCurveTo(-34, -120, -42, -116, -45, -96); k.closePath();
  };
  switch (f.frisur) {
    case 'glatze': ell(c, -14, -132, 16, 6, alpha('#fff6e0', 0.35), null, 0, -0.3); return;
    case 'locken':
      for (let i = 0; i < 9; i += 1) { const a = Math.PI + (i / 8) * Math.PI; ell(c, Math.cos(a) * 44, -102 + Math.sin(a) * 44, 18, 18, hair, line, 2); }
      path(c, (k) => cap(k, 4), hair, line, 2); break;
    case 'dutt': ell(c, 0, -152, 21, 19, hair, line, 2); path(c, (k) => cap(k), hair, line, 2); rr(c, -22, -140, 44, 8, 4, shade(hair, -0.25)); break;
    case 'zopf':
      path(c, (k) => cap(k), hair, line, 2);
      for (let i = 0; i < 5; i += 1) ell(c, 52 + i * 1.5, -78 + i * 22, 11, 14, i % 2 ? hair : shade(hair, 0.08), line, 2, 0.1);
      ell(c, 56, 30, 8, 8, '#d9a6a4'); break;
    case 'lang':
      path(c, (k) => cap(k, 2), hair, line, 2);
      for (const sd of [-1, 1]) path(c, (k) => { k.moveTo(sd * 36, -112); k.bezierCurveTo(sd * 60, -90, sd * 56, -50, sd * 50, -22); k.lineTo(sd * 36, -22); k.bezierCurveTo(sd * 40, -60, sd * 34, -90, sd * 30, -108); k.closePath(); }, hair, line, 2);
      break;
    default: // kurz
      path(c, (k) => cap(k), hair, line, 2); ell(c, -38, -88, 8, 16, hair); ell(c, 38, -88, 8, 16, hair);
  }
  c.strokeStyle = alpha(hi, 0.7); c.lineWidth = 4; c.lineCap = 'round';
  c.beginPath(); c.arc(0, -104, 36, Math.PI * 1.15, Math.PI * 1.45); c.stroke();
}

export function drawFace(c, f, a) {
  const ink = '#3b2d2a';
  const happy = a.happy;
  for (const sd of [-1, 1]) {
    const ex = sd * 16, ey = -100;
    if (happy || a.blink) { c.strokeStyle = ink; c.lineWidth = 3.5; c.lineCap = 'round'; c.beginPath(); c.arc(ex, ey + (happy ? 4 : 2), 6.5, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); } else {
      const dn = a.working || a.reading ? 2 : 0;
      ell(c, ex, ey + dn, 6.4, 8, ink); ell(c, ex + 2, ey - 2.5 + dn, 2.4, 2.6, '#fff'); ell(c, ex - 2, ey + 3 + dn, 1.3, 1.3, alpha('#fff', 0.7));
    }
    ell(c, sd * 28, -86, 9, 5.5, alpha('#e58f8a', 0.42));
    c.strokeStyle = alpha(shade(FARBEN[f.haare] ?? '#7a5640', -0.2), 0.8); c.lineWidth = 3; c.beginPath(); c.arc(ex, ey - 17 + (happy ? -2 : 0), 8, Math.PI * 1.2, Math.PI * 1.8); c.stroke();
  }
  c.strokeStyle = alpha(ink, 0.8); c.lineWidth = 2.6;
  if (a.sip) ell(c, 0, -86, 3.6, 4.2, alpha('#a85a5a', 0.85)); else { c.beginPath(); c.arc(0, -90, 6.5, Math.PI * 0.18, Math.PI * 0.82); c.stroke(); }
}

export function drawAccessories(c, f, top) {
  const ink = '#3b2d2a';
  if (f.gesicht === 'brille') { for (const sd of [-1, 1]) { ell(c, sd * 16, -100, 15, 14, alpha('#e9f2f1', 0.18), '#6b5441', 3.2); } c.strokeStyle = '#6b5441'; c.lineWidth = 3; c.beginPath(); c.moveTo(-3, -102); c.quadraticCurveTo(0, -106, 3, -102); c.stroke(); }
  if (f.gesicht === 'sonnenbrille') { for (const sd of [-1, 1]) rr(c, sd * 16 - 15, -112, 30, 24, 10, '#34303a'); rr(c, -4, -106, 8, 4, 2, '#34303a'); ell(c, -22, -106, 6, 3, alpha('#fff', 0.35)); ell(c, 10, -106, 6, 3, alpha('#fff', 0.35)); }
  if (f.kopf === 'muetze') {
    const col = shade(top, -0.05) === top ? top : '#b98574';
    path(c, (k) => { k.moveTo(-48, -112); k.bezierCurveTo(-56, -180, 56, -180, 48, -112); k.closePath(); }, lg(c, 0, -170, 0, -110, [[0, shade(col, 0.1)], [1, shade(col, -0.1)]]), alpha(ink, 0.3), 2.5);
    rr(c, -52, -128, 104, 24, 12, shade(col, -0.12), alpha(ink, 0.3), 2.5);
    c.strokeStyle = alpha('#fff6e0', 0.25); c.lineWidth = 3; for (let i = -40; i <= 40; i += 16) { c.beginPath(); c.moveTo(i, -126); c.lineTo(i, -106); c.stroke(); }
    ell(c, 0, -168, 15, 15, '#f4eee2', alpha(ink, 0.25), 2);
  }
  if (f.kopf === 'kopfhoerer') {
    c.strokeStyle = '#5a5560'; c.lineWidth = 9; c.lineCap = 'round'; c.beginPath(); c.arc(0, -104, 50, Math.PI * 1.04, Math.PI * 1.96); c.stroke();
    for (const sd of [-1, 1]) { ell(c, sd * 48, -98, 13, 20, '#5a5560', alpha(ink, 0.3), 2); ell(c, sd * 48 + sd * 2, -98, 7, 12, '#c98f7a'); }
  }
  if (f.kopf === 'blumenkranz') {
    for (let i = 0; i < 9; i += 1) {
      const a = Math.PI * 1.08 + (i / 8) * Math.PI * 0.84, px = Math.cos(a) * 48, py = -102 + Math.sin(a) * 45;
      leaf(c, px, py, 18, 7, a + Math.PI / 2, '#7f9a74', { veins: false });
      if (i % 2 === 0) { for (let k = 0; k < 5; k += 1) ell(c, px + Math.cos((k / 5) * TAU) * 7, py + Math.sin((k / 5) * TAU) * 7, 6, 4.5, ['#e8c9c0', '#f1ece0', '#e6cf8a'][(i / 2) % 3 | 0], null, 0, (k / 5) * TAU); ell(c, px, py, 3.4, 3.4, '#d9ad63'); }
    }
  }
}

export function drawFigure(c, f, x, ty, a, st) {
  const skin = HAUT[f.haut] ?? HAUT[2];
  const hair = FARBEN[f.haare] ?? FARBEN.braun;
  const top = FARBEN[f.oberteil] ?? FARBEN.blau;
  const typing = a.working ? Math.sin(a.t / 95 + a.seed * 9) : 0;
  c.save(); c.translate(x, ty + a.bob);
  drawHairBack(c, f, hair);
  // Arme
  for (const sd of [-1, 1]) {
    c.strokeStyle = shade(top, -0.06); c.lineWidth = 30; c.lineCap = 'round';
    c.beginPath(); c.moveTo(sd * 40, -46); c.quadraticCurveTo(sd * 62, -10, sd * 38, 16 + (a.working ? typing * sd * 3 : 0)); c.stroke();
    ell(c, sd * 38, 20 + (a.working ? typing * sd * 3 : 0), 12, 11, skin);
  }
  // Körper
  path(c, (k) => { k.moveTo(-52, 18); k.bezierCurveTo(-58, -26, -46, -64, -16, -72); k.lineTo(16, -72); k.bezierCurveTo(46, -64, 58, -26, 52, 18); k.closePath(); },
    lg(c, 0, -74, 0, 18, [[0, shade(top, 0.14)], [1, shade(top, -0.1)]]), alpha('#2b2118', 0.3), 2.5);
  ell(c, 0, -70, 20, 9, shade(skin, -0.1));
  if (f.hals === 'schal') {
    rr(c, -36, -78, 72, 22, 11, '#c07a6c', alpha('#2b2118', 0.28), 2.5);
    c.strokeStyle = alpha('#f1e3c8', 0.6); c.lineWidth = 3; for (let i = -26; i <= 26; i += 13) { c.beginPath(); c.moveTo(i, -76); c.lineTo(i, -58); c.stroke(); }
    rr(c, 12, -62, 24, 56, 9, '#c07a6c', alpha('#2b2118', 0.28), 2.5);
    c.strokeStyle = alpha('#f1e3c8', 0.6); for (let yy = -48; yy < -10; yy += 14) { c.beginPath(); c.moveTo(14, yy); c.lineTo(34, yy); c.stroke(); }
  }
  rr(c, -10, -82, 20, 18, 7, shade(skin, -0.1));
  // Kopf
  ell(c, 0, -102, 44, 41, lg(c, -30, -140, 30, -60, [[0, shade(skin, 0.1)], [1, shade(skin, -0.06)]]), alpha('#2b2118', 0.3), 2.5);
  for (const sd of [-1, 1]) ell(c, sd * 43, -98, 7, 10, skin, alpha('#2b2118', 0.25), 2);
  drawFace(c, f, a);
  drawHairFront(c, f, hair);
  drawAccessories(c, f, top);
  c.restore();
}

export function steam(c, x, y, t, strong, seed) {
  c.strokeStyle = alpha('#ffffff', strong ? 0.6 : 0.4); c.lineWidth = 3.5; c.lineCap = 'round';
  for (let i = 0; i < 2; i += 1) {
    const ph = t / 520 + seed * 5 + i * 1.6;
    c.beginPath(); c.moveTo(x + i * 10 - 5, y);
    c.bezierCurveTo(x + i * 10 - 5 + Math.sin(ph) * 8, y - 14, x + i * 10 - 5 - Math.sin(ph) * 8, y - 24, x + i * 10 - 5 + Math.sin(ph + 1) * 7, y - (strong ? 44 : 34));
    c.stroke();
  }
}

export function drawTable(c, x, ty, st) {
  ell(c, x, ty + 110, 134, 20, alpha('#2b2118', 0.2));
  rr(c, x - 9, ty + 40, 18, 66, 8, shade(st.rim, -0.1)); ell(c, x, ty + 104, 50, 11, shade(st.rim, -0.14));
  ell(c, x, ty + 38, 116, 29, st.rim);
  ell(c, x, ty + 26, 116, 29, lg(c, x - 110, ty, x + 110, ty + 55, [[0, shade(st.top, 0.1)], [1, shade(st.top, -0.07)]]), alpha('#2b2118', 0.2), 2);
  ell(c, x - 24, ty + 14, 70, 11, alpha('#fff6e0', 0.16));
}

export function drawDesk(c, f, x, ty, a) {
  const hand = (hx, hy) => ell(c, hx, hy, 12, 10, HAUT[f.haut] ?? HAUT[2], alpha('#2b2118', 0.25), 2);
  if (f.tisch === 'laptop') {
    rr(c, x - 62, ty + 28, 124, 18, 8, '#aaa498', alpha('#2b2118', 0.25), 2);
    rr(c, x - 54, ty - 34, 108, 70, 10, lg(c, x - 54, ty - 34, x + 54, ty + 36, [[0, '#d7d3c9'], [1, '#b9b4a8']]), alpha('#2b2118', 0.3), 2.5);
    ell(c, x, ty + 2, 8, 8, alpha('#fff6e0', 0.55));
    if (a.working) glow(c, x, ty - 36, 70, '#cfe9ff', 0.28);
  } else if (f.tisch === 'notizbuch') {
    const wob = a.working ? Math.sin(a.t / 140 + a.seed * 7) * 7 : 0;
    path(c, (k) => { k.moveTo(x - 66, ty + 28); k.lineTo(x, ty + 20); k.lineTo(x, ty + 56); k.lineTo(x - 70, ty + 50); k.closePath(); }, '#f6efdc', alpha('#2b2118', 0.3), 2);
    path(c, (k) => { k.moveTo(x + 66, ty + 28); k.lineTo(x, ty + 20); k.lineTo(x, ty + 56); k.lineTo(x + 70, ty + 50); k.closePath(); }, '#fbf6e8', alpha('#2b2118', 0.3), 2);
    c.strokeStyle = alpha('#9a8b6e', 0.5); c.lineWidth = 2; for (let i = 0; i < 4; i += 1) { c.beginPath(); c.moveTo(x - 58, ty + 32 + i * 5); c.lineTo(x - 8, ty + 28 + i * 5); c.moveTo(x + 8, ty + 28 + i * 5); c.lineTo(x + 58, ty + 32 + i * 5); c.stroke(); }
    c.strokeStyle = '#6b8aa3'; c.lineWidth = 4; c.beginPath(); c.moveTo(x + 24 + wob, ty + 36); c.lineTo(x + 46 + wob, ty + 18); c.stroke();
    hand(x + 22 + wob, ty + 40); hand(x - 40, ty + 44);
  } else if (f.tisch === 'buch') { // Buch lesen: aufgeschlagenes Buch, ab und zu wird umgeblättert
    const flip = (a.t % 7000) / 700; // 0..10: nur die ersten 1.0 sind die Bewegung
    rr(c, x - 80, ty + 12, 160, 50, 8, '#8f5a4e', alpha('#2b2118', 0.35), 2.5);
    path(c, (k) => { k.moveTo(x - 72, ty + 26); k.lineTo(x, ty + 18); k.lineTo(x, ty + 54); k.lineTo(x - 76, ty + 50); k.closePath(); }, '#f6efdc', alpha('#2b2118', 0.3), 2);
    path(c, (k) => { k.moveTo(x + 72, ty + 26); k.lineTo(x, ty + 18); k.lineTo(x, ty + 54); k.lineTo(x + 76, ty + 50); k.closePath(); }, '#fbf6e8', alpha('#2b2118', 0.3), 2);
    c.strokeStyle = alpha('#9a8b6e', 0.5); c.lineWidth = 2;
    for (let i = 0; i < 5; i += 1) { c.beginPath(); c.moveTo(x - 64, ty + 29 + i * 4.6); c.lineTo(x - 8, ty + 25 + i * 4.6); c.moveTo(x + 8, ty + 25 + i * 4.6); c.lineTo(x + 64, ty + 29 + i * 4.6); c.stroke(); }
    if (flip < 1) { // umblätternde Seite
      const k = Math.cos(flip * Math.PI), w = 72 * k;
      path(c, (kk) => { kk.moveTo(x, ty + 18); kk.lineTo(x + w, ty + 26 - Math.sin(flip * Math.PI) * 14); kk.lineTo(x + w * 1.05, ty + 50 - Math.sin(flip * Math.PI) * 14); kk.lineTo(x, ty + 54); kk.closePath(); }, '#fffaf0', alpha('#2b2118', 0.3), 2);
    }
    rr(c, x - 3, ty + 14, 6, 44, 3, '#c0584a');
    hand(x - 62, ty + 48); hand(x + 62, ty + 48);
  } else { // Schreibmaschine
    rr(c, x - 36, ty - 52, 72, 64, 4, '#fbf6e8', alpha('#2b2118', 0.28), 2);
    c.strokeStyle = alpha('#7a6e58', 0.55); c.lineWidth = 2.4; for (let i = 0; i < 5; i += 1) { c.beginPath(); c.moveTo(x - 26, ty - 40 + i * 9); c.lineTo(x + 26 - (i === 4 ? 24 : 0), ty - 40 + i * 9); c.stroke(); }
    rr(c, x - 62, ty + 2, 124, 50, 14, lg(c, 0, ty, 0, ty + 52, [[0, '#6f8486'], [1, '#52666a']]), alpha('#2b2118', 0.3), 2.5);
    ell(c, x, ty + 4, 68, 9, '#3d4d50');
    for (let r = 0; r < 2; r += 1) for (let i = 0; i < 8; i += 1) ell(c, x - 42 + i * 12 + r * 6, ty + 24 + r * 14, 4.6, 4.6, '#e6dfcc', '#3d4d50', 1.4);
    if (a.working && Math.floor(a.t / 160) % 2) ell(c, x + 10, ty + 24, 4.6, 4.6, '#cfc7b0', '#3d4d50', 1.4);
  }
  // Getränk
  const cx = x + 88, cy = ty + 34;
  ell(c, cx, cy + 12, 28, 8, alpha('#f4eee2', 0.95), alpha('#2b2118', 0.2), 1.5);
  rr(c, cx - 15, cy - 16, 30, 28, 9, lg(c, cx - 15, 0, cx + 15, 0, [[0, '#fbf6ea'], [1, '#e1d9c8']]), alpha('#2b2118', 0.28), 2);
  path(c, (k) => { k.arc(cx + 16, cy - 3, 8, -Math.PI / 2, Math.PI / 2); }, null, '#e1d9c8', 3.5);
  const liquid = f.getraenk === 'kaffee' ? '#5d4030' : f.getraenk === 'kakao' ? '#8f5f48' : '#cf9a55';
  ell(c, cx, cy - 14, 13, 4, liquid);
  if (f.getraenk === 'kakao') { ell(c, cx - 4, cy - 15, 4, 3, '#fbf6ea'); ell(c, cx + 4, cy - 14, 3.4, 2.6, '#f4dfe0'); }
  steam(c, cx, cy - 20, a.t, a.sip, a.seed);
  // Tier
  if (f.tier === 'katze') {
    const tail = Math.sin(a.t / 700 + a.seed * 6) * 8;
    c.strokeStyle = '#a6a095'; c.lineWidth = 10; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - 94, ty + 30); c.quadraticCurveTo(x - 128, ty + 30, x - 124 + tail, ty + 4); c.stroke();
    ell(c, x - 98, ty + 12, 24, 28, lg(c, x - 120, 0, x - 78, 0, [[0, '#b2ada2'], [1, '#948e84']]), alpha('#2b2118', 0.3), 2); ell(c, x - 98, ty + 20, 13, 16, '#e9e3d6');
    ell(c, x - 98, ty - 16, 21, 18, '#b2ada2', alpha('#2b2118', 0.3), 2);
    for (const sd of [-1, 1]) path(c, (k) => { k.moveTo(x - 98 + sd * 8, ty - 28); k.lineTo(x - 98 + sd * 19, ty - 42); k.lineTo(x - 98 + sd * 20, ty - 24); k.closePath(); }, '#b2ada2', alpha('#2b2118', 0.3), 2);
    c.strokeStyle = '#3b2d2a'; c.lineWidth = 2.6; for (const sd of [-1, 1]) { c.beginPath(); c.arc(x - 98 + sd * 8, ty - 17, 4.2, Math.PI * 0.15, Math.PI * 0.85); c.stroke(); }
    ell(c, x - 98, ty - 10, 2.6, 2, '#d99a95');
  } else if (f.tier === 'eule') {
    ell(c, x - 98, ty + 6, 24, 34, lg(c, x - 122, 0, x - 74, 0, [[0, '#a98664'], [1, '#85694c']]), alpha('#2b2118', 0.3), 2);
    ell(c, x - 98, ty + 12, 15, 22, '#eadcc0');
    for (const i of [0, 1, 2]) { c.strokeStyle = alpha('#a98664', 0.6); c.lineWidth = 2; c.beginPath(); c.arc(x - 98, ty + 6 + i * 9, 6, 0.2, Math.PI - 0.2); c.stroke(); }
    for (const sd of [-1, 1]) { path(c, (k) => { k.moveTo(x - 98 + sd * 12, ty - 26); k.lineTo(x - 98 + sd * 20, ty - 42); k.lineTo(x - 98 + sd * 22, ty - 22); k.closePath(); }, '#85694c'); ell(c, x - 98 + sd * 10, ty - 14, 11, 11, '#fbf6ea', alpha('#2b2118', 0.3), 2); ell(c, x - 98 + sd * 10, ty - 13, 5.4, 5.4, '#3b2d2a'); ell(c, x - 98 + sd * 11, ty - 15, 1.8, 1.8, '#fff'); }
    path(c, (k) => { k.moveTo(x - 104, ty - 6); k.lineTo(x - 98, ty + 4); k.lineTo(x - 92, ty - 6); k.closePath(); }, '#d9ad63');
  }
}

