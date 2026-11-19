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
