const DB_NAME = "cwaa_team_db";
const DB_VERSION = 1;
const STORE_CANDIDATES = "candidates";
const STORE_META = "meta";

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_CANDIDATES)) {
        const store = db.createObjectStore(STORE_CANDIDATES, { keyPath: "id" });
        store.createIndex("status", "status");
        store.createIndex("service", "service");
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(store, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const result = fn(s);
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const db = {
  async getAll(store) {
    const dbh = await openDB();
    return new Promise((resolve, reject) => {
      const req = dbh.transaction(store).objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },
  async get(store, key) {
    const dbh = await openDB();
    return new Promise((resolve, reject) => {
      const req = dbh.transaction(store).objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async put(store, value) { return tx(store, "readwrite", (s) => s.put(value)); },
  async delete(store, key) { return tx(store, "readwrite", (s) => s.delete(key)); },
  async clear(store) { return tx(store, "readwrite", (s) => s.clear()); },
  async bulkPut(store, arr) { return tx(store, "readwrite", (s) => arr.forEach(v => s.put(v))); }
};
