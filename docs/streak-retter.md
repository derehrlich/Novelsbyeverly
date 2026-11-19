# Streak-Retter (Anleitung für Marcel)

Die **Streak** ist die Besuchsserie einer Person: Stream-Tage in Folge, an denen sie eingecheckt war. Ein verpasster Stream wird bis zur
**Schonfrist** verziehen (Admin → Check-in, Streak und Punkte → „Schonfrist“). Wer mehr verpasst hat, verliert die Serie. Der Streak-Retter
ist ein zweiter **Kanalpunkte-Reward**, mit dem man eine solche Lücke nachträglich überbrücken kann.

## Einschalten
1. Der **Check-in** muss eingeschaltet sein (Admin → Check-in, Streak und Punkte).
2. Dort die Karte **„Streak-Retter“** aufklappen, „Streak-Retter aktivieren“ einschalten und speichern. Reward-Name (zum Beispiel „Streak-Retter“) und Preis (zum Beispiel 500 Kanalpunkte) kannst du ändern. Der Name muss sich von dem des Check-in-Rewards unterscheiden.
3. Der Reward wird beim Speichern automatisch bei Twitch angelegt.

## Wie es funktioniert
- Wer den Reward einlöst, dessen **jüngste Lücke** verpasster Stream-Tage wird überbrückt. Die überbrückten Tage zählen nicht als Besuche, sie reißen die Serie aber auch nicht mehr.
- Gerettet werden Lücken bis **höchstens so viele Streams**, wie du einstellst (Standard 3), und nur aus den **letzten 7 Stream-Tagen**.
- Ist die Streak nicht in Gefahr oder die Lücke zu lang oder zu alt, schreibt der Bot eine Nachricht und die **Kanalpunkte gehen zurück**.
- Dieselbe Lücke kann nur einmal gerettet werden.
- Bei einer Rettung klappt im Overlay das Buch auf („Streak gerettet!“ mit Rettungsring und der neuen Streak), dazu schreibt der Bot ins Chat.
- Mit dem Knopf „Streak-Rettung“ unter Stream → Alerts und Raids siehst du das Buch zum Ausprobieren.

Alle Texte (Chat, Buch) lassen sich im Admin ändern, Platzhalter: `{user}`, `{days}`, `{streak}`.
