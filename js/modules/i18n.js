const DEFAULT_LOCALE = "zh-CN";
const LOCALE_STORAGE_KEY = "wiki-locale-v1";

const messagesByLocale = {
  "zh-CN": {
    "common.separator": " · ",
    "content.homeWelcome": "<h1>首页</h1><p>欢迎使用 Wiki。</p>",
    "content.newPage": "<h1>{title}</h1><p>这是新页面，开始编辑吧。</p>",
    "content.newWiki": "<h1>首页</h1><p>新 Wiki 已创建。</p>",
    "content.usage": "<h1>使用说明</h1><p>支持树形页面、内链和图片粘贴。</p>",
    "counter.initial": "0 字",
    "counter.words": "{count} 字",
    "editor.emptyPlaceholder": "输入 [[页面名]] 可创建 Wiki 内链",
    "editor.pasteHint": "使用 WangEditor 工具栏进行富文本编辑。",
    "error.cannotCreateInTrashView": "回收站视图下不可新建页面",
    "error.importInvalidJson": "导入失败：JSON 格式无效",
    "error.importMissingData": "导入失败：未找到 pages / trash 数据",
    "error.importNoUsableData": "导入失败：没有可用数据",
    "error.importReadFile": "导入失败：读取文件异常",
    "error.moveToDescendant": "不能移动到自己的子孙页面",
    "error.noPageToDelete": "没有可删除的页面",
    "error.openOrCreateFirst": "请先创建或打开页面",
    "error.pageExists": "页面“{name}”已存在",
    "error.pageNameRequired": "页面名不能为空",
    "error.parentCannotSelf": "父级不能是自己",
    "error.searchPageMissing": "页面不存在：{page}",
    "error.sortMustBeNumber": "排序值必须是数字",
    "error.targetParentMissing": "目标父级不存在",
    "error.trashPreviewNoPageBg": "回收站预览不可修改页面背景",
    "error.trashPreviewReadOnlyMode": "回收站预览仅支持阅读模式",
    "error.trashPreviewReadOnlySave": "回收站预览不可保存",
    "error.wangEditorLoadFailed": "WangEditor 加载失败，已降级为基础编辑器。",
    "html.title": "Wiki 富文本",
    "locale.enUS": "English",
    "locale.label": "语言",
    "locale.tag": "zh-CN",
    "locale.zhCN": "简体中文",
    "menu.import.merge": "合并导入",
    "menu.import.replace": "覆盖导入",
    "menu.page.delete": "全部删除",
    "menu.page.deleteKeepChildren": "只删本页",
    "menu.page.moveRoot": "移动到顶级",
    "menu.page.newChild": "新建子页面",
    "menu.page.open": "打开页面",
    "menu.page.rename": "重命名页面",
    "menu.page.setSort": "设置排序值",
    "menu.page.sortDown": "下移",
    "menu.page.sortUp": "上移",
    "menu.trash.delete": "彻底删除",
    "menu.trash.restore": "恢复",
    "mode.edit": "编辑",
    "mode.read": "阅读",
    "page.defaultPrefix": "页面",
    "page.home": "首页",
    "page.restoreSuffix": "恢复",
    "page.unnamed": "未命名",
    "page.usage": "使用说明",
    "prompt.sortValue": "输入排序值（数字，越小越靠前）",
    "search.clear": "清空",
    "search.empty": "未找到匹配内容",
    "search.meta": "关键词“{query}” | {count} 条结果",
    "search.placeholder": "输入关键词搜索全部页面",
    "search.resultMatch": "匹配 #{index}",
    "search.title": "全局搜索",
    "sidebar.exportJson": "导出 JSON",
    "sidebar.importJson": "导入 JSON",
    "sidebar.operationTips": "操作提示",
    "sidebar.operationTipsHint": "右键可打开/重命名/删除/新建子页；拖拽页面到目标页面仅调整层级，顺序请用右键排序操作。",
    "sidebar.quickCreate": "+ 新建页面",
    "sidebar.treeTitle": "Wiki 页面树",
    "status.alreadyBottom": "已经在最下方",
    "status.alreadyTop": "已经在最上方",
    "status.autoSaved": "已自动保存：{path} · {time}",
    "status.autoSavedAt": "已自动保存：{time}",
    "status.autoSavedPrefix": "已自动保存：",
    "status.currentPage": "当前页面：{path}",
    "status.currentPagePrefix": "当前页面：",
    "status.deletedPromoteChildren": "已删除页面并提升子页面：{name}",
    "status.exportedJson": "已导出 JSON 备份",
    "status.hierarchyUpdated": "已更新层级：{path}",
    "status.importComplete": "导入完成（{mode}）：页面 {pages}（覆盖 {pagesOver}），回收站 {trash}（覆盖 {trashOver}{dedupe}）",
    "status.importDedupe": "，去重 {count}",
    "status.initFailed": "初始化失败，请刷新页面重试",
    "status.loaded": "已加载",
    "status.movedDown": "已下移：{name}",
    "status.movedToTrash": "已移入回收站：{name}",
    "status.movedUp": "已上移：{name}",
    "status.pageBgDefault": "默认背景",
    "status.pageBgSet": "已设置页面背景：{label}",
    "status.pageCreated": "已创建页面：{name}",
    "status.purgedFromTrash": "已从回收站彻底删除：{name}",
    "status.redo": "已前进",
    "status.renamed": "已重命名：{oldName} -> {newName}",
    "status.reordered": "已排序：{name} -> {position} {target}",
    "status.restoredFromTrash": "已从回收站恢复：{name}",
    "status.saved": "已保存页面：{path} · {time}",
    "status.savedPrefix": "已保存页面：",
    "status.searchCleared": "已清空搜索",
    "status.searchJumped": "已跳转到：{page}",
    "status.searchOpenedNoHit": "已打开页面：{page}（未定位到关键词）",
    "status.sortSet": "已设置排序值：{name} -> {value}",
    "status.trashPath": "回收站路径：{path}",
    "status.trashPathPrefix": "回收站路径：",
    "status.trashPreview": "回收站预览",
    "status.undo": "已撤销",
    "tree.pages": "页面树",
    "tree.trash": "回收站",
    "version.latest": "最新版本：{version}",
    "wiki.pageMeta": "{count}字 · 排序{sortKey}",
    "wiki.tocEmpty": "暂无标题目录（使用 H1/H2/H3）",
    "wiki.trashDepth": "层级{depth}",
    "wiki.trashDepthRoot": "根",
    "wiki.trashEmpty": "回收站为空"
  },
  "en-US": {
    "common.separator": " · ",
    "content.homeWelcome": "<h1>Home</h1><p>Welcome to Wiki.</p>",
    "content.newPage": "<h1>{title}</h1><p>This is a new page. Start editing.</p>",
    "content.newWiki": "<h1>Home</h1><p>New Wiki created.</p>",
    "content.usage": "<h1>Guide</h1><p>Supports page tree, wiki links, and image paste.</p>",
    "counter.initial": "0 chars",
    "counter.words": "{count} chars",
    "editor.emptyPlaceholder": "Type [[Page Name]] to create wiki links",
    "editor.pasteHint": "Use the WangEditor toolbar for rich-text editing.",
    "error.cannotCreateInTrashView": "Cannot create page in trash view",
    "error.importInvalidJson": "Import failed: invalid JSON format",
    "error.importMissingData": "Import failed: pages/trash data not found",
    "error.importNoUsableData": "Import failed: no usable data",
    "error.importReadFile": "Import failed: file read error",
    "error.moveToDescendant": "Cannot move to its own descendant",
    "error.noPageToDelete": "No page available to delete",
    "error.openOrCreateFirst": "Please create or open a page first",
    "error.pageExists": "Page \"{name}\" already exists",
    "error.pageNameRequired": "Page name cannot be empty",
    "error.parentCannotSelf": "Parent cannot be itself",
    "error.searchPageMissing": "Page not found: {page}",
    "error.sortMustBeNumber": "Sort value must be a number",
    "error.targetParentMissing": "Target parent does not exist",
    "error.trashPreviewNoPageBg": "Cannot change page background while previewing trash",
    "error.trashPreviewReadOnlyMode": "Trash preview supports read mode only",
    "error.trashPreviewReadOnlySave": "Cannot save while previewing trash",
    "error.wangEditorLoadFailed": "WangEditor failed to load. Fallback editor is enabled.",
    "html.title": "Wiki Rich Text",
    "locale.enUS": "English",
    "locale.label": "Language",
    "locale.tag": "en-US",
    "locale.zhCN": "Chinese (Simplified)",
    "menu.import.merge": "Merge Import",
    "menu.import.replace": "Replace Import",
    "menu.page.delete": "Delete All",
    "menu.page.deleteKeepChildren": "Delete This Page Only",
    "menu.page.moveRoot": "Move To Root",
    "menu.page.newChild": "New Child Page",
    "menu.page.open": "Open Page",
    "menu.page.rename": "Rename Page",
    "menu.page.setSort": "Set Sort Value",
    "menu.page.sortDown": "Move Down",
    "menu.page.sortUp": "Move Up",
    "menu.trash.delete": "Delete Permanently",
    "menu.trash.restore": "Restore",
    "mode.edit": "Edit",
    "mode.read": "Read",
    "page.defaultPrefix": "Page",
    "page.home": "Home",
    "page.restoreSuffix": "Restored",
    "page.unnamed": "Untitled",
    "page.usage": "Guide",
    "prompt.sortValue": "Input sort value (number, smaller first)",
    "search.clear": "Clear",
    "search.empty": "No matches found",
    "search.meta": "Query \"{query}\" | {count} result(s)",
    "search.placeholder": "Type to search all pages",
    "search.resultMatch": "Match #{index}",
    "search.title": "Global Search",
    "sidebar.exportJson": "Export JSON",
    "sidebar.importJson": "Import JSON",
    "sidebar.operationTips": "Tips",
    "sidebar.operationTipsHint": "Right-click to open/rename/delete/create child page. Dragging a page to another page only changes hierarchy; use right-click sort actions to adjust order.",
    "sidebar.quickCreate": "+ New Page",
    "sidebar.treeTitle": "Wiki Page Tree",
    "status.alreadyBottom": "Already at the bottom",
    "status.alreadyTop": "Already at the top",
    "status.autoSaved": "Auto-saved: {path} · {time}",
    "status.autoSavedAt": "Auto-saved: {time}",
    "status.autoSavedPrefix": "Auto-saved:",
    "status.currentPage": "Current page: {path}",
    "status.currentPagePrefix": "Current page:",
    "status.deletedPromoteChildren": "Deleted page and promoted children: {name}",
    "status.exportedJson": "Exported JSON backup",
    "status.hierarchyUpdated": "Hierarchy updated: {path}",
    "status.importComplete": "Import completed ({mode}): pages {pages} (overwritten {pagesOver}), trash {trash} (overwritten {trashOver}{dedupe})",
    "status.importDedupe": ", deduped {count}",
    "status.initFailed": "Initialization failed. Please refresh and try again.",
    "status.loaded": "Loaded",
    "status.movedDown": "Moved down: {name}",
    "status.movedToTrash": "Moved to trash: {name}",
    "status.movedUp": "Moved up: {name}",
    "status.pageBgDefault": "Default background",
    "status.pageBgSet": "Page background set: {label}",
    "status.pageCreated": "Created page: {name}",
    "status.purgedFromTrash": "Deleted permanently from trash: {name}",
    "status.redo": "Redone",
    "status.renamed": "Renamed: {oldName} -> {newName}",
    "status.reordered": "Reordered: {name} -> {position} {target}",
    "status.restoredFromTrash": "Restored from trash: {name}",
    "status.saved": "Saved page: {path} · {time}",
    "status.savedPrefix": "Saved page:",
    "status.searchCleared": "Search cleared",
    "status.searchJumped": "Jumped to: {page}",
    "status.searchOpenedNoHit": "Opened page: {page} (keyword not located)",
    "status.sortSet": "Sort value set: {name} -> {value}",
    "status.trashPath": "Trash path: {path}",
    "status.trashPathPrefix": "Trash path:",
    "status.trashPreview": "Trash Preview",
    "status.undo": "Undone",
    "tree.pages": "Pages",
    "tree.trash": "Trash",
    "version.latest": "Latest Version: {version}",
    "wiki.pageMeta": "{count} chars · sort {sortKey}",
    "wiki.tocEmpty": "No headings in TOC (use H1/H2/H3)",
    "wiki.trashDepth": "Level {depth}",
    "wiki.trashDepthRoot": "Root",
    "wiki.trashEmpty": "Trash is empty"
  }
};

function formatTemplate(template, params) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => {
    if (params && Object.prototype.hasOwnProperty.call(params, key)) {
      const value = params[key];
      return value === null || value === undefined ? "" : String(value);
    }
    return "";
  });
}

function getSupportedLocaleList() {
  return Object.keys(messagesByLocale);
}

function normalizeLocale(rawLocale) {
  const value = String(rawLocale || "").trim();
  const supported = getSupportedLocaleList();
  if (!value) return DEFAULT_LOCALE;
  if (supported.includes(value)) return value;

  const lower = value.toLowerCase();
  const exact = supported.find((loc) => loc.toLowerCase() === lower);
  if (exact) return exact;

  const language = lower.split("-")[0];
  const partial = supported.find((loc) => loc.toLowerCase().startsWith(`${language}-`));
  return partial || DEFAULT_LOCALE;
}

function detectInitialLocale() {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored) return normalizeLocale(stored);
  } catch {}

  if (typeof navigator !== "undefined") {
    const candidates = [navigator.language, ...(navigator.languages || [])].filter(Boolean);
    for (const candidate of candidates) {
      const normalized = normalizeLocale(candidate);
      if (normalized) return normalized;
    }
  }

  return DEFAULT_LOCALE;
}

let currentLocale = detectInitialLocale();

function getBundle(locale = currentLocale) {
  const normalized = normalizeLocale(locale);
  return messagesByLocale[normalized] || messagesByLocale[DEFAULT_LOCALE];
}

export function getCurrentLocale() {
  return currentLocale;
}

export function getSupportedLocales() {
  return getSupportedLocaleList();
}

export function setLocale(locale, options = {}) {
  const { persist = true, apply = true, root = document } = options;
  const nextLocale = normalizeLocale(locale);
  currentLocale = nextLocale;

  if (persist) {
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    } catch {}
  }

  if (apply) {
    applyI18n(root);
  }

  if (typeof document !== "undefined" && typeof document.dispatchEvent === "function") {
    document.dispatchEvent(new CustomEvent("i18n:changed", { detail: { locale: nextLocale } }));
  }

  return nextLocale;
}

export function t(key, params = null, locale = currentLocale) {
  const bundle = getBundle(locale);
  const fallback = getBundle(DEFAULT_LOCALE);
  const hasInBundle = Object.prototype.hasOwnProperty.call(bundle, key);
  const hasInFallback = Object.prototype.hasOwnProperty.call(fallback, key);
  const template = hasInBundle ? bundle[key] : (hasInFallback ? fallback[key] : key);
  if (!params) return String(template);
  return formatTemplate(template, params);
}

function toCssContentValue(text) {
  const escaped = String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, "\\A ");
  return `"${escaped}"`;
}

export function applyI18n(root = document) {
  const scope = root && typeof root.querySelectorAll === "function" ? root : document;

  scope.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });

  scope.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
  });

  scope.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.setAttribute("title", t(el.getAttribute("data-i18n-title")));
  });

  scope.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
    el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria-label")));
  });

  const doc = scope.ownerDocument || document;
  doc.documentElement.lang = t("locale.tag") || currentLocale;
  doc.documentElement.style.setProperty("--editor-empty-tip", toCssContentValue(t("editor.emptyPlaceholder")));

  const localeSelect = doc.getElementById("localeSelect");
  if (localeSelect) {
    localeSelect.value = currentLocale;
  }
}

export { messagesByLocale as messages };
