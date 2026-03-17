const APP_VERSION = "V0.3.6";

const STORAGE_KEYS = {
  navCollapsed: "rechnungsapp.navCollapsed",
  authToken: "rechnungsapp.auth.token"
};

const BRAND_ASSET_URLS = {
  invoice: "/api/assets/logo/invoice",
  app: "/api/assets/logo/app"
};

const state = {
  auth: {
    hasUser: false,
    authenticated: false,
    username: "",
    mode: "login"
  },
  settings: null,
  customers: [],
  articles: [],
  invoices: [],
  filters: {
    customers: "",
    articles: ""
  },
  openPanelId: null,
  invoiceDraft: {
    customerId: "",
    issueDate: today(),
    dueDate: addDays(14),
    reference: "",
    notes: "",
    items: [createEmptyItem()],
    signatureDataUrl: ""
  }
};

const appShell = document.getElementById("appShell");
const statusBanner = document.getElementById("statusBanner");
const appVersion = document.getElementById("appVersion");
const templateHint = document.getElementById("templateHint");
const panelOverlay = document.getElementById("panelOverlay");
const settingsForm = document.getElementById("settingsForm");
const customerForm = document.getElementById("customerForm");
const articleForm = document.getElementById("articleForm");
const invoiceForm = document.getElementById("invoiceForm");
const invoiceCustomer = document.getElementById("invoiceCustomer");
const issueDateInput = document.getElementById("issueDate");
const dueDateInput = document.getElementById("dueDate");
const invoiceReferenceInput = document.getElementById("invoiceReference");
const invoiceNotesInput = document.getElementById("invoiceNotes");
const customersTable = document.getElementById("customersTable");
const articlesTable = document.getElementById("articlesTable");
const customersSearchInput = document.getElementById("customersSearch");
const articlesSearchInput = document.getElementById("articlesSearch");
const invoiceItemsTable = document.getElementById("invoiceItemsTable");
const invoiceTotals = document.getElementById("invoiceTotals");
const invoiceHistory = document.getElementById("invoiceHistory");
const invoiceCanvas = document.getElementById("invoiceCanvas");
const canvasContext = invoiceCanvas.getContext("2d");
const addInvoiceItemButton = document.getElementById("addInvoiceItem");
const addInvoiceItemInPanelButton = document.getElementById("addInvoiceItemInPanel");
const createInvoiceButton = document.getElementById("createInvoiceButton");
const navToggle = document.getElementById("navToggle");
const authOverlay = document.getElementById("authOverlay");
const authForm = document.getElementById("authForm");
const authModeKicker = document.getElementById("authModeKicker");
const authTitle = document.getElementById("authTitle");
const authText = document.getElementById("authText");
const authSubmit = document.getElementById("authSubmit");
const authSwitchModeButton = document.getElementById("authSwitchMode");
const authUsernameInput = document.getElementById("authUsername");
const authPasswordInput = document.getElementById("authPassword");
const logoutButton = document.getElementById("logoutButton");
const settingsAuthPasswordInput = document.getElementById("settingsAuthPassword");
const toggleSettingsAuthPasswordButton = document.getElementById("toggleSettingsAuthPassword");
const smtpPassInput = document.getElementById("smtpPass");
const toggleSmtpPassButton = document.getElementById("toggleSmtpPass");
const openSmtpInfoButton = document.getElementById("openSmtpInfo");
const ccEmailList = document.getElementById("ccEmailList");
const addCcEmailButton = document.getElementById("addCcEmailLegacy") || document.getElementById("addCcEmail");
const smtpEnabledInput = document.getElementById("smtpEnabled");
const smtpSettingsGroup = document.getElementById("smtpSettingsGroup");
const invoiceLogoFileInput = document.getElementById("invoiceLogoFile");
const appLogoFileInput = document.getElementById("appLogoFile");
const appFavicon = document.getElementById("appFavicon");
const appleTouchIcon = document.getElementById("appleTouchIcon");
const bannerLogoImages = [...document.querySelectorAll("[data-banner-logo]")];
const appLogoImages = [...document.querySelectorAll("[data-app-logo]")];
const sendDialog = document.getElementById("sendDialog");
const closeSendDialogButton = document.getElementById("closeSendDialog");
const openSignatureDialogButton = document.getElementById("openSignatureDialog");
const sendInvoiceButton = document.getElementById("sendInvoiceButton");
const sendPreviewCanvas = document.getElementById("sendPreviewCanvas");
const sendPreviewContext = sendPreviewCanvas.getContext("2d");
const sendDialogCard = sendDialog.querySelector(".dialog-card");
const sendPreviewArea = sendDialog.querySelector(".dialog-preview");
const signatureDialog = document.getElementById("signatureDialog");
const closeSignatureDialogButton = document.getElementById("closeSignatureDialog");
const cancelSignatureButton = document.getElementById("cancelSignatureButton");
const confirmSignatureButton = document.getElementById("confirmSignatureButton");
const signaturePad = document.getElementById("signaturePad");
const signatureContext = signaturePad.getContext("2d");
const clearSignatureButton = document.getElementById("clearSignature");
const signatureDialogCard = signatureDialog.querySelector(".dialog-card");
const smtpInfoDialog = document.getElementById("smtpInfoDialog");
const closeSmtpInfoDialogButton = document.getElementById("closeSmtpInfoDialog");
const confirmSmtpInfoDialogButton = document.getElementById("confirmSmtpInfoDialog");
const installPrompt = document.getElementById("installPrompt");
const installPromptText = document.getElementById("installPromptText");
const dismissInstallPromptButton = document.getElementById("dismissInstallPrompt");
const installAppButton = document.getElementById("installAppButton");
const railButtons = [...document.querySelectorAll(".rail-button")];
const panelElements = [...document.querySelectorAll(".side-panel")];
const openPanelButtons = [...document.querySelectorAll("[data-open-panel]")];
const closePanelButtons = [...document.querySelectorAll("[data-close-panel]")];
const focusMainButton = document.querySelector("[data-focus-main]");
const resetCustomerFormButton = document.getElementById("resetCustomerForm");
const resetArticleFormButton = document.getElementById("resetArticleForm");

const customerFields = {
  id: customerForm.elements.namedItem("id"),
  customerNumber: customerForm.elements.namedItem("customerNumber"),
  name: customerForm.elements.namedItem("name"),
  contactPerson: customerForm.elements.namedItem("contactPerson"),
  street: customerForm.elements.namedItem("street"),
  postalCode: customerForm.elements.namedItem("postalCode"),
  city: customerForm.elements.namedItem("city"),
  country: customerForm.elements.namedItem("country"),
  phone: customerForm.elements.namedItem("phone"),
  email: customerForm.elements.namedItem("email"),
  uid: customerForm.elements.namedItem("uid"),
  notes: customerForm.elements.namedItem("notes")
};

const articleFields = {
  id: articleForm.elements.namedItem("id"),
  group: articleForm.elements.namedItem("group"),
  number: articleForm.elements.namedItem("number"),
  name: articleForm.elements.namedItem("name"),
  unit: articleForm.elements.namedItem("unit"),
  unitPrice: articleForm.elements.namedItem("unitPrice"),
  taxRate: articleForm.elements.namedItem("taxRate"),
  description: articleForm.elements.namedItem("description")
};

const settingsFields = {
  companyName: settingsForm.elements.namedItem("companyName"),
  senderLine: settingsForm.elements.namedItem("senderLine"),
  addressLine1: settingsForm.elements.namedItem("addressLine1"),
  addressLine2: settingsForm.elements.namedItem("addressLine2"),
  postalCode: settingsForm.elements.namedItem("postalCode"),
  city: settingsForm.elements.namedItem("city"),
  country: settingsForm.elements.namedItem("country"),
  phone: settingsForm.elements.namedItem("phone"),
  businessEmail: settingsForm.elements.namedItem("businessEmail"),
  uid: settingsForm.elements.namedItem("uid"),
  bankName: settingsForm.elements.namedItem("bankName"),
  iban: settingsForm.elements.namedItem("iban"),
  bic: settingsForm.elements.namedItem("bic"),
  issuerName: settingsForm.elements.namedItem("issuerName"),
  paymentNote: settingsForm.elements.namedItem("paymentNote"),
  footerNote: settingsForm.elements.namedItem("footerNote"),
  invoiceTitle: settingsForm.elements.namedItem("invoiceTitle"),
  counterValue: settingsForm.elements.namedItem("counterValue"),
  counterYear: settingsForm.elements.namedItem("counterYear"),
  smtpHost: settingsForm.elements.namedItem("smtpHost"),
  smtpEnabled: settingsForm.elements.namedItem("smtpEnabled"),
  smtpPort: settingsForm.elements.namedItem("smtpPort"),
  smtpUser: settingsForm.elements.namedItem("smtpUser"),
  smtpPass: settingsForm.elements.namedItem("smtpPass"),
  smtpSecure: settingsForm.elements.namedItem("smtpSecure"),
  emailSubject: settingsForm.elements.namedItem("emailSubject"),
  emailBody: settingsForm.elements.namedItem("emailBody"),
  authUsername: settingsForm.elements.namedItem("authUsername"),
  authPassword: settingsForm.elements.namedItem("authPassword")
};

const templateState = {
  image: null,
  loaded: false
};

const logoState = {
  image: null,
  loaded: false
};

let previewTimer = 0;
let renderNonce = 0;
let isSignatureDrawing = false;
let hasSignatureStroke = false;
let lastBusinessEmailValue = "";
let deferredInstallPrompt = null;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function createClientId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0"));
    return [
      hex.slice(0, 4).join(""),
      hex.slice(4, 6).join(""),
      hex.slice(6, 8).join(""),
      hex.slice(8, 10).join(""),
      hex.slice(10, 16).join("")
    ].join("-");
  }

  return `item-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function createEmptyItem() {
  return {
    id: createClientId(),
    articleId: "",
    articleNumber: "",
    description: "",
    quantity: 0.5,
    unit: "Stunden",
    unitPrice: 0,
    taxRate: 20,
    discount: 0
  };
}

function toNumber(value, fallback = 0) {
  const normalized = Number.parseFloat(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function roundCurrency(value) {
  return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("de-AT", {
    style: "currency",
    currency: "EUR"
  }).format(toNumber(value));
}

function formatAmount(value) {
  return new Intl.NumberFormat("de-AT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(toNumber(value));
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sortByNumericField(entries, fieldName) {
  return [...entries].sort((left, right) => {
    const leftValue = Number(left[fieldName]);
    const rightValue = Number(right[fieldName]);
    if (Number.isFinite(leftValue) && Number.isFinite(rightValue)) {
      return leftValue - rightValue;
    }

    return String(left[fieldName] || "").localeCompare(String(right[fieldName] || ""), "de");
  });
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLocaleLowerCase("de")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .trim();
}

function matchesSearch(entry, fields, searchTerm) {
  if (!searchTerm) {
    return true;
  }

  const haystack = normalizeSearchText(
    fields
      .map((field) => entry[field] || "")
      .filter(Boolean)
      .join(" ")
  );

  return haystack.includes(searchTerm);
}

function nextSequentialNumber(entries, fieldName, base = 10001) {
  const maxValue = entries.reduce((max, entry) => {
    const current = Number(entry[fieldName]);
    return Number.isFinite(current) ? Math.max(max, current) : max;
  }, base - 1);

  return String(maxValue + 1);
}

function nextCustomerNumber() {
  return nextSequentialNumber(state.customers, "customerNumber");
}

function nextArticleNumber() {
  return nextSequentialNumber(state.articles, "number");
}

function selectedCustomer() {
  return state.customers.find((entry) => entry.id === state.invoiceDraft.customerId) || null;
}

function selectedArticle(articleId) {
  return state.articles.find((entry) => entry.id === articleId) || null;
}

function normalizeArticle(article) {
  return {
    ...article,
    unit: String(article.unit || "Stunden").trim(),
    unitPrice: toNumber(article.unitPrice),
    taxRate: toNumber(article.taxRate, 20)
  };
}

async function api(url, options = {}) {
  const authToken = window.localStorage.getItem(STORAGE_KEYS.authToken) || "";
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(async () => ({ error: (await response.text().catch(() => "")).trim() || "Unbekannter Fehler" }));
    if (
      response.status === 401 &&
      !String(url).includes("/api/auth/login") &&
      !String(url).includes("/api/auth/register") &&
      !String(url).includes("/api/auth/session")
    ) {
      clearAuthToken();
      resetAuthenticatedState();
      if (logoutButton) {
        logoutButton.hidden = true;
      }
      setAuthMode("login");
      showAuthOverlay();
    }
    throw new Error(errorData.error || "Unbekannter Fehler");
  }

  if (response.status === 204) {
    return null;
  }

  return response
    .json()
    .catch(async () => {
      const text = (await response.text().catch(() => "")).trim();
      throw new Error(text || "Antwort konnte nicht verarbeitet werden.");
    });
}

function clearAuthToken() {
  window.localStorage.removeItem(STORAGE_KEYS.authToken);
}

function buildAuthenticatedFileUrl(filePath) {
  if (!filePath) {
    return "";
  }

  const authToken = window.localStorage.getItem(STORAGE_KEYS.authToken) || "";
  const url = new URL(filePath, window.location.origin);
  if (authToken) {
    url.searchParams.set("token", authToken);
  }
  return url.toString();
}

function resetAuthenticatedState() {
  state.auth.authenticated = false;
  state.auth.username = "";
  state.settings = null;
  state.customers = [];
  state.articles = [];
  state.invoices = [];
  state.openPanelId = null;
  state.invoiceDraft = {
    customerId: "",
    issueDate: today(),
    dueDate: addDays(14),
    reference: "",
    notes: "",
    items: [createEmptyItem()],
    signatureDataUrl: ""
  };
}

function setStatus(message, tone = "info") {
  statusBanner.textContent = message;
  statusBanner.style.background =
    tone === "error"
      ? "rgba(176, 68, 68, 0.14)"
      : tone === "success"
        ? "rgba(63, 138, 90, 0.16)"
        : "rgba(47, 111, 102, 0.1)";
  statusBanner.style.color =
    tone === "error" ? "#8f3131" : tone === "success" ? "#24583a" : "#2f6f66";
}

function setActiveRail(targetPanelId = null) {
  railButtons.forEach((button) => {
    const isMain = !targetPanelId && button.hasAttribute("data-focus-main");
    const isPanel = targetPanelId && button.dataset.openPanel === targetPanelId;
    button.classList.toggle("is-active", Boolean(isMain || isPanel));
  });
}

function loadCollapsedState() {
  const storedValue = window.localStorage.getItem(STORAGE_KEYS.navCollapsed);
  const isCollapsed = storedValue === null ? true : storedValue === "true";
  appShell.classList.toggle("nav-collapsed", isCollapsed);
}

function toggleNavigation() {
  const nextState = !appShell.classList.contains("nav-collapsed");
  appShell.classList.toggle("nav-collapsed", nextState);
  window.localStorage.setItem(STORAGE_KEYS.navCollapsed, String(nextState));
}

function openPanel(panelId) {
  state.openPanelId = panelId;
  setActiveRail(panelId);
  panelOverlay.hidden = false;
  document.body.classList.add("panel-open");

  panelElements.forEach((panel) => {
    const isOpen = panel.id === panelId;
    panel.classList.toggle("is-open", isOpen);
    panel.setAttribute("aria-hidden", String(!isOpen));
  });
}

function closePanels() {
  state.openPanelId = null;
  setActiveRail(null);
  panelOverlay.hidden = true;
  panelElements.forEach((panel) => {
    panel.classList.remove("is-open");
    panel.setAttribute("aria-hidden", "true");
  });
  if (authOverlay.hidden && sendDialog.hidden) {
    document.body.classList.remove("panel-open");
  }
}

function closePanelsIfMobile() {
  if (window.innerWidth <= 1180) {
    closePanels();
  }
}

function openSendDialog() {
  sendDialog.hidden = false;
  document.body.classList.add("panel-open");
  window.requestAnimationFrame(() => {
    sendDialog.scrollTop = 0;
    if (sendDialogCard) {
      sendDialogCard.scrollTop = 0;
    }
    if (sendPreviewArea) {
      sendPreviewArea.scrollTop = 0;
    }
  });
}

function closeSendDialog() {
  sendDialog.hidden = true;
  signatureDialog.hidden = true;
  if (authOverlay.hidden && state.openPanelId === null) {
    document.body.classList.remove("panel-open");
  }
}

function openSignatureDialog() {
  signatureDialog.hidden = false;
  document.body.classList.add("panel-open");
  window.requestAnimationFrame(() => {
    signatureDialog.scrollTop = 0;
    if (signatureDialogCard) {
      signatureDialogCard.scrollTop = 0;
    }
  });
}

function closeSignatureDialog() {
  signatureDialog.hidden = true;
  if (authOverlay.hidden && state.openPanelId === null && sendDialog.hidden) {
    document.body.classList.remove("panel-open");
  }
}

function openSmtpInfoDialog() {
  smtpInfoDialog.hidden = false;
  document.body.classList.add("panel-open");
}

function closeSmtpInfoDialog() {
  smtpInfoDialog.hidden = true;
  if (authOverlay.hidden && state.openPanelId === null && sendDialog.hidden && signatureDialog.hidden) {
    document.body.classList.remove("panel-open");
  }
}

async function loadAuthState() {
  state.auth.hasUser = true;
  const authToken = window.localStorage.getItem(STORAGE_KEYS.authToken) || "";

  if (!authToken) {
    state.auth.authenticated = false;
    state.auth.username = "";
    return;
  }

  try {
    const response = await api("/api/auth/session");
    state.auth.username = String(response.username || "").trim();
    state.auth.authenticated = Boolean(state.auth.username);
  } catch {
    clearAuthToken();
    state.auth.authenticated = false;
    state.auth.username = "";
  }
}

function setAuthMode(mode = "login") {
  state.auth.mode = "login";
  authModeKicker.textContent = "Anmeldung";
  authTitle.textContent = "Anmelden";
  authText.textContent =
    "Mit einem vorhandenen Benutzer anmelden. Verf?gbar sind admin und kaindl_daniel, jeweils mit dem Kennwort admin."; /*
    : "Mit deinem Benutzer anmelden. Nach dem Login werden deine eigenen Daten auf jedem Gerät wieder geladen.";
  */ authSubmit.textContent = "Anmelden";
  return;
  /* legacy auth mode removed
  authModeKicker.textContent = isRegister ? "Erster Start" : "Anmeldung";
  authTitle.textContent = isRegister ? "Benutzer registrieren" : "Anmelden";
  authText.textContent = isRegister
    ? "Lege einmal Benutzername und Kennwort fest. Danach meldet sich die App über Autologin automatisch an."
    : "Melde dich mit deinem Benutzerkonto an. Wenn bereits ein Login gespeichert wurde, erfolgt der Einstieg automatisch.";
  authSubmit.textContent = isRegister ? "Registrieren" : "Anmelden";
  authConfirmWrap.hidden = !isRegister;
  authPasswordConfirmInput.required = isRegister;
  */
}

function showAuthOverlay() {
  authOverlay.hidden = false;
  document.body.classList.add("panel-open");
}

function hideAuthOverlay() {
  authOverlay.hidden = true;
  if (state.openPanelId === null && sendDialog.hidden) {
    document.body.classList.remove("panel-open");
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = `${src}?v=${Date.now()}`;
  });
}

function loadInlineImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function clearSignaturePad() {
  signatureContext.clearRect(0, 0, signaturePad.width, signaturePad.height);
  signatureContext.fillStyle = "#ffffff";
  signatureContext.fillRect(0, 0, signaturePad.width, signaturePad.height);
  signatureContext.strokeStyle = "rgba(39, 84, 56, 0.18)";
  signatureContext.lineWidth = 2;
  signatureContext.beginPath();
  signatureContext.moveTo(36, signaturePad.height - 34);
  signatureContext.lineTo(signaturePad.width - 36, signaturePad.height - 34);
  signatureContext.stroke();
  signatureContext.strokeStyle = "#183126";
  signatureContext.lineWidth = 2.6;
  signatureContext.lineCap = "round";
  signatureContext.lineJoin = "round";
  hasSignatureStroke = false;
}

function signaturePointFromEvent(event) {
  const rect = signaturePad.getBoundingClientRect();
  const scaleX = signaturePad.width / rect.width;
  const scaleY = signaturePad.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY
  };
}

function refreshSendPreview() {
  sendPreviewContext.clearRect(0, 0, sendPreviewCanvas.width, sendPreviewCanvas.height);
  sendPreviewContext.drawImage(invoiceCanvas, 0, 0, sendPreviewCanvas.width, sendPreviewCanvas.height);
}

async function loadTemplate() {
  if (templateState.loaded) {
    return templateState.image;
  }

  const candidates = ["/assets/invoice-template.png", "/assets/image.png", "/assets/template.png"];
  for (const candidate of candidates) {
    try {
      templateState.image = await loadImage(candidate);
      templateState.loaded = true;
      templateHint.textContent = `Vorlage geladen: ${candidate}`;
      return templateState.image;
    } catch {
      // Nächste Datei versuchen.
    }
  }

  templateState.loaded = true;
  templateHint.textContent =
    "Noch keine Vorlage gefunden. Die Vorschau verwendet deshalb ein eingebautes Rechnungsblatt.";
  return null;
}

async function loadLogo() {
  if (logoState.loaded) {
    return logoState.image;
  }

  const candidates = [
    BRAND_ASSET_URLS.invoice,
    "/assets/KaindlBanner.png",
    "/assets/logo.png",
    "/assets/logo.png.png",
    "/assets/logo.webp",
    "/assets/logo.jpg",
    "/assets/logo.jpeg"
  ];

  for (const candidate of candidates) {
    try {
      logoState.image = await loadImage(candidate);
      logoState.loaded = true;
      return logoState.image;
    } catch {
      // Nächste Datei versuchen.
    }
  }

  logoState.loaded = true;
  return null;
}

function populateSettingsForm() {
  if (!state.settings) {
    return;
  }

  const { business, smtp, invoice, email, auth } = state.settings;
  settingsFields.authUsername.value = auth?.username || "";
  settingsFields.authPassword.value = "";
  settingsFields.companyName.value = business.companyName || "";
  settingsFields.senderLine.value = business.senderLine || "";
  settingsFields.addressLine1.value = business.addressLine1 || "";
  settingsFields.addressLine2.value = business.addressLine2 || "";
  settingsFields.postalCode.value = business.postalCode || "";
  settingsFields.city.value = business.city || "";
  settingsFields.country.value = business.country || "";
  settingsFields.phone.value = business.phone || "";
  settingsFields.businessEmail.value = business.email || "";
  settingsFields.uid.value = business.uid || "";
  settingsFields.bankName.value = business.bankName || "";
  settingsFields.iban.value = business.iban || "";
  settingsFields.bic.value = business.bic || "";
  settingsFields.issuerName.value = business.issuerName || "";
  settingsFields.paymentNote.value = business.paymentNote || "";
  settingsFields.footerNote.value = business.footerNote || "";
  settingsFields.invoiceTitle.value = invoice.title || "Rechnung";
  settingsFields.counterValue.value = invoice.counterValue ?? 0;
  settingsFields.counterYear.value = invoice.counterYear ?? new Date().getFullYear();
  settingsFields.smtpEnabled.checked = Boolean(smtp.enabled);
  settingsFields.smtpHost.value = smtp.host || "smtp.gmail.com";
  settingsFields.smtpPort.value = smtp.port || 587;
  settingsFields.smtpUser.value = smtp.user || "";
  settingsFields.smtpPass.value = smtp.pass || "";
  renderCcEmailInputs(parseEmailList(smtp.ccEmail || business.email || ""));
  settingsFields.smtpSecure.checked = Boolean(smtp.secure);
  settingsFields.emailSubject.value = email.subjectTemplate || "";
  settingsFields.emailBody.value = email.bodyTemplate || "";
  lastBusinessEmailValue = business.email || "";
  updateSettingsAuthPasswordToggleLabel();
  updateSmtpPassToggleLabel();
  updateSmtpVisibility();
}

function readSettingsForm() {
  return {
    business: {
      companyName: settingsFields.companyName.value.trim(),
      senderLine: settingsFields.senderLine.value.trim(),
      addressLine1: settingsFields.addressLine1.value.trim(),
      addressLine2: settingsFields.addressLine2.value.trim(),
      postalCode: settingsFields.postalCode.value.trim(),
      city: settingsFields.city.value.trim(),
      country: settingsFields.country.value.trim(),
      phone: settingsFields.phone.value.trim(),
      email: settingsFields.businessEmail.value.trim(),
      uid: settingsFields.uid.value.trim(),
      bankName: settingsFields.bankName.value.trim(),
      iban: settingsFields.iban.value.trim(),
      bic: settingsFields.bic.value.trim(),
      issuerName: settingsFields.issuerName.value.trim(),
      paymentNote: settingsFields.paymentNote.value.trim(),
      footerNote: settingsFields.footerNote.value.trim()
    },
    auth: {
      username: settingsFields.authUsername.value.trim() || "admin",
      password: settingsFields.authPassword.value
    },
    smtp: {
      enabled: settingsFields.smtpEnabled.checked,
      host: settingsFields.smtpHost.value.trim(),
      port: toNumber(settingsFields.smtpPort.value, 587),
      user: settingsFields.smtpUser.value.trim(),
      pass: settingsFields.smtpPass.value.trim(),
      ccEmail: getCcEmailValue(),
      secure: settingsFields.smtpSecure.checked
    },
    invoice: {
      title: settingsFields.invoiceTitle.value.trim() || "Rechnung",
      counterValue: toNumber(settingsFields.counterValue.value, 0),
      counterYear: toNumber(settingsFields.counterYear.value, new Date().getFullYear())
    },
    email: {
      subjectTemplate: settingsFields.emailSubject.value.trim(),
      bodyTemplate: settingsFields.emailBody.value.trim()
    }
  };
}

function parseEmailList(value) {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function renderCcEmailInputs(values = []) {
  if (!ccEmailList) {
    return;
  }

  const entries = values.length ? values : [""];
  ccEmailList.innerHTML = entries
    .map(
      (value, index) => `
        <div class="cc-row">
          <input
            class="cc-row__input"
            type="email"
            value="${escapeHtml(value)}"
            placeholder="cc@example.com"
            data-cc-index="${index}"
          />
          <button class="ghost cc-row__remove" type="button" data-remove-cc="${index}">×</button>
        </div>
      `
    )
    .join("");
}

function readCcEmailInputs() {
  if (!ccEmailList) {
    return [];
  }

  return [...ccEmailList.querySelectorAll("[data-cc-index]")]
    .map((input) => input.value.trim())
    .filter(Boolean);
}

function getCcEmailValue() {
  return readCcEmailInputs().join(", ");
}

function addCcEmailRow(value = "") {
  const entries = [...readCcEmailInputs(), value];
  renderCcEmailInputs(entries);
}

function syncBusinessEmailDefaults(nextEmail) {
  const trimmedEmail = String(nextEmail || "").trim();
  const previousEmail = lastBusinessEmailValue;

  if (!trimmedEmail) {
    lastBusinessEmailValue = "";
    return;
  }

  if (!settingsFields.smtpUser.value.trim() || settingsFields.smtpUser.value.trim() === previousEmail) {
    settingsFields.smtpUser.value = trimmedEmail;
  }

  const ccEntries = readCcEmailInputs();
  if (!ccEntries.length || (ccEntries.length === 1 && ccEntries[0] === previousEmail)) {
    renderCcEmailInputs([trimmedEmail]);
  }

  lastBusinessEmailValue = trimmedEmail;
}

function updateSmtpVisibility() {
  if (!smtpSettingsGroup || !settingsFields.smtpEnabled) {
    return;
  }

  smtpSettingsGroup.hidden = !settingsFields.smtpEnabled.checked;
}

function normalizeEmailSettingsLayout() {
  const ccFields = [...document.querySelectorAll(".settings-section__grid .cc-list")];
  const primaryCcField = ccFields[0]?.closest("label");
  const duplicateCcFields = ccFields.slice(1);
  const emailSubjectField = document.querySelector('[name="emailSubject"]')?.closest("label");
  const emailBodyField = document.querySelector('[name="emailBody"]')?.closest("label");

  if (primaryCcField) {
    primaryCcField.hidden = false;
    primaryCcField.classList.add("span-2");

    const primaryAddButton = primaryCcField.querySelector(".cc-add-button");
    if (primaryAddButton) {
      primaryAddButton.hidden = false;
      primaryAddButton.id = "addCcEmail";
    }
  }

  duplicateCcFields.forEach((entry) => {
    const field = entry.closest("label");
    entry.id = "ccEmailListHidden";
    const duplicateAddButton = field?.querySelector(".cc-add-button");
    if (duplicateAddButton) {
      duplicateAddButton.id = "addCcEmailHidden";
    }
    if (field) {
      field.hidden = true;
    }
  });

  if (smtpSettingsGroup && emailSubjectField && emailSubjectField.parentElement === smtpSettingsGroup) {
    smtpSettingsGroup.insertAdjacentElement("afterend", emailBodyField);
    smtpSettingsGroup.insertAdjacentElement("afterend", emailSubjectField);
  }

  emailSubjectField?.classList.add("span-2");
  emailBodyField?.classList.add("span-2");
}

function scrollPanelFormToTop(formElement) {
  const panel = formElement?.closest(".side-panel");
  if (!panel) {
    return;
  }

  panel.scrollTo({ top: 0, behavior: "smooth" });
}

function updateSmtpPassToggleLabel() {
  if (!toggleSmtpPassButton || !smtpPassInput) {
    return;
  }

  const isHidden = smtpPassInput.type === "password";
  toggleSmtpPassButton.classList.toggle("is-visible", !isHidden);
  toggleSmtpPassButton.setAttribute(
    "aria-label",
    isHidden ? "SMTP Passwort anzeigen" : "SMTP Passwort verbergen"
  );
  toggleSmtpPassButton.title = isHidden ? "SMTP Passwort anzeigen" : "SMTP Passwort verbergen";
}

function updateSettingsAuthPasswordToggleLabel() {
  if (!toggleSettingsAuthPasswordButton || !settingsAuthPasswordInput) {
    return;
  }

  const isHidden = settingsAuthPasswordInput.type === "password";
  toggleSettingsAuthPasswordButton.classList.toggle("is-visible", !isHidden);
  toggleSettingsAuthPasswordButton.setAttribute(
    "aria-label",
    isHidden ? "Kennwort anzeigen" : "Kennwort verbergen"
  );
  toggleSettingsAuthPasswordButton.title = isHidden ? "Kennwort anzeigen" : "Kennwort verbergen";
}

function refreshBrandAssets() {
  const stamp = `?v=${Date.now()}`;
  bannerLogoImages.forEach((image) => {
    image.src = `${BRAND_ASSET_URLS.invoice}${stamp}`;
  });
  appLogoImages.forEach((image) => {
    image.src = `${BRAND_ASSET_URLS.app}${stamp}`;
  });
  if (appFavicon) {
    appFavicon.href = `${BRAND_ASSET_URLS.app}${stamp}`;
  }
  if (appleTouchIcon) {
    appleTouchIcon.href = `${BRAND_ASSET_URLS.app}${stamp}`;
  }
  logoState.loaded = false;
  logoState.image = null;
}

function fileToPngDataUrl(file) {
  return new Promise((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth || image.width;
      canvas.height = image.naturalHeight || image.height;
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(imageUrl);
        reject(new Error("Bild konnte nicht verarbeitet werden."));
        return;
      }

      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      URL.revokeObjectURL(imageUrl);
      resolve(canvas.toDataURL("image/png"));
    };

    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error("Datei konnte nicht gelesen werden."));
    };

    image.src = imageUrl;
  });
}

async function uploadLogoAsset(kind, file) {
  if (!file) {
    return;
  }

  const imageDataUrl = await fileToPngDataUrl(file);
  await api("/api/assets/logo", {
    method: "POST",
    body: JSON.stringify({ kind, imageDataUrl })
  });
}

function fillCustomerForm(customer = null) {
  const entry = customer || {
    id: "",
    customerNumber: nextCustomerNumber(),
    name: "",
    contactPerson: "",
    street: "",
    postalCode: "",
    city: "",
    country: state.settings?.business?.country || "Österreich",
    phone: "",
    email: "",
    uid: "",
    notes: ""
  };

  customerFields.id.value = entry.id || "";
  customerFields.customerNumber.value = entry.customerNumber || nextCustomerNumber();
  customerFields.name.value = entry.name || "";
  customerFields.contactPerson.value = entry.contactPerson || "";
  customerFields.street.value = entry.street || "";
  customerFields.postalCode.value = entry.postalCode || "";
  customerFields.city.value = entry.city || "";
  customerFields.country.value = entry.country || "";
  customerFields.phone.value = entry.phone || "";
  customerFields.email.value = entry.email || "";
  customerFields.uid.value = entry.uid || "";
  customerFields.notes.value = entry.notes || "";
  scrollPanelFormToTop(customerForm);
}

function readCustomerForm() {
  return {
    id: customerFields.id.value.trim(),
    customerNumber: customerFields.customerNumber.value.trim(),
    name: customerFields.name.value.trim(),
    contactPerson: customerFields.contactPerson.value.trim(),
    street: customerFields.street.value.trim(),
    postalCode: customerFields.postalCode.value.trim(),
    city: customerFields.city.value.trim(),
    country: customerFields.country.value.trim(),
    phone: customerFields.phone.value.trim(),
    email: customerFields.email.value.trim(),
    uid: customerFields.uid.value.trim(),
    notes: customerFields.notes.value.trim()
  };
}

function resetCustomerForm() {
  fillCustomerForm(null);
}

function fillArticleForm(article = null) {
  const entry = article || {
    id: "",
    group: "",
    number: nextArticleNumber(),
    name: "",
    unit: "Stunden",
    unitPrice: "",
    taxRate: 20,
    description: ""
  };

  articleFields.id.value = entry.id || "";
  articleFields.group.value = entry.group || "";
  articleFields.number.value = entry.number || nextArticleNumber();
  articleFields.name.value = entry.name || "";
  articleFields.unit.value = entry.unit || "Stunden";
  articleFields.unitPrice.value = entry.unitPrice ?? "";
  articleFields.taxRate.value = entry.taxRate ?? 20;
  articleFields.description.value = entry.description || "";
  scrollPanelFormToTop(articleForm);
}

function readArticleForm() {
  return {
    id: articleFields.id.value.trim(),
    group: articleFields.group.value.trim(),
    number: articleFields.number.value.trim(),
    name: articleFields.name.value.trim(),
    description: articleFields.description.value.trim(),
    unit: articleFields.unit.value.trim() || "Stunden",
    unitPrice: toNumber(articleFields.unitPrice.value),
    taxRate: toNumber(articleFields.taxRate.value, 20)
  };
}

function resetArticleForm() {
  fillArticleForm(null);
}

function calculateItem(item) {
  const quantity = toNumber(item.quantity, 0);
  const unitPrice = toNumber(item.unitPrice, 0);
  const discount = toNumber(item.discount, 0);
  const taxRate = toNumber(item.taxRate, 0);
  const undiscountedNet = roundCurrency(quantity * unitPrice);
  const net = roundCurrency(undiscountedNet * Math.max(0, 1 - discount / 100));
  const tax = roundCurrency(net * (taxRate / 100));
  return {
    discountAmount: roundCurrency(undiscountedNet - net),
    net,
    tax,
    gross: roundCurrency(net + tax)
  };
}

function calculateDraftTotals() {
  return state.invoiceDraft.items.reduce(
    (totals, item) => {
      if (!String(item.description || "").trim() || toNumber(item.quantity) <= 0) {
        return totals;
      }

      const current = calculateItem(item);
      totals.discountTotal = roundCurrency(totals.discountTotal + current.discountAmount);
      totals.subtotal = roundCurrency(totals.subtotal + current.net);
      totals.taxTotal = roundCurrency(totals.taxTotal + current.tax);
      totals.grossTotal = roundCurrency(totals.grossTotal + current.gross);
      return totals;
    },
    { discountTotal: 0, subtotal: 0, taxTotal: 0, grossTotal: 0 }
  );
}

function updateInvoiceTotalsDisplay() {
  const totals = calculateDraftTotals();
  invoiceTotals.textContent = `Gesamt: ${formatCurrency(totals.grossTotal)}`;
}

function renderCustomerOptions() {
  const options = ['<option value="">Kunde auswählen</option>'];
  for (const customer of sortByNumericField(state.customers, "customerNumber")) {
    options.push(
      `<option value="${escapeHtml(customer.id)}">${escapeHtml(
        `${customer.customerNumber || "Ohne Nr."} - ${customer.name}`
      )}</option>`
    );
  }

  invoiceCustomer.innerHTML = options.join("");

  if (
    state.invoiceDraft.customerId &&
    state.customers.some((entry) => entry.id === state.invoiceDraft.customerId)
  ) {
    invoiceCustomer.value = state.invoiceDraft.customerId;
    return;
  }

  state.invoiceDraft.customerId = state.customers[0]?.id || "";
  invoiceCustomer.value = state.invoiceDraft.customerId;
}

function renderCustomers() {
  const searchTerm = normalizeSearchText(state.filters.customers);
  const entries = sortByNumericField(state.customers, "customerNumber").filter((customer) =>
    matchesSearch(
      customer,
      ["customerNumber", "name", "contactPerson", "street", "postalCode", "city", "email", "phone", "uid"],
      searchTerm
    )
  );
  if (!entries.length) {
    customersTable.innerHTML =
      `<tr><td colspan="5" class="empty-state">${
        searchTerm ? "Keine passenden Kunden gefunden." : "Noch keine Kunden angelegt."
      }</td></tr>`;
    return;
  }

  customersTable.innerHTML = entries
    .map(
      (customer) => `
        <tr>
          <td data-label="Nr.">${escapeHtml(customer.customerNumber)}</td>
          <td data-label="Kunde">
            <strong>${escapeHtml(customer.name)}</strong>
            ${customer.contactPerson ? `<div>${escapeHtml(customer.contactPerson)}</div>` : ""}
          </td>
          <td data-label="Ort">${escapeHtml(
            [customer.postalCode, customer.city].filter(Boolean).join(" ")
          )}</td>
          <td data-label="E-Mail">${escapeHtml(customer.email)}</td>
          <td data-label="Aktion">
            <div class="row-actions">
              <button class="secondary" type="button" data-action="edit-customer" data-id="${escapeHtml(customer.id)}">Bearbeiten</button>
              <button class="danger" type="button" data-action="delete-customer" data-id="${escapeHtml(customer.id)}">Löschen</button>
            </div>
          </td>
        </tr>
      `
    )
    .join("");
}

function renderArticles() {
  const searchTerm = normalizeSearchText(state.filters.articles);
  const entries = sortByNumericField(state.articles, "number").filter((article) =>
    matchesSearch(article, ["number", "name", "description", "group", "unit"], searchTerm)
  );
  if (!entries.length) {
    articlesTable.innerHTML =
      `<tr><td colspan="5" class="empty-state">${
        searchTerm ? "Keine passenden Leistungen gefunden." : "Noch keine Leistungen angelegt."
      }</td></tr>`;
    return;
  }

  articlesTable.innerHTML = entries
    .map(
      (article) => `
        <tr>
          <td data-label="Nr.">${escapeHtml(article.number)}</td>
          <td data-label="Bezeichnung">
            <strong>${escapeHtml(article.name)}</strong>
            ${article.description ? `<div>${escapeHtml(article.description)}</div>` : ""}
          </td>
          <td data-label="Preis">${escapeHtml(formatCurrency(article.unitPrice))}</td>
          <td data-label="Gruppe">${escapeHtml(article.group)}</td>
          <td data-label="Aktion">
            <div class="row-actions">
              <button class="secondary" type="button" data-action="edit-article" data-id="${escapeHtml(article.id)}">Bearbeiten</button>
              <button class="danger" type="button" data-action="delete-article" data-id="${escapeHtml(article.id)}">Löschen</button>
            </div>
          </td>
        </tr>
      `
    )
    .join("");
}

function buildArticleOptions(selectedId) {
  const options = ['<option value="">Leistung auswählen</option>'];
  for (const article of sortByNumericField(state.articles, "number")) {
    options.push(
      `<option value="${escapeHtml(article.id)}"${
        article.id === selectedId ? " selected" : ""
      }>${escapeHtml(`${article.number || "Ohne Nr."} - ${article.name}`)}</option>`
    );
  }

  return options.join("");
}

function renderInvoiceItems() {
  if (!state.invoiceDraft.items.length) {
    state.invoiceDraft.items = [createEmptyItem()];
  }

  invoiceItemsTable.innerHTML = state.invoiceDraft.items
    .map((item, index) => {
      const totals = calculateItem(item);
      return `
        <tr data-index="${index}">
          <td data-label="Artikel">
            <select name="articleId" class="item-article-select">
              ${buildArticleOptions(item.articleId)}
            </select>
          </td>
          <td data-label="Beschreibung">
            <div class="invoice-description-fields">
              <input name="description" type="text" value="${escapeHtml(item.description)}" placeholder="Leistung" />
              <input name="articleNumber" type="text" value="${escapeHtml(
                item.articleNumber
              )}" placeholder="Art.-Nr." />
            </div>
          </td>
          <td data-label="Menge">
            <div class="quantity-stepper">
              <button class="ghost quantity-stepper__button" type="button" data-action="decrease-quantity">-</button>
              <input name="quantity" type="number" min="0" step="0.5" value="${escapeHtml(
                item.quantity
              )}" />
              <button class="ghost quantity-stepper__button" type="button" data-action="increase-quantity">+</button>
            </div>
          </td>
          <td data-label="Einheit">
            <input name="unit" type="text" value="${escapeHtml(item.unit || "Stunden")}" />
          </td>
          <td data-label="Nettopreis">
            <input name="unitPrice" type="number" min="0" step="0.01" value="${escapeHtml(
              item.unitPrice
            )}" />
          </td>
          <td data-label="MwSt. %">
            <input name="taxRate" type="number" min="0" step="0.01" value="${escapeHtml(
              item.taxRate
            )}" />
          </td>
          <td data-label="Rabatt %">
            <input name="discount" type="number" min="0" step="0.01" value="${escapeHtml(
              item.discount
            )}" />
          </td>
          <td data-label="Summe">
            <div class="readonly-chip" data-role="row-total">${escapeHtml(
              formatCurrency(totals.net)
            )}</div>
          </td>
          <td data-label="Aktion">
            <button class="danger" type="button" data-action="remove-item">Löschen</button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function readInvoiceRow(row) {
  return {
    articleId: row.querySelector('[name="articleId"]').value,
    description: row.querySelector('[name="description"]').value.trim(),
    articleNumber: row.querySelector('[name="articleNumber"]').value.trim(),
    quantity: toNumber(row.querySelector('[name="quantity"]').value, 0),
    unit: row.querySelector('[name="unit"]').value.trim() || "Stunden",
    unitPrice: toNumber(row.querySelector('[name="unitPrice"]').value, 0),
    taxRate: toNumber(row.querySelector('[name="taxRate"]').value, 0),
    discount: toNumber(row.querySelector('[name="discount"]').value, 0)
  };
}

function updateInvoiceRowState(row) {
  const index = Number(row.dataset.index);
  if (!Number.isInteger(index) || !state.invoiceDraft.items[index]) {
    return;
  }

  state.invoiceDraft.items[index] = {
    ...state.invoiceDraft.items[index],
    ...readInvoiceRow(row)
  };
}

function updateInvoiceRowTotal(row) {
  const index = Number(row.dataset.index);
  const item = state.invoiceDraft.items[index];
  if (!item) {
    return;
  }

  const totalElement = row.querySelector('[data-role="row-total"]');
  if (totalElement) {
    totalElement.textContent = formatCurrency(calculateItem(item).net);
  }
}

function applyArticleToItem(item, article) {
  if (!article) {
    return {
      ...item,
      articleId: "",
      articleNumber: item.articleNumber || ""
    };
  }

  return {
    ...item,
    articleId: article.id,
    articleNumber: article.number || "",
    description: article.name || item.description,
    unit: article.unit || item.unit || "Stunden",
    unitPrice: toNumber(article.unitPrice),
    taxRate: toNumber(article.taxRate, 20)
  };
}

function syncDraftItemsFromArticle(articleId, draftArticle) {
  let changed = false;
  state.invoiceDraft.items = state.invoiceDraft.items.map((item) => {
    if (item.articleId !== articleId) {
      return item;
    }

    changed = true;
    return {
      ...item,
      articleNumber: draftArticle.number || item.articleNumber,
      description: draftArticle.name || item.description,
      unit: draftArticle.unit || item.unit || "Stunden",
      unitPrice: toNumber(draftArticle.unitPrice, item.unitPrice),
      taxRate: toNumber(draftArticle.taxRate, item.taxRate)
    };
  });

  if (changed) {
    renderInvoiceItems();
    updateInvoiceTotalsDisplay();
    schedulePreviewRender();
  }
}

function renderInvoiceHistory() {
  if (!state.invoices.length) {
    invoiceHistory.innerHTML = '<div class="empty-state">Noch keine Rechnungen erstellt.</div>';
    return;
  }

  invoiceHistory.innerHTML = state.invoices
    .slice(0, 8)
    .map((invoice) => {
      const emailMessage = invoice.email?.message || "Noch kein Versandstatus";
      const pdfUrl = buildAuthenticatedFileUrl(invoice.files?.pdfUrl);
      const fileLink = invoice.files?.pdfUrl
        ? `<a href="${escapeHtml(invoice.files.pdfUrl)}" target="_blank" rel="noreferrer">PDF öffnen</a>`
        : "";

      return `
        <article class="history-item">
          <strong>${escapeHtml(invoice.invoiceNumber)}</strong>
          <p>${escapeHtml(invoice.customer?.name || "Unbekannter Kunde")}</p>
          <p>${escapeHtml(formatCurrency(invoice.totals?.grossTotal || 0))}</p>
          <p>${escapeHtml(emailMessage)}</p>
          ${fileLink}
        </article>
      `;
    })
    .join("");
}

function syncInvoiceMetaInputs() {
  renderCustomerOptions();
  issueDateInput.value = state.invoiceDraft.issueDate || today();
  dueDateInput.value = state.invoiceDraft.dueDate || addDays(14);
  invoiceReferenceInput.value = state.invoiceDraft.reference || "";
  invoiceNotesInput.value = state.invoiceDraft.notes || "";
}

function previewInvoiceNumber() {
  const issueYear =
    Number(String(state.invoiceDraft.issueDate || "").slice(0, 4)) || new Date().getFullYear();
  const configuredYear = Number(state.settings?.invoice?.counterYear) || issueYear;
  const currentCounter = Number(state.settings?.invoice?.counterValue || 0);
  const nextCounter = configuredYear === issueYear ? currentCounter + 1 : 1;

  return `${issueYear}-${String(nextCounter).padStart(5, "0")}`;
}

function drawWrappedText(context, text, x, y, maxWidth, lineHeight, maxLines = Infinity) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  if (!words.length) {
    return 0;
  }

  let line = "";
  let lineCount = 0;

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      context.fillText(line, x, y + lineCount * lineHeight);
      line = word;
      lineCount += 1;
      if (lineCount >= maxLines) {
        return lineCount * lineHeight;
      }
    } else {
      line = candidate;
    }
  }

  context.fillText(line, x, y + lineCount * lineHeight);
  return (lineCount + 1) * lineHeight;
}

function drawFallbackLayout(context) {
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, invoiceCanvas.width, invoiceCanvas.height);
  context.strokeStyle = "#222222";
  context.lineWidth = 1.2;
  context.beginPath();
  context.moveTo(62, 150);
  context.lineTo(734, 150);
  context.moveTo(62, 980);
  context.lineTo(734, 980);
  context.stroke();
  context.fillStyle = "#f5f5f5";
  context.strokeStyle = "#c9c9c9";
  context.lineWidth = 1;
  context.beginPath();
  context.roundRect(438, 162, 280, 150, 6);
  context.fill();
  context.stroke();
  context.fillStyle = "#d5d5d5";
  context.fillRect(64, 392, 674, 22);
}

function getPreviewTaxLabel() {
  const validRates = state.invoiceDraft.items
    .filter((item) => String(item.description || "").trim() && toNumber(item.quantity) > 0)
    .map((item) => toNumber(item.taxRate, 0));

  if (!validRates.length) {
    return "MwSt.";
  }

  const firstRate = validRates[0];
  return validRates.every((rate) => rate === firstRate)
    ? `${formatAmount(firstRate)}% MwSt`
    : "MwSt.";
}

async function renderCanvas() {
  const currentNonce = ++renderNonce;
  const [template, logo] = await Promise.all([loadTemplate(), loadLogo()]);
  if (currentNonce !== renderNonce) {
    return;
  }

  canvasContext.clearRect(0, 0, invoiceCanvas.width, invoiceCanvas.height);
  canvasContext.fillStyle = "#ffffff";
  canvasContext.fillRect(0, 0, invoiceCanvas.width, invoiceCanvas.height);
  if (template) {
    canvasContext.drawImage(template, 0, 0, invoiceCanvas.width, invoiceCanvas.height);
  } else {
    drawFallbackLayout(canvasContext);
  }

  const customer = selectedCustomer();
  const totals = calculateDraftTotals();
  const business = state.settings?.business || {};
  const invoiceTitle = state.settings?.invoice?.title || "Rechnung";
  const invoiceNumber = previewInvoiceNumber();
  const validItems = getValidInvoiceItems();

  if (logo) {
    const maxWidth = 180;
    const maxHeight = 78;
    const ratio = Math.min(maxWidth / logo.width, maxHeight / logo.height, 1);
    const drawWidth = logo.width * ratio;
    const drawHeight = logo.height * ratio;
    canvasContext.drawImage(logo, 66, 46, drawWidth, drawHeight);
  }

  canvasContext.fillStyle = "#101010";
  canvasContext.textBaseline = "top";
  canvasContext.font = '11px Calibri, Candara, "Segoe UI", sans-serif';
  canvasContext.fillStyle = "#2e2e2e";
  drawWrappedText(canvasContext, business.senderLine || "", 66, 164, 340, 14, 2);

  canvasContext.fillStyle = "#111111";
  canvasContext.font = '14px Calibri, Candara, "Segoe UI", sans-serif';
  const addressLines = customer
    ? [
        customer.name,
        customer.street,
        `${customer.postalCode || ""} ${customer.city || ""}`.trim(),
        customer.country
      ].filter(Boolean)
    : ["Bitte Kunde auswählen"];

  addressLines.forEach((line, index) => {
    canvasContext.fillText(line, 66, 190 + index * 20);
  });

  canvasContext.font = 'bold 14px Calibri, Candara, "Segoe UI", sans-serif';
  canvasContext.fillText("Kundeninfo", 446, 180);
  canvasContext.font = '13px Calibri, Candara, "Segoe UI", sans-serif';
  [
    `Kunden-Nr.:   ${customer?.customerNumber || "-"}`,
    `Telefon:      ${customer?.phone || business.phone || "-"}`,
    `eMail:        ${customer?.email || "-"}`,
    `UID-Nr.:      ${customer?.uid || business.uid || "-"}`
  ].forEach((line, index) => {
    canvasContext.fillText(line, 446, 212 + index * 22);
  });

  canvasContext.font = 'bold 18px Calibri, Candara, "Segoe UI", sans-serif';
  canvasContext.fillText(`${invoiceTitle} ${invoiceNumber}`, 66, 345);
  canvasContext.font = '13px Calibri, Candara, "Segoe UI", sans-serif';
  if (state.invoiceDraft.reference) {
    canvasContext.fillText(`zu Bst.: ${state.invoiceDraft.reference}`, 66, 373);
  }

  canvasContext.textAlign = "right";
  canvasContext.fillText(`Datum: ${formatDate(state.invoiceDraft.issueDate)}`, 738, 345);
  canvasContext.fillText(`Bearbeiter: ${business.issuerName || "-"}`, 738, 369);
  canvasContext.textAlign = "left";

  const tableTop = 404;
  canvasContext.font = 'bold 13px Calibri, Candara, "Segoe UI", sans-serif';
  canvasContext.textBaseline = "middle";
  canvasContext.fillText("Pos", 68, tableTop);
  canvasContext.fillText("Beschreibung", 98, tableTop);
  canvasContext.textAlign = "right";
  canvasContext.fillText("Einzelpreis €", 536, tableTop);
  canvasContext.fillText("Menge", 644, tableTop);
  canvasContext.fillText("Summe €", 710, tableTop);
  canvasContext.textAlign = "left";
  canvasContext.textBaseline = "top";

  let itemY = 430;
  validItems.forEach((item, index) => {
    const current = calculateItem(item);
    const hasDiscount = toNumber(item.discount) > 0;
    canvasContext.font = '13px Calibri, Candara, "Segoe UI", sans-serif';
    canvasContext.fillText(String(index + 1), 68, itemY);
    canvasContext.font = 'bold 13px Calibri, Candara, "Segoe UI", sans-serif';
    canvasContext.fillText(item.description, 98, itemY);
    canvasContext.font = 'bold 12px Calibri, Candara, "Segoe UI", sans-serif';
    canvasContext.fillText(`Art.-Nr.: ${item.articleNumber || "-"}`, 98, itemY + 18);
    if (hasDiscount) {
      canvasContext.font = '12px Calibri, Candara, "Segoe UI", sans-serif';
      canvasContext.fillText(`Rabatt: ${formatAmount(item.discount)} %`, 98, itemY + 34);
    }

    canvasContext.font = '13px Calibri, Candara, "Segoe UI", sans-serif';
    canvasContext.textAlign = "right";
    canvasContext.fillText(formatAmount(item.unitPrice), 536, itemY);
    canvasContext.fillText(
      `${formatAmount(item.quantity)} ${String(item.unit || "Std.").trim()}`,
      644,
      itemY
    );
    canvasContext.fillText(formatAmount(current.net), 710, itemY);
    canvasContext.textAlign = "left";
    itemY += hasDiscount ? 70 : 54;
  });

  canvasContext.strokeStyle = "#202020";
  canvasContext.lineWidth = 1;
  canvasContext.beginPath();
  canvasContext.moveTo(66, Math.max(itemY - 10, 468));
  canvasContext.lineTo(738, Math.max(itemY - 10, 468));
  canvasContext.stroke();

  const totalsStartY = Math.max(itemY + 18, 500);
  const drawAmountLine = (label, value, y, bold = false) => {
    canvasContext.textAlign = "left";
    canvasContext.font = `${bold ? "bold " : ""}${bold ? "16" : "14"}px Calibri, Candara, "Segoe UI", sans-serif`;
    canvasContext.fillText(label, 494, y);
    canvasContext.textAlign = "right";
    canvasContext.fillText(value, 734, y);
  };

  const hasDiscountTotal = totals.discountTotal > 0;
  const taxLineY = totalsStartY + (hasDiscountTotal ? 48 : 24);
  const totalLineY = totalsStartY + (hasDiscountTotal ? 84 : 60);
  const totalDividerY = totalsStartY + (hasDiscountTotal ? 68 : 44);
  drawAmountLine("Netto", formatAmount(totals.subtotal), totalsStartY);
  if (hasDiscountTotal) {
    drawAmountLine("Rabatt-Abzug", `- ${formatAmount(totals.discountTotal)}`, totalsStartY + 24);
  }
  drawAmountLine(getPreviewTaxLabel(), formatAmount(totals.taxTotal), taxLineY);
  drawAmountLine("Gesamtbetrag €", formatAmount(totals.grossTotal), totalLineY, true);

  canvasContext.beginPath();
  canvasContext.lineWidth = 1.8;
  canvasContext.moveTo(492, totalDividerY);
  canvasContext.lineTo(738, totalDividerY);
  canvasContext.stroke();
  canvasContext.textAlign = "left";

  const paymentLines = [
    `Fällig am: ${formatDate(state.invoiceDraft.dueDate)}`,
    business.paymentNote || "Fällig innerhalb von 14 Tagen ohne Abzug.",
    state.invoiceDraft.notes || ""
  ].filter(Boolean);

  let blockY = totalsStartY + 126;
  canvasContext.font = '13px Calibri, Candara, "Segoe UI", sans-serif';
  paymentLines.forEach((line) => {
    drawWrappedText(canvasContext, line, 66, blockY, 560, 18, 3);
    blockY += 22;
  });

  if (business.footerNote) {
    drawWrappedText(canvasContext, business.footerNote, 66, Math.max(blockY + 26, 956), 610, 18, 3);
  }

  const footerLine = [business.bankName, business.iban, business.bic, business.uid]
    .filter(Boolean)
    .join("; ");
  if (footerLine) {
    canvasContext.fillText(footerLine, 58, 1064);
  }

  if (state.invoiceDraft.signatureDataUrl) {
    const signatureImage = await loadInlineImage(state.invoiceDraft.signatureDataUrl).catch(
      () => null
    );
    if (signatureImage) {
      const maxWidth = 150;
      const maxHeight = 56;
      const ratio = Math.min(maxWidth / signatureImage.width, maxHeight / signatureImage.height, 1);
      const drawWidth = signatureImage.width * ratio;
      const drawHeight = signatureImage.height * ratio;
      canvasContext.drawImage(signatureImage, 560, 900, drawWidth, drawHeight);
      canvasContext.font = '11px Calibri, Candara, "Segoe UI", sans-serif';
      canvasContext.fillText("Kundenunterschrift", 560, 962);
    }
  }
}

function schedulePreviewRender() {
  window.clearTimeout(previewTimer);
  previewTimer = window.setTimeout(() => {
    renderCanvas().catch((error) => {
      console.error(error);
      setStatus(error.message || "Vorschau konnte nicht aktualisiert werden.", "error");
    });
  }, 70);
}

async function saveSettings(event) {
  event.preventDefault();
  try {
    const settingsPayload = readSettingsForm();
    const response = await api("/api/settings", {
      method: "PUT",
      body: JSON.stringify({ settings: settingsPayload })
    });

    const invoiceLogoFile = invoiceLogoFileInput?.files?.[0] || null;
    const appLogoFile = appLogoFileInput?.files?.[0] || null;
    if (invoiceLogoFile) {
      await uploadLogoAsset("invoice", invoiceLogoFile);
    }
    if (appLogoFile) {
      await uploadLogoAsset("app", appLogoFile);
    }

    state.settings = response.settings;
    state.auth.username = response.settings.auth?.username || state.auth.username;
    if (invoiceLogoFileInput) {
      invoiceLogoFileInput.value = "";
    }
    if (appLogoFileInput) {
      appLogoFileInput.value = "";
    }
    refreshBrandAssets();
    populateSettingsForm();
    setStatus(
      invoiceLogoFile || appLogoFile
        ? "Einstellungen und Logos gespeichert."
        : "Einstellungen gespeichert.",
      "success"
    );
    schedulePreviewRender();
    closePanels();
  } catch (error) {
    setStatus(error.message || "Einstellungen konnten nicht gespeichert werden.", "error");
  }
}

async function saveCustomer(event) {
  event.preventDefault();
  const customer = readCustomerForm();

  try {
    const response = await api(customer.id ? `/api/customers/${customer.id}` : "/api/customers", {
      method: customer.id ? "PUT" : "POST",
      body: JSON.stringify({ customer })
    });

    const savedCustomer = response.customer;
    state.customers = customer.id
      ? state.customers.map((entry) => (entry.id === savedCustomer.id ? savedCustomer : entry))
      : [...state.customers, savedCustomer];

    state.customers = sortByNumericField(state.customers, "customerNumber");
    state.invoiceDraft.customerId = savedCustomer.id;
    renderCustomers();
    renderCustomerOptions();
    resetCustomerForm();
    schedulePreviewRender();
    setStatus("Kunde gespeichert.", "success");
    closePanelsIfMobile();
  } catch (error) {
    setStatus(error.message || "Kunde konnte nicht gespeichert werden.", "error");
  }
}

async function saveArticle(event) {
  event.preventDefault();
  const article = readArticleForm();

  try {
    const response = await api(article.id ? `/api/articles/${article.id}` : "/api/articles", {
      method: article.id ? "PUT" : "POST",
      body: JSON.stringify({ article })
    });

    const savedArticle = normalizeArticle(response.article);
    state.articles = article.id
      ? state.articles.map((entry) => (entry.id === savedArticle.id ? savedArticle : entry))
      : [...state.articles, savedArticle];

    state.articles = sortByNumericField(state.articles, "number");
    syncDraftItemsFromArticle(savedArticle.id, savedArticle);
    renderArticles();
    renderInvoiceItems();
    resetArticleForm();
    schedulePreviewRender();
    setStatus("Leistung gespeichert.", "success");
    closePanelsIfMobile();
  } catch (error) {
    setStatus(error.message || "Leistung konnte nicht gespeichert werden.", "error");
  }
}

async function handleCustomerTableClick(event) {
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) {
    return;
  }

  const customer = state.customers.find((entry) => entry.id === actionButton.dataset.id);
  if (!customer) {
    return;
  }

  if (actionButton.dataset.action === "edit-customer") {
    fillCustomerForm(customer);
    openPanel("customersPanel");
    return;
  }

  if (window.confirm(`Kunde "${customer.name}" wirklich löschen?`)) {
    try {
      await api(`/api/customers/${customer.id}`, { method: "DELETE" });
      state.customers = state.customers.filter((entry) => entry.id !== customer.id);
      if (state.invoiceDraft.customerId === customer.id) {
        state.invoiceDraft.customerId = state.customers[0]?.id || "";
      }
      renderCustomers();
      renderCustomerOptions();
      schedulePreviewRender();
      setStatus("Kunde gelöscht.", "success");
    } catch (error) {
      setStatus(error.message || "Kunde konnte nicht gelöscht werden.", "error");
    }
  }
}

async function handleArticleTableClick(event) {
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) {
    return;
  }

  const article = state.articles.find((entry) => entry.id === actionButton.dataset.id);
  if (!article) {
    return;
  }

  if (actionButton.dataset.action === "edit-article") {
    fillArticleForm(article);
    openPanel("articlesPanel");
    return;
  }

  if (window.confirm(`Leistung "${article.name}" wirklich löschen?`)) {
    try {
      await api(`/api/articles/${article.id}`, { method: "DELETE" });
      state.articles = state.articles.filter((entry) => entry.id !== article.id);
      state.invoiceDraft.items = state.invoiceDraft.items.map((item) =>
        item.articleId === article.id ? { ...item, articleId: "" } : item
      );
      renderArticles();
      renderInvoiceItems();
      updateInvoiceTotalsDisplay();
      schedulePreviewRender();
      setStatus("Leistung gelöscht.", "success");
    } catch (error) {
      setStatus(error.message || "Leistung konnte nicht gelöscht werden.", "error");
    }
  }
}

function addInvoiceItem() {
  state.invoiceDraft.items.push(createEmptyItem());
  renderInvoiceItems();
  updateInvoiceTotalsDisplay();
  schedulePreviewRender();
}

function removeInvoiceItem(index) {
  state.invoiceDraft.items.splice(index, 1);
  if (!state.invoiceDraft.items.length) {
    state.invoiceDraft.items.push(createEmptyItem());
  }

  renderInvoiceItems();
  updateInvoiceTotalsDisplay();
  schedulePreviewRender();
}

function handleInvoiceTableInput(event) {
  const row = event.target.closest("tr[data-index]");
  if (!row) {
    return;
  }

  updateInvoiceRowState(row);
  updateInvoiceRowTotal(row);
  updateInvoiceTotalsDisplay();
  schedulePreviewRender();
}

function handleInvoiceTableChange(event) {
  const row = event.target.closest("tr[data-index]");
  if (!row) {
    return;
  }

  const index = Number(row.dataset.index);
  const item = state.invoiceDraft.items[index];
  if (!item) {
    return;
  }

  if (event.target.matches(".item-article-select")) {
    const article = selectedArticle(event.target.value);
    state.invoiceDraft.items[index] = applyArticleToItem(item, article);
    renderInvoiceItems();
    updateInvoiceTotalsDisplay();
    schedulePreviewRender();
    return;
  }

  updateInvoiceRowState(row);
  updateInvoiceRowTotal(row);
  updateInvoiceTotalsDisplay();
  schedulePreviewRender();
}

function handleInvoiceTableClick(event) {
  const quantityButton = event.target.closest('[data-action="decrease-quantity"], [data-action="increase-quantity"]');
  if (quantityButton) {
    const row = quantityButton.closest("tr[data-index]");
    if (!row) {
      return;
    }

    const quantityInput = row.querySelector('[name="quantity"]');
    const currentValue = toNumber(quantityInput?.value, 0);
    const nextValue =
      quantityButton.dataset.action === "increase-quantity"
        ? currentValue + 0.5
        : Math.max(0, currentValue - 0.5);

    quantityInput.value = String(roundCurrency(nextValue));
    updateInvoiceRowState(row);
    updateInvoiceRowTotal(row);
    updateInvoiceTotalsDisplay();
    schedulePreviewRender();
    return;
  }

  const button = event.target.closest('[data-action="remove-item"]');
  if (!button) {
    return;
  }

  const row = button.closest("tr[data-index]");
  if (row) {
    removeInvoiceItem(Number(row.dataset.index));
  }
}

function handleInvoiceMetaInput() {
  state.invoiceDraft.customerId = invoiceCustomer.value;
  state.invoiceDraft.issueDate = issueDateInput.value;
  state.invoiceDraft.dueDate = dueDateInput.value;
  state.invoiceDraft.reference = invoiceReferenceInput.value.trim();
  state.invoiceDraft.notes = invoiceNotesInput.value.trim();
  schedulePreviewRender();
}

function handleArticleFormLiveInput() {
  const articleId = articleFields.id.value.trim();
  if (articleId) {
    syncDraftItemsFromArticle(articleId, readArticleForm());
  }
}

function getValidInvoiceItems() {
  return state.invoiceDraft.items.filter((item) => {
    const hasArticle = String(item.articleId || "").trim();
    const hasDescription = String(item.description || "").trim();
    return Boolean((hasArticle || hasDescription) && toNumber(item.quantity) > 0);
  });
}

function showInvoiceDraftWarning(message) {
  setStatus(message, "error");
  window.alert(message);
}

function compileClientTemplate(template, tokens) {
  return String(template || "").replace(/\{\{(\w+)\}\}/g, (_, key) => tokens[key] ?? "");
}

function buildClientEmailDraft(invoice, options = {}) {
  const { includePdfLink = false } = options;
  const customerEmail = String(invoice.customer?.email || selectedCustomer()?.email || "").trim();
  const ccEmail = String(
    state.settings?.smtp?.ccEmail || state.settings?.business?.email || state.settings?.smtp?.fromEmail || ""
  )
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .join(", ");
  const invoiceUrl = invoice.files?.pdfUrl
    ? new URL(invoice.files.pdfUrl, window.location.origin).toString()
    : "";
  const tokens = {
    invoiceNumber: invoice.invoiceNumber,
    customerName: invoice.customer?.name || selectedCustomer()?.name || "",
    companyName: state.settings?.business?.companyName || "",
    invoiceUrl
  };
  const subject = compileClientTemplate(state.settings?.email?.subjectTemplate, tokens);
  const bodyParts = [
    compileClientTemplate(state.settings?.email?.bodyTemplate, tokens).trim(),
    includePdfLink && invoiceUrl ? `PDF-Link: ${invoiceUrl}` : ""
  ].filter(Boolean);
  return {
    customerEmail,
    ccEmail,
    subject: subject || `Rechnung ${invoice.invoiceNumber}`,
    body: bodyParts.join("\n\n"),
    invoiceUrl
  };
}

function buildMailtoLink(invoice) {
  const draft = buildClientEmailDraft(invoice, { includePdfLink: true });
  const params = [];
  if (draft.ccEmail) {
    params.push(`cc=${encodeURIComponent(draft.ccEmail)}`);
  }
  params.push(`subject=${encodeURIComponent(draft.subject)}`);
  params.push(`body=${encodeURIComponent(draft.body)}`);
  return `mailto:${encodeURIComponent(draft.customerEmail)}?${params.join("&")}`;
}

async function openExternalMailApp(invoice) {
  const draft = buildClientEmailDraft(invoice);
  const pdfUrl = buildAuthenticatedFileUrl(invoice.files?.pdfUrl);
  const shareSupported =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function";

  if (shareSupported && pdfUrl) {
    try {
      const response = await fetch(pdfUrl);
      if (response.ok) {
        const blob = await response.blob();
        const file = new File([blob], `${invoice.invoiceNumber}.pdf`, {
          type: blob.type || "application/pdf"
        });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: draft.subject,
            text: draft.body,
            files: [file]
          });
          return "share";
        }
      }
    } catch {
      // Fallback auf mailto, wenn Teilen oder PDF-Fetch nicht unterstützt wird.
    }
  }

  window.location.href = buildMailtoLink(invoice);
  return "mailto";
}

function isSmtpEnabled() {
  return Boolean(state.settings?.smtp?.enabled);
}

async function prepareInvoice() {
  if (!state.invoiceDraft.customerId) {
    showInvoiceDraftWarning("Bitte zuerst einen Kunden auswählen.");
    return;
    setStatus("Bitte zuerst einen Kunden auswählen.", "error");
    return;
  }

  const validItems = state.invoiceDraft.items.filter(
    (item) => String(item.description || "").trim() && toNumber(item.quantity) > 0
  );
  if (!validItems.length) {
    showInvoiceDraftWarning("Es sind keine Daten vorhanden. Bitte zuerst eine Leistung eintragen.");
    return;
    setStatus("Bitte mindestens eine Leistung eintragen.", "error");
    return;
  }

  createInvoiceButton.disabled = true;
  createInvoiceButton.textContent = "Vorschau wird vorbereitet...";
  try {
    state.invoiceDraft.signatureDataUrl = "";
    await renderCanvas();
    refreshSendPreview();
    clearSignaturePad();
    openSendDialog();
    setStatus("Rechnung vorbereitet. Bitte prüfen, unterschreiben und danach senden.", "info");
  } catch (error) {
    setStatus(error.message || "Rechnung konnte nicht vorbereitet werden.", "error");
  } finally {
    createInvoiceButton.disabled = false;
    createInvoiceButton.textContent = "Rechnung erstellen";
  }
}

async function sendInvoice() {
  sendInvoiceButton.disabled = true;
  sendInvoiceButton.textContent = "Rechnung wird gesendet...";

  try {
    sendInvoiceButton.textContent = "Rechnung wird gesendet...";
    const customer = selectedCustomer();
    if (!customer?.email) {
      showInvoiceDraftWarning("Beim ausgewählten Kunden ist keine E-Mail-Adresse hinterlegt.");
      return;
    }

    await renderCanvas();
    refreshSendPreview();

    const response = await api("/api/invoices", {
      method: "POST",
      body: JSON.stringify({
        customerId: state.invoiceDraft.customerId,
        issueDate: state.invoiceDraft.issueDate,
        dueDate: state.invoiceDraft.dueDate,
        reference: state.invoiceDraft.reference,
        notes: state.invoiceDraft.notes,
        title: state.settings?.invoice?.title || "Rechnung",
        items: state.invoiceDraft.items.map((item) => ({
          ...item,
          unit: String(item.unit || "Stunden").trim()
        })),
        imageDataUrl: invoiceCanvas.toDataURL("image/png"),
        deliveryMethod: isSmtpEnabled() ? "smtp" : "external-app"
      })
    });

    state.invoices = [response.invoice, ...state.invoices];
    state.settings = response.settings;
    state.auth.username = response.settings.auth?.username || state.auth.username;
    populateSettingsForm();
    renderInvoiceHistory();
    closeSendDialog();
    setStatus(
      response.email?.message || "Rechnung erstellt. Mail-App wurde geöffnet.",
      response.email?.status === "sent" ? "success" : "error"
    );
    if (response.email?.status && response.email.status !== "sent") {
      window.alert(response.email.message || "Mailversand fehlgeschlagen.");
    }
    if (response.email?.status === "external-app" && response.invoice) {
      await openExternalMailApp(response.invoice);
    }

    const preservedCustomerId = state.invoiceDraft.customerId;
    state.invoiceDraft = {
      customerId: preservedCustomerId,
      issueDate: today(),
      dueDate: addDays(14),
      reference: "",
      notes: "",
      items: [createEmptyItem()],
      signatureDataUrl: ""
    };
    syncInvoiceMetaInputs();
    renderInvoiceItems();
    updateInvoiceTotalsDisplay();
    schedulePreviewRender();
  } catch (error) {
    setStatus(error.message || "Rechnung konnte nicht gesendet werden.", "error");
    window.alert(error.message || "Rechnung konnte nicht gesendet werden.");
  } finally {
    sendInvoiceButton.disabled = false;
    sendInvoiceButton.textContent = "Senden";
  }
}

async function prepareInvoiceForSend() {
  if (!state.invoiceDraft.customerId) {
    showInvoiceDraftWarning("Bitte zuerst einen Kunden auswählen.");
    return;
  }

  const validItems = getValidInvoiceItems();
  if (!validItems.length) {
    showInvoiceDraftWarning("Es sind keine Daten vorhanden. Bitte zuerst eine Leistung eintragen.");
    return;
  }

  if (!state.invoiceDraft.customerId) {
    setStatus("Bitte zuerst einen Kunden auswählen.", "error");
    return;
  }

  createInvoiceButton.disabled = true;
  createInvoiceButton.textContent = "Vorschau wird vorbereitet...";
  try {
    openSendDialog();
    await renderCanvas();
    refreshSendPreview();
    setStatus("Rechnung vorbereitet. Bitte prüfen, bei Bedarf unterschreiben und danach senden.", "info");
  } catch (error) {
    setStatus(error.message || "Rechnung konnte nicht vorbereitet werden.", "error");
  } finally {
    createInvoiceButton.disabled = false;
    createInvoiceButton.textContent = "Rechnung erstellen";
  }
}

async function handleAuthSubmit(event) {
  event.preventDefault();

  const username = authUsernameInput.value.trim();
  const password = authPasswordInput.value;

  if (!username || !password) {
    setStatus("Bitte Benutzername und Kennwort eingeben.", "error");
    return;
  }

  try {
    const response = await api(
      "/api/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ username, password })
      }
    );

    window.localStorage.setItem(STORAGE_KEYS.authToken, response.token);
    state.auth.hasUser = true;
    state.auth.authenticated = true;
    state.auth.username = response.username;
    authForm.reset();
    setAuthMode("login");
    hideAuthOverlay();
    await bootstrap();
    return;
  } catch (error) {
    const message = error.message || "Benutzername oder Kennwort ist nicht korrekt.";
    setStatus(message, "error");
    window.alert(message);
    return;
  }

  /*
  if (username !== DEFAULT_USERNAME || password !== DEFAULT_PASSWORD) {
    setStatus("Benutzername oder Kennwort ist nicht korrekt.", "error");
    return;
    setStatus("Die Kennwörter stimmen nicht überein.", "error");
    return;
  }

  window.localStorage.removeItem(STORAGE_KEYS.authUsername);
  window.localStorage.removeItem(STORAGE_KEYS.authPasswordHash);
  window.localStorage.setItem(STORAGE_KEYS.autoLoginUser, DEFAULT_USERNAME);
  state.auth.hasUser = true;
  state.auth.authenticated = true;
  state.auth.username = DEFAULT_USERNAME;
  authForm.reset();
  hideAuthOverlay();
  await bootstrap();
  return;

  const passwordHash = await hashPassword(password);
  if (isRegister) {
    window.localStorage.setItem(STORAGE_KEYS.authUsername, username);
    window.localStorage.setItem(STORAGE_KEYS.authPasswordHash, passwordHash);
  } else {
    const storedUsername = window.localStorage.getItem(STORAGE_KEYS.authUsername) || "";
    const storedHash = window.localStorage.getItem(STORAGE_KEYS.authPasswordHash) || "";
    if (storedUsername !== username || storedHash !== passwordHash) {
      setStatus("Benutzername oder Kennwort ist nicht korrekt.", "error");
      return;
    }
  }

  window.localStorage.setItem(STORAGE_KEYS.autoLoginUser, username);
  state.auth.hasUser = true;
  state.auth.authenticated = true;
  state.auth.username = username;
  authForm.reset();
  hideAuthOverlay();
  await bootstrap();
  */
}

async function handleLogout() {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } catch {
    // Token kann bereits ungültig sein.
  }

  clearAuthToken();
  resetAuthenticatedState();
  closeSendDialog();
  closeSignatureDialog();
  closePanels();
  if (logoutButton) {
    logoutButton.hidden = true;
  }
  authForm.reset();
  setAuthMode("login");
  showAuthOverlay();
  setStatus("Abgemeldet. Mit einem Benutzer erneut anmelden.", "info");
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch((error) => {
      console.error("Service Worker konnte nicht registriert werden.", error);
    });
  });
}

function isStandaloneApp() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function hideInstallPrompt() {
  if (installPrompt) {
    installPrompt.hidden = true;
  }
}

function showInstallPrompt() {
  if (!installPrompt || isStandaloneApp()) {
    return;
  }

  installPrompt.hidden = false;
  if (deferredInstallPrompt) {
    installPromptText.textContent =
      "Installiere die App auf deinem Gerät, damit sie ohne Browserleiste wie eine echte App startet.";
  } else {
    installPromptText.textContent =
      "Wenn dein Browser keine direkte Installation anbietet, nutze im Browser-Menü „Zum Startbildschirm hinzufügen“ oder „App installieren“.";
  }
}

function bindInstallPrompt() {
  if (!installPrompt || isStandaloneApp()) {
    hideInstallPrompt();
    return;
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    showInstallPrompt();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    hideInstallPrompt();
  });

  dismissInstallPromptButton?.addEventListener("click", hideInstallPrompt);
  installAppButton?.addEventListener("click", async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice.catch(() => null);
      deferredInstallPrompt = null;
      hideInstallPrompt();
      return;
    }

    window.alert(
      "Bitte im Browser-Menü „Zum Startbildschirm hinzufügen“ oder „App installieren“ wählen."
    );
  });

  window.addEventListener("load", () => {
    window.setTimeout(showInstallPrompt, 900);
  });
}

function bindPanelButtons() {
  navToggle.addEventListener("click", toggleNavigation);
  focusMainButton?.addEventListener("click", closePanels);

  openPanelButtons.forEach((button) => {
    button.addEventListener("click", () => openPanel(button.dataset.openPanel));
  });

  closePanelButtons.forEach((button) => {
    button.addEventListener("click", closePanels);
  });

  panelOverlay.addEventListener("click", closePanels);
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!smtpInfoDialog.hidden) {
        closeSmtpInfoDialog();
        return;
      }
      if (!signatureDialog.hidden) {
        closeSignatureDialog();
        return;
      }
      if (!sendDialog.hidden) {
        closeSendDialog();
        return;
      }
      closePanels();
    }
  });
}

function bindSignaturePad() {
  clearSignaturePad();

  signaturePad.addEventListener("pointerdown", (event) => {
    isSignatureDrawing = true;
    const point = signaturePointFromEvent(event);
    signatureContext.beginPath();
    signatureContext.moveTo(point.x, point.y);
    hasSignatureStroke = true;
  });

  signaturePad.addEventListener("pointermove", (event) => {
    if (!isSignatureDrawing) {
      return;
    }

    const point = signaturePointFromEvent(event);
    signatureContext.lineTo(point.x, point.y);
    signatureContext.stroke();
  });

  const stopDrawing = () => {
    isSignatureDrawing = false;
  };

  signaturePad.addEventListener("pointerup", stopDrawing);
  signaturePad.addEventListener("pointerleave", stopDrawing);
  signaturePad.addEventListener("pointercancel", stopDrawing);
}

function bindDialogs() {
  closeSendDialogButton.addEventListener("click", closeSendDialog);
  openSignatureDialogButton.addEventListener("click", () => {
    clearSignaturePad();
    openSignatureDialog();
  });
  closeSignatureDialogButton.addEventListener("click", closeSignatureDialog);
  cancelSignatureButton.addEventListener("click", closeSignatureDialog);
  confirmSignatureButton.addEventListener("click", async () => {
    state.invoiceDraft.signatureDataUrl = hasSignatureStroke ? signaturePad.toDataURL("image/png") : "";
    await renderCanvas();
    refreshSendPreview();
    closeSignatureDialog();
    setStatus(
      state.invoiceDraft.signatureDataUrl
        ? "Unterschrift übernommen."
        : "Unterschriftsfenster geschlossen.",
      "success"
    );
  });
  clearSignatureButton.addEventListener("click", clearSignaturePad);
  sendInvoiceButton.addEventListener("click", sendInvoice);
  openSmtpInfoButton?.addEventListener("click", openSmtpInfoDialog);
  closeSmtpInfoDialogButton?.addEventListener("click", closeSmtpInfoDialog);
  confirmSmtpInfoDialogButton?.addEventListener("click", closeSmtpInfoDialog);
  smtpInfoDialog?.addEventListener("click", (event) => {
    if (event.target === smtpInfoDialog) {
      closeSmtpInfoDialog();
    }
  });
}

function bindStaticEvents() {
  invoiceForm.addEventListener("submit", (event) => event.preventDefault());
  settingsForm.addEventListener("submit", saveSettings);
  settingsFields.businessEmail.addEventListener("input", (event) => {
    syncBusinessEmailDefaults(event.target.value);
  });
  settingsFields.smtpEnabled?.addEventListener("change", updateSmtpVisibility);
  toggleSettingsAuthPasswordButton?.addEventListener("click", () => {
    settingsAuthPasswordInput.type =
      settingsAuthPasswordInput.type === "password" ? "text" : "password";
    updateSettingsAuthPasswordToggleLabel();
  });
  toggleSmtpPassButton?.addEventListener("click", () => {
    smtpPassInput.type = smtpPassInput.type === "password" ? "text" : "password";
    updateSmtpPassToggleLabel();
  });
  addCcEmailButton?.addEventListener("click", () => addCcEmailRow(""));
  ccEmailList?.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-remove-cc]");
    if (!removeButton) {
      return;
    }

    const removeIndex = Number(removeButton.dataset.removeCc);
    const entries = readCcEmailInputs().filter((_, index) => index !== removeIndex);
    renderCcEmailInputs(entries);
  });
  customerForm.addEventListener("submit", saveCustomer);
  articleForm.addEventListener("submit", saveArticle);
  articleForm.addEventListener("input", handleArticleFormLiveInput);
  customersSearchInput?.addEventListener("input", (event) => {
    state.filters.customers = event.target.value || "";
    renderCustomers();
  });
  articlesSearchInput?.addEventListener("input", (event) => {
    state.filters.articles = event.target.value || "";
    renderArticles();
  });
  customersTable.addEventListener("click", handleCustomerTableClick);
  articlesTable.addEventListener("click", handleArticleTableClick);
  invoiceItemsTable.addEventListener("input", handleInvoiceTableInput);
  invoiceItemsTable.addEventListener("change", handleInvoiceTableChange);
  invoiceItemsTable.addEventListener("click", handleInvoiceTableClick);
  addInvoiceItemButton.addEventListener("click", addInvoiceItem);
  addInvoiceItemInPanelButton?.addEventListener("click", () => {
    addInvoiceItem();
    closePanelsIfMobile();
  });
  createInvoiceButton.addEventListener("click", prepareInvoiceForSend);
  resetCustomerFormButton.addEventListener("click", resetCustomerForm);
  resetArticleFormButton.addEventListener("click", resetArticleForm);
  invoiceCustomer.addEventListener("change", handleInvoiceMetaInput);
  issueDateInput.addEventListener("input", handleInvoiceMetaInput);
  dueDateInput.addEventListener("input", handleInvoiceMetaInput);
  invoiceReferenceInput.addEventListener("input", handleInvoiceMetaInput);
  invoiceNotesInput.addEventListener("input", handleInvoiceMetaInput);
  authForm.addEventListener("submit", handleAuthSubmit);
  logoutButton?.addEventListener("click", handleLogout);
}

async function bootstrap() {
  try {
    setStatus("Lade Daten...");
    const response = await api("/api/bootstrap");
    state.settings = response.settings;
    state.customers = sortByNumericField(response.customers || [], "customerNumber");
    state.articles = sortByNumericField((response.articles || []).map(normalizeArticle), "number");
    state.invoices = response.invoices || [];

    if (!state.invoiceDraft.customerId) {
      state.invoiceDraft.customerId = state.customers[0]?.id || "";
    }

    populateSettingsForm();
    refreshBrandAssets();
    fillCustomerForm(null);
    fillArticleForm(null);
    syncInvoiceMetaInputs();
    renderCustomers();
    renderArticles();
    renderInvoiceItems();
    updateInvoiceTotalsDisplay();
    renderInvoiceHistory();
    await renderCanvas();
    if (logoutButton) {
      logoutButton.hidden = false;
    }
    setStatus("Bereit. Rechnung kann erstellt werden.", "success");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Die App konnte nicht geladen werden.", "error");
  }
}

async function initializeApp() {
  appVersion.textContent = APP_VERSION;
  panelOverlay.hidden = true;
  sendDialog.hidden = true;
  signatureDialog.hidden = true;
  smtpInfoDialog.hidden = true;
  authOverlay.hidden = true;
  if (logoutButton) {
    logoutButton.hidden = true;
  }
  document.body.classList.remove("panel-open");
  try {
    await loadAuthState();
  } catch (error) {
    console.error(error);
    setStatus("Anmeldedaten konnten nicht geladen werden.", "error");
  }
  setAuthMode("login");
  settingsFields.authUsername?.closest("fieldset")?.setAttribute("hidden", "");
  normalizeEmailSettingsLayout();
  updateSettingsAuthPasswordToggleLabel();
  updateSmtpVisibility();

  authUsernameInput.value = state.auth.username || "";
  if (state.auth.authenticated) {
    hideAuthOverlay();
    await bootstrap();
    return;
  }

  showAuthOverlay();
  setStatus("Bitte anmelden.");
}

loadCollapsedState();
bindPanelButtons();
bindSignaturePad();
bindDialogs();
bindInstallPrompt();
bindStaticEvents();
registerServiceWorker();
initializeApp();
