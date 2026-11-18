# Videos als Ausblick: Anfragen für Gemini (Veo)

Statt der gezeichneten Landschaft kann der Ausblick durchs Fenster ein **Video** sein. Das Video zeigt nur, was man draußen sieht. Dein Raumbild (mit dem Magenta-Fenster) bleibt davor. Regen, Schnee, Nebel und Blitz legt der Bot selbst darüber, dafür brauchst du keine eigenen Wetter-Videos.

Pro **Szene und Tageszeit** ein Video: 4 Szenen × 4 Tageszeiten = 16 Videos. Du musst nicht alle machen. Wo kein Video ist, nimmt der Bot die gezeichnete Landschaft. Fang am besten mit **Abend** und **Nacht** an.

Hochladen: Admin → **Overlay → Design und Hintergrund → Videos als Ausblick**. Gibt es nur auf dem Heimserver (CasaOS). Die Videos liegen im Datenordner, nicht in der JSON-Sicherung.

## Regeln

- **MP4 oder WebM**, höchstens **80 MB**, am besten 8 Sekunden, 16:9, 1080p oder 720p, ohne Ton.
- **Schleife:** Das Ende wird 1,2 Sekunden sanft in den Anfang überblendet. Ein perfekt nahtloses Video ist nicht nötig.
- **Nur der Ausblick:** kein Fensterrahmen, kein Glas, kein Raum, keine Vorhänge, keine Tropfen am Glas.
- **Unteres Drittel ruhig:** Dort verdecken oft Schreibtisch, Tisch oder Sitzbank das Bild. Wichtiges gehört in die obere Hälfte.
- **Immer „klares Wetter“:** Regen, Schnee, Nebel und Blitz macht der Bot.

## Baustein für jede Anfrage

Diesen Block an die Szenen- und Tageszeit-Beschreibung hängen:

```
Style: hand-drawn 2D anime lo-fi illustration, painterly Studio-Ghibli-like background art, soft film grain, warm cozy colors.
Format: 16:9 landscape, 1080p, 8 seconds, seamless loop if possible, completely static locked-off camera (no zoom, no pan), no cuts, no people, no text, no logo, no watermark, no audio.
IMPORTANT: Show ONLY the outdoor view as seen through a window. No window frame, no glass, no curtains, no room interior, no reflections, no raindrops on glass.
Weather: clear, dry, no rain, no snow, no fog.
Composition: keep the lower third of the picture calm and simple (a desk will cover it).
```

Tipp: Hänge dein Raumbild als **Stilvorlage** an und schreibe: *„Match the art style of the attached image. Do not include the room, only the view outside.“* Dann passen Ausblick und Raum zusammen.

## Szenen

**a) Zugabteil**
```
View from the window of a moving train: a calm countryside with rolling hills, pine forests and small villages with softly lit windows. Wooden utility poles with sagging wires pass by steadily from right to left at a relaxed speed, with gentle parallax (far hills move slowly, near trees and fence posts move faster).
```

**b) Sitzecke am Fenster (Wald)**
```
A dense pine forest right outside a cabin window. Tall trees sway very gently in a light breeze, soft light shafts drift slowly between the trunks, tiny pollen or dust particles float in the air, a few leaves fall slowly.
```

**c) Stadt**
```
A wide view over a large modern city skyline seen from a high apartment: many skyscrapers with glowing windows, a few windows flicker on and off now and then, red aircraft warning lights on rooftops blink slowly, clouds drift slowly across the sky, one small airplane with blinking lights crosses the sky very slowly. No close-up cars, at most tiny distant lights.
```

**d) See mit Weitblick**
```
A wide view over a calm mountain lake with a forested shore and snow-capped mountains in the distance. Gentle ripples move over the water, the mountains and trees are softly reflected, clouds drift slowly, a few birds fly by in the distance, a thin mist drifts slowly over the water.
```

## Tageszeiten

Je Szene eine dieser Zeilen **zusätzlich** in die Anfrage schreiben:

- **morgen:** `Time of day: early sunrise, soft pink and orange sky, long gentle light, light morning haze.`
- **mittag:** `Time of day: bright midday, deep blue sky with a few white clouds, high sun, crisp clear colors.`
- **abend:** `Time of day: golden hour sunset, glowing orange and purple sky, warm light, long soft shadows.`
- **nacht:** `Time of day: deep night, moonlit sky with stars, deep blue tones, lights glowing warmly (fireflies in the forest scene).`

## Wenn etwas nicht klappt

- **Video bleibt schwarz oder zeigt nichts:** Erst im Admin in der Vorschau ansehen. Spielt es dort nicht, im Browser testen. Manche OBS-Versionen spielen H.264-MP4 nicht ab. Dann das Video als **WebM** speichern (zum Beispiel mit HandBrake oder ffmpeg) und neu hochladen.
- **Zu groß:** Kürzer machen oder in 720p erstellen.
- **Ruckelt beim Überblenden:** Das Video hat starke Bewegung am Anfang und Ende. Bitte um „calm, steady motion“ oder schneide Anfang und Ende etwas ab.
