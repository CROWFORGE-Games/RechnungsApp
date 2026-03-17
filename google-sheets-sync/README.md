# Google Sheets Sync

Diese Apps-Script-Datei verbindet die RechnungsApp mit deinem vorhandenen Google Sheet:

- Spreadsheet: `11sTU5OoNFaOkfnKfqzlcqG8O-CdG3OO2OzKMt6CCerY`
- Tabs: `User`, `Kunden`, `Artikel`

## So richtest du es ein

1. In Google Sheets `Erweiterungen -> Apps Script` öffnen.
2. Den Inhalt von [`Code.gs`](C:/Users/mathi/Documents/Codex/KaindlBilling/google-sheets-sync/Code.gs) komplett einfügen.
3. In `Code.gs` den Wert `API_SECRET` auf ein eigenes geheimes Kennwort ändern.
4. Das Projekt speichern.
5. `Bereitstellen -> Neue Bereitstellung -> Web-App`
6. Ausführen als: `Ich`
7. Zugriff: `Jeder mit dem Link`
8. Die Web-App-URL kopieren.

## Render-Variablen

In Render diese zwei Environment-Variablen setzen:

- `GOOGLE_SHEETS_WEBAPP_URL`
- `GOOGLE_SHEETS_WEBAPP_SECRET`

## Datenaufbau

- `User`
  - `username`
  - `settings_json`
  - `updated_at`
- `Kunden`
  - `username`
  - `customer_id`
  - `payload_json`
  - `updated_at`
- `Artikel`
  - `username`
  - `article_id`
  - `payload_json`
  - `updated_at`

Die RechnungsApp behandelt `username` als Zuordnung pro Benutzer, z. B. `admin` oder `kaindl_daniel`.
