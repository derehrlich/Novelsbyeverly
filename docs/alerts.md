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

## Eigene Töne für die Alerts
Admin → Stream → **Alerts und Raids** → Karte **„Eigene Töne“**: Für jede Alert-Art (Follow, Abo, Abo-Jubiläum, Geschenk-Abos, Bits, Raid, Streak-Rettung) kannst du einen eigenen Ton hochladen.
- Dateien: **MP3, WAV oder OGG**, höchstens 1,5 MB, am besten 1 bis 5 Sekunden.
- Der Ton spielt, wenn das Buch aufklappt, und **ersetzt den Standard-Klang**. Ohne eigenen Ton gibt es den kleinen Klang wie bisher.
- „▶ Anhören“ spielt ihn im Admin ab, „Alert ausprobieren“ zeigt den Alert im Overlay (und spielt dort den Ton).
- Die **Lautstärke** stellst du in der Karte „Alerts“ ein (0 bis 100, Standard 80).
- In OBS muss bei der Browserquelle **„Audio über OBS steuern“** angehaltet sein, sonst hörst du im Stream nichts. Mit `?ton=aus` an der Adresse bleibt das Overlay stumm.
- Die Töne sind in der Sicherung enthalten.

**Wenn der Ton im Stream nicht zu hören ist:**
1. In OBS die Browserquelle des Overlays aktualisieren (Rechtsklick auf die Quelle → Eigenschaften → „Cache der aktuellen Seite aktualisieren“). Nach einem Update lädt sich das Overlay jetzt zwar selbst neu, ein altes Overlay kennt aber die eigenen Töne nicht.
2. Bei der Browserquelle „Audio über OBS steuern“ anhaken und im Audio-Mixer prüfen, dass die Quelle nicht stummgeschaltet ist.
3. Wer den Ton in OBS mithören will: Erweiterte Audioeigenschaften → Audio-Monitoring für diese Quelle auf „Monitor und Ausgabe“.
