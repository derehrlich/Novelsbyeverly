# Stream-Pause (Anleitung für Marcel)

Eine kleine Tafel mit dampfender Tasse für Zuschauer, die gerade hereinschauen: „Kurz Trinkpause – Weiter in etwa 4:32“.
Nicht zu verwechseln mit der **Pomodoro-Pause** (`!pause`), die den Timer steuert.

## Einschalten
1. Admin → Stream → **Stream-Pause** → Karte „Stream-Pause“ → einschalten, speichern.
2. In OBS eine Browserquelle mit der Adresse `…/pause` anlegen (1920×1080, Hintergrund bleibt durchsichtig). Sie ist leer, solange keine Pause läuft, und fährt bei einer Pause herein.
   - Platz: `?pos=top`, `?pos=bottom`, `?pos=bottom-right` … (Standard: Mitte)
   - Größe: `?size=0.8`
   - Ansehen ohne Pause: `?demo`

## Benutzen
- Im Chat (nur Moderation und Streamerin): `!auszeit 5 Trinkpause` startet eine Pause von etwa 5 Minuten mit dem Text „Trinkpause“. Die Zahl ist optional: `!auszeit Essen holen` läuft ohne Countdown, bis `!zurueck` kommt (auch `!weiter`).
- Oder im Admin mit den Knöpfen.
- Texte (Standardtext, Zeile darunter, Chatnachrichten) lassen sich im Admin ändern. Der Bot kann die Pause im Chat ankündigen.

## Eigene Pausen mit Befehl und Icon
Im Admin unter Stream → Stream-Pause → Karte „Eigene Pausen“ legst du bis zu **8 Pausen** an. Jede hat:
- ein **Befehlswort** (zum Beispiel `kaffee` → im Chat `!kaffee`; ein Wort, das der Bot schon kennt, nimmt er nicht an),
- einen **Text** (steht groß auf der Tafel),
- **Minuten** (0 = läuft, bis `!zurueck` kommt),
- ein **Icon**: entweder ein **Emoji** oder ein eigenes **Bild** (am besten quadratisch, PNG mit durchsichtigem Hintergrund; der Browser verkleinert es selbst). Das Bild geht vor dem Emoji, ohne beides zeigt die Tafel die Tasse.

Im Chat (nur Moderation und Streamerin): `!kaffee` startet die Pause, `!kaffee 10` überschreibt die Minuten, `!zurueck` beendet sie.
Mit „Starten“ in der Zeile startest du sie auch von Hand. Die Pausen und Bilder sind in der Sicherung enthalten.
