import { t } from "../text.js";

// 创建 Wiki 核心服务，封装页面树、回收站和编辑区的主要业务逻辑。
export function createWiki({ dom, state, savePages, saveTrash, showMenuInViewport, setStatus }) {

  // 清理页面名输入，统一去掉首尾空格。
  function sanitizeName(name) {
    return (name || "").trim();
  }

  const PAGE_BG_DEFAULT = "";
  // 校验 RGB 单通道值，必须是 0~255 的整数。
  function sanitizeRgbChannel(channel) {
    const n = Number(channel);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    return n;
  }

  // 规范化页面背景色，仅允许 #RRGGBB 或 rgb(r,g,b)。
  function sanitizePageBackground(color) {
    const raw = String(color || "").trim();
    if (!raw) return PAGE_BG_DEFAULT;

    const hex = raw.match(/^#([0-9a-f]{6})$/i);
    if (hex) return `#${hex[1].toLowerCase()}`;

    const rgb = raw.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
    if (rgb) {
      const r = sanitizeRgbChannel(rgb[1]);
      const g = sanitizeRgbChannel(rgb[2]);
      const b = sanitizeRgbChannel(rgb[3]);
      if (r !== null && g !== null && b !== null) return `rgb(${r}, ${g}, ${b})`;
    }

    return PAGE_BG_DEFAULT;
  }

  // 将页面背景应用到编辑区容器。
  function applyEditorBackground(color) {
    if (!dom.editorWrap) return;
    const next = sanitizePageBackground(color);
    dom.editorWrap.style.background = next || "";
  }

  // 转义字符串，避免文本直接进入 HTML 时产生注入。
  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // 过滤不安全标签与属性，生成可安全持久化的 HTML。
  function sanitizeHtml(inputHtml) {
    const template = document.createElement("template");
    template.innerHTML = String(inputHtml || "");
    const blockedTags = new Set([
      "SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "META", "LINK", "BASE", "FORM",
      "SVG", "MATH"
    ]);
    const transientClasses = new Set([
      "jump-target",
      "image-selected",
      "table-selected",
      "table-wrap",
      "wiki-table"
    ]);

    const elements = Array.from(template.content.querySelectorAll("*"));
    elements.forEach((el) => {
      // 1) 先移除明确禁止的高风险标签。
      if (blockedTags.has(el.tagName)) {
        el.remove();
        return;
      }

      // 2) 清掉仅用于编辑态的临时 class，避免污染持久化内容。
      if (el.classList && el.classList.length) {
        transientClasses.forEach((name) => el.classList.remove(name));
        if (!el.classList.length) el.removeAttribute("class");
      }

      // 3) 清理危险属性：事件属性、srcdoc、javascript: URL。
      Array.from(el.attributes).forEach((attr) => {
        const attrName = attr.name.toLowerCase();
        const attrValue = String(attr.value || "").trim();
        if (attrName.startsWith("on") || attrName === "srcdoc") {
          el.removeAttribute(attr.name);
          return;
        }
        const isUrlAttr = attrName === "href" || attrName === "src" || attrName === "xlink:href";
        if (isUrlAttr && /^\s*javascript:/i.test(attrValue)) {
          el.removeAttribute(attr.name);
        }
      });
    });

    return template.innerHTML.trim() ? template.innerHTML : "<p></p>";
  }

  // 获取编辑器适配器（统一富文本编辑器与降级模式接口）。
  function getEditorAdapter() {
    const adapter = state.editorAdapter;
    if (!adapter) return null;
    if (typeof adapter.getHtml !== "function") return null;
    if (typeof adapter.setHtml !== "function") return null;
    return adapter;
  }

  // 从编辑器读取当前 HTML。
  function readEditorHtml() {
    const adapter = getEditorAdapter();
    if (adapter) return String(adapter.getHtml() || "");
    if (!dom.editor) return "";
    return String(dom.editor.innerHTML || "");
  }

  // 写入 HTML 到编辑器，并先做安全清洗。
  function writeEditorHtml(html) {
    const safeHtml = sanitizeHtml(html);
    const adapter = getEditorAdapter();
    if (adapter) {
      adapter.setHtml(safeHtml);
      return;
    }
    if (dom.editor) dom.editor.innerHTML = safeHtml;
  }

  // 持久化当前页面树数据。
  function persistPages() {
    savePages(state.pages);
  }

  // 持久化当前回收站数据（可选注入）。
  function persistTrash() {
    if (typeof saveTrash === "function") saveTrash(state.trash);
  }

  // 规范化页面数据结构并修正非法父子关系。
  function normalizePages(source) {
    const out = {};
    const siblingCursor = { __root__: 0 };
    Object.keys(source || {}).forEach((name) => {
      const page = source[name] || {};
      // 对旧数据做兼容：优先 sortKey，其次 order，最后按遍历顺序兜底。
      const parentKey = page.parent || "__root__";
      const fallbackOrder = siblingCursor[parentKey] || 0;
      const normalizedSortKey = Number.isFinite(Number(page.sortKey))
        ? Number(page.sortKey)
        : (Number.isFinite(Number(page.order)) ? Number(page.order) : fallbackOrder);
      siblingCursor[parentKey] = fallbackOrder + 1;
      out[name] = {
        title: page.title || name,
        content: sanitizeHtml(page.content || "<p></p>"),
        pageBackground: sanitizePageBackground(page.pageBackground),
        parent: page.parent || null,
        sortKey: normalizedSortKey,
        order: normalizedSortKey
      };
    });
    // 修正异常 parent：指向自己或不存在节点时降级为根节点。
    Object.keys(out).forEach((name) => {
      const p = out[name].parent;
      if (p === name || (p && !out[p])) out[name].parent = null;
    });
    normalizeAllSiblingOrders(out);
    return out;
  }

  // 规范化回收站数据结构，补齐恢复所需字段。
  function normalizeTrash(source) {
    const out = {};
    Object.keys(source || {}).forEach((name) => {
      const item = source[name] || {};
      const sortKey = Number.isFinite(Number(item.sortKey))
        ? Number(item.sortKey)
        : (Number.isFinite(Number(item.order)) ? Number(item.order) : 0);
      out[name] = {
        title: item.title || name,
        content: sanitizeHtml(item.content || "<p></p>"),
        pageBackground: sanitizePageBackground(item.pageBackground),
        parent: item.parent || null,
        sortKey,
        order: sortKey,
        root: item.root || name,
        depth: Number.isFinite(Number(item.depth)) ? Number(item.depth) : 0,
        deletedAt: item.deletedAt || new Date().toISOString()
      };
    });
    return out;
  }

  // 构建 parent->children 映射，并按 sortKey 排序。
  function getChildrenMap() {
    const map = { __root__: [] };
    // 先为每个页面预建 children 数组，保证后续 push 安全。
    Object.keys(state.pages).forEach((name) => { map[name] = []; });
    // 构建父子关系；父不存在时归入根节点集合。
    Object.keys(state.pages).forEach((name) => {
      const p = state.pages[name].parent;
      if (p && state.pages[p]) map[p].push(name);
      else map.__root__.push(name);
    });
    // 每组兄弟节点按 sortKey、再按名称排序，保证渲染稳定。
    Object.keys(map).forEach((k) => map[k].sort((a, b) => {
      const pageA = state.pages[a];
      const pageB = state.pages[b];
      if (!pageA && !pageB) return 0;
      if (!pageA) return 1;
      if (!pageB) return -1;
      const ao = Number.isFinite(Number(pageA.sortKey))
        ? Number(pageA.sortKey)
        : (Number.isFinite(Number(pageA.order)) ? Number(pageA.order) : 0);
      const bo = Number.isFinite(Number(pageB.sortKey))
        ? Number(pageB.sortKey)
        : (Number.isFinite(Number(pageB.order)) ? Number(pageB.order) : 0);
      if (ao !== bo) return ao - bo;
      return a.localeCompare(b, "zh-CN");
    }));
    return map;
  }

  // 统一修正页面的 sortKey/order 字段，保证排序字段可用。
  function normalizeAllSiblingOrders(pages = state.pages) {
    Object.keys(pages).forEach((name) => {
      const page = pages[name];
      if (!page) return;
      const sortKey = Number.isFinite(Number(page.sortKey))
        ? Number(page.sortKey)
        : (Number.isFinite(Number(page.order)) ? Number(page.order) : 0);
      page.sortKey = sortKey;
      page.order = sortKey;
    });
  }

  // 计算给定父节点下下一个可用排序值。
  function nextSortKeyForParent(parent) {
    const parentKey = parent || null;
    let maxSortKey = -1;
    Object.keys(state.pages).forEach((name) => {
      if ((state.pages[name].parent || null) !== parentKey) return;
      const page = state.pages[name];
      const v = Number.isFinite(Number(page.sortKey))
        ? Number(page.sortKey)
        : Number(page.order);
      if (Number.isFinite(v) && v > maxSortKey) maxSortKey = v;
    });
    return maxSortKey + 1;
  }

  // 判断 candidateParent 是否为 nodeName 的后代（用于防环）。
  function isDescendant(candidateParent, nodeName) {
    if (!candidateParent || !nodeName || !state.pages[candidateParent] || !state.pages[nodeName]) return false;
    let p = candidateParent;
    const seen = new Set();
    while (p && state.pages[p] && !seen.has(p)) {
      if (p === nodeName) return true;
      seen.add(p);
      p = state.pages[p].parent;
    }
    return false;
  }

  // 生成页面树路径文本（祖先 / 当前页）。
  function buildPagePath(name) {
    if (!state.pages[name]) return name;
    const segs = [name];
    let p = state.pages[name].parent;
    const seen = new Set([name]);
    while (p && state.pages[p] && !seen.has(p)) {
      segs.unshift(p);
      seen.add(p);
      p = state.pages[p].parent;
    }
    return segs.join(" / ");
  }

  // 生成回收站项路径，尽量还原其原始层级上下文。
  function buildTrashPath(name) {
    if (!state.trash[name]) return name;
    const segs = [name];
    const seen = new Set([name]);
    let parent = state.trash[name].parent;

    // 先沿回收站内 parent 链回溯；若断链再尝试拼接在 pages 中仍存在的祖先。
    while (parent && !seen.has(parent)) {
      seen.add(parent);
      segs.unshift(parent);
      if (state.trash[parent]) {
        parent = state.trash[parent].parent;
        continue;
      }
      if (state.pages[parent]) {
        let p = state.pages[parent].parent;
        const seenPages = new Set([parent]);
        while (p && state.pages[p] && !seenPages.has(p)) {
          segs.unshift(p);
          seenPages.add(p);
          p = state.pages[p].parent;
        }
      }
      break;
    }

    return segs.join(" / ");
  }

  // 统一格式化保存时间（24 小时制）。
  function formatSaveTime(date = new Date()) {
    return date.toLocaleTimeString("zh-CN", { hour12: false });
  }

  // 当前是否使用编辑器适配器模式（而不是原生 contenteditable）。
  function isAdapterEditorMode() {
    const adapter = state.editorAdapter;
    return Boolean(
      adapter
      && typeof adapter.getHtml === "function"
      && typeof adapter.setHtml === "function"
    );
  }

  // 记录当前编辑选区，用于保存后尽量恢复光标位置。
  function captureEditorSelectionSnapshot() {
    if (isAdapterEditorMode()) return null;
    if (!dom.editor) return null;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!dom.editor.contains(range.commonAncestorContainer)) return null;
    return range.cloneRange();
  }

  // 恢复之前捕获的选区，避免保存后光标丢失。
  function restoreEditorSelectionSnapshot(rangeSnapshot, shouldFocus = false) {
    if (isAdapterEditorMode()) return;
    if (!rangeSnapshot || !dom.editor) return;
    const sel = window.getSelection();
    if (!sel) return;
    try {
      sel.removeAllRanges();
      sel.addRange(rangeSnapshot);
      if (shouldFocus && document.activeElement !== dom.editor) {
        dom.editor.focus({ preventScroll: true });
      }
    } catch {}
  }

  // 按页面树层级渲染左侧页面列表。
  function renderPageList() {
    const map = getChildrenMap();
    dom.pageList.innerHTML = "";
    // 递归渲染：每深入一层增加缩进，并附带当前页/选中态。
    const append = (name, depth) => {
      const page = state.pages[name];
      if (!page) return;
      const item = document.createElement("div");
      const activeCls = name === state.currentPage ? " active" : "";
      const selectedCls = name === state.selectedPage ? " selected" : "";
      item.className = `page-item${activeCls}${selectedCls}`;
      item.style.marginLeft = `${depth * 16}px`;
      item.dataset.page = name;
      item.draggable = true;
      const wc = (page.content || "").replace(/<[^>]+>/g, "").replace(/\s+/g, "").length;
      const sortKey = Number.isFinite(Number(page.sortKey))
        ? Number(page.sortKey)
        : (Number.isFinite(Number(page.order)) ? Number(page.order) : 0);
      const nameEl = document.createElement("span");
      nameEl.textContent = name;
      const metaEl = document.createElement("span");
      metaEl.className = "meta-text";
      metaEl.textContent = t("wiki.pageMeta", { count: wc, sortKey });
      item.appendChild(nameEl);
      item.appendChild(metaEl);
      item.addEventListener("click", () => openPage(name));
      dom.pageList.appendChild(item);
      // 深度优先渲染子节点，保持树结构可视化。
      (map[name] || []).forEach((child) => append(child, depth + 1));
    };
    (map.__root__ || []).forEach((root) => append(root, 0));
  }

  // 渲染回收站列表，并按删除时间/层级排序展示。
  function renderTrashList() {
    if (!dom.trashList) return;
    dom.trashList.innerHTML = "";
    const names = Object.keys(state.trash || {});
    if (!names.length) {
      dom.trashList.innerHTML = `<div class="trash-item-meta">${escapeHtml(t("wiki.trashEmpty"))}</div>`;
      return;
    }
    names
      .map((name) => ({ name, ...state.trash[name] }))
      .sort((a, b) => {
        // 先按删除时间倒序，再按 root/depth/sortKey 保持同树结构顺序。
        const ad = new Date(a.deletedAt || 0).getTime();
        const bd = new Date(b.deletedAt || 0).getTime();
        if (ad !== bd) return bd - ad;
        if ((a.root || a.name) !== (b.root || b.name)) return (a.root || a.name).localeCompare(b.root || b.name, "zh-CN");
        if (a.depth !== b.depth) return a.depth - b.depth;
        return ((a.sortKey ?? a.order) || 0) - ((b.sortKey ?? b.order) || 0);
      })
      .forEach((item) => {
        const root = item.root || item.name;
        const div = document.createElement("div");
        div.className = `page-item${item.depth === 0 ? " trash-node-root" : ""}`;
        div.style.marginLeft = `${item.depth * 16}px`;
        div.dataset.trashName = item.name;
        div.dataset.trashRoot = root;
        const when = item.deletedAt ? new Date(item.deletedAt).toLocaleString() : "";
        const nameEl = document.createElement("span");
        nameEl.textContent = item.name;
        const metaEl = document.createElement("span");
        metaEl.className = "meta-text";
        const depthLabel = item.depth === 0 ? t("wiki.trashDepthRoot") : t("wiki.trashDepth", { depth: item.depth });
        metaEl.textContent = `${depthLabel}${t("common.separator")}${when}`;
        div.appendChild(nameEl);
        div.appendChild(metaEl);
        dom.trashList.appendChild(div);
      });
  }

  // 创建页面并插入到指定父节点下。
  function createPage(name, content = "<p></p>", parent = null) {
    const clean = sanitizeName(name);
    if (!clean) return setStatus(t("error.pageNameRequired")), false;
    if (state.pages[clean]) return setStatus(t("error.pageExists", { name: clean })), false;
    const safeParent = parent && state.pages[parent] ? parent : null;
    const sortKey = nextSortKeyForParent(safeParent);
    state.pages[clean] = {
      title: clean,
      content: sanitizeHtml(content),
      pageBackground: PAGE_BG_DEFAULT,
      parent: safeParent,
      sortKey,
      order: sortKey
    };
    persistPages();
    renderPageList();
    setStatus(t("status.pageCreated", { name: clean }));
    return true;
  }

  // 自动生成不冲突的页面名称（如 页面1、页面2）。
  function buildAutoPageName(prefix = t("page.defaultPrefix")) {
    const base = sanitizeName(prefix) || t("page.defaultPrefix");
    let index = 1;
    while (state.pages[`${base}${index}`]) index += 1;
    return `${base}${index}`;
  }

  // 创建一页默认模板内容的新页面，返回实际名称。
  function createAutoPage(parent = null, prefix = t("page.defaultPrefix")) {
    const name = buildAutoPageName(prefix);
    const ok = createPage(name, `<h1>${escapeHtml(name)}</h1><p><br></p>`, parent);
    return ok ? name : "";
  }

  // 打开页面：必要时自动创建、加载内容并刷新选中状态。
  function openPage(name) {
    const clean = sanitizeName(name);
    // 从回收站预览态切回正常页面态。
    state.trashPreviewName = "";
    // 切页前先静默保存当前页，避免编辑丢失。
    if (state.currentPage && clean !== state.currentPage) {
      saveCurrentPage(true);
    }
    // 允许“输入即打开”：若页面不存在则按当前页创建子页。
    if (!state.pages[clean]) {
      const created = createPage(clean, t("content.newPage", { title: escapeHtml(clean) }), state.currentPage || null);
      if (!created) return;
    }
    state.currentPage = clean;
    state.selectedPage = clean;
    const page = state.pages[clean];
    writeEditorHtml(page.content || "<p></p>");
    applyEditorBackground(page.pageBackground);
    renderPageList();
    setStatus(t("status.currentPage", { path: buildPagePath(clean) }));
  }

  // 预览回收站页面（只读），切换编辑区显示内容。
  function previewTrashPage(name) {
    const clean = sanitizeName(name);
    if (!clean || !state.trash[clean]) return false;

    if (state.autoSaveTimer) {
      clearTimeout(state.autoSaveTimer);
      state.autoSaveTimer = null;
    }
    if (!state.trashPreviewName && state.currentPage && state.pages[state.currentPage]) {
      saveCurrentPage(true);
    }

    state.trashPreviewName = clean;
    writeEditorHtml(state.trash[clean].content || "<p></p>");
    applyEditorBackground(state.trash[clean].pageBackground);
    setStatus(t("status.trashPath", { path: buildTrashPath(clean) }));
    return true;
  }

  // 保存当前页面内容，支持静默模式（自动保存）。
  function saveCurrentPage(silent = false) {
    if (state.trashPreviewName) {
      if (!silent) setStatus(t("error.trashPreviewReadOnlySave"));
      return false;
    }
    if (!state.currentPage || !state.pages[state.currentPage]) {
      if (!silent) setStatus(t("error.openOrCreateFirst"));
      return false;
    }
    // 保存前快照选区，保存后尽量恢复用户编辑位置。
    const hadEditorFocus = document.activeElement === dom.editor;
    const selectionSnapshot = captureEditorSelectionSnapshot();
    const oldName = state.currentPage;
    const html = sanitizeHtml(readEditorHtml());
    state.pages[oldName] = { ...state.pages[oldName], content: html };
    persistPages();
    renderPageList();
    const path = buildPagePath(state.currentPage);
    const timeText = formatSaveTime();
    setStatus(
      silent
        ? t("status.autoSaved", { path, time: timeText })
        : t("status.saved", { path, time: timeText })
    );
    restoreEditorSelectionSnapshot(selectionSnapshot, hadEditorFocus);
    return true;
  }

  // 移动页面到新父节点下，并自动分配排序值。
  function movePage(name, targetParent) {
    const cleanName = sanitizeName(name);
    if (!cleanName || !state.pages[cleanName]) return false;
    const cleanParent = sanitizeName(targetParent) || null;
    if (cleanParent === cleanName) return setStatus(t("error.parentCannotSelf")), false;
    if (cleanParent && !state.pages[cleanParent]) return setStatus(t("error.targetParentMissing")), false;
    if (cleanParent && isDescendant(cleanParent, cleanName)) return setStatus(t("error.moveToDescendant")), false;
    state.pages[cleanName].parent = cleanParent;
    const sortKey = nextSortKeyForParent(cleanParent);
    state.pages[cleanName].sortKey = sortKey;
    state.pages[cleanName].order = sortKey;
    normalizeAllSiblingOrders(state.pages);
    persistPages();
    renderPageList();
    setStatus(t("status.hierarchyUpdated", { path: buildPagePath(cleanName) }));
    return true;
  }

  // 重命名页面，并同步修正子页面 parent 指向。
  function renamePage(name, newName) {
    const oldName = sanitizeName(name);
    const nextName = sanitizeName(newName);
    if (!oldName || !state.pages[oldName]) return false;
    if (!nextName) return setStatus(t("error.pageNameRequired")), false;
    if (oldName === nextName) return true;
    if (state.pages[nextName]) return setStatus(t("error.pageExists", { name: nextName })), false;

    const oldData = state.pages[oldName];
    delete state.pages[oldName];
    state.pages[nextName] = { ...oldData, title: nextName };
    Object.keys(state.pages).forEach((n) => {
      if (state.pages[n].parent === oldName) state.pages[n].parent = nextName;
    });
    if (state.currentPage === oldName) state.currentPage = nextName;
    if (state.selectedPage === oldName) state.selectedPage = nextName;
    normalizeAllSiblingOrders(state.pages);
    persistPages();
    renderPageList();
    setStatus(t("status.renamed", { oldName, newName: nextName }));
    return true;
  }

  // 收集某页面整棵子树（BFS），用于整树删除/恢复。
  function collectSubtree(rootName) {
    const list = [];
    const queue = [{ name: rootName, depth: 0 }];
    while (queue.length) {
      const current = queue.shift();
      if (!state.pages[current.name]) continue;
      list.push(current);
      Object.keys(state.pages).forEach((n) => {
        if (state.pages[n].parent === current.name) queue.push({ name: n, depth: current.depth + 1 });
      });
    }
    return list;
  }

  // 生成恢复时不冲突的新页面名。
  function uniqueRestoredName(baseName, used) {
    let name = sanitizeName(baseName) || t("page.unnamed");
    if (!used.has(name) && !state.pages[name]) return name;
    let idx = 1;
    const restoreSuffix = t("page.restoreSuffix");
    while (used.has(`${name}(${restoreSuffix}${idx > 1 ? idx : ""})`) || state.pages[`${name}(${restoreSuffix}${idx > 1 ? idx : ""})`]) idx += 1;
    return `${name}(${restoreSuffix}${idx > 1 ? idx : ""})`;
  }

  // 恢复回收站中同一 root 的整棵页面子树。
  function restoreTrashRoot(rootName) {
    const root = sanitizeName(rootName);
    if (!root) return false;
    // 取出同一 root 的整棵子树，并按深度优先恢复（父节点先恢复）。
    const nodes = Object.keys(state.trash)
      .filter((n) => (state.trash[n].root || n) === root)
      .map((n) => ({ oldName: n, ...state.trash[n] }))
      .sort((a, b) => a.depth - b.depth || ((a.sortKey ?? a.order) - (b.sortKey ?? b.order)));
    if (!nodes.length) return false;

    // 为每个节点分配不冲突的新名称，并建立旧名到新名映射。
    const used = new Set();
    const nameMap = {};
    nodes.forEach((node) => {
      const next = uniqueRestoredName(node.oldName, used);
      used.add(next);
      nameMap[node.oldName] = next;
    });

    // 按映射重建页面节点，父节点优先关联恢复后的名称。
    nodes.forEach((node) => {
      const newName = nameMap[node.oldName];
      const parent = node.parent;
      const restoredParent = parent && nameMap[parent] ? nameMap[parent] : (parent && state.pages[parent] ? parent : null);
      const restoredSortKey = nextSortKeyForParent(restoredParent);
      state.pages[newName] = {
        title: newName,
        content: node.content || "<p></p>",
        pageBackground: sanitizePageBackground(node.pageBackground),
        parent: restoredParent,
        sortKey: restoredSortKey,
        order: restoredSortKey
      };
    });

    // 清理回收站源数据并刷新 UI。
    nodes.forEach((node) => { delete state.trash[node.oldName]; });
    normalizeAllSiblingOrders(state.pages);
    persistPages();
    persistTrash();
    renderPageList();
    renderTrashList();
    openPage(nameMap[root] || Object.keys(nameMap)[0]);
    setStatus(t("status.restoredFromTrash", { name: nameMap[root] || root }));
    return true;
  }

  // 彻底清除回收站中同一 root 的所有节点。
  function purgeTrashRoot(rootName) {
    const root = sanitizeName(rootName);
    if (!root) return false;
    const names = Object.keys(state.trash).filter((n) => (state.trash[n].root || n) === root);
    if (!names.length) return false;
    names.forEach((n) => { delete state.trash[n]; });
    if (names.includes(state.trashPreviewName)) state.trashPreviewName = "";
    persistTrash();
    renderTrashList();
    setStatus(t("status.purgedFromTrash", { name: root }));
    return true;
  }

  // 删除页面及其全部子页面，并整体移入回收站。
  function deletePageByName(name) {
    const clean = sanitizeName(name);
    if (!clean || !state.pages[clean]) return false;

    const subtree = collectSubtree(clean);
    // 先将整棵子树镜像写入回收站，再删除原页面，保证可恢复。
    subtree.forEach(({ name: pageName, depth }) => {
      const page = state.pages[pageName];
      state.trash[pageName] = {
        title: page.title || pageName,
        content: page.content || "<p></p>",
        pageBackground: sanitizePageBackground(page.pageBackground),
        parent: page.parent || null,
        sortKey: Number.isFinite(Number(page.sortKey))
          ? Number(page.sortKey)
          : (Number.isFinite(Number(page.order)) ? Number(page.order) : 0),
        order: Number.isFinite(Number(page.sortKey))
          ? Number(page.sortKey)
          : (Number.isFinite(Number(page.order)) ? Number(page.order) : 0),
        root: clean,
        depth,
        deletedAt: new Date().toISOString()
      };
    });

    // 再从 pages 中删除，并重建列表状态。
    subtree.forEach(({ name: pageName }) => { delete state.pages[pageName]; });
    if (subtree.some((n) => n.name === state.selectedPage)) state.selectedPage = "";
    normalizeAllSiblingOrders(state.pages);
    persistPages();
    persistTrash();
    renderPageList();
    renderTrashList();

    // 保证至少存在一个可用页面，并避免 currentPage 指向已删节点。
    if (!Object.keys(state.pages).length) createPage(t("page.home"), t("content.newWiki"), null);
    if (subtree.some((n) => n.name === state.currentPage)) openPage(Object.keys(state.pages)[0]);

    setStatus(t("status.movedToTrash", { name: clean }));
    return true;
  }

  // 仅删除当前页面，直接子页面提升到当前页父级下。
  function deletePageKeepChildrenByName(name) {
    const clean = sanitizeName(name);
    if (!clean || !state.pages[clean]) return false;

    const current = state.pages[clean];
    const parent = current.parent || null;
    const directChildren = Object.keys(state.pages)
      .filter((n) => state.pages[n].parent === clean)
      .sort((a, b) => {
        const ao = Number(state.pages[a].sortKey ?? state.pages[a].order) || 0;
        const bo = Number(state.pages[b].sortKey ?? state.pages[b].order) || 0;
        if (ao !== bo) return ao - bo;
        return a.localeCompare(b, "zh-CN");
      });

    // 先提升直接子节点到被删节点的父级下，保持子树仍可访问。
    directChildren.forEach((childName) => {
      state.pages[childName].parent = parent;
      const nextSortKey = nextSortKeyForParent(parent);
      state.pages[childName].sortKey = nextSortKey;
      state.pages[childName].order = nextSortKey;
    });

    // 仅将当前节点放入回收站（不含其子节点）。
    state.trash[clean] = {
      title: current.title || clean,
      content: current.content || "<p></p>",
      pageBackground: sanitizePageBackground(current.pageBackground),
      parent: current.parent || null,
      sortKey: Number.isFinite(Number(current.sortKey))
        ? Number(current.sortKey)
        : (Number.isFinite(Number(current.order)) ? Number(current.order) : 0),
      order: Number.isFinite(Number(current.sortKey))
        ? Number(current.sortKey)
        : (Number.isFinite(Number(current.order)) ? Number(current.order) : 0),
      root: clean,
      depth: 0,
      deletedAt: new Date().toISOString()
    };

    // 删除当前节点并刷新状态。
    delete state.pages[clean];
    if (state.selectedPage === clean) state.selectedPage = "";

    normalizeAllSiblingOrders(state.pages);
    persistPages();
    persistTrash();
    renderPageList();
    renderTrashList();

    // 当前页被删时，优先打开提升后的子页，其次父页，再次任意页。
    if (!Object.keys(state.pages).length) createPage(t("page.home"), t("content.newWiki"), null);
    if (state.currentPage === clean) {
      const openCandidate = directChildren.find((n) => state.pages[n])
        || (parent && state.pages[parent] ? parent : Object.keys(state.pages)[0]);
      if (openCandidate) openPage(openCandidate);
    }

    setStatus(t("status.deletedPromoteChildren", { name: clean }));
    return true;
  }

  // 获取同父级下兄弟页面列表（按排序值升序）。
  function getSiblingNames(parent) {
    const parentKey = parent || null;
    return Object.keys(state.pages)
      .filter((n) => (state.pages[n].parent || null) === parentKey)
      .sort((a, b) => {
        const ao = Number(state.pages[a].sortKey ?? state.pages[a].order) || 0;
        const bo = Number(state.pages[b].sortKey ?? state.pages[b].order) || 0;
        if (ao !== bo) return ao - bo;
        return a.localeCompare(b, "zh-CN");
      });
  }

  // 在同级内上移/下移页面（交换排序值）。
  function movePageSort(name, direction = "up") {
    const clean = sanitizeName(name);
    if (!clean || !state.pages[clean]) return false;
    if (direction !== "up" && direction !== "down") return false;

    const parent = state.pages[clean].parent || null;
    const siblings = getSiblingNames(parent);
    const idx = siblings.indexOf(clean);
    if (idx === -1) return false;
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= siblings.length) {
      setStatus(direction === "up" ? t("status.alreadyTop") : t("status.alreadyBottom"));
      return false;
    }

    // 通过交换 sortKey 实现同级上移/下移。
    const targetName = siblings[targetIdx];
    const currentSort = Number(state.pages[clean].sortKey ?? state.pages[clean].order) || 0;
    const targetSort = Number(state.pages[targetName].sortKey ?? state.pages[targetName].order) || 0;
    state.pages[clean].sortKey = targetSort;
    state.pages[clean].order = targetSort;
    state.pages[targetName].sortKey = currentSort;
    state.pages[targetName].order = currentSort;

    persistPages();
    renderPageList();
    setStatus(direction === "up" ? t("status.movedUp", { name: clean }) : t("status.movedDown", { name: clean }));
    return true;
  }

  // 手动设置页面排序值并立即重渲染列表。
  function setPageSortKey(name, rawValue) {
    const clean = sanitizeName(name);
    if (!clean || !state.pages[clean]) return false;
    const value = Number(rawValue);
    if (!Number.isFinite(value)) {
      setStatus(t("error.sortMustBeNumber"));
      return false;
    }
    state.pages[clean].sortKey = value;
    state.pages[clean].order = value;
    persistPages();
    renderPageList();
    setStatus(t("status.sortSet", { name: clean, value }));
    return true;
  }

  // 绑定回收站点击/右键菜单的交互行为。
  function bindTrashActions() {
    if (!dom.trashList) return;
    // 单击回收站项：加载该项内容到编辑区做预览。
    dom.trashList.addEventListener("click", (e) => {
      const item = e.target.closest("[data-trash-name]");
      if (!item) return;
      const name = item.getAttribute("data-trash-name") || "";
      previewTrashPage(name);
    });

    // 右键回收站根节点：弹出“恢复/彻底删除”菜单。
    dom.trashList.addEventListener("contextmenu", (e) => {
      const item = e.target.closest("[data-trash-root]");
      if (!item) return;
      e.preventDefault();
      const root = item.getAttribute("data-trash-root") || "";
      dom.trashItemMenu.dataset.trashRoot = root;
      showMenuInViewport(dom.trashItemMenu, e.clientX, e.clientY);
    });

    dom.trashMenuRestoreBtn.addEventListener("click", () => {
      const root = sanitizeName(dom.trashItemMenu.dataset.trashRoot);
      if (!root) return;
      restoreTrashRoot(root);
      dom.trashItemMenu.style.display = "none";
    });

    dom.trashMenuDeleteBtn.addEventListener("click", () => {
      const root = sanitizeName(dom.trashItemMenu.dataset.trashRoot);
      if (!root) return;
      purgeTrashRoot(root);
      dom.trashItemMenu.style.display = "none";
    });
  }

  return {
    sanitizeName,
    normalizePages,
    normalizeTrash,
    renderPageList,
    renderTrashList,
    createAutoPage,
    openPage,
    saveCurrentPage,
    movePage,
    movePageSort,
    setPageSortKey,
    renamePage,
    deletePageByName,
    deletePageKeepChildrenByName,
    bindTrashActions
  };
}
