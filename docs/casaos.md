# Novels by Everly auf dem eigenen CasaOS-Server

Der Bot läuft zu Hause auf dem NAS (statt auf Netlify). Der Code ist derselbe: `server.mjs` lädt die vorhandenen Functions, liefert `public/` aus und speichert die Daten in einem Ordner (`/data`). Gebaut wird ein Docker-Image (`Dockerfile`), das die GitHub Action `docker-image.yml` nach `ghcr.io/derehrlich/novelsbyeverly` legt.

Warum zu Hause: Das Overlay fragt alle paar Sekunden nach. Auf Netlify zählt jede Abfrage gegen das Kontingent, zu Hause kostet sie nichts. Außerdem laufen jetzt auch Hintergrund-Aufgaben: Der Pomodoro-Timer wechselt die Phase und meldet sich im Chat, auch wenn kein Overlay offen ist, und es gibt jede Nacht eine Sicherung.

## Wie alles zusammenhängt

```
Twitch / OBS / Zuschauer ──https──> Cloudflare ──Tunnel──> cloudflared (NAS) ──> Everly-Bot (Port 3001)
```

Es wird nichts im Router freigegeben. Der Tunnel baut die Verbindung von innen nach außen auf.

## Was du vorher brauchst

- Eine Adresse bei Cloudflare, z. B. `bot.deinedomain.de` (Domain mit Status „Aktiv“), und ein Cloudflare Tunnel (`cloudflared`) auf dem NAS. Läuft der schon für die Stadtwache, wird nur ein weiterer *Public Hostname* ergänzt.
- Sicherung der Netlify-Version: im Admin die Daten ansehen geht nur dort. Wenn du bisher Besucher, Arbeitszeiten und Wörter hast, melde dich bei mir, dann baue ich einen Export für die Übernahme (der bisherige Speicher ist Netlify Blobs, die neue Sicherungsdatei hat ein eigenes Format).
- Deine Werte: `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` (in der Twitch-Entwicklerkonsole, bei Bedarf „Neues Geheimnis“), `EVENTSUB_SECRET` (frei ausdenken, 10 bis 100 Zeichen, nur Buchstaben und Zahlen), `ADMIN_PASSWORD` (neues langes Passwort).

## Schritt 1: Image bereitstellen (einmalig)

1. Den Zweig in den Hauptzweig mergen (oder in GitHub unter *Actions → Docker-Image → Run workflow* den Zweig von Hand bauen lassen).
2. Nach dem ersten Lauf: GitHub → dein Profil → *Packages* → `novelsbyeverly` → *Package settings* → **Change visibility → Public**. Sonst kann CasaOS das Image nicht laden.

## Schritt 2: In CasaOS installieren

1. CasaOS → App-Store → **Benutzerdefinierte App installieren** (oben rechts) → Compose-Datei einfügen (Inhalt von `docker-compose.yml`).
2. Die Werte `HIER_…` ersetzen und `SITE_URL` auf deine Adresse stellen (mit `https://`, ohne Schrägstrich am Ende). Der Bot ist im Heimnetz unter Port **3001** erreichbar, damit er sich nicht mit der Stadtwache (Port 3000) beißt.
3. Installieren. Die Daten liegen danach in `/DATA/AppData/everly/data`. Diesen Ordner **nie überschreiben** und in dein NAS-Backup aufnehmen.
4. Test im Heimnetz: `http://<NAS-Adresse>:3001/admin/` öffnen und mit dem Admin-Passwort anmelden.

## Schritt 3: Tunnel und Twitch

1. Cloudflare → Zero Trust → Netzwerke → Tunnels → dein Tunnel → *Public Hostname* hinzufügen: Subdomain und Domain wie gewünscht, Typ `HTTP`, URL `<NAS-Adresse>:3001`.
2. Twitch-Entwicklerkonsole → deine App → **OAuth Redirect URL** ergänzen: `https://DEINE-ADRESSE/api/auth/callback`.
3. Admin → **Kanal mit Twitch verbinden**, dann **Bot-Account verbinden**, dann **Reward & Webhooks abgleichen**. Der Status oben muss grün sein.
4. OBS: Browserquelle auf `https://DEINE-ADRESSE/overlay` umstellen.

Läuft Netlify noch parallel, wird ein Ereignis an zwei Orte geliefert. Netlify also erst abschalten, wenn alles läuft.

## Admin-Bereich zusätzlich schützen (Cloudflare Access)

Zero Trust → Access → Anwendungen → *Selbst gehostet*: Anwendung für deine Adresse mit den Pfaden **`/admin`** und **`/api/admin`**, Regel „Erlauben, wenn E-Mail = deine Adresse“. Alles andere **nicht** in die Regel aufnehmen, sonst brechen Twitch-Webhooks (`/api/twitch-webhook`), Anmeldung (`/api/auth/*`), das Overlay (`/overlay`), die Rangliste (`/rangliste`, `/api/rangliste`) und die Schnittstellen für Hilfsprogramme (`/api/words`, `/api/musik`).

## Betrieb

- **Update per Knopf:** Im Admin unter *System* steht die laufende Version und der Knopf **„Auf Updates prüfen“**. Er bittet Watchtower, nachzusehen, ob nach einem Merge ein neues Image da ist. Wenn ja, lädt Watchtower es und startet den Bot neu (die Seite ist etwa eine halbe Minute weg, die Daten bleiben).
  - **Einmalig einrichten:** 1. Ein langes Geheimwort ausdenken. 2. Watchtower installieren (`docker-compose.watchtower.yml`). **Läuft auf dem NAS schon Watchtower für die Stadtwache, brauchst du keine zweite App:** Dort bei `command` beide Namen eintragen (`stadtwache everly`). 3. In der Everly-App `WATCHTOWER_URL` (z. B. `http://<NAS-Adresse>:8081`) und `WATCHTOWER_TOKEN` (derselbe Schlüssel wie bei Watchtower) setzen.
- **Update von Hand:** per SSH `docker run --rm -v /var/run/docker.sock:/var/run/docker.sock ghcr.io/nicholas-fedor/watchtower:latest --run-once --cleanup everly`.
- **Server war aus:** Admin → **Rewards & Webhooks abgleichen**, falls Twitch die Webhooks abgeschaltet hat.
- **Gesundheit:** `/healthz` antwortet mit `ok`; Docker prüft das selbst.
- **Automatische Sicherung:** Jede Nacht ab 3 Uhr (einstellbar unter *Einstellungen → Sicherung*) legt der Bot eine Datei `everly-JJJJ-MM-TT.json` im Backup-Ordner ab und hebt die letzten 7 auf. Der Ordner sollte auf einem **anderen Gerät** liegen, zum Beispiel einer Freigabe deines NAS (in CasaOS unter *Dateien → Netzwerk* verbinden, sie erscheint dann unter `/media/<Name>`). Dann in der App beim Speicher `/DATA/AppData/everly/backups` durch den Ordner auf der Freigabe ersetzen (rechts steht weiter `:/backups`). Im Admin unter *System* gibt es „Jetzt sichern“, „Sicherung herunterladen“ und „Wiederherstellen“.
- **Was in der Sicherung steckt:** Einstellungen, Besucher mit Arbeitszeit und Wörtern, Aufgaben, Check-ins, Stream-Tage und Monatspunkte sowie Timer, Wörter- und Seitenstand. Nicht enthalten: die Twitch-Verbindung (nach dem Wiederherstellen neu verbinden) und Kurzlebiges wie Sitzplätze.
- **Datenordner:** `/DATA/AppData/everly/data` enthält auch die Twitch-Tokens (Dateirechte nur für den Besitzer). Nicht öffentlich teilen.

## Lokal ausprobieren (Entwickler)

```
npm ci
ADMIN_PASSWORD=test EVENTSUB_SECRET=zufallstext123 SITE_URL=http://localhost:3000 npm start   # Daten in ./data
npm test
```
