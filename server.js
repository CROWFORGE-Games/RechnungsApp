import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";
import nodemailer from "nodemailer";
import { PDFDocument } from "pdf-lib";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, "public");
const PUBLIC_ASSET_DIR = path.join(PUBLIC_DIR, "assets");
const IS_NETLIFY = process.env.NETLIFY === "true";
const STORAGE_ROOT = process.env.STORAGE_DIR
  ? path.resolve(process.env.STORAGE_DIR)
  : IS_NETLIFY
    ? path.join(os.tmpdir(), "rechnungsapp")
    : path.join(__dirname, "data");
const DATA_FILE = path.join(STORAGE_ROOT, "store.json");
const GENERATED_DIR = path.join(STORAGE_ROOT, "generated");
const ASSET_STORAGE_DIR = path.join(STORAGE_ROOT, "assets");
const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 3000);
const GOOGLE_SHEETS_WEBAPP_URL = String(process.env.GOOGLE_SHEETS_WEBAPP_URL || "").trim();
const GOOGLE_SHEETS_WEBAPP_SECRET = String(process.env.GOOGLE_SHEETS_WEBAPP_SECRET || "").trim();
const BLOB_STORE_NAME = "rechnungsapp";
const STORE_BLOB_KEY = "store.json";
const LOGO_KEYS = {
  invoice: "assets/KaindlBanner.png",
  app: "assets/KaindlLogo.png"
};
const PRESET_USERS = [
  { username: "admin", password: "admin" },
  { username: "kaindl_daniel", password: "admin" }
];

function createAdminSeedPayload() {
  return {
    settings: {
      business: {
        companyName: "Testfirma",
        senderLine: "Abs.: Testfirma | Musterstraße 1 | 6335 Thiersee",
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
      smtp: {
        enabled: false,
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        user: "",
        pass: "",
        fromEmail: "",
        ccEmail: "mathias.mairhofer@gmail.com"
      },
      invoice: {
        title: "Rechnung",
        counterYear: new Date().getFullYear(),
        counterValue: 0
      },
      email: {
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

const DEFAULT_STORE = {
  settings: {
    business: {
      companyName: "",
      senderLine: "",
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
    smtp: {
      enabled: false,
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      user: "",
      pass: "",
      fromEmail: "",
      ccEmail: ""
    },
    auth: {
      username: "admin",
      password: "admin"
    },
    invoice: {
      title: "Rechnung",
      counterYear: new Date().getFullYear(),
      counterValue: 0
    },
    email: {
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
  smtp: { ...DEFAULT_STORE.settings.smtp },
  invoice: { ...DEFAULT_STORE.settings.invoice },
  email: { ...DEFAULT_STORE.settings.email }
};

function isGoogleSheetsSyncConfigured() {
  return Boolean(GOOGLE_SHEETS_WEBAPP_URL && GOOGLE_SHEETS_WEBAPP_SECRET);
}

const app = express();
app.use(express.json({ limit: "20mb" }));
app.use(express.static(PUBLIC_DIR));

let blobStoreCache = null;
let blobStoreFactoryPromise = null;
const pendingGoogleSheetSyncPayloads = new Map();
const activeGoogleSheetSyncUsers = new Set();

async function getAppBlobStore() {
  if (!IS_NETLIFY) {
    return null;
  }

  if (!blobStoreFactoryPromise) {
    blobStoreFactoryPromise = import("@netlify/blobs")
      .then((module) => module.getStore)
      .catch((error) => {
        console.error("Netlify Blobs Paket konnte nicht geladen werden.", error);
        return null;
      });
  }

  const getBlobStore = await blobStoreFactoryPromise;
  if (!getBlobStore) {
    return null;
  }

  try {
    if (!blobStoreCache) {
      blobStoreCache = getBlobStore(BLOB_STORE_NAME);
    }
  } catch (error) {
    console.error("Netlify Blobs konnten nicht initialisiert werden.", error);
    return null;
  }

  return blobStoreCache;
}

function roundCurrency(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(String(password || "")).digest("hex");
}

function mergeSettings(raw = {}) {
  return {
    business: {
      ...DEFAULT_SETTINGS.business,
      ...(raw.business || {})
    },
    smtp: {
      ...DEFAULT_SETTINGS.smtp,
      ...(raw.smtp || {})
    },
    invoice: {
      ...DEFAULT_SETTINGS.invoice,
      ...(raw.invoice || {})
    },
    email: {
      ...DEFAULT_SETTINGS.email,
      ...(raw.email || {})
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
  updatedAt
} = {}) {
  return {
    id: id || crypto.randomUUID(),
    username: String(username || "").trim() || "admin",
    passwordHash: passwordHash || hashPassword(password),
    settings: mergeSettings(settings),
    customers: Array.isArray(customers) ? customers : [],
    articles: Array.isArray(articles) ? articles : [],
    invoices: Array.isArray(invoices) ? invoices : [],
    createdAt: createdAt || new Date().toISOString(),
    updatedAt: updatedAt || new Date().toISOString()
  };
}

function applySeedDataIfNeeded(user) {
  if (user.username !== "admin") {
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

  const seed = createAdminSeedPayload();
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
      normalizedUsers[existingIndex] = applySeedDataIfNeeded(createUserRecord({
        ...normalizedUsers[existingIndex],
        username,
        passwordHash: hashPassword(password)
      }));
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
      smtp: legacySettings.smtp,
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

function toArrayBuffer(value) {
  if (value instanceof ArrayBuffer) {
    return value;
  }

  const buffer = value instanceof Uint8Array ? value : Buffer.from(value);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

async function readBlobJson(key) {
  const store = await getAppBlobStore();
  if (!store) {
    return null;
  }
  try {
    return await store.get(key, { type: "json" });
  } catch (error) {
    console.error(`Blob-Lesen fehlgeschlagen (${key}).`, error);
    return null;
  }
}

async function writeBlobJson(key, value) {
  const store = await getAppBlobStore();
  if (!store) {
    return false;
  }

  try {
    await store.set(key, JSON.stringify(value, null, 2), {
      metadata: { contentType: "application/json; charset=utf-8" }
    });
    return true;
  } catch (error) {
    console.error(`Blob-Schreiben fehlgeschlagen (${key}).`, error);
    return false;
  }
}

async function readBlobBinary(key) {
  const store = await getAppBlobStore();
  if (!store) {
    return null;
  }

  try {
    const data = await store.get(key, { type: "arrayBuffer" });
    return data ? Buffer.from(data) : null;
  } catch (error) {
    console.error(`Blob-Binärlesen fehlgeschlagen (${key}).`, error);
    return null;
  }
}

async function writeBlobBinary(key, value, contentType) {
  const store = await getAppBlobStore();
  if (!store) {
    return false;
  }

  try {
    await store.set(key, toArrayBuffer(value), {
      metadata: { contentType }
    });
    return true;
  } catch (error) {
    console.error(`Blob-Binärschreiben fehlgeschlagen (${key}).`, error);
    return false;
  }
}

async function ensureDataFiles() {
  if (IS_NETLIFY) {
    const existing = await readBlobJson(STORE_BLOB_KEY);
    if (existing) {
      return;
    }

    const storedInBlobs = await writeBlobJson(STORE_BLOB_KEY, createInitialStore());
    if (storedInBlobs) {
      return;
    }
  }

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

  if (IS_NETLIFY) {
    const raw = await readBlobJson(STORE_BLOB_KEY);
    if (raw) {
      return mergeStore(raw);
    }
  }

  const raw = await fs.readFile(DATA_FILE, "utf8");
  const normalizedRaw = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  return mergeStore(JSON.parse(normalizedRaw));
}

async function writeStore(store) {
  if (IS_NETLIFY) {
    const storedInBlobs = await writeBlobJson(STORE_BLOB_KEY, store);
    if (storedInBlobs) {
      return;
    }
  }

  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
}

function sanitizeSettings(settings) {
  return {
    business: settings.business,
    smtp: {
      enabled: Boolean(settings.smtp.enabled),
      host: settings.smtp.host,
      port: Number(settings.smtp.port) || 587,
      secure: Boolean(settings.smtp.secure),
      user: settings.smtp.user,
      pass: settings.smtp.pass,
      ccEmail: settings.smtp.ccEmail,
      smtpPassConfigured: Boolean(settings.smtp.pass)
    },
    auth: {
      username: ""
    },
    invoice: {
      title: settings.invoice.title,
      counterYear: Number(settings.invoice.counterYear) || new Date().getFullYear(),
      counterValue: Number(settings.invoice.counterValue) || 0
    },
    email: settings.email
  };
}

function sanitizeCustomer(input = {}) {
  return {
    id: input.id || crypto.randomUUID(),
    customerNumber: String(input.customerNumber || "").trim(),
    name: String(input.name || "").trim(),
    contactPerson: String(input.contactPerson || "").trim(),
    street: String(input.street || "").trim(),
    postalCode: String(input.postalCode || "").trim(),
    city: String(input.city || "").trim(),
    country: String(input.country || "").trim(),
    phone: String(input.phone || "").trim(),
    email: String(input.email || "").trim(),
    uid: String(input.uid || "").trim(),
    notes: String(input.notes || "").trim()
  };
}

function sanitizeArticle(input = {}) {
  return {
    id: input.id || crypto.randomUUID(),
    group: String(input.group || "").trim(),
    number: String(input.number || "").trim(),
    name: String(input.name || "").trim(),
    description: String(input.description || "").trim(),
    unit: String(input.unit || "Stunden").trim(),
    unitPrice: roundCurrency(input.unitPrice || 0),
    taxRate: Number(input.taxRate ?? 20)
  };
}

function buildSheetSyncPayload(user) {
  return {
    username: user.username,
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

function applyRemoteUserData(user, remoteData = {}) {
  if (!remoteData || typeof remoteData !== "object") {
    return user;
  }

  if (remoteData.settings) {
    user.settings = mergeSettings(remoteData.settings);
  }

  if (Array.isArray(remoteData.customers)) {
    user.customers = remoteData.customers.map((entry) => sanitizeCustomer(entry));
  }

  if (Array.isArray(remoteData.articles)) {
    user.articles = remoteData.articles.map((entry) => sanitizeArticle(entry));
  }

  user.updatedAt = new Date().toISOString();
  return user;
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

    applyRemoteUserData(user, response.data);
    await writeStore(store);
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
  const quantity = Number(input.quantity || 0);
  const unitPrice = roundCurrency(input.unitPrice || 0);
  const discount = Number(input.discount || 0);
  const net = roundCurrency(quantity * unitPrice * Math.max(0, 1 - discount / 100));
  const taxRate = Number(input.taxRate || 0);
  const tax = roundCurrency(net * (taxRate / 100));

  return {
    id: input.id || crypto.randomUUID(),
    articleId: String(input.articleId || ""),
    articleNumber: String(input.articleNumber || "").trim(),
    description: String(input.description || "").trim(),
    unit: String(input.unit || "Stunden").trim(),
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
      username: user.username
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

function getMailSettings(settings) {
  return {
    enabled: Boolean(settings.smtp.enabled),
    host: process.env.SMTP_HOST || settings.smtp.host,
    port: Number(process.env.SMTP_PORT || settings.smtp.port || 587),
    secure:
      String(process.env.SMTP_SECURE || settings.smtp.secure || "false").toLowerCase() === "true",
    user: process.env.SMTP_USER || settings.smtp.user,
    pass: process.env.SMTP_PASS || settings.smtp.pass,
    fromEmail: process.env.SMTP_FROM || settings.smtp.user || settings.business.email,
    ccEmail: process.env.SMTP_CC || settings.smtp.ccEmail || settings.business.email
  };
}

function isMailConfigured(mailSettings) {
  return Boolean(
    mailSettings.enabled &&
      mailSettings.host &&
      mailSettings.port &&
      mailSettings.user &&
      mailSettings.pass
  );
}

function getLogoFileName(kind) {
  return path.basename(LOGO_KEYS[kind] || "");
}

function getLogoFallbackPath(kind) {
  if (kind === "app") {
    return path.join(PUBLIC_ASSET_DIR, "app-maskable.svg");
  }

  const fileName = getLogoFileName(kind);
  return fileName ? path.join(PUBLIC_ASSET_DIR, fileName) : path.join(PUBLIC_ASSET_DIR, "app-maskable.svg");
}

async function readStoredLogo(kind) {
  const blobKey = LOGO_KEYS[kind];
  if (!blobKey) {
    return null;
  }

  if (IS_NETLIFY) {
    const blob = await readBlobBinary(blobKey);
    if (blob) {
      return blob;
    }
  }

  const localPath = path.join(ASSET_STORAGE_DIR, getLogoFileName(kind));
  try {
    return await fs.readFile(localPath);
  } catch {
    return null;
  }
}

async function saveLogoAsset(kind, imageDataUrl) {
  const blobKey = LOGO_KEYS[kind];
  if (!blobKey) {
    throw new Error("Unbekannte Logo-Art.");
  }

  if (!String(imageDataUrl || "").startsWith("data:image/png;base64,")) {
    throw new Error("Logo muss als PNG-Bild hochgeladen werden.");
  }

  const imageBuffer = Buffer.from(String(imageDataUrl).split(",")[1] || "", "base64");

  if (IS_NETLIFY) {
    const storedInBlobs = await writeBlobBinary(blobKey, imageBuffer, "image/png");
    if (storedInBlobs) {
      return;
    }
  }

  await fs.mkdir(ASSET_STORAGE_DIR, { recursive: true });
  await fs.writeFile(path.join(ASSET_STORAGE_DIR, getLogoFileName(kind)), imageBuffer);
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

  if (IS_NETLIFY) {
    const pngStored = await withRetry(() => writeBlobBinary(pngKey, pngBuffer, "image/png"), 3, 200);
    const pdfStored = await withRetry(
      () => writeBlobBinary(pdfKey, pdfBuffer, "application/pdf"),
      3,
      200
    );
    if (pngStored && pdfStored) {
      return {
        pdfName,
        pdfUrl: `/api/files/generated/${pdfName}`,
        pngName,
        pngUrl: `/api/files/generated/${pngName}`,
        pdfBuffer
      };
    }
  }

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

function getManifestPayload() {
  return {
    name: "Rechnungen",
    short_name: "Rechnungen",
    lang: "de",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#eaf4ee",
    theme_color: "#3f8a5a",
    description: "Mobile Rechnungs-App für Kunden, Leistungen, Vorschau und Versand.",
    icons: [
      {
        src: "/api/assets/logo/app",
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
  if (IS_NETLIFY) {
    const blob = await readBlobBinary(`generated/${fileName}`);
    if (blob) {
      return blob;
    }
  }

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

  const mailSettings = getMailSettings(user.settings);
  if (!isMailConfigured(mailSettings)) {
    return {
      status: "skipped",
      message: "SMTP ist noch nicht vollständig konfiguriert."
    };
  }

  const transport = nodemailer.createTransport({
    host: mailSettings.host,
    port: mailSettings.port,
    secure: mailSettings.secure,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    auth: {
      user: mailSettings.user,
      pass: mailSettings.pass
    }
  });

  const tokens = {
    invoiceNumber: invoice.invoiceNumber,
    customerName: invoice.customer.name,
    companyName: user.settings.business.companyName
  };

  const attachments = [];
  if (fileInfo.pdfBuffer) {
    attachments.push({
      filename: `${invoice.invoiceNumber}.pdf`,
      content: fileInfo.pdfBuffer,
      contentType: "application/pdf"
    });
  }

  await transport.sendMail({
    from: `"${user.settings.business.companyName || "Rechnungs-App"}" <${mailSettings.fromEmail}>`,
    to: invoice.customer.email,
    cc: mailSettings.ccEmail || undefined,
    subject: compileTemplate(user.settings.email.subjectTemplate, tokens),
    text: compileTemplate(user.settings.email.bodyTemplate, tokens),
    attachments
  });

  return {
    status: "sent",
    message: `Rechnung an ${invoice.customer.email} gesendet.`
  };
}

function buildInvoiceRecord(user, payload) {
  const customer = user.customers.find((entry) => entry.id === payload.customerId);
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

app.get("/api/manifest.webmanifest", (_req, res) => {
  res.type("application/manifest+json").send(JSON.stringify(getManifestPayload()));
});

app.get("/api/assets/logo/:kind", async (req, res, next) => {
  try {
    const kind = String(req.params.kind || "").trim();
    if (!LOGO_KEYS[kind]) {
      res.status(404).end();
      return;
    }

    const storedLogo = await readStoredLogo(kind);
    if (storedLogo) {
      res.setHeader("Cache-Control", "no-store");
      res.type("image/png").send(storedLogo);
      return;
    }

    res.setHeader("Cache-Control", "public, max-age=300");
    const preferredFallback = getLogoFallbackPath(kind);
    try {
      await fs.access(preferredFallback);
      res.sendFile(preferredFallback);
      return;
    } catch {
      res.sendFile(path.join(PUBLIC_ASSET_DIR, "app-maskable.svg"));
    }
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
    await hydrateUserFromGoogleSheets(req.store, req.user);
    res.json({
      settings: getUserSettingsForClient(req.user),
      customers: req.user.customers,
      articles: req.user.articles,
      invoices: [...req.user.invoices]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((invoice) => serializeInvoiceForClient(invoice, req.session.token))
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

    const session = createSession(store, user.id);
    await writeStore(store);
    res.json({ ok: true, username: user.username, token: session.token });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/register", async (req, res, next) => {
  try {
    res.status(403).json({
      error: "Neue Benutzer werden derzeit nicht direkt in der App angelegt."
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/session", requireAuth, async (req, res, next) => {
  try {
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

app.post("/api/assets/logo", requireAuth, async (req, res, next) => {
  try {
    await saveLogoAsset(String(req.body?.kind || "").trim(), req.body?.imageDataUrl);
    res.status(201).json({ ok: true });
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
    currentUser.settings.invoice = {
      ...currentUser.settings.invoice,
      ...(incoming.invoice || {})
    };

    const currentPass = currentUser.settings.smtp.pass;
    currentUser.settings.smtp = {
      ...currentUser.settings.smtp,
      ...(incoming.smtp || {})
    };
    if (!incoming.smtp?.pass) {
      currentUser.settings.smtp.pass = currentPass;
    }

    currentUser.settings.smtp.port = Number(currentUser.settings.smtp.port || 587);
    currentUser.settings.invoice.counterYear =
      Number(currentUser.settings.invoice.counterYear) || new Date().getFullYear();
    currentUser.settings.invoice.counterValue = Number(currentUser.settings.invoice.counterValue) || 0;
    currentUser.updatedAt = new Date().toISOString();

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
    req.user.updatedAt = new Date().toISOString();
    await writeStore(req.store);
    queueGoogleSheetsSync(req.user);
    res.status(201).json({ customer });
  } catch (error) {
    next(error);
  }
});

app.put("/api/customers/:id", requireAuth, async (req, res, next) => {
  try {
    const index = req.user.customers.findIndex((entry) => entry.id === req.params.id);
    if (index === -1) {
      res.status(404).json({ error: "Kunde nicht gefunden." });
      return;
    }

    req.user.customers[index] = sanitizeCustomer({
      ...req.user.customers[index],
      ...(req.body?.customer || req.body),
      id: req.params.id
    });
    req.user.updatedAt = new Date().toISOString();
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
    req.user.updatedAt = new Date().toISOString();
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
    req.user.updatedAt = new Date().toISOString();
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
    req.user.updatedAt = new Date().toISOString();
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
    req.user.updatedAt = new Date().toISOString();
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
    if (deliveryMethod === "external-app") {
      emailResult = {
        status: "external-app",
        message: "Rechnung erstellt. Die Mail-App kann jetzt geöffnet werden."
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
    req.user.updatedAt = new Date().toISOString();
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

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({
    error: error.message || "Unerwarteter Serverfehler."
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

    console.log("RechnungsApp läuft unter:");
    urls.forEach((url) => console.log(`- ${url}`));
  });
}
