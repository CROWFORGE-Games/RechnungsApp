# RechnungsApp

Eine schlanke Rechnungs-App fuer:
- Kunden anlegen
- Artikel und Leistungen verwalten
- Rechnungen mit fortlaufender Nummer erzeugen
- Daten auf eine PNG-Vorlage schreiben
- Rechnung per E-Mail an den Kunden senden und die eigene Adresse in CC setzen

## Start

```bash
npm install
npm start
```

Danach im Browser `http://localhost:3000` aufrufen.

## Einfach starten per Doppelklick

Auf Windows kannst du auch einfach diese Datei starten:

- `Start-KaindlBilling.bat`

Die Datei installiert bei Bedarf automatisch die Abhaengigkeiten, startet den Server und oeffnet den Browser.

## Nutzung am Smartphone

- PC und Smartphone muessen im selben WLAN sein.
- Starte die App über `Start-KaindlBilling.bat`.
- Im Konsolenfenster werden neben `http://localhost:3000` auch die WLAN-Adressen wie `http://192.168.x.x:3000` angezeigt.
- Diese Adresse dann am Smartphone im Browser aufrufen.

## Wo kommt die Vorlage hin?

Lege deine echte Rechnungs-Vorlage als PNG in einen dieser Pfade:

- `public/assets/invoice-template.png`
- `public/assets/image.png`

Solange dort noch keine Datei liegt, zeigt die App ein eingebautes Fallback-Layout an.

Für Logos werden jetzt diese Dateien bevorzugt:
- `public/assets/KaindlLogo.png` für App-Symbol und Favicon
- `public/assets/KaindlBanner.png` für die Rechnungs-Vorschau oben links

## Mailversand

In der Oberflaeche unter **Einstellungen** eintragen:

- SMTP Host
- SMTP Port
- SMTP User
- SMTP Passwort
- Versand von
- CC an eigene E-Mail

Wenn SMTP noch nicht vollständig gesetzt ist, wird die Rechnung trotzdem erstellt und als PDF gespeichert, aber nicht verschickt.

## Speicherung

- Kunden, Artikel, Einstellungen und Rechnungen: `data/store.json`
- Erzeugte PDFs und PNGs: `generated/`

## Hinweise

- Die Rechnungsnummer verwendet das Format `JAHR-00001`.
- Der Zähler ist in den Einstellungen editierbar.
- Die aktuelle Umsetzung verschickt eine PDF, die aus der gerenderten Rechnungsansicht erzeugt wird.
