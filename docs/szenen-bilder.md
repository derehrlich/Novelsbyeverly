# Szenen mit bewegtem Ausblick: Raumbilder mit Gemini erstellen

Der Bot hat vier Szenen: **Zugabteil**, **Sitzecke am Fenster**, **Stadt** und **See mit Weitblick**. Jede Szene ist ein **Raumbild mit einem Fenster**. Den Ausblick (vorbeiziehende Landschaft, Himmel, Wetter, Licht) malt der Bot selbst und bewegt ihn. Das Raumbild machst du mit Gemini.

## So funktioniert es

1. Du lässt Gemini ein Raumbild erzeugen, bei dem die **Fensterscheibe eine flache Fläche in Magenta (#FF00FF)** ist.
2. Du lädst das Bild im Admin hoch: **Overlay → Design und Hintergrund → Raumbilder für die Szenen**.
3. Der Bot erkennt die Magenta-Fläche selbst, schneidet sie aus und zeigt dahinter den bewegten Ausblick. Tageszeit (Morgen, Mittag, Abend, Nacht) und Wetter (klar, wolkig, Regen, Gewitter, Schnee, Nebel) färben auch das Raumbild ein.

Ohne eigenes Raumbild siehst du einen einfachen Platzhalter-Raum, damit alles schon läuft.

## Regeln für gute Bilder

- **Querformat 16:9** (1920×1080). Deine Beispielbilder waren hochkant, das muss in der Anfrage ausdrücklich stehen.
- **Fenster als reine Magenta-Fläche**, ohne Spiegelung, ohne Regentropfen, ohne Aussicht, ohne Vorhang über dem Glas. Scharfe Kante zum Fensterrahmen.
- **Beleuchtung neutral bis warm am Abend**, nicht schon sehr dunkel. Der Bot dunkelt für die Nacht selbst ab. Lampen im Bild dürfen leuchten.
- **Keine Personen, kein Text, kein Wasserzeichen.**
- **Ränder ruhig lassen:** Oben links und oben rechts liegen im Stream die Karten (Uhr, Wörter, To-Do). Dort sollte nichts Wichtiges sein.
- Nutze **nicht** die Beispielbilder anderer Künstler. Sie tragen Wasserzeichen und gehören nicht dir. Lass Gemini eigene Bilder erzeugen.

## Gemeinsamer Baustein (an jede Anfrage anhängen)

```
Style: cozy lo-fi anime illustration, hand-painted look, warm glowing lamp light, soft film grain, rich detail.
Format: 16:9 widescreen landscape, 1920x1080. No people, no text, no watermark, no logo.
IMPORTANT: The window glass area must be one single flat solid pure magenta color (#FF00FF). No reflections, no raindrops, no view outside, no gradient, no curtains across the glass, crisp clean edge against the window frame. Everything else (room, frame, furniture, lamps) is fully illustrated.
Lighting: warm, neutral evening lighting (not very dark), so the image can be tinted for day and night later.
Composition: keep the top-left and top-right corners calm and uncluttered (space for overlay widgets).
```

## a) Zugabteil

```
Interior of a vintage train compartment, dark polished wood paneling with brass details, one large rounded-rectangle window in the center of the wall (about half the image width), two facing benches with orange floral upholstery on the left and right edges, a small round table in front of the window with an open book and a steaming cup of tea, warm glowing globe lamps on the walls and a ceiling lamp, old pipes and rails on the ceiling.
```

## b) Sitzecke am Fenster (Wald)

```
Cozy reading nook in a log cabin: a wooden window seat with a thick knitted blanket, fluffy cushions, an open book and a steaming cup on a small tray, under a large wooden window with a cross-bar (four panes), a lantern hanging next to the window, a warm table lamp, a small bookshelf with plants on the left, wooden plank walls.
```

## c) Stadt

```
Modern cozy apartment room with a huge floor-to-ceiling window in the center, a wooden desk in front of the window with a laptop, a warm desk lamp, a cup of tea and an open book, a tall bookshelf full of books on the left edge, string lights on the right wall, green plants, a sleeping cat on a rug, a comfortable armchair with a knitted blanket.
```

## d) See mit Weitblick

```
Wooden cabin interior with a very wide panoramic window (about three quarters of the image width) with thin wooden mullions, a wide wooden desk in front of the window with an open book, a black mug, a warm table lamp on the right, pine wood walls, a cozy rug, the room is simple and calm so that the view outside will be the star.
```

## Tipps für Gemini

- Wird das Fenster nicht sauber magenta, schreibe danach: *„Edit this image: fill the entire window glass area with one flat solid #FF00FF magenta color. Remove everything that is visible through the window. Keep everything else unchanged.“*
- Schreibe in der ersten Anfrage ausdrücklich *„Create a 16:9 landscape image“*. Wenn das Bild trotzdem hochkant kommt, bitte um ein Querformat.
- Lass mehrere Varianten erzeugen und nimm die mit dem saubersten Fensterrand.

## Hochladen und einstellen

1. Admin → **Overlay → Design und Hintergrund** → **Raumbilder für die Szenen** → bei der Szene **Raumbild wählen …**. Die Szene wird gleich ausgewählt.
2. Oben auf der Seite stellst du **Szene**, **Tageszeit** und **Wetter** ein. Die Vorschau rechts zeigt es sofort.
3. Unter *Szenen (Ausblick und Wetter)* regelst du **Wind** und das **Tempo des Zuges**.
4. Im Chat können Moderatoren umstellen: `!wetter regen`, `!tageszeit nacht`, `!hintergrund stadt` (Möglichkeiten: landschaft, zug, sitzecke, stadt, see, bild).
