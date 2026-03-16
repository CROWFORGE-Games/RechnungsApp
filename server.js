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
const DATA_FILE = path.join(__dirname, "data", "store.json");
const GENERATED_DIR = path.join(__dirname, "generated");
const PUBLIC_DIR = path.join(__dirname, "public");
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

const app = express();
app.use(express.json({ limit: "20mb" }));
app.use("/generated", express.static(GENERATED_DIR));
app.use(express.static(PUBLIC_DIR));

function roundCurrency(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function mergeStore(raw = {}) {
  return {
    settings: {
      business: {
        ...DEFAULT_STORE.settings.business,
        ...(raw.settings?.business || {})
      },
      smtp: {
        ...DEFAULT_STORE.settings.smtp,
        ...(raw.settings?.smtp || {})
      },
      invoice: {
        ...DEFAULT_STORE.settings.invoice,
        ...(raw.settings?.invoice || {})
      },
      email: {
        ...DEFAULT_STORE.settings.email,
        ...(raw.settings?.email || {})
      }
    },
    customers: Array.isArray(raw.customers) ? raw.customers : [],
    articles: Array.isArray(raw.articles) ? raw.articles : [],
    invoices: Array.isArray(raw.invoices) ? raw.invoices : []
  };
}

async function ensureDataFiles() {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.mkdir(GENERATED_DIR, { recursive: true });

  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify(DEFAULT_STORE, null, 2), "utf8");
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
      fromEmail: settings.smtp.fromEmail,
      ccEmail: settings.smtp.ccEmail,
      smtpPassConfigured: Boolean(settings.smtp.pass)
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

function buildInvoiceNumber(store, issueDate) {
  const issueYear = Number(String(issueDate || "").slice(0, 4)) || new Date().getFullYear();
  if (Number(store.settings.invoice.counterYear) !== issueYear) {
    store.settings.invoice.counterYear = issueYear;
    store.settings.invoice.counterValue = 0;
  }

  store.settings.invoice.counterValue = Number(store.settings.invoice.counterValue || 0) + 1;
  return `${issueYear}-${String(store.settings.invoice.counterValue).padStart(5, "0")}`;
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
    fromEmail:
      process.env.SMTP_FROM || settings.business.email || settings.smtp.fromEmail || settings.smtp.user,
    ccEmail: process.env.SMTP_CC || settings.business.email || settings.smtp.ccEmail
  };
}

function isMailConfigured(mailSettings) {
  return Boolean(
    mailSettings.host &&
      mailSettings.port &&
      mailSettings.user &&
      mailSettings.pass &&
      mailSettings.fromEmail
  );
}

async function createInvoiceFiles(invoiceNumber, imageDataUrl) {
  if (!imageDataUrl?.startsWith("data:image/png;base64,")) {
    return { pdfPath: null, pdfUrl: null, pngPath: null, pngUrl: null };
  }

  const baseName = invoiceNumber.replace(/[^a-zA-Z0-9-_]/g, "_");
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

async function sendInvoiceEmail(store, invoice, fileInfo) {
  if (!invoice.customer.email) {
    return {
      status: "skipped",
      message: "Kunde hat keine E-Mail-Adresse hinterlegt."
    };
  }

  const mailSettings = getMailSettings(store.settings);
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
    companyName: store.settings.business.companyName
  };

  const attachments = [];
  if (fileInfo.pdfPath) {
    attachments.push({
      filename: `${invoice.invoiceNumber}.pdf`,
      path: fileInfo.pdfPath
    });
  }

  await transport.sendMail({
    from: `"${store.settings.business.companyName || "Rechnungs-App"}" <${mailSettings.fromEmail}>`,
    to: invoice.customer.email,
    cc: mailSettings.ccEmail || undefined,
    subject: compileTemplate(store.settings.email.subjectTemplate, tokens),
    text: compileTemplate(store.settings.email.bodyTemplate, tokens),
    attachments
  });

  return {
    status: "sent",
    message: `Rechnung an ${invoice.customer.email} gesendet.`
  };
}

function buildInvoiceRecord(store, payload) {
  const customer = store.customers.find((entry) => entry.id === payload.customerId);
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
    invoiceNumber: buildInvoiceNumber(store, issueDate),
    title: String(payload.title || store.settings.invoice.title || "Rechnung").trim(),
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

app.get("/api/bootstrap", async (_req, res, next) => {
  try {
    const store = await readStore();
    res.json({
      settings: sanitizeSettings(store.settings),
      customers: store.customers,
      articles: store.articles,
      invoices: [...store.invoices].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    });
  } catch (error) {
    next(error);
  }
});

app.put("/api/settings", async (req, res, next) => {
  try {
    const store = await readStore();
    const incoming = req.body?.settings || {};

    store.settings.business = {
      ...store.settings.business,
      ...(incoming.business || {})
    };
    store.settings.email = {
      ...store.settings.email,
      ...(incoming.email || {})
    };
    store.settings.invoice = {
      ...store.settings.invoice,
      ...(incoming.invoice || {})
    };

    const currentPass = store.settings.smtp.pass;
    store.settings.smtp = {
      ...store.settings.smtp,
      ...(incoming.smtp || {})
    };
    if (!incoming.smtp?.pass) {
      store.settings.smtp.pass = currentPass;
    }

    store.settings.smtp.port = Number(store.settings.smtp.port || 587);
    store.settings.invoice.counterYear =
      Number(store.settings.invoice.counterYear) || new Date().getFullYear();
    store.settings.invoice.counterValue = Number(store.settings.invoice.counterValue) || 0;

    await writeStore(store);
    res.json({ settings: sanitizeSettings(store.settings) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/customers", async (req, res, next) => {
  try {
    const store = await readStore();
    const customer = sanitizeCustomer(req.body?.customer || req.body);
    if (!customer.customerNumber) {
      customer.customerNumber = getNextSequentialNumber(store.customers, "customerNumber");
    }
    if (!customer.name) {
      res.status(400).json({ error: "Kundenname ist erforderlich." });
      return;
    }

    store.customers.push(customer);
    await writeStore(store);
    res.status(201).json({ customer });
  } catch (error) {
    next(error);
  }
});

app.put("/api/customers/:id", async (req, res, next) => {
  try {
    const store = await readStore();
    const index = store.customers.findIndex((entry) => entry.id === req.params.id);
    if (index === -1) {
      res.status(404).json({ error: "Kunde nicht gefunden." });
      return;
    }

    store.customers[index] = sanitizeCustomer({
      ...store.customers[index],
      ...(req.body?.customer || req.body),
      id: req.params.id
    });
    await writeStore(store);
    res.json({ customer: store.customers[index] });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/customers/:id", async (req, res, next) => {
  try {
    const store = await readStore();
    store.customers = store.customers.filter((entry) => entry.id !== req.params.id);
    await writeStore(store);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.post("/api/articles", async (req, res, next) => {
  try {
    const store = await readStore();
    const article = sanitizeArticle(req.body?.article || req.body);
    if (!article.number) {
      article.number = getNextSequentialNumber(store.articles, "number");
    }
    if (!article.name) {
      res.status(400).json({ error: "Artikelname ist erforderlich." });
      return;
    }

    store.articles.push(article);
    await writeStore(store);
    res.status(201).json({ article });
  } catch (error) {
    next(error);
  }
});

app.put("/api/articles/:id", async (req, res, next) => {
  try {
    const store = await readStore();
    const index = store.articles.findIndex((entry) => entry.id === req.params.id);
    if (index === -1) {
      res.status(404).json({ error: "Artikel nicht gefunden." });
      return;
    }

    store.articles[index] = sanitizeArticle({
      ...store.articles[index],
      ...(req.body?.article || req.body),
      id: req.params.id
    });
    await writeStore(store);
    res.json({ article: store.articles[index] });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/articles/:id", async (req, res, next) => {
  try {
    const store = await readStore();
    store.articles = store.articles.filter((entry) => entry.id !== req.params.id);
    await writeStore(store);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.post("/api/invoices", async (req, res, next) => {
  try {
    const store = await readStore();
    const invoice = buildInvoiceRecord(store, req.body || {});
    const fileInfo = await createInvoiceFiles(invoice.invoiceNumber, req.body?.imageDataUrl);
    invoice.files = fileInfo;

    let emailResult;
    try {
      emailResult = await sendInvoiceEmail(store, invoice, fileInfo);
    } catch (error) {
      emailResult = {
        status: "failed",
        message: error.message || "Mailversand fehlgeschlagen."
      };
    }

    invoice.email = emailResult;
    store.invoices.unshift(invoice);
    await writeStore(store);

    res.status(201).json({
      invoice,
      email: emailResult,
      settings: sanitizeSettings(store.settings)
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
