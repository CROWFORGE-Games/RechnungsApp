import { OAuth2Client } from "google-auth-library";

// Lokale Entwicklung: GCP_ACCESS_TOKEN (z. B. `gcloud auth print-access-token`) statt
// Application Default Credentials. Auf Cloud Run nicht gesetzt -> Service Account.
export function getOptionalAuthClient() {
  const token = String(process.env.GCP_ACCESS_TOKEN || "").trim();
  if (!token) {
    return undefined;
  }
  const client = new OAuth2Client();
  client.setCredentials({ access_token: token });
  return client;
}
