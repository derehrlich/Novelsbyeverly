# Novels by Everly – Co-Working-Overlay und Twitch-Bot (CasaOS)

Overlay für Schreib- und Co-Working-Streams mit Admin-Oberfläche. Läuft als Container auf dem CasaOS-Server im Heimnetz: `node server/index.mjs`, Daten in `/data`, Updates als ZIP im Admin unter *System → Update* (Bau der ZIP: `npm run zip`).

Adressen: Admin `/admin/` · Overlay `/overlay` · Alerts `/alerts` · **Gaming-Szene `/gaming`**.

## Gaming-Szene (`/gaming`)
Eigene Browser-Quelle (1920×1080) für Gaming-Streams. Alles stellst du im Admin unter *Gaming* ein.
- **Spielfenster 16:9** (1712×963) mit dünnem Rahmen und schmalem Rand. In OBS liegt die Spielaufnahme ganz unten, **darüber die Kamera**, ganz oben die Browser-Quelle. Spiel und Kamera scheinen durch die ausgeschnittenen Fenster.
- **Kamerafenster** (quadratisch, 160–700 px) in jeder der vier Ecken einzeln an- oder abschaltbar. Sie sitzen mit Abstand zum Bildrand und überlappen den Spielrahmen.
- **Design:** *Gemütlich* (Landschaft aus dem Overlay, Holzrahmen mit Blättern) oder *Glas* (schlicht, durchscheinend, an Apples Liquid Glass angelehnt, Farbverlauf nach Tageszeit).
- **Rand als unscharfes Spielbild:** Hintergrund „Unscharfes Spielbild“ lässt den Rand durchsichtig (abdunkelbar). In OBS die Spielaufnahme kopieren („Als Referenz einfügen“), auf Vollbild ziehen, Unschärfe-Filter hinzufügen und **unter** das scharfe Spiel legen.
- **Deathcounter** (optional, im Stil der Karten aus *Overlay → Design*, im Glas-Design als Glaskapsel): Totenkopf, Beschriftung, Zahl; wählbare Position, rückt neben eine Kamera in derselben Ecke; blendet nach einstellbarer Zeit aus (0 = bleibt) und bei jedem Zählen wieder ein.
  - Chat: `!tod` (+1), `!tod -`, `!tod 12`, `!tod reset` (nur Streamerin) für Moderation und Streamerin; `!tode` zeigt allen den Stand.
  - Admin: Knöpfe −1, +1, Einblenden, Setzen, Auf 0.
  - Hotkey: `GET/POST /api/tod` mit `INGEST_TOKEN` (`aktion`: `plus`, `minus`, `reset`, `zeigen`, `set` mit `wert`), z. B. `http://CASAOS-IP:8888/api/tod?aktion=plus&token=…`. Für Stream Deck („Website öffnen“) oder das AutoHotkey-Skript `/tode-hotkey.ahk` (im Admin zum Herunterladen, F9 = +1, F10 = −1).
- Zum Ausprobieren in der Adresse: `?kamera=oben-links,unten-rechts` (oder `aus`), `&groesse=340`, `?design=glas`, `?hintergrund=obs&abdunkeln=25`, `?platzhalter=1` (zeigt die Fenster), `?demo=1` (Beispieldaten).
- Eine klickbare Demo ohne OBS ist `docs/gaming-demo.html`.

## Entwicklung
```
node test/gaming.mjs          # Prüfung der Gaming-Szene gegen den echten Server (leerer Datenordner)
node scripts/build-gaming-demo.mjs   # klickbare Demo bauen
npm run zip                   # Update-ZIP nach dist/
```
