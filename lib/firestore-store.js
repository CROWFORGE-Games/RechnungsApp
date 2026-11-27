import { FieldValue, Firestore, Timestamp } from "@google-cloud/firestore";

import { getOptionalAuthClient } from "./gcp-auth.js";

// Firestore-Persistenz fuer den bestehenden In-Memory-Store ({ users, sessions }).
//
// Datenmodell:
//   users/{username}                     Benutzer ohne Listen (Settings, Hash, Zeitstempel)
//   users/{username}/customers/{id}      Kunden
//   users/{username}/articles/{id}       Artikel
//   users/{username}/invoices/{id}       Rechnungen
//   sessions/{token}                     Sessions (TTL-Policy auf expireAt)
//
// Geschrieben wird nur, was sich seit dem Laden geaendert hat. Benutzer-Dokumente
// werden feldweise aktualisiert (z. B. nur "lastSeenAt"), damit parallele Requests
// sich nicht gegenseitig Felder wie den Rechnungszaehler ueberschreiben.

export const SNAPSHOT = Symbol("firestoreSnapshot");

const USER_LIST_FIELDS = ["customers", "articles", "invoices"];
const SUBCOLLECTIONS = USER_LIST_FIELDS;
const MAX_BATCH_OPS = 400;

export function stableStringify(value) {
  if (value === undefined) {
    return "null";
  }
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  const keys = Object.keys(value)
    .filter((key) => value[key] !== undefined)
    .sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function toPlain(value) {
  return value === undefined ? null : JSON.parse(JSON.stringify(value));
}

export function encodeDocId(id) {
  const raw = String(id ?? "").trim();
  if (!raw) {
    return "";
  }
  const encoded = encodeURIComponent(raw).replace(/\./g, "%2E");
  return encoded.startsWith("__") ? `%5F${encoded.slice(1)}` : encoded;
}

function isValidToken(token) {
  return /^[A-Za-z0-9-]{8,128}$/.test(String(token || ""));
}

function stripDeviceOnlyBranding(settings = {}) {
  const branding = { ...(settings.branding || {}) };
  for (const key of Object.keys(branding)) {
    // Logos liegen nur im Geraete-Cache; Data-URLs sprengen das 1-MiB-Dokumentlimit.
    if (key.endsWith("DataUrl")) {
      delete branding[key];
    }
  }
  return { ...settings, branding };
}

export function buildUserDoc(user) {
  const doc = {};
  for (const [key, value] of Object.entries(user)) {
    if (USER_LIST_FIELDS.includes(key) || value === undefined) {
      continue;
    }
    doc[key] = key === "settings" ? stripDeviceOnlyBranding(value) : value;
  }
  return toPlain(doc);
}

// Zerlegt ein Benutzer-Dokument in aktualisierbare Feldpfade ("settings.invoice", "lastSeenAt" ...).
function flattenUserDoc(doc) {
  const fields = {};
  for (const [key, value] of Object.entries(doc)) {
    if (key === "settings" && value && typeof value === "object" && !Array.isArray(value)) {
      for (const [subKey, subValue] of Object.entries(value)) {
        fields[`settings.${subKey}`] = subValue;
      }
      continue;
    }
    fields[key] = value;
  }
  return fields;
}

function buildSessionDoc(session) {
  return toPlain(session);
}

// Liefert Map: Pfad -> { type, data, fields? }
function buildDocMap(store) {
  const docs = new Map();
  for (const user of store.users || []) {
    const username = String(user.username || "").trim();
    if (!username) {
      continue;
    }
    const userPath = `users/${encodeDocId(username)}`;
    const userDoc = buildUserDoc(user);
    docs.set(userPath, { type: "user", data: userDoc, fields: flattenUserDoc(userDoc) });

    for (const collection of SUBCOLLECTIONS) {
      for (const entry of Array.isArray(user[collection]) ? user[collection] : []) {
        const docId = encodeDocId(entry?.id);
        if (!docId) {
          continue;
        }
        docs.set(`${userPath}/${collection}/${docId}`, { type: "doc", data: toPlain(entry) });
      }
    }
  }

  for (const session of store.sessions || []) {
    if (!isValidToken(session?.token)) {
      continue;
    }
    docs.set(`sessions/${session.token}`, { type: "session", data: buildSessionDoc(session) });
  }
  return docs;
}

function snapshotEntry(entry) {
  if (entry.type === "user") {
    const fields = {};
    for (const [key, value] of Object.entries(entry.fields)) {
      fields[key] = stableStringify(value);
    }
    return { type: "user", fields };
  }
  return { type: entry.type, json: stableStringify(entry.data) };
}

function sessionFromDoc(data = {}) {
  const { expireAt: _expireAt, ...rest } = data;
  return rest;
}

export function createFirestoreBackend({ projectId, databaseId, authClient = getOptionalAuthClient() } = {}) {
  const db = new Firestore({
    projectId: projectId || undefined,
    databaseId: databaseId || undefined,
    ignoreUndefinedProperties: true,
    ...(authClient ? { authClient } : {})
  });

  async function loadAllUsers() {
    const [usersSnap, ...subSnaps] = await Promise.all([
      db.collection("users").get(),
      ...SUBCOLLECTIONS.map((collection) => db.collectionGroup(collection).get())
    ]);

    const usersByPath = new Map();
    const users = [];
    for (const doc of usersSnap.docs) {
      const user = { ...doc.data(), customers: [], articles: [], invoices: [] };
      usersByPath.set(doc.ref.path, user);
      users.push(user);
    }

    SUBCOLLECTIONS.forEach((collection, index) => {
      for (const doc of subSnaps[index].docs) {
        const parentUserRef = doc.ref.parent.parent;
        if (!parentUserRef || parentUserRef.parent.id !== "users") {
          continue;
        }
        const user = usersByPath.get(parentUserRef.path);
        if (user) {
          user[collection].push(doc.data());
        }
      }
    });
    return users;
  }

  async function loadSingleUser(username) {
    const userRef = db.doc(`users/${encodeDocId(username)}`);
    const [userSnap, ...subSnaps] = await Promise.all([
      userRef.get(),
      ...SUBCOLLECTIONS.map((collection) => userRef.collection(collection).get())
    ]);
    if (!userSnap.exists) {
      return [];
    }
    const user = { ...userSnap.data() };
    SUBCOLLECTIONS.forEach((collection, index) => {
      user[collection] = subSnaps[index].docs.map((doc) => doc.data());
    });
    return [user];
  }

  async function findUsernameByUserId(userId) {
    if (!userId) {
      return "";
    }
    const snap = await db.collection("users").where("id", "==", String(userId)).limit(1).get();
    return snap.empty ? "" : String(snap.docs[0].get("username") || "");
  }

  // Laedt nur, was der Request braucht: mit Session/Benutzername genau einen Benutzer,
  // fuer den Admin (Benutzerverwaltung) alle Benutzer.
  async function loadRaw({ token, username } = {}) {
    const sessions = [];
    if (token && isValidToken(token)) {
      const sessionSnap = await db.collection("sessions").doc(token).get();
      if (sessionSnap.exists) {
        sessions.push(sessionFromDoc(sessionSnap.data()));
      }
    }

    let scopedUsername = String(username || "").trim();
    if (!scopedUsername && sessions[0]) {
      scopedUsername = String(sessions[0].username || "") || (await findUsernameByUserId(sessions[0].userId));
    }

    if (scopedUsername && scopedUsername !== "admin") {
      return { users: await loadSingleUser(scopedUsername), sessions, partial: true };
    }

    return { users: await loadAllUsers(), sessions, partial: false };
  }

  function takeSnapshot(store) {
    const snapshot = new Map();
    for (const [path, entry] of buildDocMap(store)) {
      snapshot.set(path, snapshotEntry(entry));
    }
    return snapshot;
  }

  async function commitOps(ops) {
    for (let index = 0; index < ops.length; index += MAX_BATCH_OPS) {
      const batch = db.batch();
      for (const op of ops.slice(index, index + MAX_BATCH_OPS)) {
        op(batch);
      }
      await batch.commit();
    }
  }

  async function write(store, rawSnapshot = null) {
    const previous = store[SNAPSHOT] || rawSnapshot || new Map();
    const next = buildDocMap(store);
    const ops = [];

    for (const [path, entry] of next) {
      const ref = db.doc(path);
      const old = previous.get(path);
      if (entry.type === "user") {
        if (!old || old.type !== "user") {
          ops.push((batch) => batch.set(ref, entry.data));
          continue;
        }
        const update = {};
        for (const [key, value] of Object.entries(entry.fields)) {
          if (old.fields[key] !== stableStringify(value)) {
            update[key] = value === undefined ? null : value;
          }
        }
        for (const key of Object.keys(old.fields)) {
          if (!(key in entry.fields)) {
            update[key] = FieldValue.delete();
          }
        }
        if (Object.keys(update).length) {
          ops.push((batch) => batch.update(ref, update));
        }
        continue;
      }

      if (!old || old.json !== stableStringify(entry.data)) {
        const data =
          entry.type === "session" && entry.data.expiresAt
            ? { ...entry.data, expireAt: Timestamp.fromDate(new Date(entry.data.expiresAt)) }
            : entry.data;
        ops.push((batch) => batch.set(ref, data));
      }
    }

    for (const path of previous.keys()) {
      if (!next.has(path)) {
        ops.push((batch) => batch.delete(db.doc(path)));
      }
    }

    await commitOps(ops);
    if (process.env.DEBUG_STORE) {
      console.log(`[store] ${ops.length} Firestore-Schreibvorgaenge`);
    }

    const snapshot = new Map();
    for (const [path, entry] of next) {
      snapshot.set(path, snapshotEntry(entry));
    }
    setSnapshot(store, snapshot);
    return ops.length;
  }

  function setSnapshot(store, snapshot) {
    Object.defineProperty(store, SNAPSHOT, { value: snapshot, enumerable: false, configurable: true, writable: true });
  }

  function markFieldPersisted(store, user, fieldKey, value) {
    const snapshot = store[SNAPSHOT];
    const entry = snapshot?.get(`users/${encodeDocId(user.username)}`);
    if (entry?.type === "user") {
      entry.fields[fieldKey] = stableStringify(toPlain(value));
    }
  }

  // Vergibt die naechste Rechnungsnummer atomar (Transaktion auf users/{username}).
  async function allocateInvoiceCounter(store, user, issueYear) {
    const ref = db.doc(`users/${encodeDocId(user.username)}`);
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const current = (snap.exists ? snap.get("settings.invoice") : null) || user.settings.invoice || {};
      const previous = toPlain(current);
      const next = { ...previous };
      if (Number(next.counterYear) !== issueYear) {
        next.counterYear = issueYear;
        next.counterValue = 0;
      }
      next.counterValue = Number(next.counterValue || 0) + 1;
      if (snap.exists) {
        tx.update(ref, { "settings.invoice": next });
      } else {
        tx.set(ref, { settings: { invoice: next } }, { merge: true });
      }
      return { previous, next };
    });

    user.settings.invoice = { ...user.settings.invoice, ...result.next };
    markFieldPersisted(store, user, "settings.invoice", user.settings.invoice);
    return result;
  }

  // Gibt eine vergebene Nummer zurueck, falls seither keine weitere vergeben wurde.
  async function releaseInvoiceCounter(store, user, allocation) {
    const ref = db.doc(`users/${encodeDocId(user.username)}`);
    const released = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const current = snap.exists ? snap.get("settings.invoice") : null;
      if (
        !current ||
        Number(current.counterYear) !== Number(allocation.next.counterYear) ||
        Number(current.counterValue) !== Number(allocation.next.counterValue)
      ) {
        return false;
      }
      tx.update(ref, { "settings.invoice": allocation.previous });
      return true;
    });

    if (released) {
      user.settings.invoice = { ...user.settings.invoice, ...allocation.previous };
      markFieldPersisted(store, user, "settings.invoice", user.settings.invoice);
    }
    return released;
  }

  return {
    db,
    loadRaw,
    takeSnapshot,
    setSnapshot,
    write,
    allocateInvoiceCounter,
    releaseInvoiceCounter
  };
}
