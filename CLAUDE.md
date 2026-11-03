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
- **Bei jedem Release `VERSION.txt` und `version` in `package.json` auf dieselbe Nummer setzen** (`npm run zip` prüft das) (Marcel prüft damit unter Admin → System, ob das Update angekommen ist).

## Betrieb
- `docker-compose.yml`: Image `node:22-alpine`, `/DATA/AppData/novelsbyeverly/app` → `/app` (Programm), `…/data` → `/data` (Daten), Port 8888. Startbefehl `node server/index.mjs`. `restart: unless-stopped`, deshalb reicht `process.exit(1)` für einen Neustart.
- **Update:** Admin → System → ZIP hochladen (`POST /api/system/update`). Die ZIP wird geprüft und als `data/update.zip` abgelegt, der Prozess beendet sich. Beim Start wendet `server/update.mjs` sie an (läuft vor allem anderen, nur Node-Bordmittel): entpacken in `data/update_tmp`, jede `.mjs` mit `node --check` prüfen, Programm nach `data/backups/programm_vor_update_*.zip` sichern (letzte 5), `server/` und `public/` austauschen, neu starten. Bei Fehler bleibt das alte Programm, die Datei heißt `update_fehlerhaft.zip`, Status in `data/update_status.txt`. Ein umschließender Ordner in der ZIP wird abgestreift; alles außer `server`, `public`, `package.json`, `VERSION.txt` wird ignoriert.
- **Sicherungen** (`server/core/sicherung.mjs`): `data/backups/sicherung_*.zip` (Einstellungen, Zählerstände, Aufgaben, Mitschreibende; ohne Twitch-Tokens). Nachts 4 Uhr automatisch, vor jedem Update und jeder Wiederherstellung, letzte 10. Wiederherstellen über `data/restore.zip`, das beim nächsten Start eingespielt wird.
- **Release bauen:** `npm run zip` → `novelsbyeverly-<Version>.zip` (nur Programm). Marcel lädt sie im Admin hoch. Erste Installation oder Umzug: `sudo sh scripts/installieren.sh`.
- **Zugangsdaten:** `server/core/config.mjs` liest `<DATA_DIR>/novelsbyeverly.env` (KEY=Wert); echte Umgebungsvariablen haben Vorrang.

## Pomodoro-Ablauf (`features/timer.mjs`)
- Fester Ablauf je Start: Pomodoro → Pause, `repeats`-mal (`state/timer.cycle = {total, index, focusMin, breakMin}`), danach Leerlauf. Keine automatische „lange Pause“ mehr. Start über `startFocus(settings, minutes, now, {breakMinutes, repeats})` (Chat `!pomodoro 25 5 4`, Admin `timer/focus`, Stream-Panel).
- Anhalten/Fortsetzen: `holdTimer`/`resumeTimer` (`timer.paused = {at, remaining}`, beim Fortsetzen werden `startedAt`/`endsAt` um die Pausendauer verschoben); `tick()` lässt angehaltene Timer stehen.
- Overlay-Ereignisse `phase` (mit `cycle`, `vorher`, `sessionEnde`) und `hold`. **Töne: es gibt genau zwei**, `start` (ein Pomodoro beginnt) und `ende` (ein Pomodoro ist zu Ende, also `phase: break` mit `vorher: focus`); Pausenende, Banner und alles andere bleiben still. Einstellungen `soundAn` (Hauptschalter, aus = stumm), `soundStart`, `soundEnde`, `soundLautstaerke`; im View als `ton` samt `dateien`. Eigene Dateien: `features/sounds.mjs` + `api/sounds.mjs` (`/api/sound/<start|ende>`: GET öffentlich, PUT/DELETE mit Login; nur echte Audiodateien nach Dateikopf, höchstens 4 MB, liegen in `data/sounds/`).

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
- `admin/`: ein Rahmen für alle Seiten (`nav.js`: Seitenleiste am PC, Burger-Menü am Handy, `common.js`: API, Meldungen, Login, `formular.js`: Einstellungsformulare aus einer Beschreibung). Seiten: `index.html`+`uebersicht.js` (Twitch-App, Verbindungen, Status, Adressen), `pomodoro.html`+`pomodoro.js` (Ablauf starten/anhalten, Länge/Pause/Wiederholungen, Töne inkl. eigener Dateien, Ziele, Wörter, Seiten, To-Do), `studio.html`+`studio.js` (Overlay-Studio: Live-Vorschau, Anordnung, Szene, Design, Module; speichert erst mit „Speichern“; jede Änderung, auch Verschieben, muss `aendern()` aufrufen), `musik.html`+`musik.js`, `chat.html`+`chat.js` (Bot, Chat-Texte, Befehle, Zimmer-Modus), `system.html`+`system.js` (Version, Update, Rückrollen, Sicherungen), `panel.html`+`panel.js` (Stream-Panel: schmal, ohne Menü/Rahmen (kein `data-seite`), für den Stream; zwei Reiter: Pomodoro und Aufgaben, der letzte Reiter wird gemerkt). Neue Seite: HTML mit `<body data-seite data-titel>`, in `nav.js` eintragen.
- Die Vorschau im Admin ist das echte Overlay im iframe (`?editor=1`); der Admin schickt per `postMessage({type:'vorschau', patch})` ungespeicherte Änderungen hinein.
- `docs/vorschau.html` (eigenständige Beispielseite) wird mit `node scripts/build-vorschau.mjs` neu erzeugt. Neue JS-Module des Overlays dort in die Liste `modules` eintragen; Namen dürfen sich zwischen Modulen nicht doppeln.

## Tests
`npm test`: Ende-zu-Ende-Tests ohne Netzwerk (simulierte Twitch-API, simulierter WebSocket, Dateispeicher im Temp-Ordner, Update in einer Kopie des Programms). Vor jedem Release alle Tests, dann `VERSION.txt` erhöhen und `npm run zip`.
- Optische Prüfung: `ADMIN_PASSWORD=geheim DATA_DIR=/tmp/x PORT=8899 node server/index.mjs` und mit Playwright Screenshots machen; Overlay-Vorschau ohne Server: `/overlay.html?demo=1&modus=fenster&blick=see&tageszeit=abend`.

## Alerts (Buch)
- **Eigene OBS-Quelle** `/alerts` (= `public/alertquelle.html`, 1920×1080, durchsichtig), getrennt vom Overlay. Sie holt Stand und Ereignisse wie das Overlay über `/api/overlay` (+ Live-Kanal) und spielt nur `follow`, `sub` (`monate`), `giftsub` (`anzahl`), `cheer` (`bits`, `nachricht`), `raid` (`zuschauer`), jeweils mit `name`. Mehrere Alerts laufen nacheinander (Warteschlange). Das Overlay selbst enthält keinen Alert-Code.
- `public/js/alerts.mjs`: Arten, Standardtexte, Schriften, `normalizeAlerts()` (Server und Browser), `alertTexte()` (Platzhalter `{name}` usw. füllen). Einstellungen in `settings.alerts` (im View als `alerts`): Hauptschalter, Schrift (+ Name einer installierten Schrift), Größen in % (Name, Beschriftung, Nebentext, Buch), Farben, Position x/y, je Art: an, Texte, Dauer, Konfetti.
- Admin-Seite `admin/alerts.html` + `alerts.js`: OBS-Adresse und Anleitung, Vorschau (iframe `/alerts?vorschau=1`, bekommt Entwürfe per `postMessage({type:'alerts'})` und Probe-Alerts per `{type:'abspielen', ereignis}`), Testknöpfe „An OBS senden“ (`POST test/event` mit `kind` = Alert-Art, `name`, Beispielwerte überschreibbar, Ereignis trägt `test:true` und spielt auch bei ausgeschalteter Art), Einstellungen, Speichern-Leiste.
- Sprites: `public/alerts/buch-aufklappen.png` = **5 Bilder à 1000×660 px nebeneinander** (blaues Buch #1a696e, aus Magenta-Vorlagen freigestellt): fast geschlossen, drei Zwischenstufen, ganz offen. Anker = Buchrücken/Lesebändchen (x 500) und Unterkante des Deckels (y 560); alle Maße in `alertquelle.html` sind Sprite-Pixel mal `--u` (Anzeigegröße, Standard 0,62 × „Größe des Buchs“). `setFrame(f)` blendet zwischen zwei benachbarten Bildern weich über (altes Bild blendet in der zweiten Hälfte aus). Text steht auf den Seiten bei x 158/540, y 150, 310×330 (Sprite-Pixel). Ablauf: hereingleiten, aufklappen (Bild 0→4), Text und eigenes Glühen, rückwärts zuklappen. Text wird bei Bedarf verkleinert. Die Alerts sind still (Töne gibt es nur `start`/`ende`).
- Neue Sprites einsetzen: Bilder wie oben freistellen (Magenta-Abstand → Deckkraft, Magenta aus Randpixeln herausrechnen, Randring mit Innenfarbe füllen), am Rücken/Deckelunterkante ausrichten, nebeneinander ablegen; bei anderer Bildanzahl/-größe `BILDER`, `BUCH_W`, `ANKER`, `MITTE` und die CSS-Maße in `alertquelle.html` anpassen. Schwachstelle: der Sprung vom fast senkrechten Deckel (Bild 3) zum ganz offenen Buch (Bild 4) wird nur überblendet; ein oder zwei Zwischenbilder (Deckel senkrecht von der Kante, Deckel halb nach links gekippt) würden es glätten.
- **Noch nicht an Twitch angeschlossen:** Echte Follows, Abos, Bits und Raids brauchen EventSub-Abos und zusätzliche Berechtigungen (`moderator:read:followers`, `channel:read:subscriptions`, `bits:read`); bisher nur Test über den Admin oder `/alerts?ereignis=raid&name=Lena`.

## Overlay-Geschwindigkeit
- Zwei Ebenen: `Szene.basis` (eigener Canvas dahinter) trägt den ruhenden Hintergrund (Landschaft/Fenster-Ansicht samt Vignette und Kamerarahmen) und wird nur bei Änderungen gemalt (`vorbereiten()` liefert einen Schlüssel); der Canvas davor zeigt nur das Bewegte (`animiere()`), bis zu 60 Bilder pro Sekunde. `glow()` kopiert zwischengespeicherte Bilder statt Verläufe neu aufzubauen. Neue bewegte Dinge nur in `animiere()`/`living()`/`live()`, nie in die Basis. Messen: `/overlay.html?demo=1&perf=1`, dann `window.__perf`.
- OBS: In den Eigenschaften der Browserquelle „Benutzerdefinierte Bildrate verwenden“ auf 60 stellen (Standard ist 30).

## Stolperfallen (schon erlebt)
- **Zeichenreihenfolge bei Topfpflanzen:** erst `pot()`, dann die Pflanze (Stängel beginnen auf Höhe der Erde, `y - Topfhöhe`). Wird der Topf nach den Blättern gemalt, sieht es aus, als kämen die Stängel hinter dem Topf hervor.
- **Baumkrone** (`wachstum.mjs`, `treeModel`): Laub nicht nur an den Astspitzen, sondern auch in einer gefüllten Ellipse im Inneren plus deckende Laubmassen, sonst scheint der Himmel durch die Mitte.
- Beim Messen von Canvas-Zeiten die Zeichnung erzwingen (`getImageData(0,0,1,1)`), sonst misst man nur das Aufzeichnen der Befehle.
- **Dateinamen im Projekt nicht doppeln** (z. B. `public/overlay.html` und eine Admin-Seite gleichen Namens): CasaOS flacht hochgeladene ZIPs/Ordner ab, dann überschreibt eine Datei die andere. Deshalb heißt die Admin-Seite `studio.html`.
- `pkill -f <name>` in der Shell kann die eigene Shell beenden; Prozesse gezielt per PID beenden.
- Twitch erlaubt im Heimnetz keine Weiterleitung auf `http://192.168…`: deshalb Device-Code-Login.
- Die Fenster-Ansicht und Landschaft zeichnen alles per Canvas; Änderungen immer in allen Jahres-/Tageszeiten ansehen (Screenshots).
