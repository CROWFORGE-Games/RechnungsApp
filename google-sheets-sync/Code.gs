const SPREADSHEET_ID = '11sTU5OoNFaOkfnKfqzlcqG8O-CdG3OO2OzKMt6CCerY';
const API_SECRET = 'CHANGE_ME_SECRET';
const CURRENT_SCHEMA_VERSION = '2';

const SHEETS = {
  users: {
    name: 'User',
    headers: [
      'username',
      'company_name',
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
      'updated_at',
      'settings_updated_at',
      'last_seen_at',
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

    if (payload.action === 'upsertUserSettings') {
      upsertUserSettings_(String(payload.username || '').trim(), payload.data || {});
      return jsonResponse({ ok: true });
    }

    if (payload.action === 'syncUserEntities') {
      syncUserEntities_(String(payload.username || '').trim(), payload.data || {});
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

function onEdit(e) {
  try {
    if (!e || !e.range) {
      return;
    }

    const range = e.range;
    const sheet = range.getSheet();
    const row = range.getRow();
    if (!sheet || row < 2) {
      return;
    }

    const headerMap = getHeaderMap_(sheet);
    const timestamp = new Date().toISOString();
    if (sheet.getName() === SHEETS.users.name) {
      setCellIfColumnExists_(sheet, headerMap, row, 'updated_at', timestamp);
      setCellIfColumnExists_(sheet, headerMap, row, 'settings_updated_at', timestamp);
      setCellIfColumnExists_(sheet, headerMap, row, 'schema_version', CURRENT_SCHEMA_VERSION);
      return;
    }

    if (sheet.getName() === SHEETS.customers.name || sheet.getName() === SHEETS.articles.name) {
      setCellIfColumnExists_(sheet, headerMap, row, 'updated_at', timestamp);
      setCellIfColumnExists_(sheet, headerMap, row, 'schema_version', CURRENT_SCHEMA_VERSION);
    }
  } catch (_error) {
    // Manuelle Tabellenbearbeitung soll die App nicht stören.
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

  const customers = customerTable.rows
    .filter((row) => getCell_(row, customerTable.indexMap, 'username') === username)
    .map((row) => buildCustomerFromRow_(row, customerTable.indexMap))
    .filter((entry) => entry.id);

  const articles = articleTable.rows
    .filter((row) => getCell_(row, articleTable.indexMap, 'username') === username)
    .map((row) => buildArticleFromRow_(row, articleTable.indexMap))
    .filter((entry) => entry.id);

  return {
    settings: buildUserSettingsFromRow_(userRow, userTable.indexMap),
    updatedAt: firstNonEmpty_(
      getCell_(userRow, userTable.indexMap, 'updated_at'),
      getCell_(userRow, userTable.indexMap, 'settings_updated_at')
    ),
    settingsUpdatedAt: firstNonEmpty_(
      getCell_(userRow, userTable.indexMap, 'settings_updated_at'),
      getCell_(userRow, userTable.indexMap, 'updated_at')
    ),
    lastSeenAt: getCell_(userRow, userTable.indexMap, 'last_seen_at'),
    schemaVersion: getCell_(userRow, userTable.indexMap, 'schema_version') || CURRENT_SCHEMA_VERSION,
    customers: customers,
    articles: articles
  };
}

function upsertUserData_(username, data) {
  if (!username) {
    throw new Error('Username missing');
  }

  upsertUserSettings_(username, data);
  syncUserEntities_(username, {
    customersUpsert: data.customers || [],
    customersDelete: normalizeDeleteIds_(data.deletedCustomers || []),
    articlesUpsert: data.articles || [],
    articlesDelete: normalizeDeleteIds_(data.deletedArticles || [])
  });
}

function upsertUserSettings_(username, data) {
  if (!username) {
    throw new Error('Username missing');
  }

  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const userSheet = spreadsheet.getSheetByName(SHEETS.users.name);
  const userHeaderMap = getHeaderMap_(userSheet);
  const settings = data.settings || {};
  const business = settings.business || {};
  const invoice = settings.invoice || {};
  const email = settings.email || {};
  const auth = settings.auth || {};
  const branding = settings.branding || {};
  const settingsUpdatedAt = normalizeTimestamp_(
    data.settingsUpdatedAt || data.updatedAt || new Date().toISOString()
  );

  upsertSingleRow_(userSheet, userHeaderMap, username, 'username', {
    username: username,
    company_name: business.companyName || '',
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
    updated_at: settingsUpdatedAt,
    settings_updated_at: settingsUpdatedAt,
    last_seen_at: String(data.lastSeenAt || ''),
    schema_version: CURRENT_SCHEMA_VERSION
  });
}

function syncUserEntities_(username, data) {
  if (!username) {
    throw new Error('Username missing');
  }

  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const customerSheet = spreadsheet.getSheetByName(SHEETS.customers.name);
  const articleSheet = spreadsheet.getSheetByName(SHEETS.articles.name);
  const customerHeaderMap = getHeaderMap_(customerSheet);
  const articleHeaderMap = getHeaderMap_(articleSheet);

  upsertEntityRows_(
    customerSheet,
    customerHeaderMap,
    'customer_id',
    username,
    (data.customersUpsert || []).map((entry) => ({
      username: username,
      customer_id: String(entry.id || '').trim(),
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
      updated_at: normalizeTimestamp_(entry.updatedAt || new Date().toISOString()),
      schema_version: CURRENT_SCHEMA_VERSION
    }))
  );

  deleteEntityRows_(customerSheet, 'username', username, 'customer_id', normalizeDeleteIds_(data.customersDelete));

  upsertEntityRows_(
    articleSheet,
    articleHeaderMap,
    'article_id',
    username,
    (data.articlesUpsert || []).map((entry) => ({
      username: username,
      article_id: String(entry.id || '').trim(),
      group_name: entry.group || '',
      number: entry.number || '',
      name: entry.name || '',
      description: entry.description || '',
      unit: entry.unit || '',
      unit_price: entry.unitPrice || 0,
      tax_rate: entry.taxRate || 0,
      updated_at: normalizeTimestamp_(entry.updatedAt || new Date().toISOString()),
      schema_version: CURRENT_SCHEMA_VERSION
    }))
  );

  deleteEntityRows_(articleSheet, 'username', username, 'article_id', normalizeDeleteIds_(data.articlesDelete));
}

function listUsers_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const userSheet = spreadsheet.getSheetByName(SHEETS.users.name);
  const userTable = getSheetTable_(userSheet);

  return userTable.rows
    .filter((row) => getCell_(row, userTable.indexMap, 'username'))
    .map((row) => ({
      username: getCell_(row, userTable.indexMap, 'username'),
      updatedAt: firstNonEmpty_(
        getCell_(row, userTable.indexMap, 'settings_updated_at'),
        getCell_(row, userTable.indexMap, 'updated_at')
      ),
      lastSeenAt: getCell_(row, userTable.indexMap, 'last_seen_at'),
      schemaVersion: getCell_(row, userTable.indexMap, 'schema_version') || CURRENT_SCHEMA_VERSION,
      migratedToStructuredColumns: true
    }));
}

function deleteUserData_(username) {
  if (!username) {
    throw new Error('Username missing');
  }

  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  deleteRowsByColumnValue_(spreadsheet.getSheetByName(SHEETS.users.name), 'username', username);
  deleteRowsByColumnValue_(spreadsheet.getSheetByName(SHEETS.customers.name), 'username', username);
  deleteRowsByColumnValue_(spreadsheet.getSheetByName(SHEETS.articles.name), 'username', username);
}

function buildUserSettingsFromRow_(row, indexMap) {
  return {
    business: {
      companyName: getCell_(row, indexMap, 'company_name'),
      addressLine1: getCell_(row, indexMap, 'address_line_1'),
      addressLine2: getCell_(row, indexMap, 'address_line_2'),
      postalCode: getCell_(row, indexMap, 'postal_code'),
      city: getCell_(row, indexMap, 'city'),
      country: getCell_(row, indexMap, 'country'),
      phone: getCell_(row, indexMap, 'phone'),
      email: getCell_(row, indexMap, 'business_email'),
      uid: getCell_(row, indexMap, 'uid'),
      bankName: getCell_(row, indexMap, 'bank_name'),
      iban: getCell_(row, indexMap, 'iban'),
      bic: getCell_(row, indexMap, 'bic'),
      issuerName: getCell_(row, indexMap, 'issuer_name'),
      paymentNote: getCell_(row, indexMap, 'payment_note'),
      footerNote: getCell_(row, indexMap, 'footer_note')
    },
    auth: {
      username: getCell_(row, indexMap, 'username'),
      password: getCell_(row, indexMap, 'password'),
      defaultUserPassword: firstNonEmpty_(getCell_(row, indexMap, 'default_user_password'), 'admin')
    },
    branding: {
      hasInvoiceLogo: firstBoolean_(getCell_(row, indexMap, 'has_invoice_logo'), false)
    },
    invoice: {
      title: firstNonEmpty_(getCell_(row, indexMap, 'invoice_title'), 'Rechnung'),
      counterYear: toNumber_(getCell_(row, indexMap, 'counter_year'), new Date().getFullYear()),
      counterValue: toNumber_(getCell_(row, indexMap, 'counter_value'), 0)
    },
    email: {
      ccEmail: getCell_(row, indexMap, 'cc_email'),
      subjectTemplate: getCell_(row, indexMap, 'email_subject'),
      bodyTemplate: getCell_(row, indexMap, 'email_body')
    }
  };
}

function buildCustomerFromRow_(row, indexMap) {
  return {
    id: getCell_(row, indexMap, 'customer_id'),
    updatedAt: getCell_(row, indexMap, 'updated_at'),
    customerNumber: getCell_(row, indexMap, 'customer_number'),
    name: getCell_(row, indexMap, 'name'),
    contactPerson: getCell_(row, indexMap, 'contact_person'),
    street: getCell_(row, indexMap, 'street'),
    postalCode: getCell_(row, indexMap, 'postal_code'),
    city: getCell_(row, indexMap, 'city'),
    country: getCell_(row, indexMap, 'country'),
    phone: getCell_(row, indexMap, 'phone'),
    email: getCell_(row, indexMap, 'email'),
    uid: getCell_(row, indexMap, 'uid'),
    notes: getCell_(row, indexMap, 'notes')
  };
}

function buildArticleFromRow_(row, indexMap) {
  return {
    id: getCell_(row, indexMap, 'article_id'),
    updatedAt: getCell_(row, indexMap, 'updated_at'),
    group: getCell_(row, indexMap, 'group_name'),
    number: getCell_(row, indexMap, 'number'),
    name: getCell_(row, indexMap, 'name'),
    description: getCell_(row, indexMap, 'description'),
    unit: getCell_(row, indexMap, 'unit'),
    unitPrice: toNumber_(getCell_(row, indexMap, 'unit_price'), 0),
    taxRate: toNumber_(getCell_(row, indexMap, 'tax_rate'), 0)
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

function upsertEntityRows_(sheet, headerMap, idColumn, username, rowObjects) {
  const filteredRows = rowObjects.filter((rowObject) => String(rowObject[idColumn] || '').trim());
  if (!filteredRows.length) {
    return;
  }

  const table = getSheetTable_(sheet);
  const rowIndexById = new Map();
  table.rows.forEach((row, index) => {
    if (getCell_(row, table.indexMap, 'username') !== username) {
      return;
    }
    const entityId = getCell_(row, table.indexMap, idColumn);
    if (entityId) {
      rowIndexById.set(entityId, index + 2);
    }
  });

  filteredRows.forEach((rowObject) => {
    const entityId = String(rowObject[idColumn] || '').trim();
    const rowValues = buildRowValues_(sheet, rowObject, headerMap);
    const existingRowIndex = rowIndexById.get(entityId);

    if (existingRowIndex) {
      sheet.getRange(existingRowIndex, 1, 1, rowValues.length).setValues([rowValues]);
      return;
    }

    sheet.appendRow(rowValues);
  });
}

function deleteEntityRows_(sheet, usernameColumn, username, idColumn, entityIds) {
  const normalizedIds = normalizeDeleteIds_(entityIds);
  if (!normalizedIds.length) {
    return;
  }

  const table = getSheetTable_(sheet);
  for (let index = table.rows.length - 1; index >= 0; index -= 1) {
    const row = table.rows[index];
    if (getCell_(row, table.indexMap, usernameColumn) !== username) {
      continue;
    }

    if (normalizedIds.indexOf(getCell_(row, table.indexMap, idColumn)) >= 0) {
      sheet.deleteRow(index + 2);
    }
  }
}

function deleteRowsByColumnValue_(sheet, columnName, value) {
  const table = getSheetTable_(sheet);
  for (let index = table.rows.length - 1; index >= 0; index -= 1) {
    if (getCell_(table.rows[index], table.indexMap, columnName) === value) {
      sheet.deleteRow(index + 2);
    }
  }
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

function setCellIfColumnExists_(sheet, headerMap, row, columnName, value) {
  const columnIndex = headerMap[columnName];
  if (typeof columnIndex !== 'number') {
    return;
  }

  sheet.getRange(row, columnIndex + 1).setValue(value);
}

function firstNonEmpty_(primary, fallback) {
  const primaryValue = String(primary || '').trim();
  if (primaryValue) {
    return primaryValue;
  }
  return String(fallback || '').trim();
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

function normalizeDeleteIds_(values) {
  return values
    .map((value) => {
      if (value && typeof value === 'object') {
        return String(value.id || '').trim();
      }
      return String(value || '').trim();
    })
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index);
}

function normalizeTimestamp_(value) {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
}

function jsonResponse(payload, statusCode) {
  payload.statusCode = statusCode || 200;
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}
