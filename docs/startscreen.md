# Startbildschirm „Gleich geht’s los“ (Anleitung für Marcel)

Eine Seite für OBS, die vor dem Stream das ganze Bild füllt: große Überschrift, Countdown auf einer Papier-Karte, ein
Schreib-Fortschrittsbalken („Der Kaffee wird gekocht“ → „Die Stifte werden gespitzt“ → „Das Notizbuch wird aufgeschlagen“ …
→ „Gleich die erste Zeile!“) und wechselnde Schreib-Sprüche („Plot-Wissen“, „Kaffee-Regel“ …). Ist die Zeit um, steht dein Schlusstext
(„Das Schreibzimmer ist geöffnet! ✍️“) da, bis du auf „Beenden“ drückst.

## In OBS einbinden
- Browserquelle 1920×1080 auf `https://<deine Adresse>/startscreen`. Sie füllt das ganze Bild und bleibt **unsichtbar**, bis du sie im Admin startest.
- Am einfachsten als eigene Szene „Startbildschirm“ mit dieser einen Quelle. Zum Start im Admin auf „Startbildschirm starten“ drücken und in OBS auf die Szene wechseln.
- `?bg=0` macht den Hintergrund durchsichtig, deine Landschaft oder Szene bleibt also stehen: `/startscreen?bg=0`.
- Zum Ansehen ohne Start: `/startscreen?demo` (3 Minuten, immer sichtbar).

## Im Admin
Stream → **Startbildschirm**:
- **Vorlauf** in Minuten (zum Beispiel 10). „Starten“ beginnt den Countdown, „+5 Minuten“ verlängert, „Beenden“ blendet aus.
- **Texte:** Überschrift, Zeile darunter, Text bei 0, Fortschrittsbalken an/aus, wie oft der Spruch wechselt.
- **Schreib-Sprüche:** einer pro Zeile, am schönsten als `Überschrift | Text`. Sie wechseln in zufälliger Reihenfolge. „Beispiel-Sprüche laden“ füllt rund 30 Sprüche ein, die du ändern kannst.
- **Hintergrund:** ein Bild (PNG, JPG, GIF, WebP, am besten 1920×1080, größere werden im Browser verkleinert) oder eine **HTML-Datei mit Animation**
  (eine einzelne Datei mit allem drin, bis 8 MB). Die HTML-Datei läuft abgeschottet und hat keinen Zugriff auf den Bot. Bilder oder Skripte von anderen
  Webseiten lädt sie nach, dafür braucht der Rechner mit OBS Internet. Ohne eigenen Hintergrund gibt es einen warmen Abend mit schwebenden Lichtern.

Die Seite ist öffentlich wie das Overlay: Cloudflare Access darf nicht davor liegen (`/startscreen`, `/api/startscreen`, `/api/startscreen-bg`).
