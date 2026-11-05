# Hinweise für Claude in diesem Repo

## Wo das Tool läuft (wichtig, nicht wieder vergessen)
- Das Tool läuft **als Docker-Container auf dem CasaOS-Server der Streamerin im Heimnetz**, nicht auf Netlify. Node ≥ 22, keine Abhängigkeiten, Start mit `node server/index.mjs`, Daten im Ordner `/data` (Volume), Zugangsdaten in `/data/novelsbyeverly.env`.
- Der Stand im Repo ist die Programmfassung von dort (Grundlage war `novelsbyeverly-1.9.0.zip`). Lädt die Streamerin eine neuere ZIP hoch, ist **die** der aktuelle Stand: erst das Repo darauf abgleichen, dann weiterarbeiten.
- Aufbau: `server/` (Routen in `server/api/`, Logik in `server/features/`, Kern in `server/core/`, Twitch in `server/twitch/`), `public/` (Overlay `overlay.html`, Gaming-Szene `gaming.html`, Admin-Seiten in `public/admin/`, gemeinsamer Code in `public/js/`), `VERSION.txt`, `package.json`.
- Admin-Seiten folgen dem Muster `public/admin/<seite>.html` + `.js` mit `common.js`, `formular.js` und Eintrag in `public/admin/nav.js`.

## Update-ZIP
- **Immer nachfragen, ob eine Update-ZIP erzeugt werden soll**, wenn eine Änderung am Tool abgeschlossen ist (nach Commit und Push). Nicht ungefragt erzeugen, und nicht vergessen zu fragen. Verlangt die Streamerin die ZIP ausdrücklich, direkt erzeugen.
- Vorher die **Version erhöhen**: `package.json` (`version`) und die erste Zeile von `VERSION.txt` (`x.y.z – kurze Beschreibung`, muss mit der Version beginnen).
- Erzeugen mit `npm run zip` → `dist/novelsbyeverly-<Version>.zip`. Inhalt wie bei den bisherigen Updates: `server/`, `public/`, `package.json`, `VERSION.txt`, **ohne umschließenden Ordner**. Der Updater im Container (`server/update.mjs`) verlangt `server/index.mjs`, `server/main.mjs`, `server/update.mjs`, `public/overlay.html` und `VERSION.txt` und sonst nichts außerhalb dieser Teile. Alles, was die Streamerin bekommen soll (auch Skripte zum Herunterladen), muss deshalb in `public/` liegen.
- Hochgeladen wird die ZIP im Admin unter *System → Update*; der Container startet danach neu, Daten und Einstellungen bleiben erhalten, das alte Programm wird gesichert.
- Vor dem Erzeugen prüfen: `node test/gaming.mjs`. Beim Erzeugen die ZIP mit SendUserFile schicken.

## Sonstiges
- Sprache der Oberfläche, README und Antworten: Deutsch.
- Die klickbare Demo der Gaming-Szene (ohne OBS) wird mit `node scripts/build-gaming-demo.mjs` gebaut (`docs/gaming-demo.html`); der Artifact-Link zur Demo wird dabei neu veröffentlicht.
