// Was gerade läuft. Quellen: Hilfsprogramm per POST /api/musik, Chatbefehl !song oder Admin.
import { db } from '../core/store.mjs';

const clean = (v, n) => String(v ?? '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const STALE_MS = 150_000; // ein Hilfsprogramm meldet alle paar Sekunden; kommt nichts mehr, läuft nichts mehr

export async function setMusik(input, { manual = false, now = Date.now() } = {}) {
  const cover = String(input.cover ?? '').trim();
  const m = {
    title: clean(input.title, 120), artist: clean(input.artist, 120),
    cover: /^https?:\/\/[^\s<>"']{1,500}$/i.test(cover) ? cover : '',
    playing: input.playing !== false && Boolean(clean(input.title, 120)),
    manual, updated: now,
  };
  await db.set('state/musik', m);
  return m;
}

export async function clearMusik() {
  await db.delete('state/musik');
}

// Anzeige-Zustand oder null
export async function getMusik(now = Date.now()) {
  const m = await db.get('state/musik');
  if (!m || !m.playing || !m.title) return null;
  if (!m.manual && now - m.updated > STALE_MS) return null;
  return { title: m.title, artist: m.artist, cover: m.cover };
}
