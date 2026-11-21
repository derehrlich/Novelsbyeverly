// Funktionen, die man im Admin (System → Funktionen) abwählen kann. Abgewählt heißt: unsichtbar im Admin UND nicht aktiv.
// Eine Stelle für alles: id, Name, welche Admin-Seiten (Schlüssel aus nav.js) dazugehören und welche Schalter dabei ausgeschaltet werden.
// Ausgeschaltet wird nur in den „wirksamen“ Einstellungen (getSettings): was du eingestellt hast, bleibt gespeichert und ist beim Wiedereinschalten da.
export const FUNKTIONEN = [
  { id: 'alerts', label: 'Alerts und Raids', hint: 'Buch-Alerts im Overlay für Follower, Abos, Bits und Raids', pages: ['alerts'], off: { alertsEnabled: false, raidEnabled: false } },
  { id: 'auszeit', label: 'Stream-Pause', hint: 'Pausen-Overlay und Befehle wie !auszeit', pages: ['auszeit'], off: { pauseEnabled: false } },
  { id: 'startscreen', label: 'Startbildschirm', hint: 'Countdown vor dem Stream', pages: ['startscreen'], off: {} },
  { id: 'checkin', label: 'Check-in, Streak und Punkte', hint: 'Kanalpunkte-Check-in, Streak-Retter, Punkte und Rangliste', pages: ['checkin'], off: { checkinEnabled: false, pointsEnabled: false, streakRescueEnabled: false, milestoneEnabled: false, appearOn: 'sit' } },
  { id: 'befehle', label: 'Eigene Befehle und Zitate', hint: 'Eigene Chat-Befehle, Zitate und Shoutout', pages: ['befehle'], off: { customCommandsEnabled: false, quoteEnabled: false, soEnabled: false } },
  { id: 'musik', label: 'Musik', hint: 'Musik-Karte im Overlay', pages: ['musik'], off: { musikQuelle: 'aus' } },
];
export const FEATURE_IDS = FUNKTIONEN.map((f) => f.id);

export const parseOff = (text) => new Set(String(text ?? '').split(',').map((s) => s.trim()).filter((id) => FEATURE_IDS.includes(id)));
export const cleanOff = (text) => FEATURE_IDS.filter((id) => parseOff(text).has(id)).join(',');
export const featureOn = (settings, id) => !parseOff(settings?.funktionenAus).has(id);

// Einstellungen so, wie der Bot sie wirklich benutzt: abgewählte Funktionen sind ausgeschaltet.
export function applyFeatures(settings) {
  const aus = parseOff(settings.funktionenAus);
  if (!aus.size) return settings;
  const out = { ...settings };
  for (const f of FUNKTIONEN) if (aus.has(f.id)) Object.assign(out, f.off);
  return out;
}
export const featureList = (settings) => FUNKTIONEN.map(({ id, label, hint, pages }) => ({ id, label, hint, pages, on: featureOn(settings, id) }));
