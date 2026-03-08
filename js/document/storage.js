import { t } from "../text.js";

// IndexedDB 数据库名。
const DB_NAME = "wiki-richtext-db";
// IndexedDB 版本号（升级时触发 onupgradeneeded）。
const DB_VERSION = 1;
// IndexedDB 对象仓库名（键值存储）。
const STORE_NAME = "kv";

// 打开 IndexedDB，并在首次升级时创建 KV 存储表。
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

// 从 IndexedDB 按键读取序列化后的字符串值。
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

// 将序列化后的字符串值写入 IndexedDB。
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

// 构建首次启动时的默认页面数据。
function defaultPages() {
  const home = t("page.home");
  const usage = t("page.usage");
  return {
    [home]: { title: home, content: t("content.homeWelcome"), parent: null },
    [usage]: { title: usage, content: t("content.usage"), parent: home }
  };
}

// 读取 JSON 数据：优先 IndexedDB，回退 localStorage，最终回退默认值。
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
      try {
        return JSON.parse(raw);
      } catch {}
    }
  }
  return fallbackValue;
}

// 保存 JSON 数据：优先写 IndexedDB，失败时回退 localStorage。
export function saveJson(storageKey, value) {
  const raw = JSON.stringify(value);
  idbSet(storageKey, raw).catch(() => {
    try {
      localStorage.setItem(storageKey, raw);
    } catch {}
  });
}

// 读取页面数据，不存在时返回默认首页/说明页。
export async function loadPages(storageKey) {
  return loadJson(storageKey, defaultPages());
}

// 保存页面数据（对 saveJson 的语义化封装）。
export function savePages(storageKey, pages) {
  saveJson(storageKey, pages);
}
