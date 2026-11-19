# Alert als eigenes Video (Anleitung und Prompt für Gemini)

Statt des gezeichneten Buchs kann ein selbst erzeugtes Video laufen: ein Buch, das aufklappt, kurz offen bleibt und wieder zuklappt.
Der Bot schreibt das Ereignis (Name, Text) **auf die aufgeklappte Seite**.

## Wie das Video sein muss
- MP4 oder WebM, höchstens 80 MB, quer (16:9). Nur auf dem Heimserver.
- Hintergrund **einfarbiges Magenta (#FF00FF)**, ohne Verlauf, Boden oder Schatten. Der Bot schneidet es aus, übrig bleibt nur das Buch.
- Feste Kamera, das Buch mittig. Ablauf in etwa: ruhiges Hereinkommen, Aufklappen, **offen und ruhig mit leeren Seiten**, Zuklappen.
- **Keine Schrift** im Video: Der Text kommt vom Bot.
- Der Ton wird nicht abgespielt (der Bot macht seinen eigenen Klang).
- Die Länge des Videos bestimmt, wie lange der Alert dauert. 8 bis 10 Sekunden sind gut.

## Prompt für Gemini (Veo)
> Eine 8 Sekunden lange, ruhige Videoaufnahme im Format 16:9 (1920×1080). Die Kamera ist völlig fest, kein Zoom, keine Bewegung, keine Unschärfe.
> Der Hintergrund ist eine einzige, vollkommen flache, einfarbige Fläche in leuchtendem Magenta (#FF00FF), ohne Verlauf, ohne Boden, ohne Tisch, ohne Schatten, ohne Lichtflecken, ohne Funken.
> Mittig im Bild liegt ein dickes, in braunes Leder gebundenes Buch mit goldenem Rahmen auf dem Einband und einem kleinen goldenen Ornament in der Mitte. Gemütlicher, weicher Illustrationsstil (wie ein liebevoll gezeichnetes Bilderbuch, flache Farben, saubere Umrisse), warme Papier- und Holztöne.
> Ablauf: Sekunde 0 bis 1: Das Buch liegt zugeklappt in der Bildmitte und kommt sanft zur Ruhe. Sekunde 1 bis 3: Der Einband klappt langsam und gleichmäßig nach links auf und gibt zwei leere, cremefarbene Seiten mit feinen waagerechten Linien frei. Sekunde 3 bis 6: Das aufgeklappte Buch bleibt vollkommen still, beide Seiten **völlig leer**, ohne Text, ohne Zeichnungen, ohne Ornamente auf den Seiten, ohne Schrift. Sekunde 6 bis 8: Der Einband klappt langsam und gleichmäßig wieder zu, das Buch endet zugeklappt in der Mitte.
> Wichtig: keine Hände, keine Personen, keine Tiere, kein Text, keine Logos, kein zusätzliches Magenta am Buch, keine Partikel oder Lichtstrahlen außerhalb des Buchs, keine Kamerabewegung, keine Musik.

Tipps:
- Sieht das Ergebnis nicht gut aus: Prompt leicht ändern und neu erzeugen. Wichtig sind der **reine Magenta-Hintergrund** und **leere Seiten**.
- Hat das Buch einen rosa-magentafarbenen Rand, ist die Hintergrundfarbe nicht rein genug: noch einmal erzeugen.
- Gibt es Probleme beim Abspielen in OBS, das Video als WebM umwandeln.

## Hochladen und einstellen
1. Admin → Stream → **Alerts und Raids** → Karte „Eigenes Video“ → Video wählen.
2. Mit den Knöpfen oben („Raid“, „Follow“ …) ausprobieren.
3. Unter „Alert-Video“ (zugeklappte Karte) feinstellen:
   - **Breite** und **Höhe der Mitte** auf dem Bildschirm (in Prozent).
   - **Textfeld**: Das Rechteck auf der rechten Seite, in dem der Text steht (von links, von oben, Breite, Höhe, in Prozent des Videos).
   - **Text erscheint ab / verschwindet bei**: Zeitraum in Prozent der Videolänge. Beim 8-Sekunden-Prompt passen 40 % bis 72 % (Buch ist von etwa 3 bis 6 Sekunden offen).
   - **Schriftgröße**.
4. Nicht mehr gewünscht? „Entfernen“ (oder den Haken bei „Das hochgeladene Video … zeigen“ wegnehmen): dann kommt wieder das gezeichnete Buch.
