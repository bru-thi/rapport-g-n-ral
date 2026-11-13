const DB_NAME = 'rapports-db';
const DB_VERSION = 1;

let dbPromise = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('reports')) {
          db.createObjectStore('reports', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('entries')) {
          const store = db.createObjectStore('entries', { keyPath: 'id' });
          store.createIndex('by_rapport', 'rapportId', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(store, value) {
  const db = await getDB();
  await reqToPromise(db.transaction(store, 'readwrite').objectStore(store).put(value));
}

async function dbGet(store, id) {
  const db = await getDB();
  return reqToPromise(db.transaction(store, 'readonly').objectStore(store).get(id));
}

async function dbAll(store) {
  const db = await getDB();
  return reqToPromise(db.transaction(store, 'readonly').objectStore(store).getAll());
}

async function dbByIndex(store, index, value) {
  const db = await getDB();
  return reqToPromise(db.transaction(store, 'readonly').objectStore(store).index(index).getAll(value));
}

async function dbDelete(store, id) {
  const db = await getDB();
  await reqToPromise(db.transaction(store, 'readwrite').objectStore(store).delete(id));
}

async function dbClear(store) {
  const db = await getDB();
  await reqToPromise(db.transaction(store, 'readwrite').objectStore(store).clear());
}

function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function fmtLocalISO(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
    'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
}

function nowISO() {
  return fmtLocalISO(new Date());
}

function toInputValue(iso) {
  return (iso || '').slice(0, 16);
}

function fmtDateTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return iso || '';
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function fmtDay(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return iso || '';
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

function sortEntries(entries) {
  return [...entries].sort((a, b) =>
    String(a.dateISO || '').localeCompare(String(b.dateISO || '')) ||
    String(a.creeLe || '').localeCompare(String(b.creeLe || ''))
  );
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function slugify(s) {
  return String(s || 'rapport')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'rapport';
}
