const DB_NAME = "wiki-richtext-db";
const DB_VERSION = 1;
const STORE_NAME = "kv";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : null);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

async function idbSet(key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({ key, value });
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export function defaultPages() {
  return {
    "首页": { title: "首页", content: "<h1>首页</h1><p>欢迎使用 Wiki。</p>", parent: null },
    "使用说明": { title: "使用说明", content: "<h1>使用说明</h1><p>支持树形页面、内链和图片粘贴。</p>", parent: "首页" }
  };
}

export async function loadJson(storageKey, fallbackValue) {
  try {
    const fromDb = await idbGet(storageKey);
    if (fromDb) return JSON.parse(fromDb);

    const fromLocal = localStorage.getItem(storageKey);
    if (fromLocal) {
      await idbSet(storageKey, fromLocal);
      return JSON.parse(fromLocal);
    }
  } catch {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      try { return JSON.parse(raw); } catch {}
    }
  }
  return fallbackValue;
}

export function saveJson(storageKey, value) {
  const raw = JSON.stringify(value);
  idbSet(storageKey, raw).catch(() => {
    try { localStorage.setItem(storageKey, raw); } catch {}
  });
}

export async function loadPages(storageKey) {
  return loadJson(storageKey, defaultPages());
}

export function savePages(storageKey, pages) {
  saveJson(storageKey, pages);
}
