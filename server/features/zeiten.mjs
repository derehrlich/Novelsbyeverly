// Jahres- und Tageszeit für die Landschaft: fest eingestellt oder nach Datum und Uhrzeit in der eingestellten Zeitzone.
const part = (settings, date, opts) => Number(new Intl.DateTimeFormat('en-US', { timeZone: settings.timezone, ...opts }).format(date));

export function resolveSeason(settings, date = new Date()) {
  if (settings.jahreszeit !== 'auto') return settings.jahreszeit;
  const m = part(settings, date, { month: 'numeric' });
  return m >= 3 && m <= 5 ? 'fruehling' : m >= 6 && m <= 8 ? 'sommer' : m >= 9 && m <= 11 ? 'herbst' : 'winter';
}

// Wetter hinter dem Fenster: 'auto' = im Winter Schnee, sonst klar
export function resolveWeather(settings, season) {
  if (settings.fensterWetter !== 'auto') return settings.fensterWetter;
  return season === 'winter' ? 'schnee' : 'klar';
}

export function resolveTime(settings, date = new Date()) {
  if (settings.tageszeit !== 'auto') return settings.tageszeit;
  const h = part(settings, date, { hour: 'numeric', hourCycle: 'h23' });
  return h >= 5 && h < 10 ? 'morgen' : h >= 10 && h < 17 ? 'mittag' : 'abend';
}
