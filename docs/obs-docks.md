# Kleine Docks für OBS

Docks sind kleine Fenster **innerhalb von OBS**, die du neben der Vorschau anordnen kannst. So steuerst du Pomodoro, Aufgaben und das Design, ohne den Browser zu öffnen.

## Einrichten (einmalig pro Dock)
1. In OBS: **Docks → Benutzerdefinierte Browser-Docks …**
2. Einen Namen eintragen (z. B. „Pomodoro“) und die Adresse einfügen. Die Adressen stehen im Admin unter **Übersicht → OBS-Adressen und Test**:
   - `…/admin/dock-alles.html` – **alles in einem Dock** mit Reitern oben (Pomodoro, Aufgaben, Design); wer nur ein Dock will, nimmt eines der drei darunter
   - `…/admin/dock-pomodoro.html` – Timer starten und stoppen, Pomodoros und Wörter zählen, Dauer und Ziel einstellen (Fokus, Pause, lange Pause, Ziel)
   - `…/admin/dock-aufgaben.html` – Aufgaben anlegen, abhaken, löschen
   - `…/admin/dock-design.html` – Hintergrund, Wetter, Tageszeit, Jahreszeit, Kartenstil, Kamera-Rahmen
3. **Anwenden** klicken. Das Dock lässt sich dann an den Rand ziehen oder als eigenes Fenster lösen.
4. Beim ersten Mal erscheint ein kleines Feld für das **Admin-Passwort**. Danach bleibst du angemeldet.

## Gut zu wissen
- Die Docks nutzen die gleiche Anmeldung wie der Admin. Ohne Passwort kommt niemand dran.
- Im Design-Dock wirkt jede Auswahl sofort im Overlay. Die Felder für Video und Kamera-Rahmen erscheinen nur, wenn sie zum gewählten Hintergrund passen.
- Greift Cloudflare Access vor den Admin, gilt das auch für die Docks.
