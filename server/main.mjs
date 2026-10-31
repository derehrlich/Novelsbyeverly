// Start: erst anstehende Updates einspielen, dann Server hochfahren und die Verbindung zu Twitch aufbauen.
//   ADMIN_PASSWORD=geheim node server/index.mjs (lädt diese Datei)   →  http://localhost:8888/admin/
// Im Container läuft das Programm aus dem eingebundenen Ordner /app; Updates kommen als ZIP über Admin → System.
import { wendeAnstehendesAn } from './update.mjs';

if (wendeAnstehendesAn()) {
  console.log('Update eingespielt, starte neu …');
  process.exit(1); // Docker (restart: unless-stopped) startet mit dem neuen Programm
}

// Erst jetzt laden: Die übrigen Module sind durch das Update vielleicht neu.
const { PORT, DATA_DIR, version } = await import('./core/config.mjs');
const { createServer } = await import('./core/server.mjs');
const { routes } = await import('./api/index.mjs');
const { startEventSub } = await import('./twitch/eventsub.mjs');
const { startJobs } = await import('./core/jobs.mjs');
const { ladeTwitchApp, twitchApp } = await import('./twitch/zugang.mjs');
await ladeTwitchApp();

const server = createServer(routes);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Co-Working-Overlay ${version()} läuft auf Port ${PORT}: Admin /admin/ · Overlay /overlay · Daten in ${DATA_DIR}`);
  if (!process.env.ADMIN_PASSWORD) console.warn('Achtung: ADMIN_PASSWORD ist nicht gesetzt, der Admin-Bereich bleibt gesperrt.');
  if (!twitchApp().clientId) console.warn('Hinweis: Die Twitch-Client-ID fehlt, die Verbindung zu Twitch ist aus. Im Admin unter „Twitch-App“ eintragen.');
  else startEventSub().then(() => console.log('Twitch: Verbindung ok')).catch((e) => console.warn('Twitch:', e.message));
});
startJobs();

for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { console.log('Beende …'); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); });
