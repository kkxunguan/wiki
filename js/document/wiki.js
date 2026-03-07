import { t } from "../text.js";

export function createWiki({ dom, state, savePages, saveTrash, showMenuInViewport, setStatus }) {

  function sanitizeName(name) {
    return (name || "").trim();
  }

  const PAGE_BG_DEFAULT = "";
  function sanitizeRgbChannel(channel) {
    const n = Number(channel);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    return n;
  }

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

  function applyEditorBackground(color) {
    if (!dom.editorWrap) return;
    const next = sanitizePageBackground(color);
    dom.editorWrap.style.background = next || "";
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

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
      if (blockedTags.has(el.tagName)) {
        el.remove();
        return;
      }

      if (el.classList && el.classList.length) {
        transientClasses.forEach((name) => el.classList.remove(name));
        if (!el.classList.length) el.removeAttribute("class");
      }

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

  function getEditorAdapter() {
    const adapter = state.editorAdapter;
    if (!adapter) return null;
    if (typeof adapter.getHtml !== "function") return null;
    if (typeof adapter.setHtml !== "function") return null;
    return adapter;
  }

  function readEditorHtml() {
    const adapter = getEditorAdapter();
    if (adapter) return String(adapter.getHtml() || "");
    if (!dom.editor) return "";
    return String(dom.editor.innerHTML || "");
  }

  function writeEditorHtml(html) {
    const safeHtml = sanitizeHtml(html);
    const adapter = getEditorAdapter();
    if (adapter) {
      adapter.setHtml(safeHtml);
      return;
    }
    if (dom.editor) dom.editor.innerHTML = safeHtml;
  }

  function persistPages() {
    savePages(state.pages);
  }

  function persistTrash() {
    if (typeof saveTrash === "function") saveTrash(state.trash);
  }

  function normalizePages(source) {
    const out = {};
    const siblingCursor = { __root__: 0 };
    Object.keys(source || {}).forEach((name) => {
      const page = source[name] || {};
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
    Object.keys(out).forEach((name) => {
      const p = out[name].parent;
      if (p === name || (p && !out[p])) out[name].parent = null;
    });
    normalizeAllSiblingOrders(out);
    return out;
  }

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

  function getChildrenMap() {
    const map = { __root__: [] };
    Object.keys(state.pages).forEach((name) => { map[name] = []; });
    Object.keys(state.pages).forEach((name) => {
      const p = state.pages[name].parent;
      if (p && state.pages[p]) map[p].push(name);
      else map.__root__.push(name);
    });
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

  function buildTrashPath(name) {
    if (!state.trash[name]) return name;
    const segs = [name];
    const seen = new Set([name]);
    let parent = state.trash[name].parent;

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

  function formatSaveTime(date = new Date()) {
    return date.toLocaleTimeString("zh-CN", { hour12: false });
  }

  function isAdapterEditorMode() {
    const adapter = state.editorAdapter;
    return Boolean(
      adapter
      && typeof adapter.getHtml === "function"
      && typeof adapter.setHtml === "function"
    );
  }

  function captureEditorSelectionSnapshot() {
    if (isAdapterEditorMode()) return null;
    if (!dom.editor) return null;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!dom.editor.contains(range.commonAncestorContainer)) return null;
    return range.cloneRange();
  }

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

  function renderPageList() {
    const map = getChildrenMap();
    dom.pageList.innerHTML = "";
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
      (map[name] || []).forEach((child) => append(child, depth + 1));
    };
    (map.__root__ || []).forEach((root) => append(root, 0));
  }

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

  function buildAutoPageName(prefix = t("page.defaultPrefix")) {
    const base = sanitizeName(prefix) || t("page.defaultPrefix");
    let index = 1;
    while (state.pages[`${base}${index}`]) index += 1;
    return `${base}${index}`;
  }

  function createAutoPage(parent = null, prefix = t("page.defaultPrefix")) {
    const name = buildAutoPageName(prefix);
    const ok = createPage(name, `<h1>${escapeHtml(name)}</h1><p><br></p>`, parent);
    return ok ? name : "";
  }

  function openPage(name) {
    const clean = sanitizeName(name);
    state.trashPreviewName = "";
    if (state.currentPage && clean !== state.currentPage) {
      saveCurrentPage(true);
    }
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

  function saveCurrentPage(silent = false) {
    if (state.trashPreviewName) {
      if (!silent) setStatus(t("error.trashPreviewReadOnlySave"));
      return false;
    }
    if (!state.currentPage || !state.pages[state.currentPage]) {
      if (!silent) setStatus(t("error.openOrCreateFirst"));
      return false;
    }
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

  function uniqueRestoredName(baseName, used) {
    let name = sanitizeName(baseName) || t("page.unnamed");
    if (!used.has(name) && !state.pages[name]) return name;
    let idx = 1;
    const restoreSuffix = t("page.restoreSuffix");
    while (used.has(`${name}(${restoreSuffix}${idx > 1 ? idx : ""})`) || state.pages[`${name}(${restoreSuffix}${idx > 1 ? idx : ""})`]) idx += 1;
    return `${name}(${restoreSuffix}${idx > 1 ? idx : ""})`;
  }

  function restoreTrashRoot(rootName) {
    const root = sanitizeName(rootName);
    if (!root) return false;
    const nodes = Object.keys(state.trash)
      .filter((n) => (state.trash[n].root || n) === root)
      .map((n) => ({ oldName: n, ...state.trash[n] }))
      .sort((a, b) => a.depth - b.depth || ((a.sortKey ?? a.order) - (b.sortKey ?? b.order)));
    if (!nodes.length) return false;

    const used = new Set();
    const nameMap = {};
    nodes.forEach((node) => {
      const next = uniqueRestoredName(node.oldName, used);
      used.add(next);
      nameMap[node.oldName] = next;
    });

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

  function deletePageByName(name) {
    const clean = sanitizeName(name);
    if (!clean || !state.pages[clean]) return false;

    const subtree = collectSubtree(clean);
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

    subtree.forEach(({ name: pageName }) => { delete state.pages[pageName]; });
    if (subtree.some((n) => n.name === state.selectedPage)) state.selectedPage = "";
    normalizeAllSiblingOrders(state.pages);
    persistPages();
    persistTrash();
    renderPageList();
    renderTrashList();

    if (!Object.keys(state.pages).length) createPage(t("page.home"), t("content.newWiki"), null);
    if (subtree.some((n) => n.name === state.currentPage)) openPage(Object.keys(state.pages)[0]);

    setStatus(t("status.movedToTrash", { name: clean }));
    return true;
  }

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

    directChildren.forEach((childName) => {
      state.pages[childName].parent = parent;
      const nextSortKey = nextSortKeyForParent(parent);
      state.pages[childName].sortKey = nextSortKey;
      state.pages[childName].order = nextSortKey;
    });

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

    delete state.pages[clean];
    if (state.selectedPage === clean) state.selectedPage = "";

    normalizeAllSiblingOrders(state.pages);
    persistPages();
    persistTrash();
    renderPageList();
    renderTrashList();

    if (!Object.keys(state.pages).length) createPage(t("page.home"), t("content.newWiki"), null);
    if (state.currentPage === clean) {
      const openCandidate = directChildren.find((n) => state.pages[n])
        || (parent && state.pages[parent] ? parent : Object.keys(state.pages)[0]);
      if (openCandidate) openPage(openCandidate);
    }

    setStatus(t("status.deletedPromoteChildren", { name: clean }));
    return true;
  }

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

  function bindTrashActions() {
    if (!dom.trashList) return;
    dom.trashList.addEventListener("click", (e) => {
      const item = e.target.closest("[data-trash-name]");
      if (!item) return;
      const name = item.getAttribute("data-trash-name") || "";
      previewTrashPage(name);
    });

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

