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

let wiki;
let editor;

function createQueueAutoSave() {
  return function queueAutoSave() {
    if (state.autoSaveTimer) clearTimeout(state.autoSaveTimer);
    state.autoSaveTimer = setTimeout(() => {
      if (wiki) wiki.saveCurrentPage(true);
    }, AUTO_SAVE_DELAY_MS);
  };
}

async function init() {
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

  state.pages = wiki.normalizePages(await loadPages(STORAGE_KEY));
  state.trash = wiki.normalizeTrash(await loadJson(STORAGE_TRASH_KEY, {}));
  if (!Object.keys(state.pages).length) {
    state.pages = wiki.normalizePages({ "首页": { title: "首页", content: "<h1>首页</h1><p>欢迎使用 Wiki。</p>", parent: null } });
  }

  editorBindings.bindAll();
  wikiBindings.bindAll();

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
  setStatus("已加载");
}

init().catch((err) => {
  console.error(err);
  setStatusText(dom, "初始化失败，请刷新页面重试");
});
