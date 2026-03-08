import { dom } from "./ui/dom.js";
import {
  STORAGE_KEY,
  STORAGE_TRASH_KEY,
  STORAGE_SCHEMA_KEY,
  STORAGE_SCHEMA_VERSION,
  state
} from "./document/state.js";
import { loadPages, savePages, loadJson, saveJson } from "./document/storage.js";
import { createEditor } from "./ui/editorUI.js";
import { createWiki } from "./document/wiki.js";
import { setStatus, showMenuInViewport } from "./ui/uiShared.js";
import { createModes } from "./ui/treeModes.js";
import { createWikiBindings } from "./ui/treeUI.js";
import { createSearch } from "./document/search.js";
import { createSearchBindings } from "./ui/searchUI.js";
import { t } from "./text.js";

// Wiki 业务服务实例（初始化后赋值）。
let wiki;
// 编辑器服务实例（初始化后赋值）。
let editor;
// 搜索 UI 绑定实例（初始化后赋值）。
let searchBindings;

// 判断值是否为普通对象（排除 null 与数组）。
function isObjectRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// 判断页面对象是否已经是当前版本所需的数据结构。
function isLatestPageShape(page) {
  if (!isObjectRecord(page)) return false;
  if (typeof page.title !== "string") return false;
  if (typeof page.content !== "string") return false;
  if (!Object.prototype.hasOwnProperty.call(page, "pageBackground")) return false;
  if (!Object.prototype.hasOwnProperty.call(page, "sortKey")) return false;
  if (!Object.prototype.hasOwnProperty.call(page, "order")) return false;
  return true;
}

// 判断回收站对象是否已经是当前版本所需的数据结构。
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

// 应用初始化入口：组装模块、加载数据、迁移结构并完成首屏渲染。
async function init() {
  // 步骤 1：创建核心服务（Wiki 业务服务 + 编辑器）。
  wiki = createWiki({
    dom,
    state,
    savePages: (pages) => savePages(STORAGE_KEY, pages),
    saveTrash: (trash) => saveJson(STORAGE_TRASH_KEY, trash),
    showMenuInViewport,
    setStatus
  });
  editor = createEditor({
    saveCurrentPage: (silent = true) => wiki.saveCurrentPage(silent),
    refreshSearchQuery: () => {
      if (searchBindings && typeof searchBindings.refreshActiveQuery === "function") {
        searchBindings.refreshActiveQuery();
      }
    }
  });

  // 步骤 2：创建模式、树交互、搜索等 UI 绑定器。
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

  // 步骤 3：读取本地存储快照（页面、回收站、Schema 版本）。
  const rawPages = await loadPages(STORAGE_KEY);
  const rawTrash = await loadJson(STORAGE_TRASH_KEY, {});
  const storedSchemaVersion = Number(await loadJson(STORAGE_SCHEMA_KEY, 0)) || 0;

  // 步骤 4：判断是否需要迁移，并将数据规范化写入运行时 state。
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

  // 步骤 5：如需迁移，则把规范化后的数据回写到存储层。
  if (pagesNeedMigration || trashNeedMigration || schemaNeedMigration) {
    savePages(STORAGE_KEY, state.pages);
    saveJson(STORAGE_TRASH_KEY, state.trash);
    saveJson(STORAGE_SCHEMA_KEY, STORAGE_SCHEMA_VERSION);
  }

  // 步骤 6：绑定事件并完成首屏渲染。
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

// 启动应用初始化流程。
init()
