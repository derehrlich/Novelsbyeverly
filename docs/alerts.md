# Alerts und Raids (Anleitung für Marcel)

Wenn jemand folgt, ein Abo abschließt, Abos verschenkt, Bits schickt oder zu Everly raidet, klappt im Overlay ein **Buch** auf,
zeigt das Ereignis und klappt wieder zu. Optional schreibt der Bot ein Danke in den Chat.

## Einschalten (einmalig)
1. Admin → Stream → **Alerts und Raids** → Karte „Alerts“ → „Alerts aktivieren“ (und bei Wunsch „Raids aktivieren“), speichern.
2. **Einmal den Kanal neu verbinden** (Admin → Einrichtung → „Mit Twitch verbinden“). Twitch gibt nur so die neuen Berechtigungen für Follower, Abos und Bits frei. Raids brauchen keine.
3. Danach meldet sich der Bot selbst bei Twitch an (das passiert nach dem Speichern automatisch; sonst „Reward & Webhooks abgleichen“).
4. Mit den Knöpfen oben auf der Seite („Follow“, „Abo“, „Raid“ …) ausprobieren. Das schreibt nichts in den Chat.

## Was angezeigt wird
- **Follow**, **Abo**, **Abo-Jubiläum** (mit Monaten und Nachricht), **Geschenk-Abos** (geschenkte Einzel-Abos werden nicht doppelt gezeigt), **Bits** (ab einer Mindestmenge), **Raid** (Name, Anzahl, zuletzt gespieltes Spiel, Profilbild, wievielter Raid von dieser Person).
- Alle Texte (im Buch und im Chat) sind im Admin änderbar, mit Platzhaltern wie `{user}`, `{bits}`, `{raider}`.
- Mehrere Alerts hintereinander kommen nacheinander (Warteschlange).

## Eigenes Video statt des gezeichneten Buchs
Siehe `docs/alert-video.md`.
