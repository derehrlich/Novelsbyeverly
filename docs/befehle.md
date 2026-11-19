# Eigene Chat-Befehle, Zitate und Shoutout (Anleitung für Marcel)

Admin → **Chat** → **Eigene Befehle und Zitate**.

## Einschalten
Unten auf der Seite die Karte **„Eigene Befehle“** aufklappen, einschalten und speichern. Der Bot muss im Chat schreiben dürfen (Admin → Chat und Befehle). Beim Speichern meldet er sich selbst bei Twitch an.

## Eigene Befehle (bis 40)
Es gibt drei Arten:
- **Befehl:** `!ant` löst aus. Das Wort hat 2 bis 20 Buchstaben oder Ziffern. Wörter, die der Bot schon kennt (`!sprint`, `!wetter` …) oder die eine eigene Pause nutzt, werden abgelehnt.
- **Stichwort:** löst aus, sobald das Wort irgendwo in einer Nachricht steht (nur ganze Wörter, „moin“ passt nicht auf „moinsen“). Nie bei Nachrichten der Streamerin.
- **Erinnerung:** kommt alle paar Minuten von selbst („Trink etwas! 💧“), aber **nur, wenn im Chat etwas los ist** (einstellbar: mindestens so viele Nachrichten seit dem letzten Mal).

Jeder Befehl hat: **Antwort im Chat**, optional **das Buch im Overlay** (Überschrift und Text), **wer ihn nutzen darf** (alle, Abos und mehr, VIPs und mehr, Moderation, nur Streamerin) und eine **Wartezeit** gegen Spam.

**Platzhalter:** `{user}` (wer es ausgelöst hat), `{args}` (der Text nach dem Befehl), `{count}` (zählt bei jedem Mal hoch, zum Beispiel für einen Kaffee-Zähler), `{random}` (Zahl 1 bis 100), `{game}` `{title}` `{uptime}` `{viewers}` (live von Twitch).
„Ausprobieren“ zeigt dir die Antwort und das Buch, schreibt aber nichts in den Chat und zählt nicht mit. `!hilfe` nennt automatisch die eigenen Befehle, die alle benutzen dürfen.

## Zitate
Karte „Zitate“ einschalten. Im Chat: `!zitat` (zufällig), `!zitat 5`, `!addzitat Text` und `!delzitat 5` (die beiden nur für Moderation und Streamerin). Im Admin kannst du die Liste ansehen, ergänzen und löschen. Gelöschte Nummern werden nicht neu vergeben. Das Aussehen der Antwort stellst du in der Karte ein (`{n}` `{text}` `{by}` `{date}`).

## Shoutout
Karte „Shoutout“ einschalten. `!so name` (nur Moderation und Streamerin) schreibt eine Nachricht mit Link und dem zuletzt gespielten Spiel. Das ist **kein** offizieller Twitch-Shoutout (der bräuchte eine zusätzliche Berechtigung). Vorlage: `{name}` `{game}` `{url}`.

Befehle, Zitate und Zähler sind in der Sicherung enthalten.
