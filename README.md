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

## Datenhaltung

Produktiv (Cloud Run) liegen alle Daten im eigenen GCP-Projekt `crowforge-billing` (europe-west3):

- Firestore `(default)`:
  - `users/{username}`: Einstellungen, Rechnungszaehler, Login
  - `users/{username}/customers|articles|invoices/{id}`
  - `sessions/{token}` (TTL auf `expireAt`)
- Cloud Storage `gs://crowforge-billing-files/generated/`: erzeugte PDFs/PNGs
- Backups: PITR (7 Tage), taeglich (7 Tage), woechentlich (14 Wochen); Bucket mit Versionierung
- Secrets im Secret Manager von `crowforge-billing` (`resend-api-key` ...), nie im Repo

Rechnungsnummern werden per Firestore-Transaktion vergeben (keine doppelten Nummern).
Firmenlogos bleiben wie bisher im Geraete-Cache des Browsers.

Lokal ohne `FIRESTORE_PROJECT_ID` speichert die App weiter in Dateien:

- Benutzerdaten, Kunden, Artikel, Rechnungen und Einstellungen: `data/store.json`
- Erzeugte PDFs und PNGs: `data/generated/`

### Umgebungsvariablen

- `FIRESTORE_PROJECT_ID` (z. B. `crowforge-billing`), optional `FIRESTORE_DATABASE_ID`
- `GCS_BUCKET` (z. B. `crowforge-billing-files`)
- `RESEND_API_KEY` (aus Secret Manager), `RESEND_FROM_EMAIL`, optional `RESEND_CC_EMAIL`
- lokal optional `GCP_ACCESS_TOKEN` (`gcloud auth print-access-token`) statt Application Default Credentials

### Deployment

Cloud Run Service `billingapp` in `crowforge-platform` (europe-west1) mit Service Account
`billingapp-runtime@crowforge-platform.iam.gserviceaccount.com`
(Firestore-User + Bucket-Objekt-Admin + Secret-Zugriff in `crowforge-billing`).

### Google Sheets (abgeloest)

Die Daten kamen frueher aus Google Sheets (`google-sheets-sync/`). Einmaliger Import und Abgleich:
`scripts/import-sheets-to-firestore.mjs import|verify`. Mit Firestore ist der Sheets-Sync abgeschaltet.

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

