import { dom } from "./ui/dom.js";
import {
  STORAGE_KEY,
  STORAGE_TRASH_KEY,
  STORAGE_SCHEMA_KEY,
  STORAGE_SCHEMA_VERSION,
  AUTO_SAVE_DELAY_MS,
  state
} from "./document/state.js";
import { loadPages, savePages, loadJson, saveJson } from "./document/storage.js";
import { createEditor } from "./ui/editorUI.js";
import { createWiki } from "./document/wiki.js";
import { setStatus as setStatusText, showMenuInViewport } from "./ui/uiShared.js";
import { createModes } from "./ui/treeModes.js";
import { createWikiBindings } from "./ui/treeUI.js";
import { createSearch } from "./document/search.js";
import { createSearchBindings } from "./ui/searchUI.js";
import { t } from "./text.js";

let wiki;
let editor;
let searchBindings;

function isObjectRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isLatestPageShape(page) {
  if (!isObjectRecord(page)) return false;
  if (typeof page.title !== "string") return false;
  if (typeof page.content !== "string") return false;
  if (!Object.prototype.hasOwnProperty.call(page, "pageBackground")) return false;
  if (!Object.prototype.hasOwnProperty.call(page, "sortKey")) return false;
  if (!Object.prototype.hasOwnProperty.call(page, "order")) return false;
  return true;
}

function isLatestTrashShape(item) {
  if (!isObjectRecord(item)) return false;
  if (typeof item.title !== "string") return false;
  if (typeof item.content !== "string") return false;
  if (!Object.prototype.hasOwnProperty.call(item, "pageBackground")) return false;
  if (!Object.prototype.hasOwnProperty.call(item, "sortKey")) return false;
  if (!Object.prototype.hasOwnProperty.call(item, "order")) return false;
  if (!Object.prototype.hasOwnProperty.call(item, "root")) return false;
  if (!Object.prototype.hasOwnProperty.call(item, "depth")) return false;
  if (!Object.prototype.hasOwnProperty.call(item, "deletedAt")) return false;
  return true;
}

function createQueueAutoSave() {
  return function queueAutoSave() {
    if (state.autoSaveTimer) clearTimeout(state.autoSaveTimer);
    state.autoSaveTimer = setTimeout(() => {
      if (!wiki) return;
      const saved = wiki.saveCurrentPage(true);
      if (saved && searchBindings && typeof searchBindings.refreshActiveQuery === "function") {
        searchBindings.refreshActiveQuery();
      }
    }, AUTO_SAVE_DELAY_MS);
  };
}

async function init() {
  const setStatus = (text) => setStatusText(dom, text);
  const queueAutoSave = createQueueAutoSave();
  const onContentChanged = () => {
    if (!editor || !wiki) return;
    editor.updateCounter();
    queueAutoSave();
  };

  editor = createEditor({ dom, state, onContentChanged, setStatus });
  wiki = createWiki({
    dom,
    state,
    savePages: (pages) => savePages(STORAGE_KEY, pages),
    saveTrash: (trash) => saveJson(STORAGE_TRASH_KEY, trash),
    showMenuInViewport,
    setStatus
  });

  const modes = createModes({ dom, editor });
  const wikiBindings = createWikiBindings({
    dom,
    state,
    wiki,
    editor,
    modes,
    setStatus,
    showMenuInViewport
  });
  const search = createSearch({
    state,
    wiki,
    editor,
    setStatus
  });
  searchBindings = createSearchBindings({
    dom,
    search,
    setStatus
  });

  const rawPages = await loadPages(STORAGE_KEY);
  const rawTrash = await loadJson(STORAGE_TRASH_KEY, {});
  const storedSchemaVersion = Number(await loadJson(STORAGE_SCHEMA_KEY, 0)) || 0;

  const pagesNeedMigration = !isObjectRecord(rawPages)
    || Object.values(rawPages).some((page) => !isLatestPageShape(page));
  const trashNeedMigration = !isObjectRecord(rawTrash)
    || Object.values(rawTrash).some((item) => !isLatestTrashShape(item));
  const schemaNeedMigration = storedSchemaVersion !== STORAGE_SCHEMA_VERSION;

  state.pages = wiki.normalizePages(rawPages);
  state.trash = wiki.normalizeTrash(rawTrash);
  if (!Object.keys(state.pages).length) {
    const homePage = t("page.home");
    state.pages = wiki.normalizePages({
      [homePage]: {
        title: homePage,
        content: t("content.homeWelcome"),
        parent: null
      }
    });
  }

  if (pagesNeedMigration || trashNeedMigration || schemaNeedMigration) {
    savePages(STORAGE_KEY, state.pages);
    saveJson(STORAGE_TRASH_KEY, state.trash);
    saveJson(STORAGE_SCHEMA_KEY, STORAGE_SCHEMA_VERSION);
  }

  wikiBindings.bindAll();
  searchBindings.bindAll();

  wiki.bindTrashActions();
  wiki.renderPageList();
  wiki.renderTrashList();
  modes.applyTreeMode();
  wiki.openPage(Object.keys(state.pages)[0]);
  modes.applyMode();
  setStatus(t("status.loaded"));
}

init().catch((err) => {
  console.error(err);
  setStatusText(dom, t("status.initFailed"));
});
