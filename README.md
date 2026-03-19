# billingapp

Eine mobile Rechnungs-App fuer:
- Kunden anlegen
- Artikel und Leistungen verwalten
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

- Benutzerdaten, Kunden, Leistungen, Rechnungen und Einstellungen: `data/store.json`
- Erzeugte PDFs und PNGs: `data/generated/`
- Hochgeladene Logos: `data/assets/`

## Netlify-Deployment

Die App ist weiterhin fuer Netlify vorbereitet:
- Express laeuft ueber `netlify/functions/api.js`
- API-Routen werden ueber `netlify.toml` auf die Function umgeleitet
- Benutzerdaten, Rechnungen, Logos und PDF-Dateien werden auf Netlify in Blobs gespeichert

### Was du in Netlify machen musst

1. Repository mit Netlify verbinden.
2. Bei den Build-Einstellungen:
   - Build command: `npm install`
   - Publish directory: `public`
3. Sicherstellen, dass `netlify.toml` verwendet wird.
4. Unter `Site configuration -> Environment variables` nur die benoetigten Variablen setzen, z. B.:
   - `GOOGLE_SHEETS_WEBAPP_URL`
   - `GOOGLE_SHEETS_WEBAPP_SECRET`
   - optional `RESEND_API_KEY`
   - optional `RESEND_FROM_EMAIL`
   - optional `RESEND_CC_EMAIL`
5. Deploy starten.

Hinweis:
- Fuer Netlify Blobs ist kein eigener lokaler Dateipfad mehr noetig.
- In Produktion nutzt Netlify die Blob-Umgebung automatisch in der Function.

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
- Pro Benutzer werden Kunden, Leistungen, Rechnungen und Einstellungen getrennt gespeichert.
- PDFs werden aus der gerenderten Vorschau erzeugt.
