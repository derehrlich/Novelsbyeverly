# Novels by Everly (Co-Working-Bot) – Projektwissen für Claude Code

## Wer und was
- **Auftraggeber:** Marcel Ehrlich (kein Programmierer), baut den Bot für die Streamerin **Everly** (Twitch „Novels by Everly“). Alles auf **Deutsch**, einfache Worte, Fachbegriffe erklären. Kleine Dinge einfach entscheiden und sagen, was entschieden wurde.
- **Projekt:** Twitch-Bot mit OBS-Overlay (wachsende Landschaft, Pomodoro, Wörter, To-Do, Musik, Zimmer-Modus). Läuft auf dem NAS mit CasaOS (Docker, Daten in `/data`, Port 3001 außen) und weiter auch auf Netlify. Neue Funktionen sind standardmäßig **aus** und werden im Admin eingeschaltet.
- **Vorlage:** Das Schwesterprojekt `derehrlich/twitch-checkin` („Stadtwache“, Marcels Kanal). Funktionen werden von dort übernommen, **ohne Discord** (kein VerwirrBot, keine Verknüpfung, keine Hall of Fame) und im Look von Everly (Fredoka, warme Papier- und Holztöne, Landschaft). Stadtwache-Code nicht blind kopieren: Everlys Ordnerstruktur ist flach (`netlify/lib/*.mjs`), der Admin ist eine Seite aus Karten (`public/admin/admin.js` mit `SCHEMA`).

## Fahrplan der Übernahme (Etappen)
1. **Fertig:** Betrieb zu Hause (`server.mjs`, Docker, Watchtower-Update-Knopf, nächtliche Sicherung), Check-in mit Besuchszähler, Streak, Meilensteinen, Punkte (Chat, aktive Tage, Check-ins) und öffentliche Rangliste `/rangliste`.
2. **Als Nächstes:** Alerts (Follow, Sub, Gift, Bits) und Raids als Banner im Overlay, Pause-Overlay (`!pause`), Startbildschirm-Overlay, Streak-Retter, Dorf-Level (hier als Schreib-Ränge denkbar).
3. **Danach (je nach Wunsch von Everly):** Soundboard, Einlaufsound, Top des Monats, Umfragen, Countdown und Glücksrad, Gewinnspiele, Tickets, Chat-Moderation, eigene Chat-Commands, Zitate, Shoutout, Abspann, Statistik und Mediakit, „Meine Seite“, Störungs-Meldung (ohne Discord: per E-Mail oder gar nicht).
- Alles in Everlys Optik anpassen. Die bisherigen Funktionen müssen bestehen bleiben.

## Technik
- Speicher: `netlify/lib/store.mjs` (`db.get/set/list/setIfNew/delete`). Mit `LOCAL_STORE_DIR` Dateien (Heimserver, Tests), sonst Netlify Blobs. Schlüssel stehen am Kopf von `store.mjs` und der jeweiligen Datei.
- **Neue Datenbereiche immer in die Sicherung eintragen:** `DATA_PREFIXES` in `netlify/lib/admin/backup.mjs`. Bewusst draußen: Tokens, Kurzlebiges (`seen/`, `event/`, `cooldown/`, `done/`, `seat/`).
- Einstellungen: `netlify/lib/settings.mjs` (`DEFAULTS`, dazu `INT`/`BOOL`/`ENUM` für die Prüfung) und ein Eintrag in `SCHEMA` in `public/admin/admin.js`. Neue Platzhalter immer auch im Hinweis des Feldes nennen.
- Chat: Befehle stehen in `COMMANDS` in `netlify/lib/chat.mjs` (Name → Aktion), Ausführung in `run`. Overlay-Ereignisse: `pushEvent` (`util.mjs`), Anzeige in `handleEvent` in `public/overlay.html`.
- Check-in: `netlify/lib/checkin.mjs` (Sperre `checked/<Tag>/<id>`), Streak `streak.mjs` (wird aus `user.days` berechnet, nie gespeichert), Punkte `punkte.mjs` (`cmonth/<Monat>/<id>`), Rangliste `netlify/functions/rangliste.mjs` + `public/rangliste.html`.
- Der Chat-Webhook wird gebraucht, wenn Befehle oder Punkte an sind (`needsChat`), der Check-in-Reward bei `checkinEnabled` oder „Erscheinen bei Check-in“ (`needsReward`). Nach Änderungen: im Admin „Reward & Webhooks abgleichen“.
- Neue Functions: `export const config = { path: ... }` genügt, `server.mjs` findet sie. Neue Weiterleitungen in `netlify.toml` (nur `from`/`to`/`status`) werden ebenfalls übernommen.

## Ausliefern
- Zweig → Pull Request → Merge → GitHub Action baut `ghcr.io/derehrlich/novelsbyeverly` → im Admin (*System → Auf Updates prüfen*) lädt Watchtower es. **Nie ohne Marcels Auftrag mergen.** Der Standard-Zweig des Repos heißt derzeit `ccr-846161ae-4jiyrb`; die Actions laufen für ihn und für `main`.
- Anleitung für Marcel: `docs/casaos.md`.

## Tests
- `npm ci && npm test` (Ende-zu-Ende mit simulierter Twitch-API in `test/run.mjs`, Heimserver in `test/server.mjs`). Vor jedem Pull Request ausführen; neue Funktionen bekommen einen Test.
