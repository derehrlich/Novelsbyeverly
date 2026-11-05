; Hotkeys für den Deathcounter (Windows, AutoHotkey v2: https://www.autohotkey.com).
; Trage die Adresse deines CasaOS-Servers und den INGEST_TOKEN (aus novelsbyeverly.env) ein, speichere die Datei und starte sie per Doppelklick.
;   F9  = +1 Tod        F10 = -1 Tod        (Tasten unten nach Wunsch ändern)
#Requires AutoHotkey v2.0
SITE := "http://DEINE-CASAOS-IP:8888"   ; Adresse, unter der du das Tool im Heimnetz öffnest
TOKEN := "dein-schluessel"

Senden(aktion) {
    Run('curl.exe -s "' SITE '/api/tod?aktion=' aktion '&token=' TOKEN '"', , "Hide")
}
F9::Senden("plus")
F10::Senden("minus")
