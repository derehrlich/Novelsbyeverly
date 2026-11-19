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

## Das erste echte Video (Gemini, 10 Sekunden)
Die Standardwerte der Karte „Alert-Video“ sind auf das Video abgestimmt, das Marcel mit Gemini erzeugt hat (1280×720, 10 Sekunden, rosa Hintergrund, Buch öffnet sich bei etwa 2 s, ist von 2,5 bis 6,5 s offen, schließt sich bis 7,5 s, danach ruht das geschlossene Buch noch 2,5 s):
- Der Hintergrund muss nicht reines Magenta sein, ein kräftiges Rosa wird auch ausgeschnitten.
- **Breite 90 %**, Mitte bei **46 %** der Bildhöhe. Das Buch ist im Video klein, deshalb wird es groß eingeblendet.
- **Rechte Seite** (Text): von links 53 %, von oben 26 %, Breite 18 %, Höhe 46 %. **Linke Seite** (Symbol, Art, Zahl, bei Raids das Profilbild) liegt spiegelbildlich dazu, ausschaltbar mit „Auch die linke Seite beschriften“.
- Text erscheint bei **28 %** (Buch ist offen), verschwindet bei **63 %** (Buch beginnt zuzuklappen).
- **Alert endet bei 78 %**: Danach blendet der Bot das Video aus, statt die ruhige Strecke mit geschlossenem Buch zu zeigen. Bei Videos ohne Leerlauf am Ende „Alert endet bei“ auf 100 stellen.
- Der Ton des Videos wird nicht abgespielt.
- Ein Video mit anderem Aufbau braucht andere Werte: Zeitraum (Von/Bis) nach der Zeit, in der das Buch offen ist, Textfeld nach der Lage der Seiten.
- Läuft das MP4 in OBS nicht, hilft ein Umwandeln in WebM (zum Beispiel mit einem Online-Konverter oder `ffmpeg -i video.mp4 -c:v libvpx-vp9 -b:v 1.5M -an video.webm`).

Tipp für einen besseren Prompt bei Gemini: das Buch gleich zu Beginn näher zeigen (es füllt nur etwa die Hälfte des Bildes) und das Video kürzer halten (8 Sekunden), ohne ruhige Strecke am Ende.
