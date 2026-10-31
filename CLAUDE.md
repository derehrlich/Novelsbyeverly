# Co-Working-Overlay (Novels by Everly) – Projektwissen für Claude Code

## Wer und was
- **Auftraggeber:** Marcel betreibt den Server; das Overlay ist für den Twitch-Kanal „Novels by Everly“ (Schreib- und Co-Working-Streams). Marcel ist kein Programmierer: **alles auf Deutsch**, Schritt für Schritt, einfache Worte, keine Fachbegriffe ohne Erklärung. Fragen vor dem Bauen klären, wenn etwas offen ist; kleine Dinge einfach entscheiden und sagen, was entschieden wurde.
- **Projekt:** Stream-Overlay für Schreib- und Co-Working-Streams (Twitch) mit Pomodoro-Timer, Wörterzähler, To-Do, Musik-Anzeige und wachsender Landschaft oder Fenster-Ansicht, plus Chat-Bot und Admin-Oberfläche. Läuft als Container auf Marcels CasaOS-Server (192.168.178.144), nur im Heimnetz.
- Verwandtes Projekt mit demselben Betriebsmodell: `derehrlich/verwirrbot` (Discord-Bot). Update-Mechanismus und Ordnerstruktur sind dort abgeschaut.

## Feste Regeln (nie brechen)
- **Geheimnisse** (Admin-Passwort, Twitch-Client-ID/Secret, Tokens) stehen nur in `<Datenordner>/novelsbyeverly.env` bzw. `data/cowork/config…` auf dem Server. Nie in Code, Chat, Screenshots, Git, docker-compose.yml. Client-ID und Secret trägt Marcel im Admin ein (Betrieb → Twitch-App, gespeichert als `config/twitch-app`, hat Vorrang vor der env-Datei); sie und die Tokens stehen bewusst **nicht** in Sicherungen. Das Secret wird nie an den Admin zurückgegeben.
- **Der Datenordner (`/data`) wird nie überschrieben.** Programm-Updates tauschen nur `server/`, `public/`, `package.json`, `VERSION.txt` aus.
- **Keine Zusatzpakete:** `package.json` hat keine Abhängigkeiten (Node 22 reicht). Auch ZIP lesen/schreiben (`server/core/zip.mjs`) ist selbst gebaut. Neue Pakete nur nach Rücksprache, weil das Programm als reiner Ordner per ZIP aktualisiert wird.
- **Nur Heimnetz:** Der Admin ist nur durch ein Passwort geschützt. Nie ins Internet stellen.
- **Bei jedem Release `VERSION.txt` ändern** (Marcel prüft damit unter Admin → System, ob das Update angekommen ist).

## Betrieb
- `docker-compose.yml`: Image `node:22-alpine`, `/DATA/AppData/novelsbyeverly/app` → `/app` (Programm), `…/data` → `/data` (Daten), Port 8888. Startbefehl `node server/index.mjs`. `restart: unless-stopped`, deshalb reicht `process.exit(1)` für einen Neustart.
- **Update:** Admin → System → ZIP hochladen (`POST /api/system/update`). Die ZIP wird geprüft und als `data/update.zip` abgelegt, der Prozess beendet sich. Beim Start wendet `server/update.mjs` sie an (läuft vor allem anderen, nur Node-Bordmittel): entpacken in `data/update_tmp`, jede `.mjs` mit `node --check` prüfen, Programm nach `data/backups/programm_vor_update_*.zip` sichern (letzte 5), `server/` und `public/` austauschen, neu starten. Bei Fehler bleibt das alte Programm, die Datei heißt `update_fehlerhaft.zip`, Status in `data/update_status.txt`. Ein umschließender Ordner in der ZIP wird abgestreift; alles außer `server`, `public`, `package.json`, `VERSION.txt` wird ignoriert.
- **Sicherungen** (`server/core/sicherung.mjs`): `data/backups/sicherung_*.zip` (Einstellungen, Zählerstände, Aufgaben, Mitschreibende; ohne Twitch-Tokens). Nachts 4 Uhr automatisch, vor jedem Update und jeder Wiederherstellung, letzte 10. Wiederherstellen über `data/restore.zip`, das beim nächsten Start eingespielt wird.
- **Release bauen:** `npm run zip` → `novelsbyeverly-<Version>.zip` (nur Programm). Marcel lädt sie im Admin hoch. Erste Installation oder Umzug: `sudo sh scripts/installieren.sh`.
- **Zugangsdaten:** `server/core/config.mjs` liest `<DATA_DIR>/novelsbyeverly.env` (KEY=Wert); echte Umgebungsvariablen haben Vorrang.

## Aufbau (`server/`)
```
index.mjs          Start: update.mjs anwenden → Server → Twitch-Verbindung → Hintergrundjobs
update.mjs         Update/Wiederherstellung beim Start (nur Node-Bordmittel)
core/              config, server (HTTP + statische Dateien), http (Session, JSON), store (JSON-Dateien), util,
                   zip, sicherung, jobs (Timer-Takt alle 5 s, Nachtsicherung), live (Server-Sent Events `/api/overlay/live`: `notify()` nach Einstellungen und Ereignissen, das Overlay fragt dann sofort neu ab; der Abruf alle 3 s bleibt Rückfall)
twitch/            api (Tokens, Helix, Chat senden, Reward), eventsub (WebSocket, verteilt Nachrichten), anmeldung (Device-Code-Login), zugang (Client-ID/Secret: `twitchApp()` statt `process.env.TWITCH_CLIENT_ID` benutzen!)
features/          settings, view (Stand fürs Overlay), chat (Befehle), timer, words, tasks, pages, streamzeit, musik, people, checkin, zeiten
api/               overlay, admin (Dispatcher) + admin/*, auth, system (Update/Sicherung), ingest-words, ingest-musik; index.mjs = Routentabelle
```
- Jede Route-Datei exportiert `config = { path, maxBody? }` und eine Funktion `(Request) → Response`; neue Routen in `api/index.mjs` eintragen. Bodies kommen als Strom und werden erst von der Route gelesen (Uploads erst nach Login-Prüfung).
- Neue Admin-Bereiche: Datei in `api/admin/`, in `api/admin.mjs` (`ROUTES`) eintragen.
- Twitch: **EventSub über WebSocket** (kein öffentlicher Zugang nötig), Abos pro Verbindung neu anlegen (`subscribeWs`). Anmeldung per **Device Code** (kein Redirect, im Heimnetz gibt es kein HTTPS); Twitch-App Client Type **Public**.
- Speicher: JSON-Dateien in `DATA_DIR/cowork/` (Schlüssel siehe Kopfkommentar `core/store.mjs`).

## Oberfläche (`public/`)
- `overlay.html` + `js/`: das Overlay (OBS-Browserquelle 1920×1080). `js/wachstum.mjs` (Landschaft), `js/fenster.mjs` (Fenster-Ansicht), `js/szene.mjs` (Module, Kamerarahmen, pausierter Zimmer-Modus), `js/design.mjs` (Farben/Schrift der Karten als CSS-Variablen, gemeinsam mit Server und Admin), `js/malerei.mjs` (Malwerkzeuge), `js/layout.mjs` (Positionen).
- `admin/`: `index.html`+`betrieb.js` (Einrichtung, Pomodoro, Ziele, Aufgaben, Musik, Einstellungen), `studio.html`+`studio.js` (Overlay-Studio: Live-Vorschau, Anordnung, Szene, Design, Module; speichert erst mit „Speichern“), `system.html`+`system.js` (Version, Update, Rückrollen, Sicherungen), `common.js` (API, Meldungen, Login).
- Die Vorschau im Admin ist das echte Overlay im iframe (`?editor=1`); der Admin schickt per `postMessage({type:'vorschau', patch})` ungespeicherte Änderungen hinein.
- `docs/vorschau.html` (eigenständige Beispielseite) wird mit `node scripts/build-vorschau.mjs` neu erzeugt. Neue JS-Module des Overlays dort in die Liste `modules` eintragen; Namen dürfen sich zwischen Modulen nicht doppeln.

## Tests
`npm test`: Ende-zu-Ende-Tests ohne Netzwerk (simulierte Twitch-API, simulierter WebSocket, Dateispeicher im Temp-Ordner, Update in einer Kopie des Programms). Vor jedem Release alle Tests, dann `VERSION.txt` erhöhen und `npm run zip`.
- Optische Prüfung: `ADMIN_PASSWORD=geheim DATA_DIR=/tmp/x PORT=8899 node server/index.mjs` und mit Playwright Screenshots machen; Overlay-Vorschau ohne Server: `/overlay.html?demo=1&modus=fenster&blick=see&tageszeit=abend`.

## Stolperfallen (schon erlebt)
- **Dateinamen im Projekt nicht doppeln** (z. B. `public/overlay.html` und eine Admin-Seite gleichen Namens): CasaOS flacht hochgeladene ZIPs/Ordner ab, dann überschreibt eine Datei die andere. Deshalb heißt die Admin-Seite `studio.html`.
- `pkill -f <name>` in der Shell kann die eigene Shell beenden; Prozesse gezielt per PID beenden.
- Twitch erlaubt im Heimnetz keine Weiterleitung auf `http://192.168…`: deshalb Device-Code-Login.
- Die Fenster-Ansicht und Landschaft zeichnen alles per Canvas; Änderungen immer in allen Jahres-/Tageszeiten ansehen (Screenshots).
