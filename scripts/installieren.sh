#!/bin/sh
# Erste Installation (oder Umzug von der alten Docker-Build-Variante) auf CasaOS.
# Aufruf im Projektordner:  sudo sh scripts/installieren.sh
# Legt /DATA/AppData/novelsbyeverly/{app,data} an, kopiert das Programm nach app und übernimmt vorhandene Daten aus ./data.
set -e
BASE="${BASE:-/DATA/AppData/novelsbyeverly}"
HIER="$(cd "$(dirname "$0")/.." && pwd)"

mkdir -p "$BASE/app" "$BASE/data"
for teil in server public package.json VERSION.txt; do
  rm -rf "$BASE/app/$teil"
  cp -r "$HIER/$teil" "$BASE/app/$teil"
done
echo "Programm kopiert nach $BASE/app ($(cat "$BASE/app/VERSION.txt"))"

if [ -d "$HIER/data/cowork" ] && [ ! -d "$BASE/data/cowork" ]; then
  cp -r "$HIER/data/cowork" "$BASE/data/cowork"
  echo "Bisherige Daten übernommen (Einstellungen, Twitch-Verbindung, Zählerstände)"
fi

if [ ! -f "$BASE/data/novelsbyeverly.env" ]; then
  cp "$HIER/.env.example" "$BASE/data/novelsbyeverly.env"
  echo "Zugangsdaten-Datei angelegt: $BASE/data/novelsbyeverly.env (jetzt ADMIN_PASSWORD und TWITCH_CLIENT_ID eintragen)"
fi
echo "Als Nächstes: Zugangsdaten eintragen, dann im Projektordner:  docker compose up -d"
