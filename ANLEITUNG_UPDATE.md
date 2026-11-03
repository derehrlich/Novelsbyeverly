# Installation, Updates und Sicherungen

## Einmalig: Installation (oder Umzug von der alten Variante)
Das Programm liegt im Ordner `app`, deine Daten im Ordner `data`. Beide liegen auf dem Server unter `/DATA/AppData/novelsbyeverly/`.

1. Im Projektordner auf dem Server (per SSH): `git pull` und dann
   `sudo sh scripts/installieren.sh`
   Das legt die beiden Ordner an, kopiert das Programm nach `app` und übernimmt Daten aus einer älteren Installation (`data/cowork`), falls vorhanden.
2. Alten Container stoppen, falls es ihn gibt: `docker compose down` (im Projektordner, **bevor** du die neue Datei benutzt).
3. Zugangsdaten eintragen: `sudo nano /DATA/AppData/novelsbyeverly/data/novelsbyeverly.env`
   - `ADMIN_PASSWORD=` dein Passwort für den Admin
   - `TWITCH_CLIENT_ID=` Client-ID deiner Twitch-App (Client Type **Public**)
4. Starten: `docker compose up -d` (die neue `docker-compose.yml` nutzt das fertige Node-Image und die beiden Ordner).
   In CasaOS erscheint die App danach im Dashboard.
5. Admin öffnen: `http://192.168.178.144:8888/admin/`. Bei einem Umzug ist Twitch schon verbunden. Sonst: „Kanal mit Twitch verbinden“ und den Code auf twitch.tv/activate bestätigen, danach „Reward & Verbindung abgleichen“.

## Ab jetzt: jedes Update im Admin
1. Admin → **System** → „Update einspielen“.
2. Die ZIP-Datei (`novelsbyeverly-….zip`, so wie du sie bekommst) auswählen und hochladen. Nicht entpacken.
3. Das Programm sichert deine Einstellungen und den alten Programmstand, prüft die neuen Dateien und startet neu (bis 1 Minute). Die Seite lädt danach von selbst neu.
4. Unter System steht „Letztes Update: … erfolgreich“ und die neue Version.

Geht etwas schief, bleibt das alte Programm unverändert und der Grund steht unter „Letztes Update“. Du kannst jederzeit unter **System → Älterer Programmstand** zurückgehen.

## Sicherungen
- Jede Nacht um 4 Uhr, vor jedem Update und vor jeder Wiederherstellung wird automatisch gesichert (die letzten 10 bleiben).
- Unter **System** kannst du „Jetzt sichern“, Sicherungen herunterladen (ab und zu auf den PC) und wiederherstellen.
- Enthalten: Einstellungen, Design, Zählerstände, Aufgaben, Mitschreibende. **Nicht** enthalten: die Twitch-Verbindungen und das Admin-Passwort (die liegen in `data`).

## Wichtig
Den Ordner `data` nie überschreiben oder neu hochladen. Dort liegen deine Einstellungen und Zugangsdaten.
