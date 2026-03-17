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
const STORAGE_ROOT = process.env.STORAGE_DIR
  ? path.resolve(process.env.STORAGE_DIR)
  : path.join(__dirname, "data");
const DATA_FILE = process.env.STORAGE_DIR
  ? path.join(STORAGE_ROOT, "store.json")
  : path.join(__dirname, "data", "store.json");
const GENERATED_DIR = process.env.STORAGE_DIR
  ? path.join(STORAGE_ROOT, "generated")
  : path.join(__dirname, "generated");
const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 3000);

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
      host: "",
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

const app = express();
app.use(express.json({ limit: "20mb" }));
app.use("/generated", express.static(GENERATED_DIR));
app.use(express.static(PUBLIC_DIR));

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

function mergeStore(raw = {}) {
  if (Array.isArray(raw.users)) {
    return {
      users: raw.users.map((user) => createUserRecord(user)),
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
    users: [migratedUser],
    sessions: []
  };
}

async function ensureDataFiles() {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.mkdir(GENERATED_DIR, { recursive: true });

  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(
      DATA_FILE,
      JSON.stringify(
        {
          users: [createUserRecord({ username: "admin", password: "admin" })],
          sessions: []
        },
        null,
        2
      ),
      "utf8"
    );
  }
}

async function readStore() {
  await ensureDataFiles();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  return mergeStore(JSON.parse(raw));
}

async function writeStore(store) {
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
}

function sanitizeSettings(settings) {
  return {
    business: settings.business,
    smtp: {
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
    host: process.env.SMTP_HOST || settings.smtp.host,
    port: Number(process.env.SMTP_PORT || settings.smtp.port || 587),
    secure:
      String(process.env.SMTP_SECURE || settings.smtp.secure || "false").toLowerCase() === "true",
    user: process.env.SMTP_USER || settings.smtp.user,
    pass: process.env.SMTP_PASS || settings.smtp.pass,
    fromEmail: process.env.SMTP_FROM || settings.smtp.user || settings.business.email,
    ccEmail: process.env.SMTP_CC || settings.business.email || settings.smtp.ccEmail
  };
}

function isMailConfigured(mailSettings) {
  return Boolean(
    mailSettings.host &&
      mailSettings.port &&
      mailSettings.user &&
      mailSettings.pass
  );
}

async function createInvoiceFiles(user, invoiceNumber, imageDataUrl) {
  if (!imageDataUrl?.startsWith("data:image/png;base64,")) {
    return { pdfPath: null, pdfUrl: null, pngPath: null, pngUrl: null };
  }

  const baseName = `${user.username}_${invoiceNumber}`.replace(/[^a-zA-Z0-9-_]/g, "_");
  const pngPath = path.join(GENERATED_DIR, `${baseName}.png`);
  const pdfPath = path.join(GENERATED_DIR, `${baseName}.pdf`);
  const pngBuffer = Buffer.from(imageDataUrl.split(",")[1], "base64");
  await fs.writeFile(pngPath, pngBuffer);

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
  await fs.writeFile(pdfPath, pdfBytes);

  return {
    pdfPath,
    pdfUrl: `/generated/${baseName}.pdf`,
    pngPath,
    pngUrl: `/generated/${baseName}.png`
  };
}

async function saveLogoAsset(kind, imageDataUrl) {
  const targets = {
    invoice: path.join(PUBLIC_DIR, "assets", "KaindlBanner.png"),
    app: path.join(PUBLIC_DIR, "assets", "KaindlLogo.png")
  };

  const targetFile = targets[kind];
  if (!targetFile) {
    throw new Error("Unbekannte Logo-Art.");
  }

  if (!String(imageDataUrl || "").startsWith("data:image/png;base64,")) {
    throw new Error("Logo muss als PNG-Bild hochgeladen werden.");
  }

  const rawBase64 = String(imageDataUrl).split(",")[1] || "";
  const imageBuffer = Buffer.from(rawBase64, "base64");
  await fs.mkdir(path.dirname(targetFile), { recursive: true });
  await fs.writeFile(targetFile, imageBuffer);
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
  if (fileInfo.pdfPath) {
    attachments.push({
      filename: `${invoice.invoiceNumber}.pdf`,
      path: fileInfo.pdfPath
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

app.get("/api/bootstrap", requireAuth, async (req, res, next) => {
  try {
    res.json({
      settings: getUserSettingsForClient(req.user),
      customers: req.user.customers,
      articles: req.user.articles,
      invoices: [...req.user.invoices].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
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
    const store = await readStore();
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");

    if (!username || !password) {
      res.status(400).json({ error: "Benutzername und Kennwort sind erforderlich." });
      return;
    }

    if (findUserByUsername(store, username)) {
      res.status(409).json({ error: "Dieser Benutzername ist bereits vergeben." });
      return;
    }

    const user = createUserRecord({ username, password });
    store.users.push(user);
    const session = createSession(store, user.id);
    await writeStore(store);
    res.status(201).json({ ok: true, username: user.username, token: session.token });
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

    const nextUsername = String(incoming.auth?.username || currentUser.username).trim() || currentUser.username;
    const otherUser = req.store.users.find(
      (entry) => entry.id !== currentUser.id && entry.username === nextUsername
    );
    if (otherUser) {
      res.status(409).json({ error: "Dieser Benutzername ist bereits vergeben." });
      return;
    }

    currentUser.username = nextUsername;
    if (incoming.auth?.password) {
      currentUser.passwordHash = hashPassword(incoming.auth.password);
      req.store.sessions = req.store.sessions.filter(
        (entry) => entry.userId !== currentUser.id || entry.token === req.session.token
      );
    }

    currentUser.settings.smtp.port = Number(currentUser.settings.smtp.port || 587);
    currentUser.settings.invoice.counterYear =
      Number(currentUser.settings.invoice.counterYear) || new Date().getFullYear();
    currentUser.settings.invoice.counterValue = Number(currentUser.settings.invoice.counterValue) || 0;
    currentUser.updatedAt = new Date().toISOString();

    await writeStore(req.store);
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
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.post("/api/invoices", requireAuth, async (req, res, next) => {
  try {
    const invoice = buildInvoiceRecord(req.user, req.body || {});
    const fileInfo = await createInvoiceFiles(req.user, invoice.invoiceNumber, req.body?.imageDataUrl);
    invoice.files = fileInfo;
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
      invoice,
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
