import crypto from "node:crypto";
import { existsSync, readFileSync, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";
import { PDFDocument } from "pdf-lib";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, "public");
const PUBLIC_ASSET_DIR = path.join(PUBLIC_DIR, "assets");
const IMPORT_DIR = path.join(__dirname, "google-sheets-sync", "import");
const IS_CLOUD_RUN = Boolean(process.env.K_SERVICE || process.env.CLOUD_RUN_JOB);
const STORAGE_ROOT = process.env.STORAGE_DIR
  ? path.resolve(process.env.STORAGE_DIR)
  : IS_CLOUD_RUN
    ? path.join(os.tmpdir(), "billingapp")
    : path.join(__dirname, "data");
const DATA_FILE = path.join(STORAGE_ROOT, "store.json");
const GENERATED_DIR = path.join(STORAGE_ROOT, "generated");
const ASSET_STORAGE_DIR = path.join(STORAGE_ROOT, "assets");
const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 3100);
const GOOGLE_SHEETS_WEBAPP_URL = String(process.env.GOOGLE_SHEETS_WEBAPP_URL || "").trim();
const GOOGLE_SHEETS_WEBAPP_SECRET = String(process.env.GOOGLE_SHEETS_WEBAPP_SECRET || "").trim();
const RESEND_API_KEY = String(process.env.RESEND_API_KEY || "").trim();
const RESEND_FROM_EMAIL = String(process.env.RESEND_FROM_EMAIL || "").trim();
const RESEND_CC_EMAIL = String(process.env.RESEND_CC_EMAIL || "").trim();
const LOGO_KEYS = {
  invoice: "invoice",
  app: "app"
};
const PRESET_USERS = [
  { username: "admin", password: "admin0789" },
  { username: "kaindl_daniel", password: "admin" },
  { username: "test_user", password: "admin" }
];

function createAdminSeedPayload() {
  return {
    settings: {
      business: {
        companyName: "Testfirma",
        addressLine1: "Musterstraße 1",
        addressLine2: "",
        postalCode: "6335",
        city: "Thiersee",
        country: "Österreich",
        phone: "+43 5376 20000",
        email: "mathias.mairhofer@gmail.com",
        uid: "ATU12345678",
        iban: "AT57 2050 6012 0000 0071",
        bic: "SPKUAT22XXX",
        bankName: "Sparkasse Thiersee",
        issuerName: "Daniel Kaindl",
        paymentNote: "Fällig innerhalb von 14 Tagen ohne Abzug.",
        footerNote: "Bitte geben Sie bei der Überweisung die Rechnungsnummer an."
      },
      branding: {
        hasInvoiceLogo: false,
        hasAppLogo: false
      },
      invoice: {
        title: "Rechnung",
        counterYear: new Date().getFullYear(),
        counterValue: 0
      },
      email: {
        ccEmail: "mathias.mairhofer@gmail.com",
        subjectTemplate: "Rechnung {{invoiceNumber}}",
        bodyTemplate:
          "Guten Tag {{customerName}},\n\nanbei erhalten Sie die Rechnung {{invoiceNumber}}.\n\nFreundliche Grüße\n{{companyName}}"
      }
    },
    customers: [
      {
        customerNumber: "10001",
        name: "CROWFORGE Games",
        contactPerson: "Mathias Mayrhofer",
        street: "Musterweg 8",
        postalCode: "6335",
        city: "Thiersee",
        country: "Österreich",
        phone: "+43 660 000000",
        email: "contact@crowforge-games.com",
        uid: "ATU87654321",
        notes: "Testkunde für mobile Rechnungsprüfung."
      }
    ],
    articles: [
      {
        group: "Test",
        number: "10001",
        name: "Testleistung",
        description: "Testartikel für Rechnungs-App",
        unit: "Std.",
        unitPrice: 72,
        taxRate: 20
      }
    ]
  };
}

function createTestUserSeedPayload() {
  return {
    settings: {
      business: {
        companyName: "Test User Firma",
        addressLine1: "Testweg 2",
        addressLine2: "",
        postalCode: "6335",
        city: "Thiersee",
        country: "Österreich",
        phone: "+43 660 111111",
        email: "contact@crowforge-games.com",
        uid: "",
        iban: "",
        bic: "",
        bankName: "",
        issuerName: "Test User",
        paymentNote: "Fällig innerhalb von 14 Tagen ohne Abzug.",
        footerNote: "Bitte gib bei der Überweisung die Rechnungsnummer an."
      },
      branding: {
        hasInvoiceLogo: false,
        hasAppLogo: false
      },
      invoice: {
        title: "Rechnung",
        counterYear: new Date().getFullYear(),
        counterValue: 0
      },
      email: {
        ccEmail: "",
        subjectTemplate: "Rechnung {{invoiceNumber}}",
        bodyTemplate:
          "Guten Tag {{customerName}},\n\nanbei erhalten Sie die Rechnung {{invoiceNumber}}.\n\nFreundliche Grüße\n{{companyName}}"
      }
    },
    customers: [
      {
        customerNumber: "10001",
        name: "CROWFORGE Games",
        contactPerson: "Mathias Mayrhofer",
        street: "Testweg 8",
        postalCode: "6335",
        city: "Thiersee",
        country: "Österreich",
        phone: "+43 660 000000",
        email: "contact@crowforge-games.com",
        uid: "",
        notes: "Testkunde fuer test_user."
      }
    ],
    articles: [
      {
        group: "Test",
        number: "10001",
        name: "Testartikel",
        description: "Testartikel fuer test_user",
        unit: "Std.",
        unitPrice: 72,
        taxRate: 20
      }
    ]
  };
}

function parseCsvLine(line = "") {
  const values = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === "," && !insideQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function parseCsvFile(filePath) {
  if (!existsSync(filePath)) {
    return [];
  }

  const raw = readFileSync(filePath, "utf8");
  const normalized = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    return [];
  }

  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return header.reduce((entry, key, index) => {
      entry[key] = values[index] ?? "";
      return entry;
    }, {});
  });
}

function loadImportedUserSeed(username) {
  const userDir = path.join(IMPORT_DIR, username);
  const userRows = parseCsvFile(path.join(userDir, "User.csv"));
  const customerRows = parseCsvFile(path.join(userDir, "Kunden.csv"));
  const articleRows = parseCsvFile(path.join(userDir, "Artikel.csv"));

  if (!userRows.length && !customerRows.length && !articleRows.length) {
    return null;
  }

  const settingsJson = String(userRows[0]?.settings_json || "").trim();
  let importedSettings = {};
  try {
    importedSettings = settingsJson ? JSON.parse(settingsJson) : {};
  } catch (error) {
    console.error(`Import-Settings für ${username} konnten nicht gelesen werden.`, error);
  }

  const customers = customerRows
    .map((row) => {
      try {
        return sanitizeCustomer(JSON.parse(String(row.payload_json || "{}")));
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean);

  const articles = articleRows
    .map((row) => {
      try {
        return sanitizeArticle(JSON.parse(String(row.payload_json || "{}")));
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean);

  return {
    settings: mergeSettings(importedSettings),
    customers,
    articles
  };
}

function normalizeAdminUser(user) {
  return createUserRecord({
    ...user,
    settings: {
      ...user.settings,
      business: { ...DEFAULT_SETTINGS.business },
      invoice: { ...DEFAULT_SETTINGS.invoice },
      email: { ...DEFAULT_SETTINGS.email },
      branding: {
        ...DEFAULT_SETTINGS.branding,
        ...(user.settings?.branding || {})
      },
      auth: {
        ...DEFAULT_SETTINGS.auth,
        ...(user.settings?.auth || {}),
        username: "admin"
      }
    },
    customers: [],
    articles: [],
    invoices: []
  });
}

async function getImportedUsernames() {
  try {
    const entries = await fs.readdir(IMPORT_DIR, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [];
  }
}

const DEFAULT_STORE = {
  settings: {
    business: {
      companyName: "",
      addressLine1: "",
      addressLine2: "",
      postalCode: "",
      city: "",
      country: "Österreich",
      phone: "",
      email: "",
      uid: "",
      iban: "",
      bic: "",
      bankName: "",
      issuerName: "",
      paymentNote: "Fällig innerhalb von 14 Tagen ohne Abzug.",
      footerNote: "Bitte geben Sie bei der Überweisung die Rechnungsnummer an."
    },
    branding: {
      hasInvoiceLogo: false,
      hasAppLogo: false
    },
    auth: {
      username: "admin",
      password: "admin",
      defaultUserPassword: "admin",
      adminPasswordVersion: 0
    },
    invoice: {
      title: "Rechnung",
      counterYear: new Date().getFullYear(),
      counterValue: 0
    },
    email: {
      ccEmail: "",
      subjectTemplate: "Rechnung {{invoiceNumber}}",
      bodyTemplate:
        "Guten Tag {{customerName}},\n\nanbei erhalten Sie die Rechnung {{invoiceNumber}}.\n\nFreundliche Grüße\n{{companyName}}"
    }
  },
  customers: [],
  articles: [],
  invoices: []
};

const DEFAULT_SETTINGS = {
  business: { ...DEFAULT_STORE.settings.business },
  branding: { ...DEFAULT_STORE.settings.branding },
  auth: { ...DEFAULT_STORE.settings.auth },
  invoice: { ...DEFAULT_STORE.settings.invoice },
  email: { ...DEFAULT_STORE.settings.email }
};

function isGoogleSheetsSyncConfigured() {
  return Boolean(GOOGLE_SHEETS_WEBAPP_URL && GOOGLE_SHEETS_WEBAPP_SECRET);
}

const app = express();
app.use(express.json({ limit: "20mb" }));
app.use(express.static(PUBLIC_DIR));

const pendingGoogleSheetSyncPayloads = new Map();
const activeGoogleSheetSyncUsers = new Set();
let importedUsersBackfillPromise = null;

function roundCurrency(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

const LEGACY_TEXT_REPLACEMENTS = [
  ["Oesterreich", "\u00D6sterreich"],
  ["oesterreich", "\u00D6sterreich"],
  ["Faellig", "F\u00E4llig"],
  ["faellig", "f\u00E4llig"],
  ["Ueberweisung", "\u00DCberweisung"],
  ["ueberweisung", "\u00DCberweisung"],
  ["Gruesse", "Gr\u00FC\u00DFe"],
  ["gruesse", "gr\u00FC\u00DFe"],
  ["zurueck", "zur\u00FCck"],
  ["Zurueck", "Zur\u00FCck"],
  ["geloescht", "gel\u00F6scht"],
  ["Geloescht", "Gel\u00F6scht"],
  ["loeschen", "l\u00F6schen"],
  ["Loeschen", "L\u00F6schen"],
  ["geaendert", "ge\u00E4ndert"],
  ["Geaendert", "Ge\u00E4ndert"],
  ["fuer", "f\u00FCr"],
  ["Fuer", "F\u00FCr"],
  ["ueber", "\u00FCber"],
  ["Ueber", "\u00DCber"],
  ["verfuegbar", "verf\u00FCgbar"],
  ["Verfuegbar", "Verf\u00FCgbar"],
  ["bestaetigen", "best\u00E4tigen"],
  ["Bestaetigen", "Best\u00E4tigen"]
];

function normalizeLegacyText(value) {
  if (typeof value !== "string") {
    return value;
  }

  let normalized = value;
  if (normalized.includes("?") || normalized.includes("?")) {
    try {
      normalized = Buffer.from(normalized, "latin1").toString("utf8");
    } catch {
      // Fallback auf den Originaltext.
    }
  }

  normalized = normalized
    .replaceAll("?sterreich", "\u00D6sterreich")
    .replaceAll("?berweisung", "\u00DCberweisung")
    .replaceAll("Gr\uFFFD?e", "Gr\u00FC\u00DFe")
    .replaceAll("gr\uFFFD?e", "gr\u00FC\u00DFe")
    .replaceAll("Stra?e", "Stra\u00DFe")
    .replaceAll("stra?e", "stra\u00DFe")
    .replaceAll("Strasse", "Stra\u00DFe")
    .replaceAll("strasse", "stra\u00DFe")
    .replaceAll("\uFFFD\u0013", "\u00D6")
    .replaceAll("\uFFFDS", "\u00DC")
    .replaceAll("\uFFFDx", "\u00DF")
    .replaceAll("\uFFFD", "");

  for (const [source, target] of LEGACY_TEXT_REPLACEMENTS) {
    normalized = normalized.replaceAll(source, target);
  }

  return normalized;
}

function normalizeLegacyData(value) {
  if (typeof value === "string") {
    return normalizeLegacyText(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeLegacyData(entry));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, normalizeLegacyData(entry)])
    );
  }

  return value;
}

function markUserUpdated(user) {
  user.updatedAt = new Date().toISOString();
  return user.updatedAt;
}

function markUserActivity(user) {
  const timestamp = markUserUpdated(user);
  user.lastActivityAt = timestamp;
  return timestamp;
}

function markUserSeen(user) {
  const timestamp = new Date().toISOString();
  user.lastSeenAt = timestamp;
  return timestamp;
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(String(password || "")).digest("hex");
}

function mergeSettings(raw = {}) {
  const normalizedRaw = normalizeLegacyData(raw);
  return {
    business: {
      ...DEFAULT_SETTINGS.business,
      ...(normalizedRaw.business || {})
    },
    branding: {
      ...DEFAULT_SETTINGS.branding,
      ...(normalizedRaw.branding || {})
    },
    auth: {
      ...DEFAULT_SETTINGS.auth,
      ...(normalizedRaw.auth || {})
    },
    invoice: {
      ...DEFAULT_SETTINGS.invoice,
      ...(normalizedRaw.invoice || {})
    },
    email: {
      ...DEFAULT_SETTINGS.email,
      ...(normalizedRaw.email || {})
    }
  };
}

function createUserRecord({
  id,
  username = "admin",
  password = "admin",
  passwordHash,
  settings,
  customers,
  articles,
  invoices,
  createdAt,
  updatedAt,
  lastActivityAt,
  lastSeenAt
} = {}) {
  const normalizedSettings = mergeSettings(settings);
  const normalizedCreatedAt = createdAt || new Date().toISOString();
  const normalizedUpdatedAt = updatedAt || normalizedCreatedAt;

  return {
    id: id || crypto.randomUUID(),
    username: String(username || "").trim() || "admin",
    passwordHash: passwordHash || hashPassword(password),
    settings: {
      ...normalizedSettings,
      auth: {
        username: String(normalizedSettings?.auth?.username || username || "admin").trim() || "admin",
        password: String(normalizedSettings?.auth?.password || password || "admin"),
        defaultUserPassword: String(normalizedSettings?.auth?.defaultUserPassword || "admin"),
        adminPasswordVersion: Number(normalizedSettings?.auth?.adminPasswordVersion || 0)
      }
    },
    customers: Array.isArray(customers) ? customers.map((entry) => sanitizeCustomer(entry)) : [],
    articles: Array.isArray(articles) ? articles.map((entry) => sanitizeArticle(entry)) : [],
    invoices: Array.isArray(invoices) ? normalizeLegacyData(invoices) : [],
    createdAt: normalizedCreatedAt,
    updatedAt: normalizedUpdatedAt,
    lastActivityAt: lastActivityAt || normalizedUpdatedAt,
    lastSeenAt: lastSeenAt || ""
  };
}

function applySeedDataIfNeeded(user) {
  if (user.username === "admin") {
    return normalizeAdminUser(user);
  }

  if (!["kaindl_daniel", "test_user"].includes(user.username)) {
    return user;
  }

  const needsSeedData =
    !user.customers.length &&
    !user.articles.length &&
    !user.invoices.length &&
    !String(user.settings?.business?.companyName || "").trim();

  if (!needsSeedData) {
    return user;
  }

  const seed =
    user.username === "kaindl_daniel" ? loadImportedUserSeed("kaindl_daniel") : createTestUserSeedPayload();

  if (!seed) {
    return user;
  }

  return createUserRecord({
    ...user,
    settings: seed.settings,
    customers: seed.customers.map((entry) => sanitizeCustomer(entry)),
    articles: seed.articles.map((entry) => sanitizeArticle(entry))
  });
}

function ensurePresetUsers(users = []) {
  const normalizedUsers = Array.isArray(users) ? [...users] : [];

  PRESET_USERS.forEach(({ username, password }) => {
    const existingIndex = normalizedUsers.findIndex((entry) => entry.username === username);
    if (existingIndex >= 0) {
      const existingUser = normalizedUsers[existingIndex];
      const shouldMigrateAdminPassword =
        username === "admin" &&
        Number(existingUser.settings?.auth?.adminPasswordVersion || 0) < 1;
      const preservedPassword =
        shouldMigrateAdminPassword
          ? password
          : existingUser.settings?.auth?.password || password;
      normalizedUsers[existingIndex] = applySeedDataIfNeeded(
        createUserRecord({
          ...existingUser,
          username,
          settings: {
            ...existingUser.settings,
            auth: {
              ...(existingUser.settings?.auth || {}),
              username,
              password: preservedPassword,
              defaultUserPassword: String(existingUser.settings?.auth?.defaultUserPassword || "admin"),
              adminPasswordVersion:
                username === "admin"
                  ? 1
                  : Number(existingUser.settings?.auth?.adminPasswordVersion || 0)
            }
          },
          passwordHash:
            shouldMigrateAdminPassword
              ? hashPassword(password)
              : existingUser.passwordHash || hashPassword(preservedPassword)
        })
      );
      return;
    }

    normalizedUsers.push(applySeedDataIfNeeded(createUserRecord({ username, password })));
  });

  return normalizedUsers;
}

function mergeStore(raw = {}) {
  if (Array.isArray(raw.users)) {
    return {
      users: ensurePresetUsers(raw.users.map((user) => createUserRecord(user))),
      sessions: Array.isArray(raw.sessions) ? raw.sessions : []
    };
  }

  const legacySettings = raw.settings || {};
  const migratedUser = createUserRecord({
    username: legacySettings.auth?.username || "admin",
    password: legacySettings.auth?.password || "admin",
    settings: {
      business: legacySettings.business,
      invoice: legacySettings.invoice,
      email: legacySettings.email
    },
    customers: raw.customers,
    articles: raw.articles,
    invoices: raw.invoices
  });

  return {
    users: ensurePresetUsers([migratedUser]),
    sessions: []
  };
}

function createInitialStore() {
  return {
    users: ensurePresetUsers([]),
    sessions: []
  };
}

function inferMimeType(fileName = "") {
  if (fileName.endsWith(".pdf")) {
    return "application/pdf";
  }
  if (fileName.endsWith(".png")) {
    return "image/png";
  }
  if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (fileName.endsWith(".webp")) {
    return "image/webp";
  }
  if (fileName.endsWith(".svg")) {
    return "image/svg+xml";
  }
  if (fileName.endsWith(".json")) {
    return "application/json; charset=utf-8";
  }
  return "application/octet-stream";
}

async function ensureDataFiles() {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.mkdir(GENERATED_DIR, { recursive: true });
  await fs.mkdir(ASSET_STORAGE_DIR, { recursive: true });

  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify(createInitialStore(), null, 2), "utf8");
  }
}

async function readStore() {
  await ensureDataFiles();

  const raw = await fs.readFile(DATA_FILE, "utf8");
  const normalizedRaw = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  return mergeStore(JSON.parse(normalizedRaw));
}

async function writeStore(store) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
}

function sanitizeSettings(settings) {
  const normalizedSettings = mergeSettings(settings);
  return {
    business: normalizedSettings.business,
    auth: {
      username: normalizedSettings.auth?.username || "",
      password: normalizedSettings.auth?.password || "",
      defaultUserPassword: normalizedSettings.auth?.defaultUserPassword || "admin"
    },
    branding: {
      hasInvoiceLogo: Boolean(normalizedSettings.branding?.hasInvoiceLogo),
      hasAppLogo: Boolean(normalizedSettings.branding?.hasAppLogo)
    },
    invoice: {
      title: normalizedSettings.invoice.title,
      counterYear: Number(normalizedSettings.invoice.counterYear) || new Date().getFullYear(),
      counterValue: Number(normalizedSettings.invoice.counterValue) || 0
    },
    email: normalizedSettings.email
  };
}

function sanitizeCustomer(input = {}) {
  const normalizedInput = normalizeLegacyData(input);
  const fallbackName = String(normalizedInput.contactPerson || "").trim();
  const resolvedName = String(normalizedInput.name || "").trim() || fallbackName;
  return {
    id: normalizedInput.id || crypto.randomUUID(),
    customerNumber: String(normalizedInput.customerNumber || "").trim(),
    name: resolvedName,
    contactPerson: fallbackName,
    street: String(normalizedInput.street || "").trim(),
    postalCode: String(normalizedInput.postalCode || "").trim(),
    city: String(normalizedInput.city || "").trim(),
    country: String(normalizedInput.country || "").trim(),
    phone: String(normalizedInput.phone || "").trim(),
    email: String(normalizedInput.email || "").trim(),
    uid: String(normalizedInput.uid || "").trim(),
    notes: String(normalizedInput.notes || "").trim()
  };
}

function findCustomerIndexByIdOrPayload(customers = [], id, input = {}) {
  const normalizedId = String(id || "").trim();
  const normalizedInput = sanitizeCustomer({ ...input, id: normalizedId || input?.id });
  const directIndex = customers.findIndex((entry) => String(entry.id || "").trim() === normalizedId);
  if (directIndex >= 0) {
    return directIndex;
  }

  const syncKey = buildCustomerSyncKey(normalizedInput);
  if (syncKey.replace(/\|/g, "")) {
    const keyIndex = customers.findIndex((entry) => buildCustomerSyncKey(entry) === syncKey);
    if (keyIndex >= 0) {
      return keyIndex;
    }
  }

  if (normalizedInput.customerNumber) {
    const numberIndex = customers.findIndex(
      (entry) => String(entry.customerNumber || "").trim() === normalizedInput.customerNumber
    );
    if (numberIndex >= 0) {
      return numberIndex;
    }
  }

  if (normalizedInput.email) {
    const emailIndex = customers.findIndex(
      (entry) => String(entry.email || "").trim().toLowerCase() === normalizedInput.email.toLowerCase()
    );
    if (emailIndex >= 0) {
      return emailIndex;
    }
  }

  if (normalizedInput.name) {
    return customers.findIndex(
      (entry) => String(entry.name || "").trim().toLowerCase() === normalizedInput.name.toLowerCase()
    );
  }

  return -1;
}

function sanitizeArticle(input = {}) {
  const normalizedInput = normalizeLegacyData(input);
  return {
    id: normalizedInput.id || crypto.randomUUID(),
    group: String(normalizedInput.group || "").trim(),
    number: String(normalizedInput.number || "").trim(),
    name: String(normalizedInput.name || "").trim(),
    description: String(normalizedInput.description || "").trim(),
    unit: String(normalizedInput.unit || "Stunden").trim(),
    unitPrice: roundCurrency(normalizedInput.unitPrice || 0),
    taxRate: Number(normalizedInput.taxRate ?? 20)
  };
}

function buildSheetSyncPayload(user) {
  return {
    username: user.username,
    updatedAt: user.updatedAt,
    lastActivityAt: user.lastActivityAt || user.updatedAt,
    lastSeenAt: user.lastSeenAt || "",
    settings: mergeSettings(user.settings),
    customers: user.customers.map((entry) => sanitizeCustomer(entry)),
    articles: user.articles.map((entry) => sanitizeArticle(entry))
  };
}

async function requestGoogleSheetsSync(action, payload = {}) {
  if (!isGoogleSheetsSyncConfigured()) {
    return null;
  }

  const response = await fetch(GOOGLE_SHEETS_WEBAPP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      secret: GOOGLE_SHEETS_WEBAPP_SECRET,
      action,
      ...payload
    })
  });

  if (!response.ok) {
    throw new Error(`Google-Sheets-Sync fehlgeschlagen (${response.status}).`);
  }

  return response.json();
}

function normalizeEntityKeyPart(value) {
  return String(value || "").trim().toLowerCase();
}

function buildCustomerSyncKey(entry = {}) {
  return [
    normalizeEntityKeyPart(entry.customerNumber),
    normalizeEntityKeyPart(entry.name),
    normalizeEntityKeyPart(entry.email)
  ].join("|");
}

function buildArticleSyncKey(entry = {}) {
  return [
    normalizeEntityKeyPart(entry.number),
    normalizeEntityKeyPart(entry.name),
    normalizeEntityKeyPart(entry.unit)
  ].join("|");
}

function mergeRemoteEntityIds(remoteEntries = [], localEntries = [], buildKey) {
  const localById = new Map();
  const localByKey = new Map();

  for (const entry of localEntries) {
    if (entry?.id) {
      localById.set(String(entry.id), entry);
    }
    const key = buildKey(entry);
    if (key !== "||") {
      localByKey.set(key, entry);
    }
  }

  let didRepairIds = false;
  const entries = remoteEntries.map((entry) => {
    const matchingLocal =
      (entry?.id && localById.get(String(entry.id))) ||
      localByKey.get(buildKey(entry));

    if (!entry?.id && matchingLocal?.id) {
      didRepairIds = true;
      return {
        ...entry,
        id: matchingLocal.id
      };
    }

    return entry;
  });

  return { entries, didRepairIds };
}

function remoteDataHasMissingEntityIds(remoteData = {}) {
  const customerIdsMissing = Array.isArray(remoteData?.customers)
    ? remoteData.customers.some((entry) => !String(entry?.id || "").trim())
    : false;
  const articleIdsMissing = Array.isArray(remoteData?.articles)
    ? remoteData.articles.some((entry) => !String(entry?.id || "").trim())
    : false;

  return customerIdsMissing || articleIdsMissing;
}

function applyRemoteUserData(user, remoteData = {}) {
  if (!remoteData || typeof remoteData !== "object") {
    return { user, repairedIds: false };
  }

  let repairedIds = false;

  if (remoteData.settings) {
    user.settings = mergeSettings(remoteData.settings);
  }

  if (Array.isArray(remoteData.customers)) {
    const mergedCustomers = mergeRemoteEntityIds(
      remoteData.customers,
      user.customers,
      buildCustomerSyncKey
    );
    repairedIds = repairedIds || mergedCustomers.didRepairIds;
    user.customers = mergedCustomers.entries.map((entry) => sanitizeCustomer(entry));
  }

  if (Array.isArray(remoteData.articles)) {
    const mergedArticles = mergeRemoteEntityIds(
      remoteData.articles,
      user.articles,
      buildArticleSyncKey
    );
    repairedIds = repairedIds || mergedArticles.didRepairIds;
    user.articles = mergedArticles.entries.map((entry) => sanitizeArticle(entry));
  }

  if (remoteData.updatedAt) {
    user.updatedAt = String(remoteData.updatedAt);
  }
  if (remoteData.lastActivityAt) {
    user.lastActivityAt = String(remoteData.lastActivityAt);
  }
  if (remoteData.lastSeenAt) {
    user.lastSeenAt = String(remoteData.lastSeenAt);
  }
  return { user, repairedIds };
}

async function hydrateUserFromGoogleSheets(store, user) {
  if (!isGoogleSheetsSyncConfigured()) {
    return user;
  }

  try {
    const response = await requestGoogleSheetsSync("getUserData", { username: user.username });
    if (!response?.ok) {
      return user;
    }

    if (!response.data) {
      await syncUserToGoogleSheets(user);
      return user;
    }

    if (remoteDataNeedsBackfill(user, response.data)) {
      await syncUserToGoogleSheets(user);
      return user;
    }

    const shouldRepairRemoteIds = remoteDataHasMissingEntityIds(response.data);
    const applyResult = applyRemoteUserData(user, response.data);
    await writeStore(store);
    if (shouldRepairRemoteIds || applyResult.repairedIds) {
      await syncUserToGoogleSheets(user);
    }
  } catch (error) {
    console.error(`Google-Sheets-Import fehlgeschlagen (${user.username}).`, error);
  }

  return user;
}

async function syncUserToGoogleSheets(user) {
  if (!isGoogleSheetsSyncConfigured()) {
    return;
  }

  try {
    await requestGoogleSheetsSync("upsertUserData", {
      username: user.username,
      data: buildSheetSyncPayload(user)
    });
  } catch (error) {
    console.error(`Google-Sheets-Sync fehlgeschlagen (${user.username}).`, error);
  }
}

function remoteDataNeedsBackfill(user, remoteData = {}) {
  const localCustomerCount = Array.isArray(user?.customers) ? user.customers.length : 0;
  const localArticleCount = Array.isArray(user?.articles) ? user.articles.length : 0;
  const remoteCustomerCount = Array.isArray(remoteData?.customers) ? remoteData.customers.length : 0;
  const remoteArticleCount = Array.isArray(remoteData?.articles) ? remoteData.articles.length : 0;
  const localBusiness = user?.settings?.business || {};
  const remoteBusiness = remoteData?.settings?.business || {};
  const localBusinessFilled = [
    localBusiness.companyName,
    localBusiness.addressLine1,
    localBusiness.postalCode,
    localBusiness.city,
    localBusiness.phone,
    localBusiness.email,
    localBusiness.uid,
    localBusiness.iban,
    localBusiness.bic,
    localBusiness.bankName,
    localBusiness.issuerName
  ].some((value) => String(value || "").trim());
  const remoteBusinessFilled = [
    remoteBusiness.companyName,
    remoteBusiness.addressLine1,
    remoteBusiness.postalCode,
    remoteBusiness.city,
    remoteBusiness.phone,
    remoteBusiness.email,
    remoteBusiness.uid,
    remoteBusiness.iban,
    remoteBusiness.bic,
    remoteBusiness.bankName,
    remoteBusiness.issuerName
  ].some((value) => String(value || "").trim());

  return (
    (localBusinessFilled && !remoteBusinessFilled) ||
    (localCustomerCount > 0 && remoteCustomerCount < localCustomerCount) ||
    (localArticleCount > 0 && remoteArticleCount < localArticleCount)
  );
}

async function backfillImportedUsersToGoogleSheets(store) {
  if (!isGoogleSheetsSyncConfigured()) {
    return;
  }

  if (importedUsersBackfillPromise) {
    return importedUsersBackfillPromise;
  }

  importedUsersBackfillPromise = (async () => {
    const importedUsernames = await getImportedUsernames();

    for (const username of importedUsernames) {
      const user = findUserByUsername(store, username);
      if (!user) {
        continue;
      }

      try {
        const response = await requestGoogleSheetsSync("getUserData", { username });
        if (!response?.ok || !response.data || remoteDataNeedsBackfill(user, response.data)) {
          await syncUserToGoogleSheets(user);
        }
      } catch (error) {
        console.error(`Google-Sheets-Backfill fehlgeschlagen (${username}).`, error);
      }
    }
  })().finally(() => {
    importedUsersBackfillPromise = null;
  });

  return importedUsersBackfillPromise;
}

async function buildAdminUsersResponse(store) {
  const users = buildAdminUsersLocalResponse(store);
  if (!isGoogleSheetsSyncConfigured()) {
    return users;
  }

  try {
    const response = await requestGoogleSheetsSync("listUsers");
    if (!response?.ok || !Array.isArray(response.users)) {
      return users;
    }

    const remoteUsersByName = new Map(
      response.users.map((entry) => [String(entry.username || "").trim().toLowerCase(), entry])
    );

    return users.map((user) => {
      const remoteUser = remoteUsersByName.get(String(user.username || "").trim().toLowerCase());
      if (!remoteUser?.updatedAt) {
        return user;
      }

      return {
        ...user,
        lastOnlineAt: String(remoteUser.lastSeenAt || remoteUser.updatedAt || user.lastOnlineAt || ""),
        schemaVersion: String(remoteUser.schemaVersion || user.schemaVersion || ""),
        migratedToStructuredColumns: Boolean(
          remoteUser.migratedToStructuredColumns || user.migratedToStructuredColumns
        )
      };
    });
  } catch (error) {
    console.error("Google-Sheets-Benutzerliste konnte nicht geladen werden.", error);
    return users;
  }
}

function buildAdminUsersLocalResponse(store) {
  return store.users
    .map((user) =>
      serializeAdminUser(user, {
        lastOnlineAt: user.lastSeenAt || user.lastActivityAt || user.updatedAt
      })
    )
    .sort((left, right) => String(left.username).localeCompare(String(right.username), "de"));
}

function queueGoogleSheetsSync(user) {
  if (!isGoogleSheetsSyncConfigured() || !user?.username) {
    return;
  }

  const username = String(user.username).trim();
  pendingGoogleSheetSyncPayloads.set(username, buildSheetSyncPayload(user));

  if (activeGoogleSheetSyncUsers.has(username)) {
    return;
  }

  activeGoogleSheetSyncUsers.add(username);

  setTimeout(async () => {
    try {
      while (pendingGoogleSheetSyncPayloads.has(username)) {
        const payload = pendingGoogleSheetSyncPayloads.get(username);
        pendingGoogleSheetSyncPayloads.delete(username);

        try {
          await requestGoogleSheetsSync("upsertUserData", {
            username,
            data: payload
          });
        } catch (error) {
          console.error(`Google-Sheets-Hintergrundsync fehlgeschlagen (${username}).`, error);
        }
      }
    } finally {
      activeGoogleSheetSyncUsers.delete(username);
      if (pendingGoogleSheetSyncPayloads.has(username)) {
        queueGoogleSheetsSync(user);
      }
    }
  }, 0);
}

function sanitizeItem(input = {}) {
  const normalizedInput = normalizeLegacyData(input);
  const quantity = Number(normalizedInput.quantity || 0);
  const unitPrice = roundCurrency(normalizedInput.unitPrice || 0);
  const discount = Number(normalizedInput.discount || 0);
  const net = roundCurrency(quantity * unitPrice * Math.max(0, 1 - discount / 100));
  const taxRate = Number(normalizedInput.taxRate || 0);
  const tax = roundCurrency(net * (taxRate / 100));

  return {
    id: normalizedInput.id || crypto.randomUUID(),
    articleId: String(normalizedInput.articleId || ""),
    articleNumber: String(normalizedInput.articleNumber || "").trim(),
    description: String(normalizedInput.description || "").trim(),
    unit: String(normalizedInput.unit || "Stunden").trim(),
    quantity: roundCurrency(quantity),
    unitPrice,
    discount: roundCurrency(discount),
    taxRate,
    net,
    tax,
    gross: roundCurrency(net + tax)
  };
}

function getUserSettingsForClient(user) {
  return {
    ...sanitizeSettings(user.settings),
    auth: {
      username: user.username,
      password: user.settings?.auth?.password || ""
    }
  };
}

function getSessionToken(req) {
  const header = String(req.headers.authorization || "");
  if (header.startsWith("Bearer ")) {
    return header.slice(7).trim();
  }

  const queryToken = req.query?.token;
  if (typeof queryToken === "string") {
    return queryToken.trim();
  }

  return "";
}

function findUserByUsername(store, username) {
  return store.users.find((entry) => entry.username === String(username || "").trim()) || null;
}

function findUserBySession(store, token) {
  const session = store.sessions.find((entry) => entry.token === token);
  if (!session) {
    return { session: null, user: null };
  }

  const user = store.users.find((entry) => entry.id === session.userId) || null;
  return { session, user };
}

function createSession(store, userId) {
  const session = {
    token: crypto.randomUUID(),
    userId,
    createdAt: new Date().toISOString()
  };
  store.sessions.push(session);
  return session;
}

async function requireAuth(req, res, next) {
  try {
    const store = await readStore();
    const token = getSessionToken(req);
    const { session, user } = findUserBySession(store, token);
    if (!session || !user) {
      res.status(401).json({ error: "Bitte neu anmelden." });
      return;
    }

    req.store = store;
    req.user = user;
    req.session = session;
    next();
  } catch (error) {
    next(error);
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.username !== "admin") {
    res.status(403).json({ error: "Nur der Admin darf diese Aktion ausführen." });
    return;
  }

  next();
}

function getDefaultUserPassword(user) {
  return String(user?.settings?.auth?.defaultUserPassword || "admin").trim() || "admin";
}

function serializeAdminUser(user, options = {}) {
  const {
    lastOnlineAt = "",
    schemaVersion = "",
    migratedToStructuredColumns = false
  } = options;
  return {
    id: user.id,
    username: user.username,
    companyName: String(user.settings?.business?.companyName || "").trim(),
    customerCount: Array.isArray(user.customers) ? user.customers.length : 0,
    articleCount: Array.isArray(user.articles) ? user.articles.length : 0,
    invoiceCount: Array.isArray(user.invoices) ? user.invoices.length : 0,
    lastOnlineAt: String(lastOnlineAt || user.lastSeenAt || user.lastActivityAt || user.updatedAt || ""),
    schemaVersion: String(schemaVersion || ""),
    migratedToStructuredColumns: Boolean(migratedToStructuredColumns),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function buildInvoiceNumber(user, issueDate) {
  const issueYear = Number(String(issueDate || "").slice(0, 4)) || new Date().getFullYear();
  if (Number(user.settings.invoice.counterYear) !== issueYear) {
    user.settings.invoice.counterYear = issueYear;
    user.settings.invoice.counterValue = 0;
  }

  user.settings.invoice.counterValue = Number(user.settings.invoice.counterValue || 0) + 1;
  return `${issueYear}-${String(user.settings.invoice.counterValue).padStart(5, "0")}`;
}

function getNextSequentialNumber(entries, fieldName) {
  const maxValue = entries.reduce((max, entry) => {
    const value = Number(entry[fieldName]);
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 10000);

  return String(maxValue + 1);
}

function compileTemplate(template, tokens) {
  return String(template || "").replace(/\{\{(\w+)\}\}/g, (_, key) => tokens[key] ?? "");
}

function getResendSettings(settings) {
  return {
    apiKey: RESEND_API_KEY,
    fromEmail: RESEND_FROM_EMAIL,
    ccEmail: RESEND_CC_EMAIL || settings.email?.ccEmail || settings.business.email,
    replyTo: settings.business.email || "",
    companyName: settings.business.companyName || "RechnungsApp"
  };
}

function splitEmailList(value) {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function isResendConfigured(resendSettings) {
  return Boolean(resendSettings.apiKey && resendSettings.fromEmail);
}

function getLogoFileName(kind) {
  return `${LOGO_KEYS[kind] || kind}.png`;
}

function getLogoPlaceholderPath(kind) {
  return path.join(PUBLIC_ASSET_DIR, kind === "app" ? "app-icon.svg" : "logo-placeholder.svg");
}

function getUserLogoKey(user, kind) {
  if (!user?.id || !LOGO_KEYS[kind]) {
    return "";
  }

  return `assets/${user.id}-${LOGO_KEYS[kind]}.png`;
}

async function readStoredLogo(user, kind) {
  const blobKey = getUserLogoKey(user, kind);
  if (!blobKey) {
    return null;
  }

  const branding = user?.settings?.branding || {};
  const dataUrl =
    kind === "invoice"
      ? String(branding.invoiceLogoDataUrl || "")
      : String(branding.appLogoDataUrl || "");
  if (dataUrl.startsWith("data:image/png;base64,")) {
    try {
      return Buffer.from(dataUrl.split(",")[1] || "", "base64");
    } catch {
      // Fallback auf lokale Datei
    }
  }

  const localPath = path.join(ASSET_STORAGE_DIR, `${user.id}-${getLogoFileName(kind)}`);
  try {
    return await fs.readFile(localPath);
  } catch {
    return null;
  }
}

async function saveLogoAsset(user, kind, imageDataUrl) {
  const blobKey = getUserLogoKey(user, kind);
  if (!blobKey) {
    throw new Error("Unbekannte Logo-Art.");
  }

  if (!String(imageDataUrl || "").startsWith("data:image/png;base64,")) {
    throw new Error("Logo muss als PNG-Bild hochgeladen werden.");
  }

  const imageBuffer = Buffer.from(String(imageDataUrl).split(",")[1] || "", "base64");

  await fs.mkdir(ASSET_STORAGE_DIR, { recursive: true });
  await fs.writeFile(path.join(ASSET_STORAGE_DIR, `${user.id}-${getLogoFileName(kind)}`), imageBuffer);
  user.settings.branding = {
    ...(user.settings.branding || {}),
    [kind === "invoice" ? "hasInvoiceLogo" : "hasAppLogo"]: true,
    ...(kind === "invoice"
      ? { invoiceLogoDataUrl: String(imageDataUrl) }
      : { appLogoDataUrl: String(imageDataUrl) })
  };
}

async function removeLogoAsset(user, kind) {
  const blobKey = getUserLogoKey(user, kind);
  if (!blobKey) {
    throw new Error("Unbekannte Logo-Art.");
  }
  const localPath = path.join(ASSET_STORAGE_DIR, `${user.id}-${getLogoFileName(kind)}`);
  try {
    await fs.unlink(localPath);
  } catch {
    // Datei war lokal nicht vorhanden
  }

  user.settings.branding = {
    ...(user.settings.branding || {}),
    [kind === "invoice" ? "hasInvoiceLogo" : "hasAppLogo"]: false,
    ...(kind === "invoice" ? { invoiceLogoDataUrl: "" } : { appLogoDataUrl: "" })
  };
}

function sanitizeStoredFileInfo(fileInfo) {
  return {
    pdfName: fileInfo.pdfName,
    pdfUrl: fileInfo.pdfUrl,
    pngName: fileInfo.pngName,
    pngUrl: fileInfo.pngUrl
  };
}

function appendTokenToPath(filePath, token) {
  if (!filePath || !token) {
    return filePath || "";
  }

  const url = new URL(filePath, "http://localhost");
  url.searchParams.set("token", token);
  return `${url.pathname}${url.search}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(operation, attempts = 2, delayMs = 150) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await sleep(delayMs);
      }
    }
  }
  throw lastError;
}

function serializeInvoiceForClient(invoice, token) {
  if (!invoice) {
    return invoice;
  }

  const files = invoice.files
    ? {
        ...invoice.files,
        pdfUrl: appendTokenToPath(invoice.files.pdfUrl, token),
        pngUrl: appendTokenToPath(invoice.files.pngUrl, token)
      }
    : invoice.files;

  return {
    ...invoice,
    files
  };
}

async function createInvoiceFiles(user, invoiceNumber, imageDataUrl) {
  if (!imageDataUrl?.startsWith("data:image/png;base64,")) {
    throw new Error("Rechnungsvorschau konnte nicht als PNG übergeben werden.");
  }

  const baseName = `${user.id}_${invoiceNumber}`.replace(/[^a-zA-Z0-9-_]/g, "_");
  const pngName = `${baseName}.png`;
  const pdfName = `${baseName}.pdf`;
  const pngKey = `generated/${pngName}`;
  const pdfKey = `generated/${pdfName}`;
  const pngBase64 = String(imageDataUrl).split(",")[1] || "";
  const pngBuffer = Buffer.from(pngBase64, "base64");
  if (!pngBuffer.length) {
    throw new Error("PNG-Daten der Rechnung sind leer.");
  }

  const pdfBuffer = await withRetry(async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]);
    const image = await pdfDoc.embedPng(pngBuffer);
    const dimensions = image.scaleToFit(page.getWidth(), page.getHeight());
    page.drawImage(image, {
      x: (page.getWidth() - dimensions.width) / 2,
      y: (page.getHeight() - dimensions.height) / 2,
      width: dimensions.width,
      height: dimensions.height
    });

    const pdfBytes = await pdfDoc.save();
    const builtPdfBuffer = Buffer.from(pdfBytes);
    if (!builtPdfBuffer.length) {
      throw new Error("PDF-Daten der Rechnung sind leer.");
    }
    return builtPdfBuffer;
  }, 3, 200);

  await fs.mkdir(GENERATED_DIR, { recursive: true });
  await withRetry(() => fs.writeFile(path.join(GENERATED_DIR, pngName), pngBuffer), 3, 200);
  await withRetry(() => fs.writeFile(path.join(GENERATED_DIR, pdfName), pdfBuffer), 3, 200);

  return {
    pdfName,
    pdfUrl: `/api/files/generated/${pdfName}`,
    pngName,
    pngUrl: `/api/files/generated/${pngName}`,
    pdfBuffer
  };
}

async function rebuildInvoiceFilesFromStoredPng(user, invoice) {
  const storedPngName = String(invoice.files?.pngName || "").trim();
  if (!storedPngName) {
    throw new Error("Für diese Rechnung ist kein Vorschau-PNG vorhanden.");
  }

  const pngBuffer = await readGeneratedFile(storedPngName);
  if (!pngBuffer?.length) {
    throw new Error("Das Vorschau-PNG der Rechnung konnte nicht geladen werden.");
  }

  const pdfBuffer = await withRetry(async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]);
    const image = await pdfDoc.embedPng(pngBuffer);
    const dimensions = image.scaleToFit(page.getWidth(), page.getHeight());
    page.drawImage(image, {
      x: (page.getWidth() - dimensions.width) / 2,
      y: (page.getHeight() - dimensions.height) / 2,
      width: dimensions.width,
      height: dimensions.height
    });

    const pdfBytes = await pdfDoc.save();
    const rebuiltPdfBuffer = Buffer.from(pdfBytes);
    if (!rebuiltPdfBuffer.length) {
      throw new Error("PDF-Daten der Rechnung sind leer.");
    }
    return rebuiltPdfBuffer;
  }, 3, 200);

  const pdfName = `${user.id}_${invoice.invoiceNumber}`.replace(/[^a-zA-Z0-9-_]/g, "_") + ".pdf";
  const pdfKey = `generated/${pdfName}`;

  await fs.mkdir(GENERATED_DIR, { recursive: true });
  await withRetry(() => fs.writeFile(path.join(GENERATED_DIR, pdfName), pdfBuffer), 3, 200);

  return {
    pdfName,
    pdfUrl: `/api/files/generated/${pdfName}`,
    pngName: storedPngName,
    pngUrl: invoice.files?.pngUrl || `/api/files/generated/${storedPngName}`,
    pdfBuffer
  };
}

function getManifestPayload(token = "") {
  const appIconPath = appendTokenToPath("/api/assets/logo/app", token);
  return {
    name: "RechnungsApp",
    short_name: "RechnungsApp",
    lang: "de",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#eaf4ee",
    theme_color: "#3f8a5a",
    description: "Mobile Rechnungs-App für Kunden, Artikel, Vorschau und Versand.",
    icons: [
      {
        src: appIconPath,
        sizes: "1024x1024",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/assets/app-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable"
      }
    ]
  };
}

function findReferencedFile(user, fileName) {
  return user.invoices.find((invoice) => {
    const files = invoice.files || {};
    return [files.pdfName, files.pngName, files.pdfUrl, files.pngUrl].some((value) =>
      String(value || "").includes(fileName)
    );
  });
}

async function readGeneratedFile(fileName) {
  try {
    return await fs.readFile(path.join(GENERATED_DIR, fileName));
  } catch {
    return null;
  }
}

async function sendInvoiceEmail(user, invoice, fileInfo) {
  if (!invoice.customer.email) {
    return {
      status: "skipped",
      message: "Kunde hat keine E-Mail-Adresse hinterlegt."
    };
  }

  const resendSettings = getResendSettings(user.settings);
  if (isResendConfigured(resendSettings)) {
    const tokens = {
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customer.name,
      companyName: user.settings.business.companyName
    };

    const attachments = [];
    if (fileInfo.pdfBuffer) {
      attachments.push({
        filename: `${invoice.invoiceNumber}.pdf`,
        content: fileInfo.pdfBuffer.toString("base64")
      });
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendSettings.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: `"${resendSettings.companyName}" <${resendSettings.fromEmail}>`,
        to: [invoice.customer.email],
        cc: splitEmailList(resendSettings.ccEmail),
        reply_to: resendSettings.replyTo || undefined,
        subject: compileTemplate(user.settings.email.subjectTemplate, tokens),
        text: compileTemplate(user.settings.email.bodyTemplate, tokens),
        attachments
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `Resend-Versand fehlgeschlagen (${response.status})${errorText ? `: ${errorText}` : "."}`
      );
    }

    return {
      status: "sent",
      message: `Rechnung an ${invoice.customer.email} gesendet.`
    };
  }
  return {
    status: "skipped",
    message: "Resend ist nicht vollständig konfiguriert."
  };
}

function buildInvoiceRecord(user, payload) {
  const customerSnapshot = normalizeLegacyData(payload.customer || {});
  const customer =
    user.customers.find((entry) => entry.id === payload.customerId) ||
    user.customers.find(
      (entry) =>
        customerSnapshot.customerNumber &&
        String(entry.customerNumber || "").trim() === String(customerSnapshot.customerNumber || "").trim()
    ) ||
    user.customers.find(
      (entry) =>
        customerSnapshot.email &&
        String(entry.email || "").trim().toLowerCase() === String(customerSnapshot.email || "").trim().toLowerCase()
    ) ||
    user.customers.find(
      (entry) =>
        customerSnapshot.name &&
        String(entry.name || "").trim().toLowerCase() === String(customerSnapshot.name || "").trim().toLowerCase()
    );
  if (!customer) {
    throw new Error("Der ausgewählte Kunde wurde nicht gefunden.");
  }

  const items = Array.isArray(payload.items) ? payload.items.map(sanitizeItem) : [];
  const validItems = items.filter((item) => item.description && item.quantity > 0);
  if (!validItems.length) {
    throw new Error("Mindestens eine gültige Position ist erforderlich.");
  }

  const issueDate = String(payload.issueDate || new Date().toISOString().slice(0, 10));
  const dueDate = String(payload.dueDate || issueDate);
  const subtotal = roundCurrency(validItems.reduce((sum, item) => sum + item.net, 0));
  const taxTotal = roundCurrency(validItems.reduce((sum, item) => sum + item.tax, 0));
  const grossTotal = roundCurrency(subtotal + taxTotal);

  return {
    id: crypto.randomUUID(),
    invoiceNumber: buildInvoiceNumber(user, issueDate),
    title: String(payload.title || user.settings.invoice.title || "Rechnung").trim(),
    reference: String(payload.reference || "").trim(),
    issueDate,
    dueDate,
    notes: String(payload.notes || "").trim(),
    createdAt: new Date().toISOString(),
    customer,
    items: validItems,
    totals: {
      subtotal,
      taxTotal,
      grossTotal
    }
  };
}

app.get("/api/manifest.webmanifest", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.type("application/manifest+json").send(JSON.stringify(getManifestPayload(getSessionToken(req))));
});

app.get("/api/assets/logo/:kind", async (req, res, next) => {
  try {
    const kind = String(req.params.kind || "").trim();
    if (!LOGO_KEYS[kind]) {
      res.status(404).end();
      return;
    }

    let user = null;
    const token = getSessionToken(req);
    if (token) {
      const store = await readStore();
      user = findUserBySession(store, token).user || null;
    }

    const storedLogo = user ? await readStoredLogo(user, kind) : null;
    if (storedLogo) {
      res.setHeader("Cache-Control", "no-store");
      res.type("image/png").send(storedLogo);
      return;
    }

    res.setHeader("Cache-Control", "public, max-age=300");
    res.sendFile(getLogoPlaceholderPath(kind));
  } catch (error) {
    next(error);
  }
});

app.get("/api/files/generated/:fileName", async (req, res, next) => {
  try {
    const fileName = path.basename(String(req.params.fileName || ""));
    if (!fileName) {
      res.status(404).end();
      return;
    }

    const store = await readStore();
    const token = getSessionToken(req);
    const { user } = findUserBySession(store, token);
    if (!user) {
      res.status(401).json({ error: "Bitte neu anmelden." });
      return;
    }

    if (!findReferencedFile(user, fileName)) {
      res.status(404).end();
      return;
    }

    const fileBuffer = await readGeneratedFile(fileName);
    if (!fileBuffer) {
      res.status(404).end();
      return;
    }

    res.setHeader("Cache-Control", "private, no-store");
    res.type(inferMimeType(fileName)).send(fileBuffer);
  } catch (error) {
    next(error);
  }
});

app.get("/api/bootstrap", requireAuth, async (req, res, next) => {
  try {
    const isAdmin = req.user.username === "admin";
    const adminUsers = isAdmin ? await buildAdminUsersResponse(req.store) : [];
    const payload = {
      isAdmin,
      settings: getUserSettingsForClient(req.user),
      customers: isAdmin ? [] : req.user.customers,
      articles: isAdmin ? [] : req.user.articles,
      adminUsers,
      invoices: [...(isAdmin ? [] : req.user.invoices)]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((invoice) => serializeInvoiceForClient(invoice, req.session.token))
    };

    res.json(payload);

    Promise.resolve()
      .then(async () => {
        if (isAdmin) {
          await syncUserToGoogleSheets(req.user);
          await backfillImportedUsersToGoogleSheets(req.store);
          return;
        }

        await hydrateUserFromGoogleSheets(req.store, req.user);
      })
      .catch((error) => {
        console.error(`Hintergrund-Sync fehlgeschlagen (${req.user.username}).`, error);
      });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const store = await readStore();
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");
    const user = findUserByUsername(store, username);

    if (!username || !password || !user || user.passwordHash !== hashPassword(password)) {
      res.status(401).json({ error: "Benutzername oder Kennwort ist nicht korrekt." });
      return;
    }

    markUserSeen(user);
    const session = createSession(store, user.id);
    await writeStore(store);
    queueGoogleSheetsSync(user);
    res.json({ ok: true, username: user.username, token: session.token });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/session", requireAuth, async (req, res, next) => {
  try {
    markUserSeen(req.user);
    await writeStore(req.store);
    queueGoogleSheetsSync(req.user);
    res.json({ ok: true, username: req.user.username });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", requireAuth, async (req, res, next) => {
  try {
    req.store.sessions = req.store.sessions.filter((entry) => entry.token !== req.session.token);
    await writeStore(req.store);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/users", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    res.json({ users: await buildAdminUsersResponse(req.store) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/users", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const username = String(req.body?.username || "")
      .trim()
      .toLowerCase();

    if (!username) {
      res.status(400).json({ error: "Bitte einen Benutzernamen eingeben." });
      return;
    }

    if (!/^[a-z0-9_]+$/i.test(username)) {
      res.status(400).json({ error: "Benutzernamen bitte nur mit Buchstaben, Zahlen und Unterstrich anlegen." });
      return;
    }

    if (findUserByUsername(req.store, username)) {
      res.status(409).json({ error: "Dieser Benutzername ist bereits vorhanden." });
      return;
    }

    const requestedDefaultPassword = String(req.body?.defaultPassword || "").trim();
    const defaultPassword = requestedDefaultPassword || getDefaultUserPassword(req.user);
    req.user.settings.auth = {
      ...req.user.settings.auth,
      username: req.user.username,
      password: req.user.settings.auth?.password || defaultPassword,
      defaultUserPassword: defaultPassword,
      adminPasswordVersion: 1
    };
    markUserActivity(req.user);
    const newUser = createUserRecord({
      username,
      password: defaultPassword,
      settings: {
        auth: {
          defaultUserPassword: "admin"
        }
      }
    });

    req.store.users.push(newUser);
    await writeStore(req.store);
    queueGoogleSheetsSync(req.user);
    queueGoogleSheetsSync(newUser);

    res.status(201).json({
      user: serializeAdminUser(newUser),
      users: await buildAdminUsersResponse(req.store),
      settings: getUserSettingsForClient(req.user),
      defaultUserPassword: defaultPassword
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/users/:username/reset-password", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const username = String(req.params.username || "").trim().toLowerCase();
    if (username === "admin") {
      res.status(400).json({ error: "Das Admin-Passwort bitte nur in den Einstellungen ändern." });
      return;
    }

    const user = findUserByUsername(req.store, username);
    if (!user) {
      res.status(404).json({ error: "Benutzer wurde nicht gefunden." });
      return;
    }

    const defaultPassword = getDefaultUserPassword(req.user);
    user.passwordHash = hashPassword(defaultPassword);
    user.settings.auth = {
      ...user.settings.auth,
      username: user.username,
      password: defaultPassword
    };
    markUserUpdated(user);

    await writeStore(req.store);
    queueGoogleSheetsSync(user);

    res.json({
      ok: true,
      message: `Passwort von ${user.username} wurde auf ${defaultPassword} zurückgesetzt.`,
      users: await buildAdminUsersResponse(req.store)
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/password", requireAuth, async (req, res, next) => {
  try {
    const password = String(req.body?.password || "");
    if (!password.trim()) {
      res.status(400).json({ error: "Bitte ein neues Kennwort eingeben." });
      return;
    }

    req.user.passwordHash = hashPassword(password);
    req.user.settings.auth = {
      ...req.user.settings.auth,
      username: req.user.username,
      password,
      adminPasswordVersion: req.user.username === "admin" ? 1 : Number(req.user.settings.auth?.adminPasswordVersion || 0)
    };
    markUserActivity(req.user);

    await writeStore(req.store);
    queueGoogleSheetsSync(req.user);

    res.json({
      ok: true,
      settings: getUserSettingsForClient(req.user)
    });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/users/:username", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const username = String(req.params.username || "").trim().toLowerCase();
    if (username === "admin") {
      res.status(400).json({ error: "Der Admin-Benutzer kann nicht gelöscht werden." });
      return;
    }

    const user = findUserByUsername(req.store, username);
    if (!user) {
      res.status(404).json({ error: "Benutzer wurde nicht gefunden." });
      return;
    }

    req.store.users = req.store.users.filter((entry) => entry.id !== user.id);
    req.store.sessions = req.store.sessions.filter((entry) => entry.userId !== user.id);
    await writeStore(req.store);

    if (isGoogleSheetsSyncConfigured()) {
      try {
        await requestGoogleSheetsSync("deleteUserData", { username: user.username });
      } catch (error) {
        console.error(`Google-Sheets-Löschen fehlgeschlagen (${user.username}).`, error);
      }
    }

    res.json({
      ok: true,
      message: `Benutzer ${user.username} wurde gelöscht.`,
      users: await buildAdminUsersResponse(req.store)
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/default-password", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const password = String(req.body?.password || "").trim();
    if (!password) {
      res.status(400).json({ error: "Bitte ein Standardkennwort eingeben." });
      return;
    }

    req.user.settings.auth = {
      ...req.user.settings.auth,
      username: req.user.username,
      password: req.user.settings.auth?.password || password,
      defaultUserPassword: password,
      adminPasswordVersion: 1
    };
    markUserActivity(req.user);

    await writeStore(req.store);
    queueGoogleSheetsSync(req.user);

    res.json({
      ok: true,
      settings: getUserSettingsForClient(req.user),
      message: `Standardkennwort wurde auf ${password} gesetzt.`
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/assets/logo", requireAuth, async (req, res, next) => {
  try {
    await saveLogoAsset(req.user, String(req.body?.kind || "").trim(), req.body?.imageDataUrl);
    markUserActivity(req.user);
    await writeStore(req.store);
    queueGoogleSheetsSync(req.user);
    res.status(201).json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/assets/logo/:kind", requireAuth, async (req, res, next) => {
  try {
    await removeLogoAsset(req.user, String(req.params.kind || "").trim());
    markUserActivity(req.user);
    await writeStore(req.store);
    queueGoogleSheetsSync(req.user);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.put("/api/settings", requireAuth, async (req, res, next) => {
  try {
    const incoming = req.body?.settings || {};
    const currentUser = req.user;

    currentUser.settings.business = {
      ...currentUser.settings.business,
      ...(incoming.business || {})
    };
    currentUser.settings.email = {
      ...currentUser.settings.email,
      ...(incoming.email || {})
    };
    currentUser.settings.auth = {
      ...currentUser.settings.auth,
      username: currentUser.username,
      password: incoming.auth?.password
        ? String(incoming.auth.password)
        : currentUser.settings.auth?.password || "admin",
      defaultUserPassword: String(currentUser.settings.auth?.defaultUserPassword || "admin"),
      adminPasswordVersion:
        currentUser.username === "admin" ? 1 : Number(currentUser.settings.auth?.adminPasswordVersion || 0)
    };
    currentUser.settings.invoice = {
      ...currentUser.settings.invoice,
      ...(incoming.invoice || {})
    };

    currentUser.settings.invoice.counterYear =
      Number(currentUser.settings.invoice.counterYear) || new Date().getFullYear();
    currentUser.settings.invoice.counterValue = Number(currentUser.settings.invoice.counterValue) || 0;
    if (incoming.auth?.password) {
      currentUser.passwordHash = hashPassword(String(incoming.auth.password));
    }
    markUserActivity(currentUser);

    await writeStore(req.store);
    queueGoogleSheetsSync(currentUser);
    res.json({ settings: getUserSettingsForClient(currentUser) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/customers", requireAuth, async (req, res, next) => {
  try {
    const customer = sanitizeCustomer(req.body?.customer || req.body);
    if (!customer.customerNumber) {
      customer.customerNumber = getNextSequentialNumber(req.user.customers, "customerNumber");
    }
    if (!customer.name) {
      res.status(400).json({ error: "Kundenname ist erforderlich." });
      return;
    }

    req.user.customers.push(customer);
    markUserActivity(req.user);
    await writeStore(req.store);
    queueGoogleSheetsSync(req.user);
    res.status(201).json({ customer });
  } catch (error) {
    next(error);
  }
});

app.put("/api/customers/:id", requireAuth, async (req, res, next) => {
  try {
    const customerInput = req.body?.customer || req.body;
    const index = findCustomerIndexByIdOrPayload(req.user.customers, req.params.id, customerInput);
    if (index === -1) {
      res.status(404).json({ error: "Kunde nicht gefunden." });
      return;
    }

    req.user.customers[index] = sanitizeCustomer({
      ...req.user.customers[index],
      ...customerInput,
      id: req.user.customers[index].id
    });
    markUserActivity(req.user);
    await writeStore(req.store);
    queueGoogleSheetsSync(req.user);
    res.json({ customer: req.user.customers[index] });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/customers/:id", requireAuth, async (req, res, next) => {
  try {
    req.user.customers = req.user.customers.filter((entry) => entry.id !== req.params.id);
    markUserActivity(req.user);
    await writeStore(req.store);
    queueGoogleSheetsSync(req.user);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.post("/api/articles", requireAuth, async (req, res, next) => {
  try {
    const article = sanitizeArticle(req.body?.article || req.body);
    if (!article.number) {
      article.number = getNextSequentialNumber(req.user.articles, "number");
    }
    if (!article.name) {
      res.status(400).json({ error: "Artikelname ist erforderlich." });
      return;
    }

    req.user.articles.push(article);
    markUserActivity(req.user);
    await writeStore(req.store);
    queueGoogleSheetsSync(req.user);
    res.status(201).json({ article });
  } catch (error) {
    next(error);
  }
});

app.put("/api/articles/:id", requireAuth, async (req, res, next) => {
  try {
    const index = req.user.articles.findIndex((entry) => entry.id === req.params.id);
    if (index === -1) {
      res.status(404).json({ error: "Artikel nicht gefunden." });
      return;
    }

    req.user.articles[index] = sanitizeArticle({
      ...req.user.articles[index],
      ...(req.body?.article || req.body),
      id: req.params.id
    });
    markUserActivity(req.user);
    await writeStore(req.store);
    queueGoogleSheetsSync(req.user);
    res.json({ article: req.user.articles[index] });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/articles/:id", requireAuth, async (req, res, next) => {
  try {
    req.user.articles = req.user.articles.filter((entry) => entry.id !== req.params.id);
    markUserActivity(req.user);
    await writeStore(req.store);
    queueGoogleSheetsSync(req.user);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.post("/api/invoices", requireAuth, async (req, res, next) => {
  try {
    const invoice = buildInvoiceRecord(req.user, req.body || {});
    const fileInfo = await createInvoiceFiles(req.user, invoice.invoiceNumber, req.body?.imageDataUrl);
    invoice.files = sanitizeStoredFileInfo(fileInfo);

    const deliveryMethod = String(req.body?.deliveryMethod || "").trim();
    let emailResult;
    if (deliveryMethod === "external-app" && !isResendConfigured(getResendSettings(req.user.settings))) {
      emailResult = {
        status: "external-app",
        message: "Rechnung erstellt. Die Mail-App kann jetzt geöffnet werden."
      };
    } else if (deliveryMethod === "share-preview") {
      emailResult = {
        status: "share-preview",
        message: "Rechnung erstellt und zum Teilen vorbereitet."
      };
    } else {
      try {
        emailResult = await sendInvoiceEmail(req.user, invoice, fileInfo);
      } catch (error) {
        emailResult = {
          status: "failed",
          message: error.message || "Mailversand fehlgeschlagen."
        };
      }
    }

    invoice.email = emailResult;
    req.user.invoices.unshift(invoice);
    markUserActivity(req.user);
    await writeStore(req.store);

    res.status(201).json({
      invoice: serializeInvoiceForClient(invoice, req.session.token),
      email: emailResult,
      settings: getUserSettingsForClient(req.user)
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/invoices/share-preview", requireAuth, async (req, res, next) => {
  try {
    const invoice = buildInvoiceRecord(req.user, req.body || {});
    const fileInfo = await createInvoiceFiles(req.user, invoice.invoiceNumber, req.body?.imageDataUrl);
    invoice.files = sanitizeStoredFileInfo(fileInfo);
    invoice.email = {
      status: "share-preview",
      message: "Rechnung erstellt und zum Teilen vorbereitet."
    };

    req.user.invoices.unshift(invoice);
    markUserActivity(req.user);
    await writeStore(req.store);

    res.status(201).json({
      invoice: serializeInvoiceForClient(invoice, req.session.token),
      email: invoice.email,
      settings: getUserSettingsForClient(req.user)
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/invoices/:id/resend", requireAuth, async (req, res, next) => {
  try {
    const invoice = req.user.invoices.find((entry) => entry.id === req.params.id);
    if (!invoice) {
      res.status(404).json({ error: "Rechnung nicht gefunden." });
      return;
    }

    const fileInfo = await rebuildInvoiceFilesFromStoredPng(req.user, invoice);
    invoice.files = sanitizeStoredFileInfo(fileInfo);

    const deliveryMethod = String(req.body?.deliveryMethod || "").trim();
    let emailResult;
    if (deliveryMethod === "external-app" && !isResendConfigured(getResendSettings(req.user.settings))) {
      if (!invoice.customer?.email) {
        emailResult = {
          status: "skipped",
          message: "Kunde hat keine E-Mail-Adresse hinterlegt."
        };
      } else {
        emailResult = {
          status: "external-app",
          message: "Rechnung wurde erneut vorbereitet. Die Mail-App kann jetzt geöffnet werden."
        };
      }
    } else {
      try {
        emailResult = await sendInvoiceEmail(req.user, invoice, fileInfo);
      } catch (error) {
        emailResult = {
          status: "failed",
          message: error.message || "Mailversand fehlgeschlagen."
        };
      }
    }

    invoice.email = emailResult;
    markUserActivity(req.user);
    await writeStore(req.store);

    res.json({
      invoice: serializeInvoiceForClient(invoice, req.session.token),
      email: emailResult
    });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({
    error: error.message || "Unerwarteter Serverfehler."
  });
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "billingapp",
    storageRoot: STORAGE_ROOT,
    cloudRun: IS_CLOUD_RUN
  });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

export { app, ensureDataFiles };

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isDirectRun) {
  await ensureDataFiles();
  app.listen(PORT, HOST, () => {
    const interfaces = os.networkInterfaces();
    const urls = [`http://localhost:${PORT}`];

    Object.values(interfaces)
      .flat()
      .filter((entry) => entry && entry.family === "IPv4" && !entry.internal)
      .forEach((entry) => {
        urls.push(`http://${entry.address}:${PORT}`);
      });

    console.log("billingapp laeuft unter:");
    urls.forEach((url) => console.log(`- ${url}`));
  });
}







