# RechnungsApp

Eine mobile Rechnungs-App fuer:
- Kunden anlegen
- Artikel verwalten
- Rechnungen mit fortlaufender Nummer erzeugen
- Vorschau, Signatur und PDF-Erstellung
- Versand per Resend oder ueber die Mail-App
- benutzerspezifische Daten mit Login und Abmelden

## Lokal starten

```bash
npm install
npm start
```

Danach im Browser `http://localhost:3000` aufrufen.

## Windows per Doppelklick

- `Start-billingapp.bat`

## Smartphone im lokalen WLAN

- PC und Smartphone muessen im selben WLAN sein.
- App lokal starten.
- Im Konsolenfenster eine WLAN-Adresse wie `http://192.168.x.x:3000` oeffnen.
- Auf dem Handy im Browser aufrufen und optional zum Startbildschirm hinzufuegen.

## Lokale Speicherung

- Benutzerdaten, Kunden, Artikel, Rechnungen und Einstellungen: `data/store.json`
- Erzeugte PDFs und PNGs: `data/generated/`
- Hochgeladene Logos: `data/assets/`

## Cloud-Run-Deployment

Die App ist fuer einen einfachen Docker-Deploy vorbereitet:
- Cloud Run nutzt automatisch den Port aus `PORT`
- auf Cloud Run wird der temporaere Speicher unter `/tmp/billingapp` verwendet
- benutzerspezifische Stammdaten kommen weiter aus Google Sheets

### Was du in Google Cloud / Cloud Run setzen musst

- `GOOGLE_SHEETS_WEBAPP_URL`
- `GOOGLE_SHEETS_WEBAPP_SECRET`
- optional `RESEND_API_KEY`
- optional `RESEND_FROM_EMAIL`
- optional `RESEND_CC_EMAIL`

Danach kann die App direkt ueber das vorhandene `Dockerfile` deployed werden.

## Vorlage und Standard-Assets

Die Rechnungs-Vorlage kann weiterhin lokal aus diesen Dateien gelesen werden:
- `public/assets/invoice-template.png`
- `public/assets/image.png`

Standard-Logos im Repository:
- `public/assets/app-icon.svg`
- `public/assets/app-maskable.svg`
- `public/assets/logo-placeholder.svg`

Wenn du in der App neue Logos hochlaedst, werden diese benutzerspezifisch gespeichert.

## Mailversand

In der Oberflaeche unter **Einstellungen** eintragen:
- CC an eigene E-Mail / weitere Empfaenger
- E-Mail Betreff
- E-Mail Text

Direkt in der App versendet wird ueber Resend, wenn es konfiguriert ist. Sonst nutzt die App die Mail-App oder den Teilen-Dialog des Geraets.

## Hinweise

- Die Rechnungsnummer verwendet das Format `JAHR-00001`.
- Pro Benutzer werden Kunden, Artikel, Rechnungen und Einstellungen getrennt gespeichert.
- PDFs werden aus der gerenderten Vorschau erzeugt.

