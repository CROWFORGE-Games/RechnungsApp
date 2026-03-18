const SPREADSHEET_ID = '11sTU5OoNFaOkfnKfqzlcqG8O-CdG3OO2OzKMt6CCerY';
const API_SECRET = 'CHANGE_ME_SECRET';

const SHEETS = {
  users: {
    name: 'User',
    headers: ['username', 'settings_json', 'updated_at']
  },
  customers: {
    name: 'Kunden',
    headers: ['username', 'customer_id', 'payload_json', 'updated_at']
  },
  articles: {
    name: 'Artikel',
    headers: ['username', 'article_id', 'payload_json', 'updated_at']
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

    const headerRange = sheet.getRange(1, 1, 1, config.headers.length);
    const currentHeaders = headerRange.getValues()[0];
    const needsHeaders = config.headers.some((header, index) => currentHeaders[index] !== header);
    if (needsHeaders) {
      headerRange.setValues([config.headers]);
      headerRange.setFontWeight('bold');
    }
  });
}

function getUserData_(username) {
  if (!username) {
    throw new Error('Username missing');
  }

  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const userSheet = spreadsheet.getSheetByName(SHEETS.users.name);
  const customerSheet = spreadsheet.getSheetByName(SHEETS.customers.name);
  const articleSheet = spreadsheet.getSheetByName(SHEETS.articles.name);

  const userRows = getDataRows_(userSheet);
  const customerRows = getDataRows_(customerSheet);
  const articleRows = getDataRows_(articleSheet);

  const userRow = userRows.find((row) => String(row[0] || '').trim() === username);
  if (!userRow) {
    return null;
  }

  return {
    settings: parseJson_(userRow[1], {}),
    customers: customerRows
      .filter((row) => String(row[0] || '').trim() === username)
      .map((row) => parseJson_(row[2], {})),
    articles: articleRows
      .filter((row) => String(row[0] || '').trim() === username)
      .map((row) => parseJson_(row[2], {}))
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

  upsertSingleRow_(userSheet, username, [
    username,
    JSON.stringify(data.settings || {}),
    timestamp
  ]);

  replaceRowsByUsername_(customerSheet, username, (data.customers || []).map((entry) => [
    username,
    String(entry.id || ''),
    JSON.stringify(entry),
    timestamp
  ]));

  replaceRowsByUsername_(articleSheet, username, (data.articles || []).map((entry) => [
    username,
    String(entry.id || ''),
    JSON.stringify(entry),
    timestamp
  ]));
}

function listUsers_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const userSheet = spreadsheet.getSheetByName(SHEETS.users.name);
  const userRows = getDataRows_(userSheet);

  return userRows
    .filter((row) => String(row[0] || '').trim())
    .map((row) => ({
      username: String(row[0] || '').trim(),
      updatedAt: String(row[2] || '').trim()
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

  replaceRowsByUsername_(userSheet, username, []);
  replaceRowsByUsername_(customerSheet, username, []);
  replaceRowsByUsername_(articleSheet, username, []);
}

function upsertSingleRow_(sheet, username, rowValues) {
  const rows = getDataRows_(sheet);
  const rowIndex = rows.findIndex((row) => String(row[0] || '').trim() === username);

  if (rowIndex >= 0) {
    sheet.getRange(rowIndex + 2, 1, 1, rowValues.length).setValues([rowValues]);
    return;
  }

  sheet.appendRow(rowValues);
}

function replaceRowsByUsername_(sheet, username, rows) {
  const data = getDataRows_(sheet);
  for (let index = data.length - 1; index >= 0; index -= 1) {
    if (String(data[index][0] || '').trim() === username) {
      sheet.deleteRow(index + 2);
    }
  }

  rows.forEach((row) => sheet.appendRow(row));
}

function getDataRows_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 2 || lastColumn < 1) {
    return [];
  }

  return sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
}

function parseJson_(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (_error) {
    return fallback;
  }
}

function jsonResponse(payload, statusCode) {
  payload.statusCode = statusCode || 200;
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}
