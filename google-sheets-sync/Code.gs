const SPREADSHEET_ID = '11sTU5OoNFaOkfnKfqzlcqG8O-CdG3OO2OzKMt6CCerY';
const API_SECRET = 'CHANGE_ME_SECRET';
const CURRENT_SCHEMA_VERSION = '2';

const SHEETS = {
  users: {
    name: 'User',
    headers: [
      'username',
      'company_name',
      'sender_line',
      'address_line_1',
      'address_line_2',
      'postal_code',
      'city',
      'country',
      'phone',
      'business_email',
      'uid',
      'bank_name',
      'iban',
      'bic',
      'issuer_name',
      'payment_note',
      'footer_note',
      'invoice_title',
      'counter_year',
      'counter_value',
      'cc_email',
      'email_subject',
      'email_body',
      'password',
      'default_user_password',
      'has_invoice_logo',
      'has_app_logo',
      'updated_at',
      'last_seen_at',
      'settings_json',
      'schema_version'
    ]
  },
  customers: {
    name: 'Kunden',
    headers: [
      'username',
      'customer_id',
      'customer_number',
      'name',
      'contact_person',
      'street',
      'postal_code',
      'city',
      'country',
      'phone',
      'email',
      'uid',
      'notes',
      'updated_at',
      'payload_json',
      'schema_version'
    ]
  },
  articles: {
    name: 'Artikel',
    headers: [
      'username',
      'article_id',
      'group_name',
      'number',
      'name',
      'description',
      'unit',
      'unit_price',
      'tax_rate',
      'updated_at',
      'payload_json',
      'schema_version'
    ]
  }
};

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : '{}');

    if (payload.secret !== API_SECRET) {
      return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
    }

    ensureSheets_();

    if (payload.action === 'getUserData') {
      return jsonResponse({ ok: true, data: getUserData_(String(payload.username || '').trim()) });
    }

    if (payload.action === 'upsertUserData') {
      upsertUserData_(String(payload.username || '').trim(), payload.data || {});
      return jsonResponse({ ok: true });
    }

    if (payload.action === 'listUsers') {
      return jsonResponse({ ok: true, users: listUsers_() });
    }

    if (payload.action === 'deleteUserData') {
      deleteUserData_(String(payload.username || '').trim());
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ ok: false, error: 'Unknown action' }, 400);
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message || 'Unexpected error' }, 500);
  }
}

function ensureSheets_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);

  Object.keys(SHEETS).forEach((key) => {
    const config = SHEETS[key];
    let sheet = spreadsheet.getSheetByName(config.name);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(config.name);
    }

    ensureHeaders_(sheet, config.headers);
  });
}

function ensureHeaders_(sheet, headers) {
  const currentColumnCount = Math.max(sheet.getLastColumn(), headers.length);
  const currentHeaders =
    currentColumnCount > 0 ? sheet.getRange(1, 1, 1, currentColumnCount).getValues()[0] : [];

  const mergedHeaders = headers.slice();
  currentHeaders.forEach((header) => {
    const normalizedHeader = String(header || '').trim();
    if (normalizedHeader && mergedHeaders.indexOf(normalizedHeader) === -1) {
      mergedHeaders.push(normalizedHeader);
    }
  });

  if (sheet.getMaxColumns() < mergedHeaders.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), mergedHeaders.length - sheet.getMaxColumns());
  }

  sheet.getRange(1, 1, 1, mergedHeaders.length).setValues([mergedHeaders]);
  sheet.getRange(1, 1, 1, mergedHeaders.length).setFontWeight('bold');
}

function getUserData_(username) {
  if (!username) {
    throw new Error('Username missing');
  }

  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const userSheet = spreadsheet.getSheetByName(SHEETS.users.name);
  const customerSheet = spreadsheet.getSheetByName(SHEETS.customers.name);
  const articleSheet = spreadsheet.getSheetByName(SHEETS.articles.name);

  const userTable = getSheetTable_(userSheet);
  const customerTable = getSheetTable_(customerSheet);
  const articleTable = getSheetTable_(articleSheet);

  const userRow = userTable.rows.find((row) => getCell_(row, userTable.indexMap, 'username') === username);
  if (!userRow) {
    return null;
  }

  const settings = buildUserSettingsFromRow_(userRow, userTable.indexMap);
  const customers = customerTable.rows
    .filter((row) => getCell_(row, customerTable.indexMap, 'username') === username)
    .map((row) => buildCustomerFromRow_(row, customerTable.indexMap));
  const articles = articleTable.rows
    .filter((row) => getCell_(row, articleTable.indexMap, 'username') === username)
    .map((row) => buildArticleFromRow_(row, articleTable.indexMap));

  return {
    settings: settings,
    lastSeenAt: getCell_(userRow, userTable.indexMap, 'last_seen_at'),
    schemaVersion: getCell_(userRow, userTable.indexMap, 'schema_version') || '1',
    customers: customers,
    articles: articles
  };
}

function upsertUserData_(username, data) {
  if (!username) {
    throw new Error('Username missing');
  }

  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const userSheet = spreadsheet.getSheetByName(SHEETS.users.name);
  const customerSheet = spreadsheet.getSheetByName(SHEETS.customers.name);
  const articleSheet = spreadsheet.getSheetByName(SHEETS.articles.name);
  const timestamp = new Date().toISOString();

  const userHeaderMap = getHeaderMap_(userSheet);
  const customerHeaderMap = getHeaderMap_(customerSheet);
  const articleHeaderMap = getHeaderMap_(articleSheet);

  const settings = data.settings || {};
  const business = settings.business || {};
  const invoice = settings.invoice || {};
  const email = settings.email || {};
  const auth = settings.auth || {};
  const branding = settings.branding || {};

  upsertSingleRow_(userSheet, userHeaderMap, username, 'username', {
    username: username,
    company_name: business.companyName || '',
    sender_line: business.senderLine || '',
    address_line_1: business.addressLine1 || '',
    address_line_2: business.addressLine2 || '',
    postal_code: business.postalCode || '',
    city: business.city || '',
    country: business.country || '',
    phone: business.phone || '',
    business_email: business.email || '',
    uid: business.uid || '',
    bank_name: business.bankName || '',
    iban: business.iban || '',
    bic: business.bic || '',
    issuer_name: business.issuerName || '',
    payment_note: business.paymentNote || '',
    footer_note: business.footerNote || '',
    invoice_title: invoice.title || '',
    counter_year: invoice.counterYear || '',
    counter_value: invoice.counterValue || 0,
    cc_email: email.ccEmail || '',
    email_subject: email.subjectTemplate || '',
    email_body: email.bodyTemplate || '',
    password: auth.password || '',
    default_user_password: auth.defaultUserPassword || 'admin',
    has_invoice_logo: branding.hasInvoiceLogo ? 'TRUE' : 'FALSE',
    has_app_logo: branding.hasAppLogo ? 'TRUE' : 'FALSE',
    updated_at: timestamp,
    last_seen_at: String(data.lastSeenAt || ''),
    settings_json: JSON.stringify(settings || {}),
    schema_version: CURRENT_SCHEMA_VERSION
  });

  replaceRowsByUsername_(customerSheet, customerHeaderMap, username, (data.customers || []).map((entry) => ({
    username: username,
    customer_id: String(entry.id || ''),
    customer_number: entry.customerNumber || '',
    name: entry.name || '',
    contact_person: entry.contactPerson || '',
    street: entry.street || '',
    postal_code: entry.postalCode || '',
    city: entry.city || '',
    country: entry.country || '',
    phone: entry.phone || '',
    email: entry.email || '',
    uid: entry.uid || '',
    notes: entry.notes || '',
    updated_at: timestamp,
    payload_json: JSON.stringify(entry || {}),
    schema_version: CURRENT_SCHEMA_VERSION
  })));

  replaceRowsByUsername_(articleSheet, articleHeaderMap, username, (data.articles || []).map((entry) => ({
    username: username,
    article_id: String(entry.id || ''),
    group_name: entry.group || '',
    number: entry.number || '',
    name: entry.name || '',
    description: entry.description || '',
    unit: entry.unit || '',
    unit_price: entry.unitPrice || 0,
    tax_rate: entry.taxRate || 0,
    updated_at: timestamp,
    payload_json: JSON.stringify(entry || {}),
    schema_version: CURRENT_SCHEMA_VERSION
  })));
}

function listUsers_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const userSheet = spreadsheet.getSheetByName(SHEETS.users.name);
  const userTable = getSheetTable_(userSheet);

  return userTable.rows
    .filter((row) => getCell_(row, userTable.indexMap, 'username'))
    .map((row) => ({
      username: getCell_(row, userTable.indexMap, 'username'),
      updatedAt: getCell_(row, userTable.indexMap, 'updated_at'),
      lastSeenAt: getCell_(row, userTable.indexMap, 'last_seen_at'),
      schemaVersion: getCell_(row, userTable.indexMap, 'schema_version') || '1',
      migratedToStructuredColumns: isStructuredUserRow_(row, userTable.indexMap)
    }));
}

function deleteUserData_(username) {
  if (!username) {
    throw new Error('Username missing');
  }

  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const userSheet = spreadsheet.getSheetByName(SHEETS.users.name);
  const customerSheet = spreadsheet.getSheetByName(SHEETS.customers.name);
  const articleSheet = spreadsheet.getSheetByName(SHEETS.articles.name);

  replaceRowsByUsername_(userSheet, getHeaderMap_(userSheet), username, []);
  replaceRowsByUsername_(customerSheet, getHeaderMap_(customerSheet), username, []);
  replaceRowsByUsername_(articleSheet, getHeaderMap_(articleSheet), username, []);
}

function buildUserSettingsFromRow_(row, indexMap) {
  const legacySettings = getLegacyUserSettings_(row, indexMap);
  const legacyBusiness = legacySettings.business || {};
  const legacyInvoice = legacySettings.invoice || {};
  const legacyEmail = legacySettings.email || {};
  const legacyAuth = legacySettings.auth || {};
  const legacyBranding = legacySettings.branding || {};

  return {
    business: {
      companyName: firstNonEmpty_(getCell_(row, indexMap, 'company_name'), legacyBusiness.companyName),
      senderLine: firstNonEmpty_(getCell_(row, indexMap, 'sender_line'), legacyBusiness.senderLine),
      addressLine1: firstNonEmpty_(getCell_(row, indexMap, 'address_line_1'), legacyBusiness.addressLine1),
      addressLine2: firstNonEmpty_(getCell_(row, indexMap, 'address_line_2'), legacyBusiness.addressLine2),
      postalCode: firstNonEmpty_(getCell_(row, indexMap, 'postal_code'), legacyBusiness.postalCode),
      city: firstNonEmpty_(getCell_(row, indexMap, 'city'), legacyBusiness.city),
      country: firstNonEmpty_(getCell_(row, indexMap, 'country'), legacyBusiness.country),
      phone: firstNonEmpty_(getCell_(row, indexMap, 'phone'), legacyBusiness.phone),
      email: firstNonEmpty_(getCell_(row, indexMap, 'business_email'), legacyBusiness.email),
      uid: firstNonEmpty_(getCell_(row, indexMap, 'uid'), legacyBusiness.uid),
      bankName: firstNonEmpty_(getCell_(row, indexMap, 'bank_name'), legacyBusiness.bankName),
      iban: firstNonEmpty_(getCell_(row, indexMap, 'iban'), legacyBusiness.iban),
      bic: firstNonEmpty_(getCell_(row, indexMap, 'bic'), legacyBusiness.bic),
      issuerName: firstNonEmpty_(getCell_(row, indexMap, 'issuer_name'), legacyBusiness.issuerName),
      paymentNote: firstNonEmpty_(getCell_(row, indexMap, 'payment_note'), legacyBusiness.paymentNote),
      footerNote: firstNonEmpty_(getCell_(row, indexMap, 'footer_note'), legacyBusiness.footerNote)
    },
    auth: {
      username: firstNonEmpty_(getCell_(row, indexMap, 'username'), legacyAuth.username),
      password: firstNonEmpty_(getCell_(row, indexMap, 'password'), legacyAuth.password),
      defaultUserPassword: firstNonEmpty_(
        getCell_(row, indexMap, 'default_user_password'),
        legacyAuth.defaultUserPassword || 'admin'
      )
    },
    branding: {
      hasInvoiceLogo: firstBoolean_(getCell_(row, indexMap, 'has_invoice_logo'), legacyBranding.hasInvoiceLogo),
      hasAppLogo: firstBoolean_(getCell_(row, indexMap, 'has_app_logo'), legacyBranding.hasAppLogo)
    },
    invoice: {
      title: firstNonEmpty_(getCell_(row, indexMap, 'invoice_title'), legacyInvoice.title || 'Rechnung'),
      counterYear: toNumber_(firstNonEmpty_(getCell_(row, indexMap, 'counter_year'), legacyInvoice.counterYear), new Date().getFullYear()),
      counterValue: toNumber_(firstNonEmpty_(getCell_(row, indexMap, 'counter_value'), legacyInvoice.counterValue), 0)
    },
    email: {
      ccEmail: firstNonEmpty_(getCell_(row, indexMap, 'cc_email'), legacyEmail.ccEmail),
      subjectTemplate: firstNonEmpty_(getCell_(row, indexMap, 'email_subject'), legacyEmail.subjectTemplate),
      bodyTemplate: firstNonEmpty_(getCell_(row, indexMap, 'email_body'), legacyEmail.bodyTemplate)
    }
  };
}

function buildCustomerFromRow_(row, indexMap) {
  const legacyPayload = getLegacyCustomerPayload_(row, indexMap);

  return {
    id: firstNonEmpty_(getCell_(row, indexMap, 'customer_id'), legacyPayload.id),
    customerNumber: firstNonEmpty_(getCell_(row, indexMap, 'customer_number'), legacyPayload.customerNumber),
    name: firstNonEmpty_(getCell_(row, indexMap, 'name'), legacyPayload.name),
    contactPerson: firstNonEmpty_(getCell_(row, indexMap, 'contact_person'), legacyPayload.contactPerson),
    street: firstNonEmpty_(getCell_(row, indexMap, 'street'), legacyPayload.street),
    postalCode: firstNonEmpty_(getCell_(row, indexMap, 'postal_code'), legacyPayload.postalCode),
    city: firstNonEmpty_(getCell_(row, indexMap, 'city'), legacyPayload.city),
    country: firstNonEmpty_(getCell_(row, indexMap, 'country'), legacyPayload.country),
    phone: firstNonEmpty_(getCell_(row, indexMap, 'phone'), legacyPayload.phone),
    email: firstNonEmpty_(getCell_(row, indexMap, 'email'), legacyPayload.email),
    uid: firstNonEmpty_(getCell_(row, indexMap, 'uid'), legacyPayload.uid),
    notes: firstNonEmpty_(getCell_(row, indexMap, 'notes'), legacyPayload.notes)
  };
}

function buildArticleFromRow_(row, indexMap) {
  const legacyPayload = getLegacyArticlePayload_(row, indexMap);

  return {
    id: firstNonEmpty_(getCell_(row, indexMap, 'article_id'), legacyPayload.id),
    group: firstNonEmpty_(getCell_(row, indexMap, 'group_name'), legacyPayload.group),
    number: firstNonEmpty_(getCell_(row, indexMap, 'number'), legacyPayload.number),
    name: firstNonEmpty_(getCell_(row, indexMap, 'name'), legacyPayload.name),
    description: firstNonEmpty_(getCell_(row, indexMap, 'description'), legacyPayload.description),
    unit: firstNonEmpty_(getCell_(row, indexMap, 'unit'), legacyPayload.unit),
    unitPrice: toNumber_(firstNonEmpty_(getCell_(row, indexMap, 'unit_price'), legacyPayload.unitPrice), 0),
    taxRate: toNumber_(firstNonEmpty_(getCell_(row, indexMap, 'tax_rate'), legacyPayload.taxRate), 0)
  };
}

function upsertSingleRow_(sheet, headerMap, matchValue, matchColumn, rowObject) {
  const table = getSheetTable_(sheet);
  const rowIndex = table.rows.findIndex((row) => getCell_(row, table.indexMap, matchColumn) === matchValue);
  const rowValues = buildRowValues_(sheet, rowObject, headerMap);

  if (rowIndex >= 0) {
    sheet.getRange(rowIndex + 2, 1, 1, rowValues.length).setValues([rowValues]);
    return;
  }

  sheet.appendRow(rowValues);
}

function replaceRowsByUsername_(sheet, headerMap, username, rowObjects) {
  const table = getSheetTable_(sheet);
  for (let index = table.rows.length - 1; index >= 0; index -= 1) {
    if (getCell_(table.rows[index], table.indexMap, 'username') === username) {
      sheet.deleteRow(index + 2);
    }
  }

  rowObjects.forEach((rowObject) => sheet.appendRow(buildRowValues_(sheet, rowObject, headerMap)));
}

function buildRowValues_(sheet, rowObject, headerMap) {
  const width = Math.max(sheet.getLastColumn(), Object.keys(headerMap).length);
  const rowValues = new Array(width).fill('');

  Object.keys(rowObject).forEach((key) => {
    const index = headerMap[key];
    if (typeof index === 'number') {
      rowValues[index] = rowObject[key];
    }
  });

  return rowValues;
}

function getSheetTable_(sheet) {
  const headerMap = getHeaderMap_(sheet);
  const lastRow = sheet.getLastRow();
  const lastColumn = Math.max(sheet.getLastColumn(), Object.keys(headerMap).length);
  if (lastRow < 2 || lastColumn < 1) {
    return { indexMap: headerMap, rows: [] };
  }

  return {
    indexMap: headerMap,
    rows: sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues()
  };
}

function getHeaderMap_(sheet) {
  const lastColumn = sheet.getLastColumn();
  if (lastColumn < 1) {
    return {};
  }

  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  return headers.reduce((map, header, index) => {
    const key = String(header || '').trim();
    if (key) {
      map[key] = index;
    }
    return map;
  }, {});
}

function getCell_(row, indexMap, columnName) {
  if (!row || !indexMap || typeof indexMap[columnName] !== 'number') {
    return '';
  }
  return String(row[indexMap[columnName]] || '').trim();
}

function getLegacyUserSettings_(row, indexMap) {
  const directSettings = parseJson_(getCell_(row, indexMap, 'settings_json'), {});
  if (Object.keys(directSettings).length) {
    return directSettings;
  }

  const schemaVersion = getCell_(row, indexMap, 'schema_version');
  if (schemaVersion) {
    return {};
  }

  return parseJson_(row[1], {});
}

function getLegacyCustomerPayload_(row, indexMap) {
  const directPayload = parseJson_(getCell_(row, indexMap, 'payload_json'), {});
  const directId = getCell_(row, indexMap, 'customer_id');
  if (Object.keys(directPayload).length) {
    return withEntityId_(directPayload, directId);
  }

  const schemaVersion = getCell_(row, indexMap, 'schema_version');
  if (schemaVersion) {
    return withEntityId_({}, directId);
  }

  return withEntityId_(parseJson_(row[2], {}), row[1]);
}

function getLegacyArticlePayload_(row, indexMap) {
  const directPayload = parseJson_(getCell_(row, indexMap, 'payload_json'), {});
  const directId = getCell_(row, indexMap, 'article_id');
  if (Object.keys(directPayload).length) {
    return withEntityId_(directPayload, directId);
  }

  const schemaVersion = getCell_(row, indexMap, 'schema_version');
  if (schemaVersion) {
    return withEntityId_({}, directId);
  }

  return withEntityId_(parseJson_(row[2], {}), row[1]);
}

function parseJson_(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (_error) {
    return fallback;
  }
}

function withEntityId_(payload, fallbackId) {
  const entry = payload && typeof payload === 'object' ? payload : {};
  if (entry.id) {
    return entry;
  }
  if (!fallbackId) {
    return entry;
  }
  entry.id = String(fallbackId);
  return entry;
}

function firstNonEmpty_(primary, fallback) {
  const primaryValue = String(primary || '').trim();
  if (primaryValue) {
    return primaryValue;
  }
  return fallback || '';
}

function firstBoolean_(primary, fallback) {
  const normalized = String(primary || '').trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }
  if (normalized === 'false') {
    return false;
  }
  return Boolean(fallback);
}

function toNumber_(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isStructuredUserRow_(row, indexMap) {
  return (
    getCell_(row, indexMap, 'schema_version') === CURRENT_SCHEMA_VERSION &&
    Boolean(getCell_(row, indexMap, 'username')) &&
    (
      Boolean(getCell_(row, indexMap, 'company_name')) ||
      Boolean(getCell_(row, indexMap, 'business_email')) ||
      Boolean(getCell_(row, indexMap, 'invoice_title')) ||
      Boolean(getCell_(row, indexMap, 'settings_json'))
    )
  );
}

function jsonResponse(payload, statusCode) {
  payload.statusCode = statusCode || 200;
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}
