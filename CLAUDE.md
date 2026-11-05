# Hinweise für Claude in diesem Repo

## Update-ZIP
- **Immer nachfragen, ob eine Update-ZIP erzeugt werden soll**, wenn eine Änderung am Tool abgeschlossen ist (nach dem Commit und Push). Nicht ungefragt erzeugen, und nicht vergessen zu fragen.
- Wenn die Streamerin die ZIP ausdrücklich verlangt, direkt erzeugen, ohne nochmal nachzufragen.
- So wird sie erzeugt (nur der committete Stand, ohne `.git`, `node_modules`, `.env`, `data/`; ohne Ordner-Präfix, damit man sie über den alten Ordner entpacken kann):
  ```
  mkdir -p dist && git archive --format=zip -o dist/novelsbyeverly-update-$(date +%F)-$(git rev-parse --short HEAD).zip HEAD
  ```
  Vorher `npm test` laufen lassen. Die Datei liegt in `dist/` (steht in `.gitignore`) und wird der Nutzerin mit SendUserFile geschickt.

## Sonstiges
- Sprache der Oberfläche, README und Antworten: Deutsch.
- Nach Änderungen am Overlay die Demo neu bauen: `node scripts/build-gaming-demo.mjs` (Gaming-Szene) bzw. `node scripts/build-vorschau.mjs`.
