// Einmaliger Import Google Sheets -> Firestore mit Abgleich.
//
// Nutzung (Werte aus dem Secret Manager, nie ins Repo):
//   SHEETS_URL=... SHEETS_SECRET=... FIRESTORE_PROJECT_ID=crowforge-billing \
//     node scripts/import-sheets-to-firestore.mjs import [--force]
//   ... node scripts/import-sheets-to-firestore.mjs verify
//
// Quelle ist die Apps-Script-Web-App (derselbe Lesepfad wie die App). Es wird
// nichts ins Sheet geschrieben.

import os from "node:os";
import path from "node:path";

const mode = process.argv[2];
const force = process.argv.includes("--force");
const SHEETS_URL = String(process.env.SHEETS_URL || "").trim();
const SHEETS_SECRET = String(process.env.SHEETS_SECRET || "").trim();
const PROJECT_ID = String(process.env.FIRESTORE_PROJECT_ID || "").trim();
const DATABASE_ID = String(process.env.FIRESTORE_DATABASE_ID || "").trim();

if (!["import", "verify"].includes(mode) || !SHEETS_URL || !SHEETS_SECRET || !PROJECT_ID) {
  console.error("Usage: SHEETS_URL=.. SHEETS_SECRET=.. FIRESTORE_PROJECT_ID=.. node scripts/import-sheets-to-firestore.mjs import|verify [--force]");
  process.exit(2);
}

// server.js im Datei-Modus laden (keine Firestore-/Sheets-Seiteneffekte), nur fuer die Normalisierung.
process.env.STORE_BACKEND = "file";
process.env.STORAGE_DIR = path.join(os.tmpdir(), `billing-import-${process.pid}`);
delete process.env.GOOGLE_SHEETS_WEBAPP_URL;
delete process.env.GOOGLE_SHEETS_WEBAPP_SECRET;
const { createUserRecord, applySeedDataIfNeeded, mergeStore } = await import("../server.js");
const { createFirestoreBackend, stableStringify } = await import("../lib/firestore-store.js");

// Optional GCP_ACCESS_TOKEN (siehe lib/gcp-auth.js) statt Application Default Credentials.
const backend = createFirestoreBackend({ projectId: PROJECT_ID, databaseId: DATABASE_ID });

async function callSheets(action, payload = {}) {
  const response = await fetch(SHEETS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: SHEETS_SECRET, action, ...payload })
  });
  if (!response.ok) {
    throw new Error(`Sheets ${action} HTTP ${response.status}`);
  }
  const json = await response.json();
  if (!json.ok) {
    throw new Error(`Sheets ${action}: ${json.error || "unbekannter Fehler"}`);
  }
  return json;
}

async function fetchRemote() {
  const { users } = await callSheets("listUsers");
  const result = [];
  for (const entry of users) {
    const username = String(entry.username || "").trim().toLowerCase();
    if (!username) {
      continue;
    }
    const { data } = await callSheets("getUserData", { username });
    result.push({ username, data });
  }
  return result;
}

// Entspricht dem Neuanlage-Zweig von syncUserFromGoogleSheetsIntoStore.
function buildUserFromRemote(username, remoteData) {
  const remotePassword = String(remoteData?.settings?.auth?.password || "admin");
  const settings = {
    ...(remoteData.settings || {}),
    auth: {
      ...(remoteData.settings?.auth || {}),
      username,
      password: remotePassword,
      adminPasswordVersion: username === "admin" ? 1 : Number(remoteData.settings?.auth?.adminPasswordVersion || 0)
    }
  };
  return applySeedDataIfNeeded(
    createUserRecord({
      username,
      password: remotePassword,
      settings,
      customers: Array.isArray(remoteData.customers) ? remoteData.customers : [],
      articles: Array.isArray(remoteData.articles) ? remoteData.articles : [],
      invoices: [],
      createdAt: remoteData.createdAt || remoteData.updatedAt,
      updatedAt: remoteData.updatedAt,
      settingsUpdatedAt: remoteData.settingsUpdatedAt || remoteData.updatedAt,
      lastActivityAt: remoteData.lastActivityAt || remoteData.updatedAt,
      lastSeenAt: remoteData.lastSeenAt
    })
  );
}

const str = (value) => String(value ?? "").trim();
const num = (value) => Number(String(value ?? "").replace(",", "."));

const CUSTOMER_FIELDS = ["customerNumber", "name", "contactPerson", "street", "postalCode", "city", "country", "phone", "email", "uid", "notes"];
const ARTICLE_TEXT_FIELDS = ["group", "number", "name", "description", "unit"];
const ARTICLE_NUMBER_FIELDS = ["unitPrice", "taxRate"];
const SETTINGS_FIELDS = {
  business: ["companyName", "addressLine1", "addressLine2", "postalCode", "city", "country", "phone", "email", "uid", "bankName", "iban", "bic", "issuerName", "paymentNote", "paymentNoteNoTax", "footerNote"],
  invoice: ["title", "counterYear", "counterValue"],
  email: ["ccEmail", "subjectTemplate", "bodyTemplate"],
  auth: ["password", "isLocked"],
  branding: ["hasInvoiceLogo"]
};

async function runImport() {
  const existing = await backend.db.collection("users").limit(1).get();
  if (!existing.empty && !force) {
    console.error("Firestore enthaelt bereits Benutzer. Abbruch (mit --force ueberschreiben).");
    process.exit(1);
  }

  const remote = await fetchRemote();
  const store = { users: remote.map(({ username, data }) => buildUserFromRemote(username, data)), sessions: [] };
  const ops = await backend.write(store);
  console.log(`Import fertig: ${store.users.length} Benutzer, ${ops} Dokumente geschrieben.`);
  for (const user of store.users) {
    console.log(`  ${user.username}: ${user.customers.length} Kunden, ${user.articles.length} Artikel`);
  }
}

async function runVerify() {
  const remote = await fetchRemote();
  const raw = await backend.loadRaw();
  const store = mergeStore(raw);
  const problems = [];
  const report = (message) => problems.push(message);

  // Zaehlung
  const remoteTotals = { users: remote.length, customers: 0, articles: 0 };
  const storedTotals = { users: raw.users.length, customers: 0, articles: 0 };

  for (const { username, data } of remote) {
    const rawUser = raw.users.find((entry) => entry.username === username);
    const user = store.users.find((entry) => entry.username === username);
    remoteTotals.customers += data.customers.length;
    remoteTotals.articles += data.articles.length;
    if (!rawUser || !user) {
      report(`${username}: fehlt in Firestore`);
      continue;
    }
    storedTotals.customers += rawUser.customers.length;
    storedTotals.articles += rawUser.articles.length;

    if (rawUser.customers.length !== data.customers.length) {
      report(`${username}: Kunden ${data.customers.length} im Sheet vs ${rawUser.customers.length} in Firestore`);
    }
    if (rawUser.articles.length !== data.articles.length) {
      report(`${username}: Artikel ${data.articles.length} im Sheet vs ${rawUser.articles.length} in Firestore`);
    }

    // Jeder Datensatz feldweise gegen die Rohwerte aus dem Sheet
    for (const remoteCustomer of data.customers) {
      const stored = rawUser.customers.find((entry) => entry.id === str(remoteCustomer.id));
      if (!stored) {
        report(`${username}: Kunde ${remoteCustomer.id} (${remoteCustomer.name}) fehlt`);
        continue;
      }
      for (const field of CUSTOMER_FIELDS) {
        const expected = str(remoteCustomer[field]) || (field === "name" ? str(remoteCustomer.contactPerson) : "");
        if (str(stored[field]) !== expected) {
          report(`${username}: Kunde ${remoteCustomer.customerNumber} ${field}: "${expected}" vs "${str(stored[field])}"`);
        }
      }
    }
    for (const remoteArticle of data.articles) {
      const stored = rawUser.articles.find((entry) => entry.id === str(remoteArticle.id));
      if (!stored) {
        report(`${username}: Artikel ${remoteArticle.number} (${remoteArticle.name}) fehlt`);
        continue;
      }
      for (const field of ARTICLE_TEXT_FIELDS) {
        if (str(stored[field]) !== str(remoteArticle[field])) {
          report(`${username}: Artikel ${remoteArticle.number} ${field}: "${str(remoteArticle[field])}" vs "${str(stored[field])}"`);
        }
      }
      for (const field of ARTICLE_NUMBER_FIELDS) {
        if (num(stored[field]) !== num(remoteArticle[field])) {
          report(`${username}: Artikel ${remoteArticle.number} ${field}: ${remoteArticle[field]} vs ${stored[field]}`);
        }
      }
    }

    // Einstellungen (Admin-Firmendaten werden von der App bewusst geleert)
    for (const [section, fields] of Object.entries(SETTINGS_FIELDS)) {
      if (username === "admin" && ["business", "invoice", "email"].includes(section)) {
        continue;
      }
      for (const field of fields) {
        const expected = data.settings?.[section]?.[field];
        const actual = user.settings?.[section]?.[field];
        if (stableStringify(expected ?? "") !== stableStringify(actual ?? "")) {
          report(`${username}: settings.${section}.${field}: ${stableStringify(expected)} vs ${stableStringify(actual)}`);
        }
      }
    }

    // Der App-Normalisierungsschritt darf nichts mehr veraendern (sonst Schreibzugriffe bei jedem Laden)
    const rawSnapshot = backend.takeSnapshot({ users: [rawUser], sessions: [] });
    const normalizedSnapshot = backend.takeSnapshot({ users: [user], sessions: [] });
    for (const [docPath, entry] of normalizedSnapshot) {
      const before = rawSnapshot.get(docPath);
      if (stableStringify(before) !== stableStringify(entry)) {
        report(`${username}: Normalisierung aendert ${docPath}`);
      }
    }
  }

  const extraUsers = raw.users.filter((entry) => !remote.some((r) => r.username === entry.username));
  for (const entry of extraUsers) {
    report(`Zusaetzlicher Benutzer in Firestore: ${entry.username}`);
  }

  console.log("Sheet     :", remoteTotals);
  console.log("Firestore :", storedTotals);
  if (problems.length) {
    console.log(`\n${problems.length} Abweichungen:`);
    problems.forEach((problem) => console.log(`  - ${problem}`));
    process.exit(1);
  }
  console.log("\nAbgleich OK: alle Benutzer, Kunden, Artikel und Einstellungen stimmen ueberein.");
}

if (mode === "import") {
  await runImport();
} else {
  await runVerify();
}
process.exit(0);
