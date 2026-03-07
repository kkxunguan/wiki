import { dom } from "./modules/dom.js";
import { STORAGE_KEY, STORAGE_TRASH_KEY, AUTO_SAVE_DELAY_MS, state } from "./modules/state.js";
import { loadPages, savePages, loadJson, saveJson } from "./modules/storage.js";
import { createPanels } from "./modules/panels.js";
import { createEditor } from "./modules/editor.js";
import { createWiki } from "./modules/wiki.js";
import { createTableModule } from "./modules/table.js";
import { setStatus as setStatusText, showMenuInViewport } from "./modules/app/ui.js";
import { createModes } from "./modules/app/modes.js";
import { createTransfer } from "./modules/app/transfer.js";
import { createEditorBindings } from "./modules/app/editorBindings.js";
import { createWikiBindings } from "./modules/app/wikiBindings.js";
import { createSearch } from "./modules/search.js";
import { createSearchBindings } from "./modules/app/searchBindings.js";
import { applyI18n, t } from "./modules/i18n.js";
import { createI18nBindings } from "./modules/app/i18nBindings.js";

let wiki;
let editor;
let searchBindings;
let i18nBindings;

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
  applyI18n(document);
  const setStatus = (text) => setStatusText(dom, text);
  const queueAutoSave = createQueueAutoSave();
  const onContentChanged = () => {
    if (!editor || !wiki) return;
    editor.updateCounter();
    wiki.renderPreview();
    queueAutoSave();
    editor.captureHistorySnapshot();
  };

  const panels = createPanels(dom);

  editor = createEditor({ dom, state, onContentChanged, queueAutoSave, setStatus });
  await editor.resetHistoryStorage();
  wiki = createWiki({
    dom,
    state,
    savePages: (pages) => savePages(STORAGE_KEY, pages),
    saveTrash: (trash) => saveJson(STORAGE_TRASH_KEY, trash),
    onContentChanged,
    queueAutoSave,
    setStatus
  });
  const tableModule = createTableModule({ dom, state, onContentChanged, queueAutoSave, setStatus });

  const modes = createModes({ dom, editor });
  const transfer = createTransfer({
    state,
    wiki,
    persistPages: (pages) => savePages(STORAGE_KEY, pages),
    persistTrash: (trash) => saveJson(STORAGE_TRASH_KEY, trash),
    setStatus,
    storageKey: STORAGE_KEY,
    trashStorageKey: STORAGE_TRASH_KEY
  });

  const editorBindings = createEditorBindings({
    dom,
    state,
    editor,
    wiki,
    panels,
    tableModule,
    setStatus,
    queueAutoSave,
    showMenuInViewport
  });
  const wikiBindings = createWikiBindings({
    dom,
    state,
    wiki,
    modes,
    setStatus,
    showMenuInViewport,
    exportAllToJson: transfer.exportAllToJson,
    importFromJsonText: transfer.importFromJsonText
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
  i18nBindings = createI18nBindings({
    dom,
    modes,
    wiki,
    editor,
    searchBindings
  });

  state.pages = wiki.normalizePages(await loadPages(STORAGE_KEY));
  state.trash = wiki.normalizeTrash(await loadJson(STORAGE_TRASH_KEY, {}));
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

  editorBindings.bindAll();
  wikiBindings.bindAll();
  searchBindings.bindAll();
  i18nBindings.bindAll();

  panels.bindGlobalDismiss(["#contextMenu", "#tableToolBar"]);

  tableModule.bindResizeBehavior();
  tableModule.bindToolbarActions();
  tableModule.bindTableSelectionTracking();

  dom.editor.addEventListener("input", onContentChanged);
  editor.bindSelectionTracking();
  editor.bindReadOnlyGuard();
  editor.bindImageTooling();

  wiki.bindPreviewLinks();
  wiki.bindTrashActions();
  wiki.renderPageList();
  wiki.renderTrashList();
  modes.applyTreeMode();
  wiki.openPage(Object.keys(state.pages)[0]);
  modes.applyMode();
  i18nBindings.refreshRuntimeLocalizedUi();
  setStatus(t("status.loaded"));
}

init().catch((err) => {
  console.error(err);
  setStatusText(dom, t("status.initFailed"));
});
