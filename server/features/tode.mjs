// Deathcounter der Gaming-Szene: eine fortlaufende Zahl (bleibt über Streams hinweg, bis sie zurückgesetzt wird).
import { db } from '../core/store.mjs';
import { pushEvent } from '../core/util.mjs';

const MAX = 99999;

export async function getTode() {
  return (await db.get('state/tode')) ?? { n: 0 };
}

export async function setTode(n, { delta = 0 } = {}) {
  const v = { n: Math.min(MAX, Math.max(0, Math.round(n))), at: Date.now() };
  await db.set('state/tode', v);
  await pushEvent({ type: 'tod', n: v.n, delta }); // weckt das Overlay sofort
  return v;
}

// Karte erneut einblenden, ohne die Zahl zu ändern
export async function zeigeTode() {
  const v = { n: (await getTode()).n, at: Date.now() };
  await db.set('state/tode', v);
  await pushEvent({ type: 'tod', n: v.n, delta: 0 });
  return v;
}

export async function addTode(delta) {
  const { n } = await getTode();
  return setTode(n + delta, { delta });
}

// Gemeinsame Aktionen für Chat, Admin und Hotkey: plus | minus | reset | set (mit wert) | zeigen
export async function todeAktion(aktion, wert) {
  if (aktion === 'plus') return addTode(1);
  if (aktion === 'minus') return addTode(-1);
  if (aktion === 'reset') return setTode(0);
  if (aktion === 'zeigen') return zeigeTode();
  if (aktion === 'set' && wert !== '' && wert !== null && Number.isFinite(Number(wert)) && Number(wert) >= 0) return setTode(Number(wert));
  return null;
}
