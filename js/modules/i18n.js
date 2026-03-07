const DEFAULT_LOCALE = "zh-CN";
const LOCALE_STORAGE_KEY = "wiki-locale-v1";

const messagesByLocale = {
  "zh-CN": {
    "locale.tag": "zh-CN",
    "locale.label": "语言",
    "locale.zhCN": "简体中文",
    "locale.enUS": "English",
    "version.latest": "最新版本：{version}",

    "common.separator": " · ",
    "common.apply": "应用",
    "common.welcome": "欢迎",

    "html.title": "Wiki 富文本",

    "sidebar.treeTitle": "Wiki 页面树",
    "sidebar.quickCreate": "+ 新建页面",
    "sidebar.importJson": "导入 JSON",
    "sidebar.exportJson": "导出 JSON",
    "sidebar.operationTips": "操作提示",
    "sidebar.operationTipsHint": "右键可打开/重命名/删除/新建子页；拖拽页面到目标页面仅调整层级，顺序请用右键排序操作。",
    "tree.pages": "页面树",
    "tree.trash": "回收站",

    "search.title": "全局搜索",
    "search.placeholder": "输入关键词搜索全部页面",
    "search.clear": "清空",
    "search.meta": "关键词“{query}” | {count} 条结果",
    "search.empty": "未找到匹配内容",
    "search.resultMatch": "匹配 #{index}",

    "mode.read": "阅读",
    "mode.edit": "编辑",

    "toolbar.undo": "撤销",
    "toolbar.undoTitle": "撤销 Ctrl+Z",
    "toolbar.redo": "前进",
    "toolbar.redoTitle": "前进 Ctrl+Y / Ctrl+Shift+Z",
    "toolbar.fontSize": "字号",
    "toolbar.color": "颜色",
    "toolbar.wiki": "Wiki",
    "toolbar.image": "图片",
    "toolbar.table": "表格",
    "toolbar.body": "正文",

    "format.p": "正文",
    "format.h1": "标题 1",
    "format.h2": "标题 2",
    "format.h3": "标题 3",

    "counter.initial": "0 字",
    "counter.words": "{count} 字",
    "editor.pasteHint": "右键编辑区可粘贴剪贴板图片（也支持 Ctrl+V）",
    "editor.emptyPlaceholder": "输入 [[页面名]] 可创建 Wiki 内链",

    "context.pasteImage": "粘贴剪贴板图片",

    "menu.page.open": "打开页面",
    "menu.page.newChild": "新建子页面",
    "menu.page.rename": "重命名页面",
    "menu.page.sortUp": "上移",
    "menu.page.sortDown": "下移",
    "menu.page.setSort": "设置排序值",
    "menu.page.moveRoot": "移动到顶级",
    "menu.page.delete": "全部删除",
    "menu.page.deleteKeepChildren": "只删本页",

    "menu.trash.restore": "恢复",
    "menu.trash.delete": "彻底删除",

    "menu.import.merge": "合并导入",
    "menu.import.replace": "覆盖导入",

    "table.exit": "退出",
    "table.insertRow": "插入行",
    "table.deleteRow": "删除行",
    "table.insertCol": "插入列",
    "table.deleteCol": "删除列",
    "table.delete": "删除表格",
    "table.title": "插入表格",
    "table.rows": "行",
    "table.cols": "列",
    "table.colLabel": "列{index}",

    "image.title": "图片设置",
    "image.defaultSize": "默认大小",
    "image.widthPlaceholder": "宽(px)",
    "image.heightPlaceholder": "高(px)",
    "image.applySize": "应用尺寸",

    "palette.title": "颜色设置",
    "palette.mode.text": "字体颜色",
    "palette.mode.bg": "文字底色",
    "palette.mode.page": "页面底色",
    "palette.aria": "颜色列表",
    "palette.clear.text": "默认黑色",
    "palette.clear.bg": "清除背景色",
    "palette.clear.page": "恢复页面底色",

    "fontSize.title": "选择字号（px）",
    "fontSize.customTitle": "自定义字号（px）",

    "status.loaded": "已加载",
    "status.initFailed": "初始化失败，请刷新页面重试",
    "status.currentPage": "当前页面：{path}",
    "status.currentPageWithAnchor": "当前页面：{path} #{anchor}",
    "status.currentPagePrefix": "当前页面：",
    "status.trashPath": "回收站路径：{path}",
    "status.trashPathPrefix": "回收站路径：",
    "status.saved": "已保存页面：{path} · {time}",
    "status.savedPrefix": "已保存页面：",
    "status.autoSaved": "已自动保存：{path} · {time}",
    "status.autoSavedPrefix": "已自动保存：",
    "status.autoSavedAt": "已自动保存：{time}",
    "status.trashPreview": "回收站预览",

    "status.pageCreated": "已创建页面：{name}",
    "status.pageBgSet": "已设置页面背景：{label}",
    "status.pageBgDefault": "默认背景",
    "status.hierarchyUpdated": "已更新层级：{path}",
    "status.reordered": "已排序：{name} -> {position} {target}",
    "status.position.before": "前置",
    "status.position.after": "后置",
    "status.renamed": "已重命名：{oldName} -> {newName}",
    "status.restoredFromTrash": "已从回收站恢复：{name}",
    "status.purgedFromTrash": "已从回收站彻底删除：{name}",
    "status.movedToTrash": "已移入回收站：{name}",
    "status.deletedPromoteChildren": "已删除页面并提升子页面：{name}",
    "status.alreadyTop": "已经在最上方",
    "status.alreadyBottom": "已经在最下方",
    "status.movedUp": "已上移：{name}",
    "status.movedDown": "已下移：{name}",
    "status.sortSet": "已设置排序值：{name} -> {value}",

    "status.undo": "已撤销",
    "status.redo": "已前进",
    "status.fontSizeSet": "已设置字号：{size}px",
    "status.clearToBodyStyle": "已按正文样式清理选区",
    "status.clearBg": "已清除底色",
    "status.presetApplied": "已应用{label}预设样式",
    "status.imageInsertedFromClipboard": "已从剪贴板插入图片",
    "status.imageInsertedByCtrlV": "已通过 Ctrl+V 插入图片",
    "status.insertedPlainText": "已插入纯文本",
    "status.imageResetDefault": "图片已恢复默认大小",
    "status.imageResizedProportional": "图片尺寸已按等比例更新",

    "status.pageBgReset": "页面底色已恢复",
    "status.textColor": "字体颜色：{color}",
    "status.highlightColor": "文字底色：{color}",
    "status.pageBgColor": "页面底色：{color}",
    "status.imageFromUrl": "已插入网络图片",
    "status.imageFromFile": "已插入本地图片",
    "status.searchCleared": "已清空搜索",
    "status.searchJumped": "已跳转到：{page}",
    "status.searchOpenedNoHit": "已打开页面：{page}（未定位到关键词）",
    "status.tableResized": "已调整表格列宽",
    "status.tableInserted": "已插入 {rows} x {cols} 表格",
    "status.tableRowAdded": "已增加一行",
    "status.tableRowRemoved": "已减少一行",
    "status.tableColAdded": "已增加一列",
    "status.tableColRemoved": "已减少一列",
    "status.tableDeleted": "已删除表格",
    "status.exportedJson": "已导出 JSON 备份",
    "status.importComplete": "导入完成（{mode}）：页面 {pages}（覆盖 {pagesOver}），回收站 {trash}（覆盖 {trashOver}{dedupe}）",
    "status.importMode.merge": "合并",
    "status.importMode.replace": "覆盖",
    "status.importDedupe": "，去重 {count}",

    "error.pageNameRequired": "页面名不能为空",
    "error.pageExists": "页面“{name}”已存在",
    "error.trashPreviewReadOnlySave": "回收站预览不可保存",
    "error.openOrCreateFirst": "请先创建或打开页面",
    "error.trashPreviewNoPageBg": "回收站预览不可修改页面背景",
    "error.parentCannotSelf": "父级不能是自己",
    "error.targetParentMissing": "目标父级不存在",
    "error.moveToDescendant": "不能移动到自己的子孙页面",
    "error.sortMustBeNumber": "排序值必须是数字",
    "error.noPageToDelete": "没有可删除的页面",
    "error.noUndo": "没有可撤销的操作",
    "error.undoFailed": "撤销失败",
    "error.noRedo": "没有可前进的操作",
    "error.redoFailed": "前进失败",
    "error.invalidFontSize": "请输入有效字号（px）",
    "error.selectText": "请先选中文本",
    "error.selectTextInEditor": "请先在编辑区选中文本",
    "error.clipboardReadUnsupported": "当前浏览器不支持 clipboard.read，请使用 Ctrl+V 粘贴图片。",
    "error.clipboardNoImage": "剪贴板中没有图片",
    "error.clipboardReadFailed": "读取剪贴板失败，请允许剪贴板权限，或改用 Ctrl+V",
    "error.imageRatioUnavailable": "无法获取图片比例，请重新选择图片",
    "error.invalidImageSize": "请输入有效的图片宽度或高度(px)",
    "error.cannotCreateInTrashView": "回收站视图下不可新建页面",
    "error.importReadFile": "导入失败：读取文件异常",
    "error.trashPreviewReadOnlyMode": "回收站预览仅支持阅读模式",
    "error.importInvalidJson": "导入失败：JSON 格式无效",
    "error.importMissingData": "导入失败：未找到 pages / trash 数据",
    "error.importNoUsableData": "导入失败：没有可用数据",
    "error.tableInvalidNumber": "表格行列请输入有效数字",
    "error.readLocalImageFailed": "读取本地图片失败",
    "error.inputOneOrTwo": "请输入 1 或 2",
    "error.searchPageMissing": "页面不存在：{page}",

    "prompt.wikiLink": "输入 Wiki 链接（页面名 或 页面名#标题）",
    "prompt.wikiLinkDefault": "首页#欢迎",
    "prompt.imageUrl": "输入图片网络地址",
    "prompt.imageMode": "选择插入方式：1 本地文件，2 图片地址",
    "prompt.sortValue": "输入排序值（数字，越小越靠前）",

    "wiki.tocEmpty": "暂无标题目录（使用 H1/H2/H3）",
    "wiki.pageMeta": "{count}字 · 排序{sortKey}",
    "wiki.trashEmpty": "回收站为空",
    "wiki.trashDepthRoot": "根",
    "wiki.trashDepth": "层级{depth}",

    "page.defaultPrefix": "页面",
    "page.home": "首页",
    "page.usage": "使用说明",
    "page.unnamed": "未命名",
    "page.restoreSuffix": "恢复",

    "content.homeWelcome": "<h1>首页</h1><p>欢迎使用 Wiki。</p>",
    "content.usage": "<h1>使用说明</h1><p>支持树形页面、内链和图片粘贴。</p>",
    "content.newPage": "<h1>{title}</h1><p>这是新页面，开始编辑吧。</p>",
    "content.newWiki": "<h1>首页</h1><p>新 Wiki 已创建。</p>",

    "label.format.P": "正文",
    "label.format.H1": "标题1",
    "label.format.H2": "标题2",
    "label.format.H3": "标题3"
  },
  "en-US": {
    "locale.tag": "en-US",
    "locale.label": "Language",
    "locale.zhCN": "Chinese (Simplified)",
    "locale.enUS": "English",
    "version.latest": "Latest Version: {version}",

    "common.separator": " · ",
    "common.apply": "Apply",
    "common.welcome": "Welcome",

    "html.title": "Wiki Rich Text",

    "sidebar.treeTitle": "Wiki Page Tree",
    "sidebar.quickCreate": "+ New Page",
    "sidebar.importJson": "Import JSON",
    "sidebar.exportJson": "Export JSON",
    "sidebar.operationTips": "Tips",
    "sidebar.operationTipsHint": "Right-click to open/rename/delete/create child page. Dragging a page to another page only changes hierarchy; use right-click sort actions to adjust order.",
    "tree.pages": "Pages",
    "tree.trash": "Trash",

    "search.title": "Global Search",
    "search.placeholder": "Type to search all pages",
    "search.clear": "Clear",
    "search.meta": "Query \"{query}\" | {count} result(s)",
    "search.empty": "No matches found",
    "search.resultMatch": "Match #{index}",

    "mode.read": "Read",
    "mode.edit": "Edit",

    "toolbar.undo": "Undo",
    "toolbar.undoTitle": "Undo Ctrl+Z",
    "toolbar.redo": "Redo",
    "toolbar.redoTitle": "Redo Ctrl+Y / Ctrl+Shift+Z",
    "toolbar.fontSize": "Size",
    "toolbar.color": "Color",
    "toolbar.wiki": "Wiki",
    "toolbar.image": "Image",
    "toolbar.table": "Table",
    "toolbar.body": "Body",

    "format.p": "Body",
    "format.h1": "Heading 1",
    "format.h2": "Heading 2",
    "format.h3": "Heading 3",

    "counter.initial": "0 chars",
    "counter.words": "{count} chars",
    "editor.pasteHint": "Right-click editor to paste clipboard images (Ctrl+V supported)",
    "editor.emptyPlaceholder": "Type [[Page Name]] to create wiki links",

    "context.pasteImage": "Paste Clipboard Image",

    "menu.page.open": "Open Page",
    "menu.page.newChild": "New Child Page",
    "menu.page.rename": "Rename Page",
    "menu.page.sortUp": "Move Up",
    "menu.page.sortDown": "Move Down",
    "menu.page.setSort": "Set Sort Value",
    "menu.page.moveRoot": "Move To Root",
    "menu.page.delete": "Delete All",
    "menu.page.deleteKeepChildren": "Delete This Page Only",

    "menu.trash.restore": "Restore",
    "menu.trash.delete": "Delete Permanently",

    "menu.import.merge": "Merge Import",
    "menu.import.replace": "Replace Import",

    "table.exit": "Exit",
    "table.insertRow": "Insert Row",
    "table.deleteRow": "Delete Row",
    "table.insertCol": "Insert Column",
    "table.deleteCol": "Delete Column",
    "table.delete": "Delete Table",
    "table.title": "Insert Table",
    "table.rows": "Rows",
    "table.cols": "Cols",
    "table.colLabel": "Col {index}",

    "image.title": "Image Settings",
    "image.defaultSize": "Default Size",
    "image.widthPlaceholder": "W(px)",
    "image.heightPlaceholder": "H(px)",
    "image.applySize": "Apply Size",

    "palette.title": "Color Settings",
    "palette.mode.text": "Text Color",
    "palette.mode.bg": "Text Highlight",
    "palette.mode.page": "Page Background",
    "palette.aria": "Color List",
    "palette.clear.text": "Default Black",
    "palette.clear.bg": "Clear Highlight",
    "palette.clear.page": "Reset Page Background",

    "fontSize.title": "Choose Font Size (px)",
    "fontSize.customTitle": "Custom Font Size (px)",

    "status.loaded": "Loaded",
    "status.initFailed": "Initialization failed. Please refresh and try again.",
    "status.currentPage": "Current page: {path}",
    "status.currentPageWithAnchor": "Current page: {path} #{anchor}",
    "status.currentPagePrefix": "Current page:",
    "status.trashPath": "Trash path: {path}",
    "status.trashPathPrefix": "Trash path:",
    "status.saved": "Saved page: {path} · {time}",
    "status.savedPrefix": "Saved page:",
    "status.autoSaved": "Auto-saved: {path} · {time}",
    "status.autoSavedPrefix": "Auto-saved:",
    "status.autoSavedAt": "Auto-saved: {time}",
    "status.trashPreview": "Trash Preview",

    "status.pageCreated": "Created page: {name}",
    "status.pageBgSet": "Page background set: {label}",
    "status.pageBgDefault": "Default background",
    "status.hierarchyUpdated": "Hierarchy updated: {path}",
    "status.reordered": "Reordered: {name} -> {position} {target}",
    "status.position.before": "before",
    "status.position.after": "after",
    "status.renamed": "Renamed: {oldName} -> {newName}",
    "status.restoredFromTrash": "Restored from trash: {name}",
    "status.purgedFromTrash": "Deleted permanently from trash: {name}",
    "status.movedToTrash": "Moved to trash: {name}",
    "status.deletedPromoteChildren": "Deleted page and promoted children: {name}",
    "status.alreadyTop": "Already at the top",
    "status.alreadyBottom": "Already at the bottom",
    "status.movedUp": "Moved up: {name}",
    "status.movedDown": "Moved down: {name}",
    "status.sortSet": "Sort value set: {name} -> {value}",

    "status.undo": "Undone",
    "status.redo": "Redone",
    "status.fontSizeSet": "Font size set: {size}px",
    "status.clearToBodyStyle": "Selection cleaned to body style",
    "status.clearBg": "Highlight cleared",
    "status.presetApplied": "Applied preset: {label}",
    "status.imageInsertedFromClipboard": "Inserted image from clipboard",
    "status.imageInsertedByCtrlV": "Inserted image via Ctrl+V",
    "status.insertedPlainText": "Inserted plain text",
    "status.imageResetDefault": "Image reset to default size",
    "status.imageResizedProportional": "Image resized proportionally",

    "status.pageBgReset": "Page background reset",
    "status.textColor": "Text color: {color}",
    "status.highlightColor": "Highlight color: {color}",
    "status.pageBgColor": "Page background: {color}",
    "status.imageFromUrl": "Inserted image from URL",
    "status.imageFromFile": "Inserted local image",
    "status.searchCleared": "Search cleared",
    "status.searchJumped": "Jumped to: {page}",
    "status.searchOpenedNoHit": "Opened page: {page} (keyword not located)",
    "status.tableResized": "Table column width adjusted",
    "status.tableInserted": "Inserted {rows} x {cols} table",
    "status.tableRowAdded": "Added one row",
    "status.tableRowRemoved": "Removed one row",
    "status.tableColAdded": "Added one column",
    "status.tableColRemoved": "Removed one column",
    "status.tableDeleted": "Deleted table",
    "status.exportedJson": "Exported JSON backup",
    "status.importComplete": "Import completed ({mode}): pages {pages} (overwritten {pagesOver}), trash {trash} (overwritten {trashOver}{dedupe})",
    "status.importMode.merge": "merge",
    "status.importMode.replace": "replace",
    "status.importDedupe": ", deduped {count}",

    "error.pageNameRequired": "Page name cannot be empty",
    "error.pageExists": "Page \"{name}\" already exists",
    "error.trashPreviewReadOnlySave": "Cannot save while previewing trash",
    "error.openOrCreateFirst": "Please create or open a page first",
    "error.trashPreviewNoPageBg": "Cannot change page background while previewing trash",
    "error.parentCannotSelf": "Parent cannot be itself",
    "error.targetParentMissing": "Target parent does not exist",
    "error.moveToDescendant": "Cannot move to its own descendant",
    "error.sortMustBeNumber": "Sort value must be a number",
    "error.noPageToDelete": "No page available to delete",
    "error.noUndo": "Nothing to undo",
    "error.undoFailed": "Undo failed",
    "error.noRedo": "Nothing to redo",
    "error.redoFailed": "Redo failed",
    "error.invalidFontSize": "Please input a valid font size (px)",
    "error.selectText": "Please select text first",
    "error.selectTextInEditor": "Please select text inside the editor",
    "error.clipboardReadUnsupported": "clipboard.read is not supported in this browser. Please use Ctrl+V to paste images.",
    "error.clipboardNoImage": "No image in clipboard",
    "error.clipboardReadFailed": "Failed to read clipboard. Please allow clipboard permission or use Ctrl+V",
    "error.imageRatioUnavailable": "Cannot get image ratio. Please reselect image",
    "error.invalidImageSize": "Please enter a valid image width or height (px)",
    "error.cannotCreateInTrashView": "Cannot create page in trash view",
    "error.importReadFile": "Import failed: file read error",
    "error.trashPreviewReadOnlyMode": "Trash preview supports read mode only",
    "error.importInvalidJson": "Import failed: invalid JSON format",
    "error.importMissingData": "Import failed: pages/trash data not found",
    "error.importNoUsableData": "Import failed: no usable data",
    "error.tableInvalidNumber": "Please enter valid numbers for table rows and columns",
    "error.readLocalImageFailed": "Failed to read local image",
    "error.inputOneOrTwo": "Please input 1 or 2",
    "error.searchPageMissing": "Page not found: {page}",

    "prompt.wikiLink": "Input Wiki link (Page or Page#Heading)",
    "prompt.wikiLinkDefault": "Home#Welcome",
    "prompt.imageUrl": "Input image URL",
    "prompt.imageMode": "Choose insert mode: 1 local file, 2 image URL",
    "prompt.sortValue": "Input sort value (number, smaller first)",

    "wiki.tocEmpty": "No headings in TOC (use H1/H2/H3)",
    "wiki.pageMeta": "{count} chars · sort {sortKey}",
    "wiki.trashEmpty": "Trash is empty",
    "wiki.trashDepthRoot": "Root",
    "wiki.trashDepth": "Level {depth}",

    "page.defaultPrefix": "Page",
    "page.home": "Home",
    "page.usage": "Guide",
    "page.unnamed": "Untitled",
    "page.restoreSuffix": "Restored",

    "content.homeWelcome": "<h1>Home</h1><p>Welcome to Wiki.</p>",
    "content.usage": "<h1>Guide</h1><p>Supports page tree, wiki links, and image paste.</p>",
    "content.newPage": "<h1>{title}</h1><p>This is a new page. Start editing.</p>",
    "content.newWiki": "<h1>Home</h1><p>New Wiki created.</p>",

    "label.format.P": "Body",
    "label.format.H1": "Heading1",
    "label.format.H2": "Heading2",
    "label.format.H3": "Heading3"
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
