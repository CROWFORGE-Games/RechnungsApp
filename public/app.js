const APP_VERSION = "V1.1.3";

const STORAGE_KEYS = {
  navCollapsed: "billingapp.navCollapsed",
  authToken: "billingapp.auth.token",
  authUsername: "billingapp.auth.username",
  authPassword: "billingapp.auth.password"
};

const BRAND_ASSET_URLS = {
  invoice: "/api/assets/logo/invoice",
  app: "/api/assets/logo/app"
};
const INVOICE_LOGO_PLACEHOLDER_URL = "/assets/logo-placeholder.svg";
const APP_LOGO_PLACEHOLDER_URL = "/assets/app-icon.svg";
const EMPTY_IMAGE_DATA_URL =
  "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
const DEVICE_ASSET_DB_NAME = "billingapp-assets";
const DEVICE_ASSET_DB_VERSION = 1;
const DEVICE_ASSET_STORE = "invoiceLogos";

const state = {
  auth: {
    hasUser: false,
    authenticated: false,
    username: "",
    mode: "login"
  },
  settings: null,
  resendConfigured: false,
  adminUsers: [],
  adminExpandedUsers: [],
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
    items: [],
    signatureDataUrl: ""
  }
};

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
  if (normalized.includes("?")) {
    try {
      normalized = decodeURIComponent(escape(normalized));
    } catch {
      // Fallback auf den Originaltext.
    }
  }

  normalized = normalized
    .replaceAll("Ã¼", "ü")
    .replaceAll("Ãœ", "Ü")
    .replaceAll("Ã¶", "ö")
    .replaceAll("Ã–", "Ö")
    .replaceAll("Ã¤", "ä")
    .replaceAll("Ã„", "Ä")
    .replaceAll("ÃŸ", "ß")
    .replaceAll("â€¦", "…")
    .replaceAll("â€“", "–")
    .replaceAll("â€”", "—")
    .replaceAll("â†’", "→")
    .replaceAll("â‚¬", "€")
    .replaceAll("Ã—", "×")
    .replaceAll("â€ž", "„")
    .replaceAll("â€œ", "“")
    .replaceAll("â€", "”")
    .replaceAll("\uFFFDsterreich", "\u00D6sterreich")
    .replaceAll("\uFFFDberweisung", "\u00DCberweisung")
    .replaceAll("Gr\uFFFD\uFFFDe", "Gr\u00FC\u00DFe")
    .replaceAll("gr\uFFFD\uFFFDe", "gr\u00FC\u00DFe")
    .replaceAll("Stra\uFFFDe", "Stra\u00DFe")
    .replaceAll("stra\uFFFDe", "stra\u00DFe")
    .replaceAll("Strasse", "Stra\u00DFe")
    .replaceAll("strasse", "stra\u00DFe")
    .replaceAll("\uFFFD\u0013", "\u00D6")
    .replaceAll("\uFFFDS", "\u00DC")
    .replaceAll("\uFFFDx", "\u00DF")
    .replaceAll("\uFFFD", "");

  LEGACY_TEXT_REPLACEMENTS.forEach(([source, target]) => {
    normalized = normalized.replaceAll(source, target);
  });

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
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, normalizeLegacyData(entry)]));
  }

  return value;
}

const appShell = document.getElementById("appShell");
const statusBanner = document.getElementById("statusBanner");
const appVersion = document.getElementById("appVersion");
const settingsVersion = document.getElementById("settingsVersion");
const authVersion = document.getElementById("authVersion");
const saveSettingsButton = document.getElementById("saveSettingsButton");
const saveSettingsActions = saveSettingsButton?.closest(".panel-form-actions") || null;
const settingsPanelTitle = document.getElementById("settingsPanelTitle");
const templateHint = document.getElementById("templateHint");
const mainInvoiceArea = document.getElementById("mainInvoiceArea");
const adminMainArea = document.getElementById("adminMainArea");
const adminUserForm = document.getElementById("adminUserForm");
const adminNewUsernameInput = document.getElementById("adminNewUsername");
const adminDefaultPasswordInput = document.getElementById("adminDefaultPassword");
const saveAdminDefaultPasswordButton = document.getElementById("saveAdminDefaultPassword");
const adminUsersTable = document.getElementById("adminUsersTable");
const mainRailLabel = document.getElementById("mainRailLabel");
const customersRailButton = document.getElementById("customersRailButton");
const customersRailLabel = document.getElementById("customersRailLabel");
const articlesRailButton = document.getElementById("articlesRailButton");
const articlesRailLabel = document.getElementById("articlesRailLabel");
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
const invoiceItemsWrap = invoiceItemsTable?.closest(".invoice-items-wrap") || null;
const invoiceItemsFooter = invoiceTotals?.closest(".invoice-items-footer") || null;
const invoiceHistory = document.getElementById("invoiceHistory");
const invoiceCanvas = document.getElementById("invoiceCanvas");
const canvasContext = invoiceCanvas.getContext("2d");
const addInvoiceItemButton = document.getElementById("addInvoiceItem");
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
const logoutButtonSettings = document.getElementById("logoutButtonSettings");
const settingsAuthUsernameDisplay = document.getElementById("settingsAuthUsernameDisplay");
const settingsAuthPasswordInput = document.getElementById("settingsAuthPassword");
const toggleSettingsAuthPasswordButton = document.getElementById("toggleSettingsAuthPassword");
const changeSettingsPasswordButton = document.getElementById("changeSettingsPassword");
const ccEmailList = document.getElementById("ccEmailList");
const addCcEmailButton = document.getElementById("addCcEmail");
const invoiceLogoFileInput = document.getElementById("invoiceLogoFile");
const appLogoFileInput = document.getElementById("appLogoFile");
const removeInvoiceLogoButton = document.getElementById("removeInvoiceLogo");
const removeAppLogoButton = document.getElementById("removeAppLogo");
const appFavicon = document.getElementById("appFavicon");
const appleTouchIcon = document.getElementById("appleTouchIcon");
const appManifest = document.getElementById("appManifest");
const bannerLogoImages = [...document.querySelectorAll("[data-banner-logo]")];
const appLogoImages = [...document.querySelectorAll("[data-app-logo]")];
const settingsLogoPreviewImages = [...document.querySelectorAll("[data-settings-logo-preview]")];
const settingsLogoPreviewCards = [...document.querySelectorAll("[data-logo-card]")];
const adminHiddenSettingsSections = [...document.querySelectorAll("[data-admin-hidden-section]")];
const sendDialog = document.getElementById("sendDialog");
const closeSendDialogButton = document.getElementById("closeSendDialog");
const openSignatureDialogButton = document.getElementById("openSignatureDialog");
const sendInvoiceButton = document.getElementById("sendInvoiceButton");
const shareInvoiceButton = document.getElementById("shareInvoiceButton");
const sendPreviewPages = document.getElementById("sendPreviewPages");
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
const passwordDialog = document.getElementById("passwordDialog");
const passwordDialogForm = document.getElementById("passwordDialogForm");
const closePasswordDialogButton = document.getElementById("closePasswordDialog");
const cancelPasswordDialogButton = document.getElementById("cancelPasswordDialog");
const passwordDialogNewInput = document.getElementById("passwordDialogNew");
const passwordDialogConfirmInput = document.getElementById("passwordDialogConfirm");
const togglePasswordDialogNewButton = document.getElementById("togglePasswordDialogNew");
const togglePasswordDialogConfirmButton = document.getElementById("togglePasswordDialogConfirm");
const confirmPasswordDialogButton = document.getElementById("confirmPasswordDialog");
const passwordDialogFeedback = document.getElementById("passwordDialogFeedback");
const installPrompt = document.getElementById("installPrompt");
const installPromptText = document.getElementById("installPromptText");
const dismissInstallPromptButton = document.getElementById("dismissInstallPrompt");
const installAppButton = document.getElementById("installAppButton");
const loadingOverlay = document.getElementById("loadingOverlay");
const loadingOverlayText = document.getElementById("loadingOverlayText");
const railButtons = [...document.querySelectorAll(".rail-button")];
const panelElements = [...document.querySelectorAll(".side-panel")];
const openPanelButtons = [...document.querySelectorAll("[data-open-panel]")];
const closePanelButtons = [...document.querySelectorAll("[data-close-panel]")];
const focusMainButton = document.querySelector("[data-focus-main]");
const resetCustomerFormButton = document.getElementById("resetCustomerForm");
const resetArticleFormButton = document.getElementById("resetArticleForm");
const saveCustomerButton = document.getElementById("saveCustomerButton");
const saveArticleButton = document.getElementById("saveArticleButton");
const articleGroupSuggestions = document.getElementById("articleGroupSuggestions");

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
let signatureBounds = null;
let deferredInstallPrompt = null;
let authRefreshPromise = null;
let hideArticleGroupSuggestionsTimer = 0;

function sortObjectDeep(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => sortObjectDeep(entry));
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = sortObjectDeep(value[key]);
        return result;
      }, {});
  }

  return value;
}

function stableSerialize(value) {
  return JSON.stringify(sortObjectDeep(value));
}

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
    quantity: 1,
    unit: "",
    unitPrice: 0,
    taxRate: 20,
    discount: 0,
    detailsExpanded: false
  };
}

function toNumber(value, fallback = 0) {
  const normalized = Number.parseFloat(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function roundCurrency(value) {
  return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
}

// Singleton formatter for performance (avoid recreating on every call)
const FMT_CURRENCY = new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" });
const FMT_AMOUNT   = new Intl.NumberFormat("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const FMT_TIME     = new Intl.DateTimeFormat("de-AT", { hour: "2-digit", minute: "2-digit" });
const FMT_DATE     = new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
const FMT_DATETIME = new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

function formatCurrency(value) {
  return FMT_CURRENCY.format(toNumber(value));
}

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return FMT_TIME.format(date);
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return FMT_DATETIME.format(date);
}

function formatAmount(value) {
  return FMT_AMOUNT.format(toNumber(value));
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return FMT_DATE.format(date);
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
    .replace(/\u00DF/g, "ss")
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

function isAdminUser() {
  return state.auth.username === "admin";
}

function normalizeArticle(article) {
  return {
    ...article,
    unit: String(article.unit || "").trim(),
    unitPrice: toNumber(article.unitPrice),
    taxRate: toNumber(article.taxRate, 20)
  };
}

async function performApiRequest(url, options = {}) {
  const authToken = window.localStorage.getItem(STORAGE_KEYS.authToken) || "";
  return fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(options.headers || {})
    },
    ...options
  });
}

function getStoredCredentials() {
  const username = String(window.localStorage.getItem(STORAGE_KEYS.authUsername) || "").trim();
  const password = String(window.localStorage.getItem(STORAGE_KEYS.authPassword) || "");
  return username && password ? { username, password } : null;
}

function persistStoredCredentials(username, password) {
  window.localStorage.setItem(STORAGE_KEYS.authUsername, String(username || "").trim());
  window.localStorage.setItem(STORAGE_KEYS.authPassword, String(password || ""));
}

function clearStoredCredentials() {
  window.localStorage.removeItem(STORAGE_KEYS.authUsername);
  window.localStorage.removeItem(STORAGE_KEYS.authPassword);
}

async function tryAutoLoginFromStoredCredentials() {
  const credentials = getStoredCredentials();
  if (!credentials) {
    return false;
  }

  if (!authRefreshPromise) {
    authRefreshPromise = (async () => {
      try {
        const response = await performApiRequest("/api/auth/login", {
          method: "POST",
          body: JSON.stringify(credentials)
        });

        if (!response.ok) {
          throw new Error("Automatische Anmeldung fehlgeschlagen.");
        }

        const data = await response.json();
        window.localStorage.setItem(STORAGE_KEYS.authToken, data.token);
        state.auth.hasUser = true;
        state.auth.authenticated = true;
        state.auth.username = String(data.username || credentials.username).trim();
        return true;
      } catch {
        clearAuthToken();
        clearStoredCredentials();
        state.auth.authenticated = false;
        state.auth.username = "";
        return false;
      } finally {
        authRefreshPromise = null;
      }
    })();
  }

  return authRefreshPromise;
}

async function api(url, options = {}) {
  let response = await performApiRequest(url, options);

  if (
    !response.ok &&
    response.status === 401 &&
    !String(url).includes("/api/auth/login") &&
    !String(url).includes("/api/auth/session") &&
    !String(url).includes("/api/auth/logout")
  ) {
    const reloginWorked = await tryAutoLoginFromStoredCredentials();
    if (reloginWorked) {
      response = await performApiRequest(url, options);
    }
  }

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(async () => ({ error: (await response.text().catch(() => "")).trim() || "Unbekannter Fehler" }));
    if (
      response.status === 401 &&
      !String(url).includes("/api/auth/login") &&
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

function normalizeStorageUsername(username = "") {
  return String(username || "").trim().toLowerCase();
}

let deviceAssetDbPromise = null;

function openDeviceAssetDatabase() {
  if (!("indexedDB" in window)) {
    return Promise.resolve(null);
  }

  if (!deviceAssetDbPromise) {
    deviceAssetDbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DEVICE_ASSET_DB_NAME, DEVICE_ASSET_DB_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(DEVICE_ASSET_STORE)) {
          database.createObjectStore(DEVICE_ASSET_STORE, { keyPath: "username" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Logo-Datenbank konnte nicht geöffnet werden."));
    }).catch((error) => {
      console.warn("Lokale Logo-Datenbank ist nicht verfügbar.", error);
      return null;
    });
  }

  return deviceAssetDbPromise;
}

function getInvoiceLogoStorageKey(username = state.settings?.auth?.username || state.auth.username) {
  const normalizedUsername = normalizeStorageUsername(username);
  return normalizedUsername ? `billingapp.invoiceLogo.${normalizedUsername}` : "";
}

function readPersistedInvoiceLogo(username = state.settings?.auth?.username || state.auth.username) {
  const storageKey = getInvoiceLogoStorageKey(username);
  if (!storageKey) {
    return "";
  }
  return String(window.localStorage.getItem(storageKey) || "");
}

function persistInvoiceLogoLocally(dataUrl = "", username = state.settings?.auth?.username || state.auth.username) {
  const storageKey = getInvoiceLogoStorageKey(username);
  if (!storageKey) {
    return;
  }
  try {
    if (String(dataUrl || "").startsWith("data:image/")) {
      window.localStorage.setItem(storageKey, String(dataUrl));
      return;
    }
    window.localStorage.removeItem(storageKey);
  } catch (error) {
    console.warn("Rechnungslogo konnte lokal nicht gespeichert werden.", error);
  }
}

async function readPersistedInvoiceLogoFromDevice(username = state.settings?.auth?.username || state.auth.username) {
  const localDataUrl = readPersistedInvoiceLogo(username);
  if (localDataUrl.startsWith("data:image/")) {
    return localDataUrl;
  }

  const normalizedUsername = normalizeStorageUsername(username);
  if (!normalizedUsername) {
    return "";
  }

  try {
    const database = await openDeviceAssetDatabase();
    if (!database) {
      return localDataUrl;
    }

    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(DEVICE_ASSET_STORE, "readonly");
      const store = transaction.objectStore(DEVICE_ASSET_STORE);
      const request = store.get(normalizedUsername);
      request.onsuccess = () => resolve(String(request.result?.dataUrl || ""));
      request.onerror = () => reject(request.error || new Error("Rechnungslogo konnte nicht geladen werden."));
    });
  } catch (error) {
    console.warn("Rechnungslogo konnte nicht aus dem Gerätespeicher gelesen werden.", error);
    return localDataUrl;
  }
}

async function persistInvoiceLogoToDeviceCache(
  dataUrl = "",
  username = state.settings?.auth?.username || state.auth.username
) {
  persistInvoiceLogoLocally(dataUrl, username);

  const normalizedUsername = normalizeStorageUsername(username);
  if (!normalizedUsername) {
    return;
  }

  try {
    const database = await openDeviceAssetDatabase();
    if (!database) {
      return;
    }

    await new Promise((resolve, reject) => {
      const transaction = database.transaction(DEVICE_ASSET_STORE, "readwrite");
      const store = transaction.objectStore(DEVICE_ASSET_STORE);
      const request = String(dataUrl || "").startsWith("data:image/")
        ? store.put({ username: normalizedUsername, dataUrl: String(dataUrl) })
        : store.delete(normalizedUsername);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error("Rechnungslogo konnte nicht gespeichert werden."));
    });
  } catch (error) {
    console.warn("Rechnungslogo konnte nicht im Gerätespeicher gespeichert werden.", error);
  }
}

function hydrateInvoiceLogoFromLocalCache(username = state.settings?.auth?.username || state.auth.username) {
  if (!state.settings) {
    return;
  }

  const currentBranding = normalizeLegacyData(state.settings?.branding || {});
  const currentDataUrl = String(currentBranding.invoiceLogoDataUrl || "");
  if (currentDataUrl.startsWith("data:image/")) {
    setBrandingLogoState("invoice", currentDataUrl);
    persistInvoiceLogoLocally(currentDataUrl, username);
    return;
  }

  const cachedDataUrl = readPersistedInvoiceLogo(username);
  if (cachedDataUrl.startsWith("data:image/")) {
    setBrandingLogoState("invoice", cachedDataUrl);
  }
}

async function hydrateInvoiceLogoFromDeviceCache(username = state.settings?.auth?.username || state.auth.username) {
  hydrateInvoiceLogoFromLocalCache(username);

  if (!state.settings?.branding?.invoiceLogoDataUrl) {
    const cachedDataUrl = await readPersistedInvoiceLogoFromDevice(username);
    if (cachedDataUrl.startsWith("data:image/")) {
      setBrandingLogoState("invoice", cachedDataUrl);
      persistInvoiceLogoLocally(cachedDataUrl, username);
    }
  }
}

async function fetchImageAsDataUrl(url) {
  const response = await fetch(url, { credentials: "same-origin" });
  if (!response.ok) {
    throw new Error("Bild konnte nicht geladen werden.");
  }

  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || "");
      if (!result.startsWith("data:image/")) {
        reject(new Error("Bilddaten konnten nicht gelesen werden."));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(new Error("Bilddaten konnten nicht gelesen werden."));
    reader.readAsDataURL(blob);
  });
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
  state.adminUsers = [];
  state.adminExpandedUsers = [];
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
    items: [],
    signatureDataUrl: ""
  };
  logoState.loaded = false;
  logoState.image = null;
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

function setLoading(active, message = "Lade Daten...") {
  if (!loadingOverlay) {
    return;
  }

  if (loadingOverlayText) {
    loadingOverlayText.textContent = message;
  }

  loadingOverlay.hidden = !active;
}

async function updateLoadingStep(message) {
  setLoading(true, message);
  await new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}

function setActiveRail(targetPanelId = null) {
  railButtons.forEach((button) => {
    const isMain = !targetPanelId && button.hasAttribute("data-focus-main");
    const isPanel = targetPanelId && button.dataset.openPanel === targetPanelId;
    button.classList.toggle("is-active", Boolean(isMain || isPanel));
  });
}

function applyRoleBasedUi() {
  const adminMode = isAdminUser();

  if (mainInvoiceArea) {
    mainInvoiceArea.hidden = adminMode;
  }
  if (adminMainArea) {
    adminMainArea.hidden = !adminMode;
  }
  if (mainRailLabel) {
    mainRailLabel.textContent = adminMode ? "Benutzer" : "Rechnungen";
  }
  // Benutzername unter dem Logo in der Nav anzeigen
  const navUserLabel = document.getElementById("navUserLabel");
  if (navUserLabel) {
    navUserLabel.textContent = state.settings?.business?.companyName || state.auth.username || "";
  }
  if (customersRailButton) {
    customersRailButton.hidden = adminMode;
  }
  if (articlesRailButton) {
    articlesRailButton.hidden = adminMode;
  }
  if (customersRailLabel) {
    customersRailLabel.textContent = "Kunden";
  }
  if (articlesRailLabel) {
    articlesRailLabel.textContent = "Artikel";
  }
  if (settingsPanelTitle) {
    settingsPanelTitle.textContent = adminMode ? "Benutzer" : "Firma, Bank und E-Mail";
  }
  adminHiddenSettingsSections.forEach((section) => {
    section.hidden = adminMode;
  });

  if (adminMode && (state.openPanelId === "customersPanel" || state.openPanelId === "articlesPanel")) {
    closePanels();
  }
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

function collapseSettingsAccordions() {
  if (!settingsForm) {
    return;
  }

  settingsForm.querySelectorAll("details.settings-accordion").forEach((detailsElement) => {
    detailsElement.open = false;
  });
}

function openPanel(panelId) {
  const targetPanel = panelElements.find((panel) => panel.id === panelId);
  if (!targetPanel || targetPanel.hidden) {
    return;
  }

  // Formulare beim Panelwechsel zuruecksetzen
  if (state.openPanelId !== panelId) {
    if (customerForm && !customerForm.hidden) {
      customerForm.hidden = true;
    }
    if (articleForm && !articleForm.hidden) {
      articleForm.hidden = true;
    }
  }

  state.openPanelId = panelId;
  setActiveRail(panelId);
  panelOverlay.hidden = false;
  document.body.classList.add("panel-open");

  if (panelId === "settingsPanel") {
    collapseSettingsAccordions();
  }

  panelElements.forEach((panel) => {
    const isOpen = panel.id === panelId;
    panel.classList.toggle("is-open", isOpen);
    panel.setAttribute("aria-hidden", String(!isOpen));
  });
}

function closePanels() {
  // Formulare beim Schliessen verstecken
  if (customerForm) customerForm.hidden = true;
  if (articleForm) articleForm.hidden = true;

  state.openPanelId = null;
  setActiveRail(null);
  panelOverlay.hidden = true;
  panelElements.forEach((panel) => {
    panel.classList.remove("is-open");
    panel.setAttribute("aria-hidden", "true");
  });
  if (authOverlay.hidden && sendDialog.hidden && signatureDialog.hidden && passwordDialog.hidden) {
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
  document.body.classList.add("dialog-open");
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
  if (passwordDialog.hidden && authOverlay.hidden) {
    document.body.classList.remove("dialog-open");
  }
  if (authOverlay.hidden && state.openPanelId === null && passwordDialog.hidden) {
    document.body.classList.remove("panel-open");
  }
}

function openSignatureDialog() {
  signatureDialog.hidden = false;
  document.body.classList.add("panel-open");
  document.body.classList.add("dialog-open");
  window.requestAnimationFrame(() => {
    signatureDialog.scrollTop = 0;
    if (signatureDialogCard) {
      signatureDialogCard.scrollTop = 0;
    }
  });
}

function closeSignatureDialog() {
  signatureDialog.hidden = true;
  if (sendDialog.hidden && passwordDialog.hidden && authOverlay.hidden) {
    document.body.classList.remove("dialog-open");
  }
  if (authOverlay.hidden && state.openPanelId === null && sendDialog.hidden && passwordDialog.hidden) {
    document.body.classList.remove("panel-open");
  }
}

function openPasswordDialog() {
  passwordDialogForm?.reset();
  if (passwordDialogNewInput) {
    passwordDialogNewInput.type = "password";
  }
  if (passwordDialogConfirmInput) {
    passwordDialogConfirmInput.type = "password";
  }
  updatePasswordDialogValidation();
  passwordDialog.hidden = false;
  document.body.classList.add("panel-open");
  document.body.classList.add("dialog-open");
  window.setTimeout(() => {
    passwordDialogNewInput?.focus();
  }, 50);
}

function closePasswordDialog() {
  passwordDialog.hidden = true;
  passwordDialogForm?.reset();
  if (passwordDialogNewInput) {
    passwordDialogNewInput.type = "password";
  }
  if (passwordDialogConfirmInput) {
    passwordDialogConfirmInput.type = "password";
  }
  updatePasswordDialogValidation();
  if (sendDialog.hidden && signatureDialog.hidden && authOverlay.hidden) {
    document.body.classList.remove("dialog-open");
  }
  if (
    authOverlay.hidden &&
    state.openPanelId === null &&
    sendDialog.hidden &&
    signatureDialog.hidden
  ) {
    document.body.classList.remove("panel-open");
  }
}

async function loadAuthState() {
  state.auth.hasUser = true;
  const authToken = window.localStorage.getItem(STORAGE_KEYS.authToken) || "";

  if (!authToken) {
    const reloginWorked = await tryAutoLoginFromStoredCredentials();
    if (reloginWorked) {
      return;
    }
    state.auth.authenticated = false;
    state.auth.username = getStoredCredentials()?.username || "";
    return;
  }

  try {
    const response = await api("/api/auth/session");
    state.auth.username = String(response.username || "").trim();
    state.auth.authenticated = Boolean(state.auth.username);
  } catch {
    clearAuthToken();
    const reloginWorked = await tryAutoLoginFromStoredCredentials();
    if (reloginWorked) {
      return;
    }
    state.auth.authenticated = false;
    state.auth.username = getStoredCredentials()?.username || "";
  }
}

function setAuthMode(mode = "login") {
  state.auth.mode = "login";
  authModeKicker.textContent = "Anmeldung";
  authTitle.textContent = "Anmelden";
  authText.textContent = "Mit einem vorhandenen Benutzer anmelden.";
  authSubmit.textContent = "Anmelden";
}

function showAuthOverlay() {
  authOverlay.hidden = false;
  document.body.classList.add("panel-open");
  document.body.classList.add("dialog-open");
}

function hideAuthOverlay() {
  authOverlay.hidden = true;
  if (sendDialog.hidden && signatureDialog.hidden && passwordDialog.hidden) {
    document.body.classList.remove("dialog-open");
  }
  if (state.openPanelId === null && sendDialog.hidden && signatureDialog.hidden && passwordDialog.hidden) {
    document.body.classList.remove("panel-open");
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    const url = new URL(String(src), window.location.origin);
    url.searchParams.set("cb", String(Date.now()));
    image.src = url.toString();
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
  signatureBounds = null;
}

function extendSignatureBounds(point) {
  if (!point) {
    return;
  }

  if (!signatureBounds) {
    signatureBounds = {
      minX: point.x,
      minY: point.y,
      maxX: point.x,
      maxY: point.y
    };
    return;
  }

  signatureBounds.minX = Math.min(signatureBounds.minX, point.x);
  signatureBounds.minY = Math.min(signatureBounds.minY, point.y);
  signatureBounds.maxX = Math.max(signatureBounds.maxX, point.x);
  signatureBounds.maxY = Math.max(signatureBounds.maxY, point.y);
}

function exportSignatureDataUrl() {
  if (!hasSignatureStroke || !signatureBounds) {
    return "";
  }

  const padding = 14;
  const minX = Math.max(Math.floor(signatureBounds.minX - padding), 0);
  const minY = Math.max(Math.floor(signatureBounds.minY - padding), 0);
  const maxX = Math.min(Math.ceil(signatureBounds.maxX + padding), signaturePad.width);
  const maxY = Math.min(Math.ceil(signatureBounds.maxY + padding), signaturePad.height);
  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);

  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = width;
  exportCanvas.height = height;
  const exportContext = exportCanvas.getContext("2d");
  exportContext.fillStyle = "#ffffff";
  exportContext.fillRect(0, 0, width, height);
  exportContext.drawImage(signaturePad, minX, minY, width, height, 0, 0, width, height);
  return exportCanvas.toDataURL("image/png");
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
  if (!sendPreviewPages) {
    return;
  }

  const pageHeight = 1123;
  const pageCount = Math.max(1, Math.ceil(invoiceCanvas.height / pageHeight));
  sendPreviewPages.innerHTML = "";

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const sliceY = pageIndex * pageHeight;
    const sliceHeight = Math.min(pageHeight, invoiceCanvas.height - sliceY);
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = invoiceCanvas.width;
    pageCanvas.height = pageHeight;
    pageCanvas.className = "send-preview-page__canvas";

    const pageContext = pageCanvas.getContext("2d");
    pageContext.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
    pageContext.fillStyle = "#ffffff";
    pageContext.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    pageContext.drawImage(
      invoiceCanvas,
      0,
      sliceY,
      invoiceCanvas.width,
      sliceHeight,
      0,
      0,
      pageCanvas.width,
      sliceHeight
    );

    const pageCard = document.createElement("section");
    pageCard.className = "send-preview-page";

    const pageLabel = document.createElement("p");
    pageLabel.className = "send-preview-page__label";
    pageLabel.textContent = `Seite ${pageIndex + 1}${pageCount > 1 ? ` / ${pageCount}` : ""}`;

    pageCard.append(pageLabel, pageCanvas);
    sendPreviewPages.append(pageCard);
  }
}

async function loadTemplate() {
  if (templateState.loaded) {
    return templateState.image;
  }

  const candidates = ["/assets/invoice-template.png", "/assets/image.png", "/assets/template.png"];
  for (const candidate of candidates) {
    try {
      // Kein Date.now()-Cache-Busting hier - Template aendert sich nicht im Betrieb
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = candidate;
      });
      templateState.image = img;
      templateState.loaded = true;
      templateHint.textContent = `Vorlage geladen: ${candidate}`;
      return templateState.image;
    } catch {
      // Naechste Datei versuchen.
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

  const cachedInvoiceLogoDataUrl = String(state.settings?.branding?.invoiceLogoDataUrl || "");
  if (cachedInvoiceLogoDataUrl.startsWith("data:image/")) {
    try {
      logoState.image = await loadImage(cachedInvoiceLogoDataUrl);
      logoState.loaded = true;
      return logoState.image;
    } catch {
      // Fallback auf Server-Asset.
    }
  }

  const deviceCachedLogoDataUrl = await readPersistedInvoiceLogoFromDevice();
  if (deviceCachedLogoDataUrl.startsWith("data:image/")) {
    try {
      setBrandingLogoState("invoice", deviceCachedLogoDataUrl);
      persistInvoiceLogoLocally(deviceCachedLogoDataUrl);
      logoState.image = await loadImage(deviceCachedLogoDataUrl);
      logoState.loaded = true;
      return logoState.image;
    } catch {
      // Fallback auf Server-Asset.
    }
  }

  if (!state.settings?.branding?.hasInvoiceLogo) {
    logoState.loaded = true;
    return null;
  }

  try {
    const serverLogoDataUrl = await fetchImageAsDataUrl(getBrandAssetUrl("invoice"));
    setBrandingLogoState("invoice", serverLogoDataUrl);
    await persistInvoiceLogoToDeviceCache(serverLogoDataUrl);
    logoState.image = await loadImage(serverLogoDataUrl);
    logoState.loaded = true;
    return logoState.image;
  } catch {
    try {
      logoState.image = await loadImage(getBrandAssetUrl("invoice"));
      logoState.loaded = true;
      return logoState.image;
    } catch {
      // Platzhalter statt Standardlogo.
    }
  }

  logoState.loaded = true;
  return null;
}

function getBrandingLogoDataUrl(kind) {
  const branding = state.settings?.branding || {};
  return kind === "invoice"
    ? String(branding.invoiceLogoDataUrl || "")
    : String(branding.appLogoDataUrl || "");
}

function setBrandingLogoState(kind, dataUrl = "") {
  state.settings = state.settings || {};
  state.settings.branding = {
    ...(state.settings?.branding || {}),
    ...(kind === "invoice"
      ? {
          hasInvoiceLogo: Boolean(dataUrl),
          invoiceLogoDataUrl: String(dataUrl || "")
        }
      : {
          hasAppLogo: Boolean(dataUrl),
          appLogoDataUrl: String(dataUrl || "")
        })
  };
  if (kind === "invoice") {
    logoState.loaded = false;
    logoState.image = null;
  }
}

function applyReceivedSettings(settings) {
  if (!settings) {
    return;
  }

  state.settings = normalizeLegacyData(settings);
  state.auth.username = settings.auth?.username || state.auth.username;
  hydrateInvoiceLogoFromLocalCache(state.settings?.auth?.username || state.auth.username);
}

function populateSettingsForm() {
  if (!state.settings) {
    return;
  }

  state.settings = normalizeLegacyData(state.settings);
  const { business, invoice, email, auth } = state.settings;
  settingsFields.authUsername.value = auth?.username || "";
  if (settingsAuthUsernameDisplay) {
    settingsAuthUsernameDisplay.textContent = auth?.username || state.auth.username || "admin";
  }
  settingsFields.authPassword.value = auth?.password || "";
  settingsFields.companyName.value = business.companyName || "";
  settingsFields.addressLine1.value = business.addressLine1 || "";
  settingsFields.addressLine2.value = business.addressLine2 || "";
  settingsFields.postalCode.value = business.postalCode || "";
  settingsFields.city.value = business.city || "";
  settingsFields.country.value = normalizeLegacyText(business.country || "");
  settingsFields.phone.value = business.phone || "";
  settingsFields.businessEmail.value = business.email || "";
  settingsFields.uid.value = business.uid || "";
  settingsFields.bankName.value = business.bankName || "";
  settingsFields.iban.value = business.iban || "";
  settingsFields.bic.value = business.bic || "";
  settingsFields.issuerName.value = business.issuerName || "";
  settingsFields.paymentNote.value = business.paymentNote || "Fällig innerhalb von 14 Tagen ohne Abzug.";
  settingsFields.footerNote.value = business.footerNote || "";
  settingsFields.invoiceTitle.value = invoice.title || "Rechnung";
  settingsFields.counterValue.value = invoice.counterValue ?? 0;
  settingsFields.counterYear.value = invoice.counterYear ?? new Date().getFullYear();
  renderCcEmailInputs(parseEmailList(email.ccEmail || business.email || ""));
  settingsFields.emailSubject.value = email.subjectTemplate || "";
  settingsFields.emailBody.value = email.bodyTemplate || "";
  updateSettingsAuthPasswordToggleLabel();
  if (adminDefaultPasswordInput) {
    adminDefaultPasswordInput.value = auth?.defaultUserPassword || "admin";
  }
  updateAdminDefaultPasswordButtonVisibility();
  updateSettingsSaveButtonVisibility();
}

function updateAdminDefaultPasswordButtonVisibility() {
  if (!adminDefaultPasswordInput || !saveAdminDefaultPasswordButton) {
    return;
  }

  const savedDefaultPassword = String(state.settings?.auth?.defaultUserPassword || "admin").trim() || "admin";
  const currentDefaultPassword = String(adminDefaultPasswordInput.value || "").trim() || "admin";
  const hasChanged = currentDefaultPassword !== savedDefaultPassword;
  saveAdminDefaultPasswordButton.hidden = !hasChanged;
  saveAdminDefaultPasswordButton.disabled = !hasChanged;
}

function readSettingsForm() {
  return {
    business: {
      companyName: settingsFields.companyName.value.trim(),
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
      username: settingsFields.authUsername.value.trim() || state.auth.username || "admin",
      password: settingsFields.authPassword.value
    },
    invoice: {
      title: settingsFields.invoiceTitle.value.trim() || "Rechnung",
      counterValue: toNumber(settingsFields.counterValue.value, 0),
      counterYear: toNumber(settingsFields.counterYear.value, new Date().getFullYear())
    },
    email: {
      ccEmail: getCcEmailValue(),
      subjectTemplate: settingsFields.emailSubject.value.trim(),
      bodyTemplate: settingsFields.emailBody.value.trim()
    }
  };
}

function getComparableSettingsPayload(settings = readSettingsForm()) {
  const normalized = normalizeLegacyData(settings);
  return {
    business: {
      companyName: String(normalized?.business?.companyName || "").trim(),
      addressLine1: String(normalized?.business?.addressLine1 || "").trim(),
      addressLine2: String(normalized?.business?.addressLine2 || "").trim(),
      postalCode: String(normalized?.business?.postalCode || "").trim(),
      city: String(normalized?.business?.city || "").trim(),
      country: String(normalized?.business?.country || "").trim(),
      phone: String(normalized?.business?.phone || "").trim(),
      email: String(normalized?.business?.email || "").trim(),
      uid: String(normalized?.business?.uid || "").trim(),
      bankName: String(normalized?.business?.bankName || "").trim(),
      iban: String(normalized?.business?.iban || "").trim(),
      bic: String(normalized?.business?.bic || "").trim(),
      issuerName: String(normalized?.business?.issuerName || "").trim(),
      paymentNote: String(normalized?.business?.paymentNote || "").trim(),
      footerNote: String(normalized?.business?.footerNote || "").trim()
    },
    auth: {
      username: String(normalized?.auth?.username || state.auth.username || "admin").trim(),
      password: String(normalized?.auth?.password || "")
    },
    invoice: {
      title: String(normalized?.invoice?.title || "Rechnung").trim(),
      counterValue: toNumber(normalized?.invoice?.counterValue, 0),
      counterYear: toNumber(normalized?.invoice?.counterYear, new Date().getFullYear())
    },
    email: {
      ccEmail: String(normalized?.email?.ccEmail || "").trim(),
      subjectTemplate: String(normalized?.email?.subjectTemplate || "").trim(),
      bodyTemplate: String(normalized?.email?.bodyTemplate || "").trim()
    }
  };
}

function updateSettingsSaveButtonVisibility() {
  if (!saveSettingsButton || !state.settings) {
    return;
  }

  const saved = stableSerialize(getComparableSettingsPayload(state.settings));
  const current = stableSerialize(getComparableSettingsPayload(readSettingsForm()));
  const hasChanged = current !== saved;
  saveSettingsButton.hidden = !hasChanged;
  saveSettingsButton.disabled = !hasChanged;
  if (saveSettingsActions) {
    saveSettingsActions.hidden = !hasChanged;
  }
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
  updateSettingsSaveButtonVisibility();
}

function scrollPanelFormToTop(formElement) {
  const panel = formElement?.closest(".side-panel");
  if (!panel) {
    return;
  }

  panel.scrollTo({ top: 0, behavior: "smooth" });
}

function scrollMainContentToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
  document.documentElement.scrollTo?.({ top: 0, behavior: "smooth" });
  document.body.scrollTo?.({ top: 0, behavior: "smooth" });
  document.querySelector(".content-shell")?.scrollTo?.({ top: 0, behavior: "smooth" });
  document.querySelector(".main-card")?.scrollTo?.({ top: 0, behavior: "smooth" });
}

function keepSettingsAccordionInView(detailsElement) {
  if (!detailsElement?.open) {
    return;
  }

  const panel = detailsElement.closest(".side-panel");
  if (!panel) {
    return;
  }

  const panelRect = panel.getBoundingClientRect();
  const detailsRect = detailsElement.getBoundingClientRect();
  const stickyHeader = panel.querySelector(".side-panel__head");
  const stickyHeaderHeight = stickyHeader ? stickyHeader.getBoundingClientRect().height : 0;
  const visibleTop = panelRect.top + stickyHeaderHeight + 12;
  const visibleBottom = panelRect.bottom - 18;

  if (detailsRect.top < visibleTop) {
    panel.scrollTop += detailsRect.top - visibleTop;
    return;
  }

  if (detailsRect.bottom > visibleBottom) {
    panel.scrollTop += detailsRect.bottom - visibleBottom;
  }
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

function updatePasswordToggleButton(button, input, hiddenLabel, visibleLabel) {
  if (!button || !input) {
    return;
  }

  const isHidden = input.type === "password";
  button.classList.toggle("is-visible", !isHidden);
  button.setAttribute("aria-label", isHidden ? hiddenLabel : visibleLabel);
  button.title = isHidden ? hiddenLabel : visibleLabel;
}

function updatePasswordDialogValidation() {
  const nextPassword = String(passwordDialogNewInput?.value || "");
  const confirmPassword = String(passwordDialogConfirmInput?.value || "");
  const hasNewPassword = Boolean(nextPassword.trim());
  const hasConfirmPassword = Boolean(confirmPassword.trim());
  const matches = hasNewPassword && hasConfirmPassword && nextPassword === confirmPassword;
  const showMismatch = hasConfirmPassword && nextPassword !== confirmPassword;

  passwordDialogNewInput?.classList.toggle("is-invalid", showMismatch);
  passwordDialogConfirmInput?.classList.toggle("is-invalid", showMismatch);

  if (passwordDialogFeedback) {
    if (showMismatch) {
      passwordDialogFeedback.textContent = showMismatch ? "Die Kennwörter stimmen nicht überein." : "Kennwörter stimmen überein.";
      passwordDialogFeedback.classList.add("is-error");
    } else if (matches) {
      passwordDialogFeedback.textContent = "Kennwörter stimmen überein.";
      passwordDialogFeedback.classList.remove("is-error");
    } else {
      passwordDialogFeedback.textContent = "";
      passwordDialogFeedback.classList.remove("is-error");
    }
  }

  if (confirmPasswordDialogButton) {
    confirmPasswordDialogButton.disabled = !matches;
  }

  updatePasswordToggleButton(
    togglePasswordDialogNewButton,
    passwordDialogNewInput,
    "Neues Kennwort anzeigen",
    "Neues Kennwort verbergen"
  );
  updatePasswordToggleButton(
    togglePasswordDialogConfirmButton,
    passwordDialogConfirmInput,
    "Kennwort best\u00E4tigen anzeigen",
    "Kennwort best\u00E4tigen verbergen"
  );
}

function refreshBrandAssets() {
  const invoiceDataUrl = getBrandingLogoDataUrl("invoice");
  const appDataUrl = getBrandingLogoDataUrl("app");
  const invoiceUrl = invoiceDataUrl || getBrandAssetUrl("invoice");
  const appUrl = appDataUrl || getBrandAssetUrl("app");
  const hasInvoiceLogo =
    Boolean(state.settings?.branding?.hasInvoiceLogo) ||
    Boolean(invoiceDataUrl) ||
    Boolean(readPersistedInvoiceLogo());
  const hasAppLogo = Boolean(state.settings?.branding?.hasAppLogo);
  const appPreviewUrl = hasAppLogo ? appUrl : APP_LOGO_PLACEHOLDER_URL;

  // App-Logo in Nav/Auth-Bereich
  bannerLogoImages.forEach((image) => { image.src = appPreviewUrl; });
  appLogoImages.forEach((image) => { image.src = appPreviewUrl; });

  // Einstellungen: Inline-Vorschau nur wenn Logo vorhanden
  settingsLogoPreviewImages.forEach((image) => {
    const kind = image.dataset.settingsLogoPreview;
    const hasLogo = kind === "invoice" ? hasInvoiceLogo : hasAppLogo;
    const url = kind === "invoice" ? invoiceUrl : appUrl;
    image.hidden = !hasLogo;
    image.src = hasLogo ? url : "";
  });

  // Entfernen-Buttons nur sichtbar wenn Logo vorhanden
  if (removeInvoiceLogoButton) {
    removeInvoiceLogoButton.hidden = !hasInvoiceLogo;
    removeInvoiceLogoButton.disabled = !hasInvoiceLogo;
  }
  if (removeAppLogoButton) {
    removeAppLogoButton.hidden = !hasAppLogo;
    removeAppLogoButton.disabled = !hasAppLogo;
  }

  // Favicon
  if (appFavicon) { appFavicon.href = appPreviewUrl; }
  if (appleTouchIcon) { appleTouchIcon.href = appPreviewUrl; }

  // Manifest mit Cache-Busting -> PWA-Icon auf Smartphone aktualisieren
  if (appManifest) {
    const authToken = window.localStorage.getItem(STORAGE_KEYS.authToken) || "";
    const manifestUrl = new URL("/api/manifest.webmanifest", window.location.origin);
    manifestUrl.searchParams.set("v", String(Date.now()));
    if (authToken) { manifestUrl.searchParams.set("token", authToken); }
    appManifest.href = manifestUrl.toString();
  }

  logoState.loaded = false;
  logoState.image = null;
}

function getBrandAssetUrl(kind) {
  const authToken = window.localStorage.getItem(STORAGE_KEYS.authToken) || "";
  const url = new URL(BRAND_ASSET_URLS[kind], window.location.origin);
  url.searchParams.set("v", String(Date.now()));
  if (authToken) {
    url.searchParams.set("token", authToken);
  }
  return url.toString();
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
        reject(new Error("Rechnungsansicht ist nicht verf\u00FCgbar."));
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

function canvasToPngDataUrl(canvas) {
  return new Promise((resolve, reject) => {
    if (!canvas) {
      reject(new Error("Rechnungsansicht ist nicht verf\u00FCgbar."));
      return;
    }

    if (typeof canvas.toBlob === "function") {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Vorschau konnte nicht als PNG erzeugt werden."));
          return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
          const result = String(reader.result || "");
          if (!result.startsWith("data:image/png;base64,")) {
            reject(new Error("PNG-Daten konnten nicht gelesen werden."));
            return;
          }
          resolve(result);
        };
        reader.onerror = () => reject(new Error("PNG-Daten konnten nicht gelesen werden."));
        reader.readAsDataURL(blob);
      }, "image/png");
      return;
    }

    try {
      const dataUrl = canvas.toDataURL("image/png");
      if (!String(dataUrl).startsWith("data:image/png;base64,")) {
        reject(new Error("Vorschau konnte nicht als PNG erzeugt werden."));
        return;
      }
      resolve(dataUrl);
    } catch (error) {
      reject(new Error(error.message || "PNG-Erstellung fehlgeschlagen."));
    }
  });
}

// Create one PNG per canvas page for multi-page PDFs.
function buildPageSlices(canvas) {
  const PAGE_H = 1123;
  const totalHeight = canvas.height;
  if (totalHeight <= PAGE_H) {
    return null; // Einzelseite - kein Slicing noetig
  }
  const numPages = Math.ceil(totalHeight / PAGE_H);
  const slices = [];
  for (let p = 0; p < numPages; p++) {
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = Math.min(PAGE_H, totalHeight - p * PAGE_H);
    const ctx = slice.getContext("2d");
    ctx.drawImage(canvas, 0, -p * PAGE_H);
    slices.push(slice.toDataURL("image/png"));
  }
  return slices;
}

async function previewSelectedLogo(kind, file) {
  if (!file) {
    refreshBrandAssets();
    return;
  }

  const imageDataUrl = await fileToPngDataUrl(file);
  settingsLogoPreviewImages.forEach((image) => {
    if (image.dataset.settingsLogoPreview === kind) {
      image.src = imageDataUrl;
      image.hidden = false;
    }
  });
  if (kind === "invoice" && removeInvoiceLogoButton) {
    removeInvoiceLogoButton.disabled = false;
  }
  if (kind === "app" && removeAppLogoButton) {
    removeAppLogoButton.disabled = false;
  }
}

async function saveSelectedLogo(kind, file) {
  if (!file) {
    return;
  }

  const previousBranding = normalizeLegacyData({ ...(state.settings?.branding || {}) });
  const imageDataUrl = await fileToPngDataUrl(file);
  setBrandingLogoState(kind, imageDataUrl);
  if (kind === "invoice") {
    await persistInvoiceLogoToDeviceCache(imageDataUrl);
  }
  refreshBrandAssets();

  setLoading(true, kind === "invoice" ? "Rechnungslogo wird gespeichert..." : "App-Logo wird gespeichert...");
  try {
    const response = await api("/api/assets/logo", {
      method: "POST",
      body: JSON.stringify({ kind, imageDataUrl })
    });

    if (response?.settings) {
      applyReceivedSettings({
        ...state.settings,
        ...response.settings,
        branding: {
          ...(state.settings?.branding || {}),
          ...(response.settings?.branding || {})
        }
      });
      if (kind === "invoice") {
        await persistInvoiceLogoToDeviceCache(state.settings?.branding?.invoiceLogoDataUrl || "");
      }
    }

    refreshBrandAssets();
    if (kind === "invoice") {
      await renderCanvas();
      refreshSendPreview();
    }
  } catch (error) {
    state.settings.branding = previousBranding;
    if (kind === "invoice") {
      await persistInvoiceLogoToDeviceCache(previousBranding.invoiceLogoDataUrl || "");
    }
    refreshBrandAssets();
    if (kind === "invoice") {
      await renderCanvas();
      refreshSendPreview();
    }
    throw error;
  } finally {
    setLoading(false);
  }
}

async function removeLogoAsset(kind) {
  await api(`/api/assets/logo/${encodeURIComponent(kind)}`, {
    method: "DELETE"
  });
}

function fillCustomerForm(customer = null, showForm = true) {
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
  if (showForm) customerForm.hidden = false;
  updateCustomerNameRequirement();
  updateCustomerFormActionVisibility();
  if (showForm) scrollPanelFormToTop(customerForm);
}

function getCustomerDisplayName(customer = {}) {
  return String(customer.name || customer.contactPerson || "").trim();
}

function readCustomerForm() {
  const companyName = customerFields.name.value.trim();
  const contactPerson = customerFields.contactPerson.value.trim();
  return {
    id: customerFields.id.value.trim(),
    customerNumber: customerFields.customerNumber.value.trim(),
    name: companyName || contactPerson,
    contactPerson,
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

function updateCustomerNameRequirement() {
  if (!customerFields.name) {
    return;
  }
  customerFields.name.required = !String(customerFields.contactPerson?.value || "").trim();
}

function getComparableCustomerFormPayload(customer = readCustomerForm()) {
  return {
    id: String(customer.id || "").trim(),
    customerNumber: String(customer.customerNumber || "").trim(),
    name: String(customer.name || "").trim(),
    contactPerson: String(customer.contactPerson || "").trim(),
    street: String(customer.street || "").trim(),
    postalCode: String(customer.postalCode || "").trim(),
    city: String(customer.city || "").trim(),
    country: String(customer.country || "").trim(),
    phone: String(customer.phone || "").trim(),
    email: String(customer.email || "").trim(),
    uid: String(customer.uid || "").trim(),
    notes: String(customer.notes || "").trim()
  };
}

function getSavedCustomerFormPayload() {
  const currentId = String(customerFields.id?.value || "").trim();
  const source = currentId ? state.customers.find((entry) => entry.id === currentId) : null;
  return getComparableCustomerFormPayload(
    source || {
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
    }
  );
}

function updateCustomerFormActionVisibility() {
  if (!saveCustomerButton || !resetCustomerFormButton) {
    return;
  }
  const hasChanged =
    stableSerialize(getComparableCustomerFormPayload()) !== stableSerialize(getSavedCustomerFormPayload());
  saveCustomerButton.hidden = !hasChanged;
  saveCustomerButton.disabled = !hasChanged;
  resetCustomerFormButton.hidden = !hasChanged;
}

function resetCustomerForm() {
  fillCustomerForm(null, false);
}

function fillArticleForm(article = null, showForm = true) {
  const entry = article || {
    id: "",
    group: "",
    number: nextArticleNumber(),
    name: "",
    unit: "",
    unitPrice: "",
    taxRate: 20,
    description: ""
  };

  articleFields.id.value = entry.id || "";
  articleFields.group.value = entry.group || "";
  articleFields.number.value = entry.number || nextArticleNumber();
  articleFields.name.value = entry.name || "";
  articleFields.unit.value = entry.unit || "";
  articleFields.unitPrice.value = entry.unitPrice ?? "";
  articleFields.taxRate.value = entry.taxRate ?? 20;
  articleFields.description.value = entry.description || "";
  if (articleGroupSuggestions) {
    articleGroupSuggestions.hidden = true;
    articleGroupSuggestions.innerHTML = "";
  }
  if (showForm) articleForm.hidden = false;
  updateArticleFormActionVisibility();
  if (showForm) scrollPanelFormToTop(articleForm);
}

function getArticleGroups() {
  const groups = [...new Set(
    state.articles
      .map((article) => String(article.group || "").trim())
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right, "de"))
  )];
  return groups;
}

function renderArticleGroupSuggestions(query = "", forceOpen = false) {
  if (!articleGroupSuggestions) {
    return;
  }

  const normalizedQuery = String(query || "").trim().toLocaleLowerCase("de");
  const groups = getArticleGroups().filter((group) =>
    !normalizedQuery ? true : group.toLocaleLowerCase("de").includes(normalizedQuery)
  );

  if (!groups.length || (!forceOpen && !normalizedQuery)) {
    articleGroupSuggestions.hidden = true;
    articleGroupSuggestions.innerHTML = "";
    return;
  }

  articleGroupSuggestions.innerHTML = groups
    .map(
      (group) =>
        `<button class="group-suggestion" type="button" data-group-option="${escapeHtml(group)}">${escapeHtml(group)}</button>`
    )
    .join("");
  articleGroupSuggestions.hidden = false;
}

function showArticleGroupSuggestions() {
  window.clearTimeout(hideArticleGroupSuggestionsTimer);
  renderArticleGroupSuggestions(articleFields.group?.value || "", true);
}

function hideArticleGroupSuggestions() {
  window.clearTimeout(hideArticleGroupSuggestionsTimer);
  hideArticleGroupSuggestionsTimer = window.setTimeout(() => {
    if (articleGroupSuggestions) {
      articleGroupSuggestions.hidden = true;
    }
  }, 120);
}

function readArticleForm() {
  return {
    id: articleFields.id.value.trim(),
    group: articleFields.group.value.trim(),
    number: articleFields.number.value.trim(),
    name: articleFields.name.value.trim(),
    description: articleFields.description.value.trim(),
    unit: articleFields.unit.value.trim(),
    unitPrice: toNumber(articleFields.unitPrice.value),
    taxRate: toNumber(articleFields.taxRate.value, 20)
  };
}

function getComparableArticleFormPayload(article = readArticleForm()) {
  return {
    id: String(article.id || "").trim(),
    group: String(article.group || "").trim(),
    number: String(article.number || "").trim(),
    name: String(article.name || "").trim(),
    description: String(article.description || "").trim(),
    unit: String(article.unit || "").trim(),
    unitPrice: toNumber(article.unitPrice),
    taxRate: toNumber(article.taxRate, 20)
  };
}

function getSavedArticleFormPayload() {
  const currentId = String(articleFields.id?.value || "").trim();
  const source = currentId ? state.articles.find((entry) => entry.id === currentId) : null;
  return getComparableArticleFormPayload(
    source || {
      id: "",
      group: "",
      number: nextArticleNumber(),
      name: "",
      unit: "",
      unitPrice: 0,
      taxRate: 20,
      description: ""
    }
  );
}

function updateArticleFormActionVisibility() {
  if (!saveArticleButton || !resetArticleFormButton) {
    return;
  }
  const hasChanged =
    stableSerialize(getComparableArticleFormPayload()) !== stableSerialize(getSavedArticleFormPayload());
  saveArticleButton.hidden = !hasChanged;
  saveArticleButton.disabled = !hasChanged;
  resetArticleFormButton.hidden = !hasChanged;
}

function resetArticleForm() {
  fillArticleForm(null, false);
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
  invoiceTotals.hidden = state.invoiceDraft.items.length === 0;
  if (invoiceItemsFooter) {
    invoiceItemsFooter.classList.toggle("is-empty", state.invoiceDraft.items.length === 0);
  }
}

function renderCustomerOptions() {
  const options = ['<option value="">Kunde ausw\u00E4hlen</option>'];
  for (const customer of sortByNumericField(state.customers, "customerNumber")) {
    const customerName = getCustomerDisplayName(customer) || "Ohne Namen";
    options.push(
      `<option value="${escapeHtml(customer.id)}">${escapeHtml(
        `${customer.customerNumber || "Ohne Nr."} - ${customerName}`
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
    .map((customer) => {
      const displayName = getCustomerDisplayName(customer) || "Ohne Namen";
      const location = [customer.postalCode, customer.city].filter(Boolean).join(" ");
      return `
        <tr>
          <td colspan="5" style="padding: 4px 0; border: none;">
            <div class="customer-card">
              <div class="customer-card__head">
                <strong class="customer-card__name">${escapeHtml(displayName)}</strong>
                <span class="customer-card__number">Nr. ${escapeHtml(customer.customerNumber || "\u2013")}</span>
              </div>
              ${customer.name && customer.contactPerson ? `<p class="customer-card__line">${escapeHtml(customer.contactPerson)}</p>` : ""}
              ${location ? `<p class="customer-card__line">${escapeHtml(location)}</p>` : ""}
              ${customer.email ? `<p class="customer-card__line customer-card__email">${escapeHtml(customer.email)}</p>` : ""}
              ${customer.phone ? `<p class="customer-card__line">${escapeHtml(customer.phone)}</p>` : ""}
              <div class="customer-card__actions">
                <button class="secondary" type="button" data-action="edit-customer" data-id="${escapeHtml(customer.id)}">Bearbeiten</button>
                <button class="danger" type="button" data-action="delete-customer" data-id="${escapeHtml(customer.id)}">L\u00F6schen</button>
              </div>
            </div>
          </td>
        </tr>
      `;
    })
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
        searchTerm ? "Keine passenden Artikel gefunden." : "Noch keine Artikel angelegt."
      }</td></tr>`;
    renderArticleGroupSuggestions(articleFields.group?.value || "", false);
    return;
  }

  articlesTable.innerHTML = entries
    .map((article) => {
      const meta = [
        article.unit ? `Einheit: ${article.unit}` : "",
        article.taxRate != null ? `MwSt.: ${article.taxRate} %` : ""
      ].filter(Boolean).join(" \u00B7 ");
      return `
        <tr>
          <td colspan="5" style="padding: 4px 0; border: none;">
            <div class="customer-card">
              <div class="customer-card__head">
                <strong class="customer-card__name">${escapeHtml(article.name)}</strong>
                <span class="customer-card__number">${escapeHtml(formatCurrency(article.unitPrice))}</span>
              </div>
              ${article.group ? `<p class="customer-card__line"><span class="article-badge">${escapeHtml(article.group)}</span></p>` : ""}
              ${article.description ? `<p class="customer-card__line">${escapeHtml(article.description)}</p>` : ""}
              ${meta ? `<p class="customer-card__line" style="font-size:0.8rem">${escapeHtml(meta)}</p>` : ""}
              <div class="customer-card__actions">
                <button class="secondary" type="button" data-action="edit-article" data-id="${escapeHtml(article.id)}">Bearbeiten</button>
                <button class="danger" type="button" data-action="delete-article" data-id="${escapeHtml(article.id)}">L\u00F6schen</button>
              </div>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  renderArticleGroupSuggestions(articleFields.group?.value || "", false);
}


function renderAdminUsers() {
  if (!adminUsersTable) {
    return;
  }

  if (!state.adminUsers.length) {
    adminUsersTable.innerHTML = '<tr><td colspan="5" class="empty-state">Noch keine Benutzer vorhanden.</td></tr>';
    return;
  }

  adminUsersTable.innerHTML = state.adminUsers
    .map((entry) => {
      const user = normalizeLegacyData(entry);
      const isExpanded = state.adminExpandedUsers.includes(user.username);
      const lastOnlineLabel = escapeHtml(formatDateTime(user.lastOnlineAt) || "-");
      const companyLabel = user.username === "admin" ? "" : escapeHtml(user.companyName || "-");
      const lockBadge = user.isLocked
        ? '<span class="admin-user-lock-badge">Gesperrt</span>'
        : "";
      const migrationLabel =
        user.username === "admin"
          ? ""
          : `<span class="admin-user-migration${
              user.migratedToStructuredColumns ? " is-complete" : " is-pending"
            }">Migration: ${user.migratedToStructuredColumns ? `Schema ${escapeHtml(user.schemaVersion || "2")}` : "Altstand"}</span>`;
      const dataLabel =
        user.username === "admin"
          ? ""
          : `<div>${escapeHtml(
              `${user.customerCount || 0} Kunden / ${user.articleCount || 0} Artikel / ${user.invoiceCount || 0} Rechnungen`
            )}</div>${migrationLabel}`;

      return `
        <tr class="admin-user-row${isExpanded ? " is-expanded" : ""}">
          <td data-label="Benutzer">
            <button
              class="ghost admin-user-summary"
              type="button"
              data-toggle-admin-user="${escapeHtml(user.username)}"
              aria-expanded="${isExpanded ? "true" : "false"}"
            >
              <span class="admin-user-summary__name">
                <strong>${escapeHtml(user.username)}</strong>
                ${lockBadge}
              </span>
              <span class="admin-user-summary__meta">${lastOnlineLabel}</span>
            </button>
          </td>
          <td data-label="Firma">${companyLabel}</td>
          <td data-label="Daten">${dataLabel}</td>
          <td data-label="Zuletzt online">${lastOnlineLabel}</td>
          <td data-label="Aktion">
            ${
              user.username === "admin"
                ? '<div class="muted-note">Passwort über Einstellungen ändern</div>'
                : `<div class="row-actions">
                    <button class="admin-user-lock-button ${user.isLocked ? "secondary" : "ghost"}" type="button" data-toggle-user-lock="${escapeHtml(user.username)}">
                      ${user.isLocked ? "Benutzer entsperren" : "Benutzer sperren"}
                    </button>
                    <button class="danger" type="button" data-reset-user-password="${escapeHtml(user.username)}">Passwort zur\u00FCcksetzen</button>
                    <button class="danger ghost-danger" type="button" data-delete-user="${escapeHtml(user.username)}">Benutzer l\u00F6schen</button>
                  </div>`
            }
          </td>
        </tr>
      `;
    })
    .join("");
}

function toggleAdminUserExpanded(username) {
  if (!username) {
    return;
  }

  if (state.adminExpandedUsers.includes(username)) {
    state.adminExpandedUsers = state.adminExpandedUsers.filter((entry) => entry !== username);
  } else {
    state.adminExpandedUsers = [...state.adminExpandedUsers, username];
  }

  renderAdminUsers();
}

function buildArticleOptions(selectedId) {
  const options = ['<option value="">Artikel ausw\u00E4hlen</option>'];
  for (const article of sortByNumericField(state.articles, "number")) {
    options.push(
      `<option value="${escapeHtml(article.id)}"${
        article.id === selectedId ? " selected" : ""
      }>${escapeHtml(`${article.number || "Ohne Nr."} - ${article.name}`)}</option>`
    );
  }

  return options.join("");
}

function buildInvoiceItemMetaSummary(item) {
  const parts = [];
  if (item.description) {
    parts.push(item.description);
  }
  if (item.articleNumber) {
    parts.push(`Art.-Nr. ${item.articleNumber}`);
  }
  return parts.join(" \u00B7 ");
}

function buildInvoiceItemPricingSummary(item) {
  const parts = [formatCurrency(item.unitPrice), `MwSt. ${formatAmount(item.taxRate)} %`];
  if (toNumber(item.discount) > 0) {
    parts.push(`Rabatt ${formatAmount(item.discount)} %`);
  }
  return parts.join(" \u00B7 ");
}

function renderInvoiceItems() {
  if (!state.invoiceDraft.items.length) {
    invoiceItemsTable.innerHTML = "";
    if (invoiceItemsWrap) {
      invoiceItemsWrap.hidden = true;
    }
    updateInvoiceTotalsDisplay();
    return;
  }

  if (invoiceItemsWrap) {
    invoiceItemsWrap.hidden = false;
  }

  invoiceItemsTable.innerHTML = state.invoiceDraft.items
    .map((item, index) => {
      const totals = calculateItem(item);
      const isEditing = Boolean(item.detailsExpanded);
      return `
        <tr class="invoice-item-row${isEditing ? " is-editing" : ""}" data-index="${index}">
          <td data-label="Artikel" colspan="4">
            <div class="invoice-item-primary">
              <div class="invoice-item-select-row">
                <select name="articleId" class="item-article-select">
                  ${buildArticleOptions(item.articleId)}
                </select>
                <button
                  class="danger invoice-item-remove"
                  type="button"
                  data-action="remove-item"
                  aria-label="Artikel entfernen"
                  title="Artikel entfernen"
                >
                  &times;
                </button>
              </div>
              <div class="invoice-item-meta">
                <div>
                  <p class="invoice-item-meta__line">${escapeHtml(buildInvoiceItemMetaSummary(item))}</p>
                  <p class="invoice-item-meta__line invoice-item-meta__line--muted">${escapeHtml(
                    buildInvoiceItemPricingSummary(item)
                  )}</p>
                </div>
                ${
                  isEditing
                    ? `
                <div class="invoice-item-editor">
                  <div class="invoice-description-fields invoice-description-fields--two">
                    <input name="description" type="text" value="${escapeHtml(item.description)}" placeholder="Artikel" />
                    <input name="articleNumber" type="text" value="${escapeHtml(
                      item.articleNumber
                    )}" placeholder="Art.-Nr." />
                  </div>
                  <div class="invoice-field-row invoice-field-row--three invoice-item-editor__pricing">
                    <div class="invoice-field-stack">
                      <span class="invoice-field-caption">Nettopreis</span>
                      <input name="unitPrice" type="number" min="0" step="0.01" value="${escapeHtml(
                        item.unitPrice
                      )}" />
                    </div>
                    <div class="invoice-field-stack">
                      <span class="invoice-field-caption">MwSt. %</span>
                      <input name="taxRate" type="number" min="0" step="0.1" value="${escapeHtml(
                        item.taxRate
                      )}" />
                    </div>
                    <div class="invoice-field-stack">
                      <span class="invoice-field-caption">Rabatt %</span>
                      <input name="discount" type="number" min="0" step="0.01" value="${escapeHtml(
                        item.discount
                      )}" />
                    </div>
                  </div>
                  <button class="ghost invoice-item-editor__done" type="button" data-action="toggle-item-details">
                    Fertig
                  </button>
                </div>
                    `
                    : `
                <button class="ghost invoice-item-meta__toggle" type="button" data-action="toggle-item-details">
                  Bearbeiten
                </button>
                    `
                }
              </div>
            </div>
          </td>
          <td>
            <div class="invoice-field-row invoice-field-row--two">
              <div class="invoice-field-stack">
                <span class="invoice-field-caption">Menge</span>
                <div class="quantity-stepper">
                  <button class="ghost quantity-stepper__button" type="button" data-action="decrease-quantity">-</button>
                  <input name="quantity" type="number" min="0" step="0.5" value="${escapeHtml(
                    item.quantity
                  )}" />
                  <button class="ghost quantity-stepper__button" type="button" data-action="increase-quantity">+</button>
                </div>
              </div>
              <div class="invoice-field-stack">
                <span class="invoice-field-caption">Einheit</span>
                <input name="unit" type="text" value="${escapeHtml(item.unit || "")}" />
              </div>
            </div>
          </td>
          <td data-label="Summe">
            <div class="readonly-chip" data-role="row-total">${escapeHtml(
              formatCurrency(totals.net)
            )}</div>
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
    unit: row.querySelector('[name="unit"]').value.trim() || "",
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
      articleNumber: item.articleNumber || "",
      detailsExpanded: Boolean(item.detailsExpanded)
    };
  }

  return {
    ...item,
    articleId: article.id,
    articleNumber: article.number || "",
    description: article.name || item.description,
    unit: article.unit || item.unit || "",
    unitPrice: toNumber(article.unitPrice),
    taxRate: toNumber(article.taxRate, 20),
    detailsExpanded: Boolean(item.detailsExpanded)
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
      unit: draftArticle.unit || item.unit || "",
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

// Share-Icon SVG (identisch mit Send-Dialog)
const SHARE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51 15.42 17.49"/><path d="M15.41 6.51 8.59 10.49"/></svg>`;

function renderInvoiceHistory() {
  if (!state.invoices.length) {
    invoiceHistory.innerHTML = '<div class="empty-state">Noch keine Rechnungen erstellt.</div>';
    return;
  }

  invoiceHistory.innerHTML = state.invoices
    .slice(0, 8)
    .map((invoice) => {
      const emailStatus = invoice.email?.status || "";
      const fileLink = invoice.files?.pdfUrl
        ? `<a href="${escapeHtml(invoice.files.pdfUrl)}" target="_blank" rel="noreferrer">PDF öffnen</a>`
        : "";
      const createdTime = formatTime(invoice.createdAt);

      let badgeClass = "status-badge status-badge--neutral";
      let badgeLabel = "Offen";
      if (emailStatus === "sent") { badgeClass = "status-badge status-badge--success"; badgeLabel = "Gesendet"; }
      else if (emailStatus === "external-app") { badgeClass = "status-badge status-badge--info"; badgeLabel = "Mail-App"; }
      else if (emailStatus === "share-preview") { badgeClass = "status-badge status-badge--info"; badgeLabel = "Geteilt"; }
      else if (emailStatus === "failed") { badgeClass = "status-badge status-badge--error"; badgeLabel = "Fehlgeschlagen"; }
      else if (emailStatus === "skipped") { badgeClass = "status-badge status-badge--neutral"; badgeLabel = "\u00DCbersprungen"; }

      return `
        <article class="history-item">
          <div class="history-item__head">
            <strong>${escapeHtml(invoice.invoiceNumber)}</strong>
            <div class="history-item__head-right">
              <span class="${badgeClass}">${badgeLabel}</span>
              ${createdTime ? `<span class="history-item__time">${escapeHtml(createdTime)}</span>` : ""}
            </div>
          </div>
          <p class="history-item__customer">${escapeHtml(invoice.customer?.name || "Unbekannter Kunde")}</p>
          <p class="history-item__amount">${escapeHtml(formatCurrency(invoice.totals?.grossTotal || 0))}</p>
          <div class="history-item__actions">
            ${fileLink}
            <button class="secondary history-resend-btn" type="button" data-resend-invoice="${escapeHtml(invoice.id)}">Erneut senden</button>
            <button class="ghost history-share-btn" type="button" data-share-invoice="${escapeHtml(invoice.id)}" aria-label="Teilen" title="Teilen">${SHARE_ICON_SVG}</button>
          </div>
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

function drawFallbackLayout(context, headerShift = 0) {
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, invoiceCanvas.width, invoiceCanvas.height);
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

  const PAGE_HEIGHT = 1123;
  const PAGE_WIDTH = 794;
  const headerShift = logo ? 0 : -58;
  const FOOTER_LINE_Y = PAGE_HEIGHT - 76;
  const FOOTER_TEXT_Y = PAGE_HEIGHT - 60;

  const customer = selectedCustomer();
  const totals = calculateDraftTotals();
  const business = state.settings?.business || {};
  const invoiceTitle = state.settings?.invoice?.title || "Rechnung";
  const invoiceNumber = previewInvoiceNumber();
  const validItems = getValidInvoiceItems();

  let neededPages = 1;
  let pageBreaks = [];
  let totalHeight = PAGE_HEIGHT;
  if (invoiceCanvas.height !== totalHeight) {
    invoiceCanvas.height = totalHeight;
  }

  canvasContext.clearRect(0, 0, PAGE_WIDTH, totalHeight);
  canvasContext.fillStyle = "#ffffff";
  canvasContext.fillRect(0, 0, PAGE_WIDTH, totalHeight);

  // --- Seite 1: Template / Fallback zeichnen ---
  if (template) {
    canvasContext.drawImage(template, 0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  } else {
    drawFallbackLayout(canvasContext, headerShift);
  }

  // --- Logo ---
  if (logo) {
    const maxWidth = 180;
    const maxHeight = 78;
    const ratio = Math.min(maxWidth / logo.width, maxHeight / logo.height, 1);
    canvasContext.drawImage(logo, 66, 46, logo.width * ratio, logo.height * ratio);
  }

  canvasContext.fillStyle = "#111111";
  canvasContext.textBaseline = "top";

  const senderLineParts = [
    business.companyName,
    business.addressLine1,
    business.addressLine2,
    [business.postalCode, business.city].filter(Boolean).join(" ").trim()
  ].filter(Boolean);
  const senderLine = senderLineParts.length ? `Abs.: ${senderLineParts.join(" • ")}` : "";
  const senderLineY = logo ? 136 : 24;

  canvasContext.font = '12px Calibri, Candara, "Segoe UI", sans-serif';
  if (senderLine) {
    canvasContext.fillText(senderLine, 34, senderLineY);
    canvasContext.beginPath();
    canvasContext.moveTo(34, senderLineY + 16);
    canvasContext.lineTo(332, senderLineY + 16);
    canvasContext.strokeStyle = "#8a8a8a";
    canvasContext.lineWidth = 0.9;
    canvasContext.stroke();
  }

  const customerAddressName = customer ? getCustomerDisplayName(customer) : "";
  const customerAddressLines = customer
    ? [
        customerAddressName,
        customer.street || "",
        [customer.postalCode, customer.city].filter(Boolean).join(" ").trim(),
        customer.country || ""
      ].filter(Boolean)
    : [];
  const customerAddressStartY = senderLine ? senderLineY + 34 : (logo ? 136 : 46);

  canvasContext.font = '14px Calibri, Candara, "Segoe UI", sans-serif';
  customerAddressLines.forEach((line, index) => {
    canvasContext.fillText(line, 34, customerAddressStartY + index * 20);
  });
  const customerAddressBottom = customerAddressLines.length
    ? customerAddressStartY + (customerAddressLines.length - 1) * 20 + 18
    : customerAddressStartY;

  const customerInfoLines = customer
    ? [
        `Kunden-Nr.:   ${customer.customerNumber || "-"}`,
        customer.phone ? `Telefon:      ${customer.phone}` : "",
        customer.email ? `E-Mail:       ${customer.email}` : "",
        customer.uid ? `UID-Nr.:      ${customer.uid}` : ""
      ].filter(Boolean)
    : ["Bitte Kunde ausw\u00E4hlen"];

  const customerInfoBoxY = customerAddressStartY - 8;
  const customerInfoBoxHeight = 38 + customerInfoLines.length * 18 + 20;

  canvasContext.fillStyle = "#f1f1f1";
  canvasContext.strokeStyle = "#cfcfcf";
  canvasContext.lineWidth = 1;
  canvasContext.beginPath();
  canvasContext.roundRect(438, customerInfoBoxY, 322, customerInfoBoxHeight, 6);
  canvasContext.fill();
  canvasContext.stroke();

  canvasContext.fillStyle = "#111111";
  canvasContext.font = 'bold 14px Calibri, Candara, "Segoe UI", sans-serif';
  canvasContext.fillText("Kundeninfo", 446, customerInfoBoxY + 18);
  canvasContext.font = '13px Calibri, Candara, "Segoe UI", sans-serif';
  customerInfoLines.forEach((line, index) => {
    canvasContext.fillText(line, 446, customerInfoBoxY + 48 + index * 18);
  });

  const infoBlocksBottom = Math.max(customerAddressBottom, customerInfoBoxY + customerInfoBoxHeight);
  const firstPageTableOffset = Math.max(404 + headerShift, infoBlocksBottom + 44);
  const invoiceHeaderTop = firstPageTableOffset - (state.invoiceDraft.reference ? 62 : 36);

  canvasContext.fillStyle = "#111111";
  canvasContext.font = 'bold 18px Calibri, Candara, "Segoe UI", sans-serif';
  canvasContext.fillText(`${invoiceTitle} ${invoiceNumber}`, 66, invoiceHeaderTop);
  canvasContext.font = '13px Calibri, Candara, "Segoe UI", sans-serif';
  if (state.invoiceDraft.reference) {
    canvasContext.fillText(`zu Bst.: ${state.invoiceDraft.reference}`, 66, invoiceHeaderTop + 28);
  }
  canvasContext.textAlign = "right";
  canvasContext.fillText(`Datum: ${formatDate(state.invoiceDraft.issueDate)}`, 738, invoiceHeaderTop);
  canvasContext.fillText(`Bearbeiter: ${business.issuerName || "-"}`, 738, invoiceHeaderTop + 24);
  canvasContext.textAlign = "left";

  const invoiceMetaBottom = state.invoiceDraft.reference ? invoiceHeaderTop + 42 : invoiceHeaderTop + 18;
  const firstPageItemsStart = Math.max(firstPageTableOffset, invoiceMetaBottom + 8) + 62;
  const continuationItemsStart = 132;
  const nonLastPageItemsEnd = FOOTER_LINE_Y - 24;
  const lastPageReservedHeight =
    430
    + (business.footerNote ? 36 : 0)
    + (state.invoiceDraft.notes ? 18 : 0);
  const firstPageLastItemsEnd = PAGE_HEIGHT - lastPageReservedHeight;
  const continuationLastItemsEnd = PAGE_HEIGHT - lastPageReservedHeight;

  function buildInvoicePageLayout(targetPageCount) {
    let pageIndex = 0;
    let cursorY = firstPageItemsStart;
    const breaks = [];
    let itemsOnCurrentPage = 0;

    for (let itemIndex = 0; itemIndex < validItems.length; itemIndex += 1) {
      const rowHeight = toNumber(validItems[itemIndex].discount) > 0 ? 70 : 54;
      const remainingItems = validItems.length - itemIndex;
      const remainingPages = targetPageCount - pageIndex - 1;
      const shouldReserveItemForNextPage =
        remainingPages > 0 && remainingItems === remainingPages && itemsOnCurrentPage > 0;
      let isLastPage = pageIndex === targetPageCount - 1;
      let pageLimit =
        pageIndex === 0
          ? (isLastPage ? firstPageLastItemsEnd : nonLastPageItemsEnd)
          : (isLastPage ? continuationLastItemsEnd : nonLastPageItemsEnd);

      if ((cursorY + rowHeight > pageLimit || shouldReserveItemForNextPage) && itemsOnCurrentPage > 0) {
        pageIndex += 1;
        if (pageIndex >= targetPageCount) {
          return { fits: false, breaks: [] };
        }
        breaks.push(itemIndex);
        cursorY = continuationItemsStart;
        itemsOnCurrentPage = 0;
        isLastPage = pageIndex === targetPageCount - 1;
        pageLimit = isLastPage ? continuationLastItemsEnd : nonLastPageItemsEnd;
      }

      if (cursorY + rowHeight > pageLimit) {
        return { fits: false, breaks: [] };
      }

      cursorY += rowHeight;
      itemsOnCurrentPage += 1;
    }

    return { fits: true, breaks };
  }

  while (true) {
    const layout = buildInvoicePageLayout(neededPages);
    if (layout.fits) {
      pageBreaks = layout.breaks;
      break;
    }
    neededPages += 1;
  }

  totalHeight = PAGE_HEIGHT * neededPages;
  if (invoiceCanvas.height !== totalHeight) {
    invoiceCanvas.height = totalHeight;
  }

  canvasContext.clearRect(0, 0, PAGE_WIDTH, totalHeight);
  canvasContext.fillStyle = "#ffffff";
  canvasContext.fillRect(0, 0, PAGE_WIDTH, totalHeight);

  if (template) {
    canvasContext.drawImage(template, 0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  } else {
    drawFallbackLayout(canvasContext, headerShift);
  }

  if (logo) {
    const maxWidth = 180;
    const maxHeight = 78;
    const ratio = Math.min(maxWidth / logo.width, maxHeight / logo.height, 1);
    canvasContext.drawImage(logo, 66, 46, logo.width * ratio, logo.height * ratio);
  }

  canvasContext.fillStyle = "#111111";
  canvasContext.textBaseline = "top";

  canvasContext.font = '12px Calibri, Candara, "Segoe UI", sans-serif';
  if (senderLine) {
    canvasContext.fillText(senderLine, 34, senderLineY);
    canvasContext.beginPath();
    canvasContext.moveTo(34, senderLineY + 16);
    canvasContext.lineTo(332, senderLineY + 16);
    canvasContext.strokeStyle = "#8a8a8a";
    canvasContext.lineWidth = 0.9;
    canvasContext.stroke();
  }

  canvasContext.font = '14px Calibri, Candara, "Segoe UI", sans-serif';
  customerAddressLines.forEach((line, index) => {
    canvasContext.fillText(line, 34, customerAddressStartY + index * 20);
  });

  canvasContext.fillStyle = "#f1f1f1";
  canvasContext.strokeStyle = "#cfcfcf";
  canvasContext.lineWidth = 1;
  canvasContext.beginPath();
  canvasContext.roundRect(438, customerInfoBoxY, 322, customerInfoBoxHeight, 6);
  canvasContext.fill();
  canvasContext.stroke();

  canvasContext.fillStyle = "#111111";
  canvasContext.font = 'bold 14px Calibri, Candara, "Segoe UI", sans-serif';
  canvasContext.fillText("Kundeninfo", 446, customerInfoBoxY + 18);
  canvasContext.font = '13px Calibri, Candara, "Segoe UI", sans-serif';
  customerInfoLines.forEach((line, index) => {
    canvasContext.fillText(line, 446, customerInfoBoxY + 48 + index * 18);
  });

  canvasContext.fillStyle = "#111111";
  canvasContext.font = 'bold 18px Calibri, Candara, "Segoe UI", sans-serif';
  canvasContext.fillText(`${invoiceTitle} ${invoiceNumber}`, 66, invoiceHeaderTop);
  canvasContext.font = '13px Calibri, Candara, "Segoe UI", sans-serif';
  if (state.invoiceDraft.reference) {
    canvasContext.fillText(`zu Bst.: ${state.invoiceDraft.reference}`, 66, invoiceHeaderTop + 28);
  }
  canvasContext.textAlign = "right";
  canvasContext.fillText(`Datum: ${formatDate(state.invoiceDraft.issueDate)}`, 738, invoiceHeaderTop);
  canvasContext.fillText(`Bearbeiter: ${business.issuerName || "-"}`, 738, invoiceHeaderTop + 24);
  canvasContext.textAlign = "left";

  // --- Tabellenkopf Seite 1 ---
  const drawTableHeader = (pageOffsetY) => {
    const tableTop = pageOffsetY + 30;
    canvasContext.fillStyle = "#e1e1e1";
    canvasContext.fillRect(66, tableTop - 10, 672, 30);
    canvasContext.strokeStyle = "#c8c8c8";
    canvasContext.lineWidth = 0.8;
    canvasContext.strokeRect(66, tableTop - 10, 672, 30);
    canvasContext.font = 'bold 13px Calibri, Candara, "Segoe UI", sans-serif';
    canvasContext.textBaseline = "middle";
    canvasContext.fillStyle = "#111111";
    const headerCenterY = tableTop + 5;
    canvasContext.fillText("Pos", 78, headerCenterY);
    canvasContext.fillText("Beschreibung", 128, headerCenterY);
    canvasContext.textAlign = "right";
    canvasContext.fillText("Einzelpreis \u20AC", 560, headerCenterY);
    canvasContext.fillText("Menge", 650, headerCenterY);
    canvasContext.fillText("Summe \u20AC", 724, headerCenterY);
    canvasContext.textAlign = "left";
    canvasContext.textBaseline = "top";
    canvasContext.strokeStyle = "#cccccc";
    canvasContext.lineWidth = 0.8;
    canvasContext.beginPath();
    canvasContext.moveTo(66, tableTop + 20);
    canvasContext.lineTo(738, tableTop + 20);
    canvasContext.stroke();
    return tableTop + 32;
  };

  const drawContinuationHeader = (pageIndex) => {
    const offsetY = pageIndex * PAGE_HEIGHT;
    canvasContext.fillStyle = "#111111";
    canvasContext.font = 'bold 18px Calibri, Candara, "Segoe UI", sans-serif';
    canvasContext.textBaseline = "top";
    canvasContext.fillText(`${invoiceTitle} ${invoiceNumber}`, 66, offsetY + 24);
    canvasContext.font = '13px Calibri, Candara, "Segoe UI", sans-serif';
    canvasContext.textAlign = "right";
    canvasContext.fillText(`Datum: ${formatDate(state.invoiceDraft.issueDate)}`, 738, offsetY + 24);
    canvasContext.fillText(`Bearbeiter: ${business.issuerName || "-"}`, 738, offsetY + 48);
    canvasContext.textAlign = "left";
  };

  const footerSegments = [
    business.bankName ? `Bank: ${business.bankName}` : "",
    business.iban ? `IBAN: ${business.iban}` : "",
    business.bic ? `BIC: ${business.bic}` : "",
    business.uid ? `UID: ${business.uid}` : ""
  ].filter(Boolean);
  const footerText = footerSegments.join("; ");

  const drawFooter = (pageIndex) => {
    const offsetY = pageIndex * PAGE_HEIGHT;
    canvasContext.strokeStyle = "#222222";
    canvasContext.lineWidth = 1;
    canvasContext.beginPath();
    canvasContext.moveTo(14, offsetY + FOOTER_LINE_Y);
    canvasContext.lineTo(780, offsetY + FOOTER_LINE_Y);
    canvasContext.stroke();
    if (footerText) {
      canvasContext.font = '11px Calibri, Candara, "Segoe UI", sans-serif';
      canvasContext.fillStyle = "#333333";
      canvasContext.textAlign = "left";
      canvasContext.fillText(footerText, 16, offsetY + FOOTER_TEXT_Y);
    }
    if (neededPages > 1) {
      canvasContext.font = '11px Calibri, Candara, "Segoe UI", sans-serif';
      canvasContext.fillStyle = "#666666";
      canvasContext.textAlign = "right";
      canvasContext.fillText(`Seite ${pageIndex + 1} von ${neededPages}`, 778, offsetY + FOOTER_TEXT_Y);
      canvasContext.textAlign = "left";
    }
  };

  // --- Positionen zeichnen ---
  let currentPage = 0;
  let itemY = drawTableHeader(Math.max(firstPageTableOffset, invoiceMetaBottom + 8));

  // Continuation-Header für Folgeseiten
  for (let p = 1; p < neededPages; p++) {
    if (template) {
      canvasContext.drawImage(template, 0, p * PAGE_HEIGHT, PAGE_WIDTH, PAGE_HEIGHT);
    } else {
      canvasContext.fillStyle = "#ffffff";
      canvasContext.fillRect(0, p * PAGE_HEIGHT, PAGE_WIDTH, PAGE_HEIGHT);
    }
    drawContinuationHeader(p);
  }

  validItems.forEach((item, index) => {
    const current = calculateItem(item);
    const hasDiscount = toNumber(item.discount) > 0;
    const rowH = hasDiscount ? 70 : 54;

    // Seitenumbruch prüfen
    if (pageBreaks.includes(index)) {
      currentPage++;
      itemY = drawTableHeader(currentPage * PAGE_HEIGHT + 70);
    }

    canvasContext.fillStyle = "#111111";
    canvasContext.font = '13px Calibri, Candara, "Segoe UI", sans-serif';
    canvasContext.textBaseline = "top";
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
      item.unit ? `${formatAmount(item.quantity)} ${String(item.unit).trim()}` : formatAmount(item.quantity),
      644,
      itemY
    );
    canvasContext.fillText(formatAmount(current.net), 710, itemY);
    canvasContext.textAlign = "left";
    itemY += rowH;
  });

  // --- Summen (immer auf letzter Seite) ---
  const lastPageOffsetY = currentPage * PAGE_HEIGHT;
  const sumDividerY = currentPage === 0
    ? Math.max(itemY - 10, lastPageOffsetY + 468 + headerShift)
    : itemY - 10;
  canvasContext.strokeStyle = "#202020";
  canvasContext.lineWidth = 1;
  canvasContext.beginPath();
  canvasContext.moveTo(66, sumDividerY);
  canvasContext.lineTo(738, sumDividerY);
  canvasContext.stroke();

  const totalsStartY = currentPage === 0
    ? Math.max(itemY + 18, lastPageOffsetY + 500 + headerShift)
    : itemY + 18;

  const drawAmountLine = (label, value, y, bold = false) => {
    canvasContext.textAlign = "left";
    canvasContext.fillStyle = "#111111";
    canvasContext.font = `${bold ? "bold " : ""}${bold ? "16" : "14"}px Calibri, Candara, "Segoe UI", sans-serif`;
    canvasContext.fillText(label, 494, y);
    canvasContext.textAlign = "right";
    canvasContext.fillText(value, 734, y);
  };

  const hasDiscountTotal = totals.discountTotal > 0;
  const preDiscountSubtotal = roundCurrency(totals.subtotal + totals.discountTotal);
  const taxLineY = totalsStartY + (hasDiscountTotal ? 72 : 24);
  const totalLineY = totalsStartY + (hasDiscountTotal ? 108 : 60);
  const totalDividerY = totalsStartY + (hasDiscountTotal ? 92 : 44);
  drawAmountLine(hasDiscountTotal ? "Zwischensumme (Netto)" : "Netto", formatAmount(hasDiscountTotal ? preDiscountSubtotal : totals.subtotal), totalsStartY);
  if (hasDiscountTotal) {
    drawAmountLine("Rabatt-Abzug", `- ${formatAmount(totals.discountTotal)}`, totalsStartY + 24);
    drawAmountLine("Netto nach Rabatt", formatAmount(totals.subtotal), totalsStartY + 48);
  }
  drawAmountLine(getPreviewTaxLabel(), formatAmount(totals.taxTotal), taxLineY);
  drawAmountLine("Gesamtbetrag \u20AC", formatAmount(totals.grossTotal), totalLineY, true);

  canvasContext.beginPath();
  canvasContext.lineWidth = 1.8;
  canvasContext.moveTo(492, totalDividerY);
  canvasContext.lineTo(738, totalDividerY);
  canvasContext.stroke();
  canvasContext.textAlign = "left";

  const paymentLines = [
    `F\u00E4llig am: ${formatDate(state.invoiceDraft.dueDate)}`,
    business.paymentNote || "F\u00E4llig innerhalb von 14 Tagen ohne Abzug.",
    state.invoiceDraft.notes || ""
  ].filter(Boolean);

  let blockY = totalsStartY + (hasDiscountTotal ? 150 : 126);
  canvasContext.font = '13px Calibri, Candara, "Segoe UI", sans-serif';
  canvasContext.fillStyle = "#111111";
  paymentLines.forEach((line) => {
    drawWrappedText(canvasContext, line, 66, blockY, 560, 18, 3);
    blockY += 22;
  });

  const footerBaseY = lastPageOffsetY + (currentPage === 0 ? 956 : PAGE_HEIGHT - 167);
  if (business.footerNote) {
    drawWrappedText(canvasContext, business.footerNote, 66, Math.max(blockY + 26, footerBaseY), 610, 18, 3);
  }

  for (let p = 0; p < neededPages; p += 1) {
    drawFooter(p);
  }

  if (state.invoiceDraft.signatureDataUrl) {
    const signatureImage = await loadInlineImage(state.invoiceDraft.signatureDataUrl).catch(() => null);
    if (signatureImage) {
      const maxWidth = 150;
      const maxHeight = 80;
      const ratio = Math.min(maxWidth / signatureImage.width, maxHeight / signatureImage.height, 1);
      const drawWidth = Math.round(signatureImage.width * ratio);
      const drawHeight = Math.round(signatureImage.height * ratio);
      // Unterschrift vertikal zentriert im Bereich
      const sigX = 560;
      const sigY = lastPageOffsetY + PAGE_HEIGHT - 230 + Math.round((maxHeight - drawHeight) / 2);
      canvasContext.drawImage(signatureImage, sigX, sigY, drawWidth, drawHeight);
      canvasContext.font = '11px Calibri, Candara, "Segoe UI", sans-serif';
      canvasContext.fillStyle = "#111111";
      canvasContext.fillText("Kundenunterschrift", 560, lastPageOffsetY + PAGE_HEIGHT - 161);
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
    setLoading(true, "\u00C4nderungen werden gespeichert und synchronisiert...");
    const settingsPayload = readSettingsForm();
    const response = await api("/api/settings", {
      method: "PUT",
      body: JSON.stringify({ settings: settingsPayload })
    });

    applyReceivedSettings(response.settings);
    if (invoiceLogoFileInput) {
      invoiceLogoFileInput.value = "";
    }
    if (appLogoFileInput) {
      appLogoFileInput.value = "";
    }
    refreshBrandAssets();
    populateSettingsForm();
    await renderCanvas();
    refreshSendPreview();
    setStatus("Einstellungen gespeichert.", "success");
    schedulePreviewRender();
    closePanels();
    focusMainButton?.click();
    scrollMainContentToTop();
    focusMainButton?.focus();
  } catch (error) {
    setStatus(error.message || "Einstellungen konnten nicht gespeichert werden.", "error");
  } finally {
    setLoading(false);
  }
}

async function clearInvoiceLogo() {
  try {
    setLoading(true, "Rechnungslogo wird entfernt...");
    const response = await removeLogoAsset("invoice");
    if (response?.settings) {
      applyReceivedSettings({
        ...state.settings,
        ...response.settings,
        branding: {
          ...(state.settings?.branding || {}),
          ...(response.settings?.branding || {})
        }
      });
    } else {
      setBrandingLogoState("invoice", "");
    }
    await persistInvoiceLogoToDeviceCache("");
    if (invoiceLogoFileInput) {
      invoiceLogoFileInput.value = "";
    }
    refreshBrandAssets();
    populateSettingsForm();
    await renderCanvas();
    refreshSendPreview();
    setStatus("Rechnungslogo entfernt. Die Rechnung wird jetzt ohne Logo erstellt.", "success");
  } catch (error) {
    setStatus(error.message || "Rechnungslogo konnte nicht entfernt werden.", "error");
  } finally {
    setLoading(false);
  }
}

async function clearAppLogo() {
  try {
    setLoading(true, "App-Logo wird entfernt...");
    const response = await removeLogoAsset("app");
    if (response?.settings) {
      applyReceivedSettings({
        ...state.settings,
        ...response.settings,
        branding: {
          ...(state.settings?.branding || {}),
          ...(response.settings?.branding || {})
        }
      });
    } else {
      setBrandingLogoState("app", "");
    }
    if (appLogoFileInput) {
      appLogoFileInput.value = "";
    }
    refreshBrandAssets();
    populateSettingsForm();
    setStatus("App-Logo entfernt. Das Standardlogo wird wieder verwendet.", "success");
  } catch (error) {
    setStatus(error.message || "App-Logo konnte nicht entfernt werden.", "error");
  } finally {
    setLoading(false);
  }
}

async function createAdminUser(event) {
  event.preventDefault();

  const username = String(adminNewUsernameInput?.value || "")
    .trim()
    .toLowerCase();
  const defaultPassword = String(adminDefaultPasswordInput?.value || "").trim() || "admin";

  if (!username) {
    setStatus("Bitte einen Benutzernamen eingeben.", "error");
    adminNewUsernameInput?.focus();
    return;
  }

  try {
    setLoading(true, "Benutzer wird angelegt und synchronisiert...");
    const response = await api("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({ username, defaultPassword })
    });

    state.adminUsers = normalizeLegacyData(response.users || []);
    if (response.settings) {
      applyReceivedSettings(response.settings);
      populateSettingsForm();
    }
    renderAdminUsers();
    adminUserForm?.reset();
    if (adminDefaultPasswordInput) {
      adminDefaultPasswordInput.value = defaultPassword;
    }
    updateAdminDefaultPasswordButtonVisibility();
    setStatus(`Benutzer ${username} wurde mit dem Passwort ${defaultPassword} angelegt.`, "success");
    adminNewUsernameInput?.focus();
  } catch (error) {
    setStatus(error.message || "Benutzer konnte nicht angelegt werden.", "error");
  } finally {
    setLoading(false);
  }
}

async function saveAdminDefaultPassword() {
  const defaultPassword = String(adminDefaultPasswordInput?.value || "").trim();
  if (!defaultPassword) {
    setStatus("Bitte ein Standardkennwort eingeben.", "error");
    adminDefaultPasswordInput?.focus();
    return;
  }

  try {
    const response = await api("/api/admin/default-password", {
      method: "POST",
      body: JSON.stringify({ password: defaultPassword })
    });

    applyReceivedSettings(response.settings);
    await hydrateInvoiceLogoFromDeviceCache(response.settings?.auth?.username || state.auth.username);
    populateSettingsForm();
    if (adminDefaultPasswordInput) {
      adminDefaultPasswordInput.value = defaultPassword;
    }
    updateAdminDefaultPasswordButtonVisibility();
    setStatus(response.message || "Standardkennwort gespeichert.", "success");
  } catch (error) {
    setStatus(error.message || "Standardkennwort konnte nicht gespeichert werden.", "error");
  }
}

async function resetAdminUserPassword(username) {
  if (!username) {
    return;
  }

  if (!window.confirm(`Willst du das Passwort von ${username} wirklich zurücksetzen?`)) {
    return;
  }

  try {
    const response = await api(`/api/admin/users/${encodeURIComponent(username)}/reset-password`, {
      method: "POST"
    });

    state.adminUsers = normalizeLegacyData(response.users || []);
    renderAdminUsers();
    setStatus(response.message || `Passwort von ${username} wurde zur\u00FCckgesetzt.`, "success");
  } catch (error) {
    setStatus(error.message || "Passwort konnte nicht zur\u00FCckgesetzt werden.", "error");
  }
}

async function toggleAdminUserLock(username, isCurrentlyLocked) {
  if (!username) {
    return;
  }

  const actionLabel = isCurrentlyLocked ? "entsperren" : "sperren";
  if (!window.confirm(`Willst du den Benutzer ${username} wirklich ${actionLabel}?`)) {
    return;
  }

  try {
    setLoading(true, isCurrentlyLocked ? "Benutzer wird entsperrt und synchronisiert..." : "Benutzer wird gesperrt und synchronisiert...");
    const response = await api(`/api/admin/users/${encodeURIComponent(username)}/toggle-lock`, {
      method: "POST"
    });

    state.adminUsers = normalizeLegacyData(response.users || []);
    renderAdminUsers();
    setStatus(response.message || `Benutzer ${username} wurde ${isCurrentlyLocked ? "entsperrt" : "gesperrt"}.`, "success");
  } catch (error) {
    setStatus(error.message || "Benutzerstatus konnte nicht geändert werden.", "error");
  } finally {
    setLoading(false);
  }
}

async function deleteAdminUser(username) {
  if (!username) {
    return;
  }

  if (!window.confirm(`Willst du den Benutzer ${username} wirklich löschen? Alle Daten dieses Benutzers gehen dabei verloren.`)) {
    return;
  }

  try {
    setLoading(true, "Benutzer wird gel\u00F6scht und synchronisiert...");
    const response = await api(`/api/admin/users/${encodeURIComponent(username)}`, {
      method: "DELETE"
    });

    state.adminUsers = normalizeLegacyData(response.users || []);
    renderAdminUsers();
    setStatus(response.message || `Benutzer ${username} wurde gel\u00F6scht.`, "success");
  } catch (error) {
    setStatus(error.message || "Benutzer konnte nicht gel\u00F6scht werden.", "error");
  }
}

async function submitPasswordChange(event) {
  event.preventDefault();

  const nextPassword = String(passwordDialogNewInput?.value || "");
  const confirmPassword = String(passwordDialogConfirmInput?.value || "");

  if (!nextPassword.trim()) {
    setStatus("Bitte ein neues Kennwort eingeben.", "error");
    window.alert("Bitte ein neues Kennwort eingeben.");
    passwordDialogNewInput?.focus();
    return;
  }

  if (nextPassword !== confirmPassword) {
    setStatus("Die beiden Kennw\u00F6rter stimmen nicht \u00FCberein.", "error");
    window.alert("Die beiden Kennw\u00F6rter stimmen nicht \u00FCberein.");
    passwordDialogConfirmInput?.focus();
    return;
  }

  try {
    const response = await api("/api/auth/password", {
      method: "POST",
      body: JSON.stringify({ password: nextPassword })
    });

    applyReceivedSettings(response.settings);
    persistStoredCredentials(state.auth.username, nextPassword);
    populateSettingsForm();
    closePasswordDialog();
    setStatus("Kennwort wurde ge\u00E4ndert.", "success");
    window.alert("Kennwort wurde erfolgreich ge\u00E4ndert.");
  } catch (error) {
    setStatus(error.message || "Kennwort konnte nicht ge\u00E4ndert werden.", "error");
    window.alert(error.message || "Kennwort konnte nicht ge\u00E4ndert werden.");
  }
}

async function saveCustomer(event) {
  event.preventDefault();
  const customer = readCustomerForm();

  if (!customer.name.trim() && !customer.contactPerson.trim()) {
    setStatus("Bitte Firmenname oder Kontaktperson eingeben.", "error");
    customerFields.name?.focus();
    return;
  }

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
    setStatus("Artikel gespeichert.", "success");
    closePanelsIfMobile();
  } catch (error) {
    setStatus(error.message || "Artikel konnte nicht gespeichert werden.", "error");
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
      setStatus("Kunde gel\u00F6scht.", "success");
    } catch (error) {
      setStatus(error.message || "Kunde konnte nicht gel\u00F6scht werden.", "error");
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

  if (window.confirm(`Artikel "${article.name}" wirklich l\u00F6schen?`)) {
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
      setStatus("Artikel gel\u00F6scht.", "success");
    } catch (error) {
      setStatus(error.message || "Artikel konnte nicht gel\u00F6scht werden.", "error");
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
  const detailsButton = event.target.closest('[data-action="toggle-item-details"]');
  if (detailsButton) {
    const row = detailsButton.closest("tr[data-index]");
    if (!row) {
      return;
    }

    const index = Number(row.dataset.index);
    if (!Number.isInteger(index) || !state.invoiceDraft.items[index]) {
      return;
    }

    state.invoiceDraft.items[index] = {
      ...state.invoiceDraft.items[index],
      detailsExpanded: !state.invoiceDraft.items[index].detailsExpanded
    };
    renderInvoiceItems();
    return;
  }

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
    const stepperIndex = Number(row.dataset.index);
    if (Number.isInteger(stepperIndex) && state.invoiceDraft.items[stepperIndex]) {
      state.invoiceDraft.items[stepperIndex] = {
        ...state.invoiceDraft.items[stepperIndex],
        quantity: roundCurrency(nextValue)
      };
    }
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
  const { includePdfLink = false, includeInvoiceUrlToken = false } = options;
  const customerEmail = String(invoice.customer?.email || selectedCustomer()?.email || "").trim();
  const ccEmail = String(state.settings?.email?.ccEmail || state.settings?.business?.email || "")
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
    invoiceUrl: includeInvoiceUrlToken ? invoiceUrl : ""
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
  const draft = buildClientEmailDraft(invoice);
  const recipient = String(draft.customerEmail || "").trim();
  const params = new URLSearchParams();
  if (draft.ccEmail) {
    params.set("cc", draft.ccEmail);
  }
  if (draft.subject) {
    params.set("subject", draft.subject);
  }
  if (draft.body) {
    params.set("body", draft.body);
  }
  return `mailto:${recipient}?${params.toString()}`;
}

function buildInvoiceRequestPayload(deliveryMethod = "external-app") {
  const customer = selectedCustomer();
  return {
    customerId: state.invoiceDraft.customerId,
    customer: customer
      ? {
          id: customer.id,
          customerNumber: customer.customerNumber,
          name: customer.name,
          email: customer.email
        }
      : null,
    issueDate: state.invoiceDraft.issueDate,
    dueDate: state.invoiceDraft.dueDate,
    reference: state.invoiceDraft.reference,
    notes: state.invoiceDraft.notes,
    title: state.settings?.invoice?.title || "Rechnung",
    items: state.invoiceDraft.items.map((item) => ({
      ...item,
      unit: String(item.unit || "").trim()
    })),
    imageDataUrl: null,
    deliveryMethod
  };
}

async function fetchInvoicePdfFile(invoice) {
  const pdfUrl = buildAuthenticatedFileUrl(invoice.files?.pdfUrl);
  if (!pdfUrl) {
    return null;
  }

  const response = await fetch(pdfUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("PDF konnte nicht geladen werden.");
  }

  const blob = await response.blob();
  if (!blob.size) {
    throw new Error("PDF ist leer.");
  }

  return new File([blob], `${invoice.invoiceNumber}.pdf`, {
    type: blob.type || "application/pdf"
  });
}

function triggerFileDownload(file) {
  const objectUrl = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = file.name || "rechnung.pdf";
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

async function openExternalMailApp(invoice) {
  window.location.href = buildMailtoLink(invoice);
  return "mailto";
}

async function shareInvoiceFile(invoice) {
  const pdfFile = await fetchInvoicePdfFile(invoice);
  if (!pdfFile) {
    throw new Error("PDF konnte nicht geladen werden.");
  }

  const shareSupported =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function";

  if (shareSupported && navigator.canShare({ files: [pdfFile] })) {
    await navigator.share({
      title: `Rechnung ${invoice.invoiceNumber}`,
      text: buildClientEmailDraft(invoice).body,
      files: [pdfFile]
    });
    return "share";
  }

  triggerFileDownload(pdfFile);
  return "download";
}


async function sendInvoice() {
  sendInvoiceButton.disabled = true;
  sendInvoiceButton.textContent = "Rechnung wird gesendet...";

  try {
    sendInvoiceButton.textContent = "Rechnung wird gesendet...";
    const customer = selectedCustomer();
    if (!customer?.email) {
      showInvoiceDraftWarning("Beim ausgew\u00E4hlten Kunden ist keine E-Mail-Adresse hinterlegt.");
      return;
    }

    await renderCanvas();
    refreshSendPreview();

    const payload = buildInvoiceRequestPayload("external-app");
    payload.imageDataUrl = await canvasToPngDataUrl(invoiceCanvas);
    const slices = buildPageSlices(invoiceCanvas);
    if (slices) payload.pageSlices = slices;

    const response = await api("/api/invoices", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    state.invoices = [response.invoice, ...state.invoices];
    applyReceivedSettings(response.settings);
    populateSettingsForm();
    renderInvoiceHistory();
    closeSendDialog();
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
      items: [],
      signatureDataUrl: ""
    };
    syncInvoiceMetaInputs();
    renderInvoiceItems();
    updateInvoiceTotalsDisplay();
    schedulePreviewRender();
    scrollMainContentToTop();
    setStatus("Bereit. Rechnung kann erstellt werden.", "success");
  } catch (error) {
    setStatus(error.message || "Rechnung konnte nicht gesendet werden.", "error");
    window.alert(error.message || "Rechnung konnte nicht gesendet werden.");
  } finally {
    sendInvoiceButton.disabled = false;
    sendInvoiceButton.textContent = "Senden";
  }
}

async function shareInvoiceDraft() {
  shareInvoiceButton.disabled = true;
  setLoading(true, "Rechnung wird zum Teilen vorbereitet...");

  try {
    const customer = selectedCustomer();
    if (!customer) {
      showInvoiceDraftWarning("Bitte zuerst einen Kunden ausw\u00E4hlen.");
      return;
    }

    const validItems = getValidInvoiceItems();
    if (!validItems.length) {
      showInvoiceDraftWarning("Es sind keine Daten vorhanden. Bitte zuerst einen Artikel eintragen.");
      return;
    }

    await renderCanvas();
    refreshSendPreview();

    const payload = buildInvoiceRequestPayload("share-preview");
    payload.imageDataUrl = await canvasToPngDataUrl(invoiceCanvas);
    const slices = buildPageSlices(invoiceCanvas);
    if (slices) payload.pageSlices = slices;

    const response = await api("/api/invoices/share-preview", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    state.invoices = [response.invoice, ...state.invoices];
    if (response.settings) {
      applyReceivedSettings(response.settings);
      populateSettingsForm();
    }
    renderInvoiceHistory();
    closeSendDialog();

    await shareInvoiceFile(response.invoice);

    const preservedCustomerId = state.invoiceDraft.customerId;
    state.invoiceDraft = {
      customerId: preservedCustomerId,
      issueDate: today(),
      dueDate: addDays(14),
      reference: "",
      notes: "",
      items: [],
      signatureDataUrl: ""
    };
    syncInvoiceMetaInputs();
    renderInvoiceItems();
    updateInvoiceTotalsDisplay();
    schedulePreviewRender();
    setStatus("Rechnung wurde zum Teilen ge\u00F6ffnet.", "success");
  } catch (error) {
    setStatus(error.message || "Rechnung konnte nicht geteilt werden.", "error");
    window.alert(error.message || "Rechnung konnte nicht geteilt werden.");
  } finally {
    setLoading(false);
    shareInvoiceButton.disabled = false;
  }
}

async function resendInvoice(invoiceId) {
  const resendButton = invoiceHistory.querySelector(`[data-resend-invoice="${invoiceId}"]`);
  if (resendButton) {
    resendButton.disabled = true;
    resendButton.textContent = "Wird vorbereitet...";
  }
  setLoading(true, "Rechnung wird erneut vorbereitet...");

  try {
    const response = await api(`/api/invoices/${invoiceId}/resend`, {
      method: "POST",
      body: JSON.stringify({ deliveryMethod: "external-app" })
    });

    state.invoices = state.invoices.map((entry) =>
      entry.id === response.invoice.id ? response.invoice : entry
    );
    renderInvoiceHistory();

    if (response.email?.status === "external-app" && response.invoice) {
      await openExternalMailApp(response.invoice);
    } else if (response.email?.status === "sent") {
      setStatus("Rechnung erfolgreich gesendet.", "success");
    } else if (response.email?.status && response.email.status !== "sent") {
      window.alert(response.email.message || "Erneutes Senden fehlgeschlagen.");
      setStatus(response.email.message || "Erneutes Senden fehlgeschlagen.", "error");
      return;
    }

    setStatus(response.email?.message || "Rechnung wurde erneut vorbereitet.", "success");
  } catch (error) {
    setStatus(error.message || "Rechnung konnte nicht erneut gesendet werden.", "error");
    window.alert(error.message || "Rechnung konnte nicht erneut gesendet werden.");
  } finally {
    setLoading(false);
    // Button wird durch renderInvoiceHistory() ohnehin neu gerendert
  }
}

async function shareExistingInvoice(invoiceId) {
  setLoading(true, "Rechnung wird zum Teilen vorbereitet...");

  try {
    const invoice = state.invoices.find((entry) => entry.id === invoiceId);
    if (!invoice) {
      throw new Error("Rechnung nicht gefunden.");
    }

    await shareInvoiceFile(invoice);
    setStatus("Rechnung wurde zum Teilen ge\u00F6ffnet.", "success");
  } catch (error) {
    setStatus(error.message || "Rechnung konnte nicht geteilt werden.", "error");
    window.alert(error.message || "Rechnung konnte nicht geteilt werden.");
  } finally {
    setLoading(false);
  }
}

async function prepareInvoiceForSend() {
  if (!state.invoiceDraft.customerId) {
    showInvoiceDraftWarning("Bitte zuerst einen Kunden ausw\u00E4hlen.");
    return;
  }

  const validItems = getValidInvoiceItems();
  if (!validItems.length) {
    showInvoiceDraftWarning("Es sind keine Daten vorhanden. Bitte zuerst einen Artikel eintragen.");
    return;
  }

  createInvoiceButton.disabled = true;
  createInvoiceButton.textContent = "Vorschau wird vorbereitet...";
  try {
    openSendDialog();
    await renderCanvas();
    refreshSendPreview();
    setStatus("Rechnung vorbereitet. Bitte pr\u00FCfen, bei Bedarf unterschreiben und danach senden.", "info");
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

  const originalText = authSubmit.textContent;
  authSubmit.disabled = true;
  authSubmit.classList.add("is-loading");
  authSubmit.textContent = "Anmelden…";

  try {
    const response = await api(
      "/api/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ username, password })
      }
    );

    window.localStorage.setItem(STORAGE_KEYS.authToken, response.token);
    persistStoredCredentials(username, password);
    state.auth.hasUser = true;
    state.auth.authenticated = true;
    state.auth.username = response.username;
    authForm.reset();
    authSubmit.classList.remove("is-loading");
    authSubmit.disabled = false;
    authSubmit.textContent = originalText;
    setAuthMode("login");
    hideAuthOverlay();
    await bootstrap();
    return;
  } catch (error) {
    authSubmit.disabled = false;
    authSubmit.classList.remove("is-loading");
    authSubmit.textContent = originalText;
    const message = error.message || "Benutzername oder Kennwort ist nicht korrekt.";
    setStatus(message, "error");
    window.alert(message);
    return;
  }

}

async function handleLogout() {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } catch {
    // Token kann bereits ungueltig sein.
  }

  clearAuthToken();
  clearStoredCredentials();
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
      "Installiere die App auf deinem Ger\u00E4t, damit sie ohne Browserleiste wie eine echte App startet.";
  } else {
    installPromptText.textContent =
      "Wenn dein Browser keine direkte Installation anbietet, nutze im Browser-Men\u00FC \u201EZum Startbildschirm hinzuf\u00FCgen\u201C oder \u201EApp installieren\u201C.";
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
      "Bitte im Browser-Men\u00FC \u201EZum Startbildschirm hinzuf\u00FCgen\u201C oder \u201EApp installieren\u201C w\u00E4hlen."
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
      if (!passwordDialog.hidden) {
        closePasswordDialog();
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
    extendSignatureBounds(point);
  });

  signaturePad.addEventListener("pointermove", (event) => {
    if (!isSignatureDrawing) {
      return;
    }

    const point = signaturePointFromEvent(event);
    signatureContext.lineTo(point.x, point.y);
    signatureContext.stroke();
    extendSignatureBounds(point);
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
    state.invoiceDraft.signatureDataUrl = exportSignatureDataUrl();
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
  shareInvoiceButton?.addEventListener("click", shareInvoiceDraft);
  closePasswordDialogButton?.addEventListener("click", closePasswordDialog);
  cancelPasswordDialogButton?.addEventListener("click", closePasswordDialog);
  passwordDialogForm?.addEventListener("submit", submitPasswordChange);
  passwordDialogNewInput?.addEventListener("input", updatePasswordDialogValidation);
  passwordDialogConfirmInput?.addEventListener("input", updatePasswordDialogValidation);
  togglePasswordDialogNewButton?.addEventListener("click", () => {
    if (!passwordDialogNewInput) {
      return;
    }
    passwordDialogNewInput.type = passwordDialogNewInput.type === "password" ? "text" : "password";
    updatePasswordDialogValidation();
  });
  togglePasswordDialogConfirmButton?.addEventListener("click", () => {
    if (!passwordDialogConfirmInput) {
      return;
    }
    passwordDialogConfirmInput.type =
      passwordDialogConfirmInput.type === "password" ? "text" : "password";
    updatePasswordDialogValidation();
  });
  passwordDialog?.addEventListener("click", (event) => {
    if (event.target === passwordDialog) {
      closePasswordDialog();
    }
  });
}

function bindStaticEvents() {
  invoiceForm.addEventListener("submit", (event) => event.preventDefault());
  settingsForm.addEventListener("submit", saveSettings);
  settingsForm.addEventListener("input", updateSettingsSaveButtonVisibility);
  settingsForm.addEventListener("change", updateSettingsSaveButtonVisibility);
  settingsForm.querySelectorAll("details.settings-accordion").forEach((detailsElement) => {
    detailsElement.addEventListener("toggle", () => {
      if (!detailsElement.open) {
        return;
      }
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => keepSettingsAccordionInView(detailsElement));
      });
    });
  });
  adminUserForm?.addEventListener("submit", createAdminUser);
  saveAdminDefaultPasswordButton?.addEventListener("click", saveAdminDefaultPassword);
  adminDefaultPasswordInput?.addEventListener("input", updateAdminDefaultPasswordButtonVisibility);
  toggleSettingsAuthPasswordButton?.addEventListener("click", () => {
    settingsAuthPasswordInput.type =
      settingsAuthPasswordInput.type === "password" ? "text" : "password";
    updateSettingsAuthPasswordToggleLabel();
  });
  changeSettingsPasswordButton?.addEventListener("click", () => {
    openPasswordDialog();
  });
  invoiceLogoFileInput?.addEventListener("change", async (event) => {
    const file = event.target?.files?.[0] || null;
    try {
      await saveSelectedLogo("invoice", file);
      if (invoiceLogoFileInput) {
        invoiceLogoFileInput.value = "";
      }
      setStatus("Rechnungslogo gespeichert.", "success");
    } catch (error) {
      setStatus(error.message || "Rechnungslogo konnte nicht geladen werden.", "error");
    }
  });
  appLogoFileInput?.addEventListener("change", async (event) => {
    const file = event.target?.files?.[0] || null;
    try {
      await saveSelectedLogo("app", file);
      if (appLogoFileInput) {
        appLogoFileInput.value = "";
      }
      setStatus("App-Logo gespeichert.", "success");
    } catch (error) {
      setStatus(error.message || "App-Logo konnte nicht geladen werden.", "error");
    }
  });
  removeInvoiceLogoButton?.addEventListener("click", clearInvoiceLogo);
  removeAppLogoButton?.addEventListener("click", clearAppLogo);
  addCcEmailButton?.addEventListener("click", () => addCcEmailRow(""));
  ccEmailList?.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-remove-cc]");
    if (!removeButton) {
      return;
    }

    const removeIndex = Number(removeButton.dataset.removeCc);
    const entries = readCcEmailInputs().filter((_, index) => index !== removeIndex);
    renderCcEmailInputs(entries);
    updateSettingsSaveButtonVisibility();
  });
  customerForm.addEventListener("submit", saveCustomer);
  customerFields.contactPerson?.addEventListener("input", updateCustomerNameRequirement);
  customerFields.name?.addEventListener("input", updateCustomerNameRequirement);
  customerForm.addEventListener("input", updateCustomerFormActionVisibility);
  customerForm.addEventListener("change", updateCustomerFormActionVisibility);
  articleForm.addEventListener("submit", saveArticle);
  articleForm.addEventListener("input", handleArticleFormLiveInput);
  articleForm.addEventListener("input", updateArticleFormActionVisibility);
  articleForm.addEventListener("change", updateArticleFormActionVisibility);
  articleFields.group?.addEventListener("focus", showArticleGroupSuggestions);
  articleFields.group?.addEventListener("click", showArticleGroupSuggestions);
  articleFields.group?.addEventListener("input", () => {
    renderArticleGroupSuggestions(articleFields.group.value, true);
  });
  articleFields.group?.addEventListener("blur", hideArticleGroupSuggestions);
  articleGroupSuggestions?.addEventListener("click", (event) => {
    const option = event.target.closest("[data-group-option]");
    if (!option || !articleFields.group) {
      return;
    }

    articleFields.group.value = option.dataset.groupOption || "";
    articleGroupSuggestions.hidden = true;
    articleFields.group.blur();
  });
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
  invoiceHistory.addEventListener("click", async (event) => {
    const resendButton = event.target.closest("[data-resend-invoice]");
    if (resendButton) {
      await resendInvoice(resendButton.dataset.resendInvoice);
      return;
    }

    const shareButton = event.target.closest("[data-share-invoice]");
    if (shareButton) {
      await shareExistingInvoice(shareButton.dataset.shareInvoice);
    }
  });
  adminUsersTable?.addEventListener("click", async (event) => {
    const toggleButton = event.target.closest("[data-toggle-admin-user]");
    if (toggleButton) {
      toggleAdminUserExpanded(toggleButton.dataset.toggleAdminUser);
      return;
    }

    const resetButton = event.target.closest("[data-reset-user-password]");
    if (resetButton) {
      await resetAdminUserPassword(resetButton.dataset.resetUserPassword);
      return;
    }

    const toggleLockButton = event.target.closest("[data-toggle-user-lock]");
    if (toggleLockButton) {
      const username = toggleLockButton.dataset.toggleUserLock;
      const user = state.adminUsers.find((entry) => String(entry.username || "").trim() === String(username || "").trim());
      await toggleAdminUserLock(username, Boolean(user?.isLocked));
      return;
    }

    const deleteButton = event.target.closest("[data-delete-user]");
    if (deleteButton) {
      await deleteAdminUser(deleteButton.dataset.deleteUser);
    }
  });
  invoiceItemsTable.addEventListener("input", handleInvoiceTableInput);
  invoiceItemsTable.addEventListener("change", handleInvoiceTableChange);
  invoiceItemsTable.addEventListener("click", handleInvoiceTableClick);
  addInvoiceItemButton.addEventListener("click", addInvoiceItem);
  createInvoiceButton.addEventListener("click", prepareInvoiceForSend);
  resetCustomerFormButton.addEventListener("click", resetCustomerForm);
  resetArticleFormButton.addEventListener("click", resetArticleForm);

  document.getElementById("showAddCustomerFormButton")?.addEventListener("click", () => {
    fillCustomerForm(null);
    scrollPanelFormToTop(customerForm);
  });

  document.getElementById("showAddArticleFormButton")?.addEventListener("click", () => {
    fillArticleForm(null);
    scrollPanelFormToTop(articleForm);
  });
  invoiceCustomer.addEventListener("change", handleInvoiceMetaInput);
  issueDateInput.addEventListener("input", handleInvoiceMetaInput);
  dueDateInput.addEventListener("input", handleInvoiceMetaInput);
  invoiceReferenceInput.addEventListener("input", handleInvoiceMetaInput);
  invoiceNotesInput.addEventListener("input", handleInvoiceMetaInput);
  authForm.addEventListener("submit", handleAuthSubmit);
  logoutButton?.addEventListener("click", handleLogout);
  logoutButtonSettings?.addEventListener("click", handleLogout);
}

async function bootstrap() {
  setLoading(true, "Lokale Daten werden geladen...");
  try {
    setStatus("Lade Daten...");
    await updateLoadingStep("Lokale Benutzerdaten werden geladen...");
    const response = normalizeLegacyData(await api("/api/bootstrap"));
    const adminMode = Boolean(response.isAdmin);
    await updateLoadingStep("Einstellungen werden geladen...");
    applyReceivedSettings(response.settings);
    await hydrateInvoiceLogoFromDeviceCache(response.settings?.auth?.username || state.auth.username);
    state.resendConfigured = Boolean(response.resendConfigured);
    state.adminUsers = response.adminUsers || [];
    // Nav-Benutzername aktualisieren
    const _navUserLabel = document.getElementById("navUserLabel");
    if (_navUserLabel) _navUserLabel.textContent = state.settings?.business?.companyName || state.auth.username || "";
    state.adminExpandedUsers = [];
    if (adminMode) {
      state.customers = [];
      state.articles = [];
      state.invoices = [];
    } else {
      await updateLoadingStep("Kunden werden geladen...");
      state.customers = sortByNumericField(response.customers || [], "customerNumber");
      await updateLoadingStep("Artikel werden geladen...");
      state.articles = sortByNumericField((response.articles || []).map(normalizeArticle), "number");
      await updateLoadingStep("Rechnungen werden geladen...");
      state.invoices = normalizeLegacyData(response.invoices || []);
    }

    if (!state.invoiceDraft.customerId) {
      state.invoiceDraft.customerId = state.customers[0]?.id || "";
    }

    await updateLoadingStep(adminMode ? "Benutzer werden geladen..." : "Oberfläche wird vorbereitet...");
    populateSettingsForm();
    applyRoleBasedUi();
    refreshBrandAssets();
    // Firmenname in Einstellungsleiste aktualisieren
    const _ul = document.getElementById("navUserLabel");
    if (_ul) _ul.textContent = state.settings?.business?.companyName || state.auth.username || "";
    fillCustomerForm(null, false);
    fillArticleForm(null, false);
    syncInvoiceMetaInputs();
    renderCustomers();
    renderArticles();
    renderAdminUsers();
    renderInvoiceItems();
    updateInvoiceTotalsDisplay();
    renderInvoiceHistory();
    await updateLoadingStep(adminMode ? "Admin-Oberfl\u00E4che wird gerendert..." : "Rechnungsvorschau wird aufgebaut...");
    await renderCanvas();
    if (logoutButton) {
      logoutButton.hidden = false;
    }
    setStatus("Bereit. Rechnung kann erstellt werden.", "success");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Die App konnte nicht geladen werden.", "error");
  } finally {
    setLoading(false);
  }
}

async function initializeApp() {
  appVersion.textContent = APP_VERSION;
  if (settingsVersion) {
    settingsVersion.textContent = APP_VERSION;
  }
  if (authVersion) {
    authVersion.textContent = APP_VERSION;
  }
  panelOverlay.hidden = true;
  sendDialog.hidden = true;
  signatureDialog.hidden = true;
  passwordDialog.hidden = true;
  authOverlay.hidden = true;
  if (logoutButton) {
    logoutButton.hidden = true;
  }
  setLoading(true, "App wird vorbereitet...");
  document.body.classList.remove("panel-open");
  document.body.classList.remove("dialog-open");
  try {
    await loadAuthState();
  } catch (error) {
    console.error(error);
    setStatus("Anmeldedaten konnten nicht geladen werden.", "error");
  }
  setAuthMode("login");
  updateSettingsAuthPasswordToggleLabel();
  updatePasswordDialogValidation();
  applyRoleBasedUi();

  authUsernameInput.value = state.auth.username || "";
  if (state.auth.authenticated) {
    hideAuthOverlay();
    await bootstrap();
    return;
  }

  setLoading(false);
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






