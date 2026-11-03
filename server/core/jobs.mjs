// Hintergrundjobs: Timer-Takt (Phasenwechsel und Ansagen auch ohne offenes Overlay) und nächtliche Sicherung um 4 Uhr.
import { getSettings } from '../features/settings.mjs';
import { tick } from '../features/timer.mjs';
import { autoHeute, sichereDaten } from './sicherung.mjs';

export function startJobs() {
  const timer = setInterval(async () => {
    try {
      await tick(await getSettings());
      if (new Date().getHours() === 4 && !autoHeute()) { sichereDaten('auto'); console.log('Nächtliche Sicherung angelegt'); }
    } catch (e) { console.warn('Hintergrundjob:', e.message); }
  }, 5000);
  timer.unref();
}
