import { dom } from "./modules/dom.js";
import { STORAGE_KEY, STORAGE_TRASH_KEY, AUTO_SAVE_DELAY_MS, state } from "./modules/state.js";
import { loadPages, savePages, loadJson, saveJson } from "./modules/storage.js";
import { createPanels } from "./modules/panels.js";
import { createEditor } from "./modules/editor.js";
import { createWiki } from "./modules/wiki.js";
import { createTableModule } from "./modules/table.js";

function setStatus(text) {
  const content = String(text || "");

  const currentPageMatch = content.match(/^当前页面：(.+)$/);
  if (currentPageMatch) {
    if (dom.pagePathEl) dom.pagePathEl.textContent = currentPageMatch[1].trim();
    dom.statusEl.textContent = "";
    return;
  }

  const saveMatch = content.match(/^已(?:自动)?保存：(.+?)\s*·\s*(\d{2}:\d{2}:\d{2})$/);
  if (saveMatch) {
    if (dom.pagePathEl) dom.pagePathEl.textContent = saveMatch[1].trim();
    dom.statusEl.textContent = `已自动保存：${saveMatch[2]}`;
    return;
  }

  const trashPathMatch = content.match(/^回收站路径：(.+)$/);
  if (trashPathMatch) {
    if (dom.pagePathEl) dom.pagePathEl.textContent = trashPathMatch[1].trim();
    dom.statusEl.textContent = "回收站预览";
    return;
  }

  dom.statusEl.textContent = content;
}

function showMenuInViewport(menuEl, clientX, clientY) {
  if (!menuEl) return;
  const margin = 8;
  menuEl.style.visibility = "hidden";
  menuEl.style.display = "block";
  const rect = menuEl.getBoundingClientRect();
  const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
  const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
  const left = Math.min(Math.max(clientX, margin), maxLeft);
  const top = Math.min(Math.max(clientY, margin), maxTop);
  menuEl.style.left = `${left}px`;
  menuEl.style.top = `${top}px`;
  menuEl.style.visibility = "visible";
}

function exportAllToJson() {
  if (state.autoSaveTimer) clearTimeout(state.autoSaveTimer);
  wiki.saveCurrentPage(true);

  const now = new Date();
  const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  const payload = {
    exportedAt: now.toISOString(),
    storageKey: STORAGE_KEY,
    trashStorageKey: STORAGE_TRASH_KEY,
    currentPage: state.currentPage,
    pages: state.pages,
    trash: state.trash
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `wiki-backup-${ts}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setStatus("已导出 JSON 备份");
}

function normalizeImportedPagesPayload(parsed) {
  if (!parsed || typeof parsed !== "object") return null;
  if (parsed.pages && typeof parsed.pages === "object") return parsed.pages;
  return parsed;
}

function normalizeImportedTrashPayload(parsed) {
  if (!parsed || typeof parsed !== "object") return null;
  if (parsed.trash && typeof parsed.trash === "object") return parsed.trash;
  return null;
}

function importFromJsonText(rawText, mode = "merge") {
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    setStatus("导入失败：JSON 格式无效");
    return;
  }

  const incomingPages = normalizeImportedPagesPayload(parsed);
  const incomingTrash = normalizeImportedTrashPayload(parsed);
  const hasPages = incomingPages && typeof incomingPages === "object";
  const hasTrash = incomingTrash && typeof incomingTrash === "object";
  if (!hasPages && !hasTrash) {
    setStatus("导入失败：未找到 pages / trash 数据");
    return;
  }

  if (state.autoSaveTimer) clearTimeout(state.autoSaveTimer);
  wiki.saveCurrentPage(true);

  let importedCount = 0;
  let overwrittenCount = 0;
  let importedTrashCount = 0;
  let overwrittenTrashCount = 0;

  if (mode === "replace") {
    const nextPages = {};
    if (hasPages) {
      Object.keys(incomingPages).forEach((name) => {
        const key = wiki.sanitizeName(name);
        if (!key) return;
        importedCount += 1;
        nextPages[key] = incomingPages[name];
      });
    }
    const nextTrash = {};
    if (hasTrash) {
      Object.keys(incomingTrash).forEach((name) => {
        const key = wiki.sanitizeName(name);
        if (!key) return;
        importedTrashCount += 1;
        nextTrash[key] = incomingTrash[name];
      });
    }
    state.pages = wiki.normalizePages(nextPages);
    state.trash = wiki.normalizeTrash(nextTrash);
  } else {
    if (hasPages) {
      const merged = { ...state.pages };
      Object.keys(incomingPages).forEach((name) => {
        const key = wiki.sanitizeName(name);
        if (!key) return;
        if (merged[key]) overwrittenCount += 1;
        importedCount += 1;
        merged[key] = incomingPages[name];
      });
      if (importedCount) state.pages = wiki.normalizePages(merged);
    }

    if (hasTrash) {
      const mergedTrash = { ...state.trash };
      Object.keys(incomingTrash).forEach((name) => {
        const key = wiki.sanitizeName(name);
        if (!key) return;
        if (mergedTrash[key]) overwrittenTrashCount += 1;
        importedTrashCount += 1;
        mergedTrash[key] = incomingTrash[name];
      });
      if (importedTrashCount) state.trash = wiki.normalizeTrash(mergedTrash);
    }
  }

  // 去重规则：同名页面已在页面树存在时，不再保留回收站同名项
  let dedupedTrashCount = 0;
  if (Object.keys(state.pages).length && Object.keys(state.trash).length) {
    Object.keys(state.trash).forEach((name) => {
      if (!state.pages[name]) return;
      delete state.trash[name];
      dedupedTrashCount += 1;
    });
  }

  savePages(STORAGE_KEY, state.pages);
  wiki.renderPageList();
  saveJson(STORAGE_TRASH_KEY, state.trash);
  wiki.renderTrashList();

  if (!importedCount && !importedTrashCount) {
    setStatus("导入失败：没有可用数据");
    return;
  }

  const openTarget = state.pages[state.currentPage]
    ? state.currentPage
    : (parsed.currentPage && state.pages[parsed.currentPage] ? parsed.currentPage : Object.keys(state.pages)[0]);
  if (openTarget) wiki.openPage(openTarget);

  const dedupeSuffix = dedupedTrashCount ? `，去重 ${dedupedTrashCount}` : "";
  const modeText = mode === "replace" ? "覆盖" : "合并";
  setStatus(`导入完成（${modeText}）：页面 ${importedCount}（覆盖 ${overwrittenCount}），回收站 ${importedTrashCount}（覆盖 ${overwrittenTrashCount}${dedupeSuffix}）`);
}

let wiki;
let editor;
let isReadMode = true;
let treeMode = "pages";

function applyTreeMode() {
  const showPages = treeMode === "pages";
  dom.pageList.classList.toggle("hidden", !showPages);
  dom.trashList.classList.toggle("hidden", showPages);
  dom.showPagesBtn.classList.toggle("active", showPages);
  dom.showTrashBtn.classList.toggle("active", !showPages);
  dom.quickCreatePageBtn.disabled = !showPages;
}

function applyMode() {
  document.body.classList.toggle("read-mode", isReadMode);
  editor.setReadOnly(isReadMode);
  dom.modeToggleBtn.textContent = isReadMode ? "编辑" : "阅读";
  if (isReadMode) {
    dom.contextMenu.style.display = "none";
    dom.tableToolBar.style.display = "none";
    dom.imageToolMenu.style.display = "none";
    dom.colorPanel.style.display = "none";
    dom.fontSizePanel.style.display = "none";
    dom.tablePanel.style.display = "none";
  }
}

function switchToEditMode() {
  if (!isReadMode) return;
  isReadMode = false;
  applyMode();
}

function switchToReadMode() {
  if (isReadMode) return;
  isReadMode = true;
  applyMode();
}

function queueAutoSave() {
  if (state.autoSaveTimer) clearTimeout(state.autoSaveTimer);
  state.autoSaveTimer = setTimeout(() => {
    if (wiki) wiki.saveCurrentPage(true);
  }, AUTO_SAVE_DELAY_MS);
}

function onContentChanged() {
  editor.updateCounter();
  wiki.renderPreview();
  queueAutoSave();
}

function bindEditorToolbar(panels, tableModule) {
  document.querySelectorAll("[data-cmd]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (editor.isReadOnly()) return;
      const cmd = btn.getAttribute("data-cmd");
      const value = btn.getAttribute("data-value");
      editor.exec(cmd, value);
    });
  });

  dom.formatBlock.addEventListener("change", () => {
    if (editor.isReadOnly()) return;
    editor.exec("formatBlock", dom.formatBlock.value);
  });

  dom.undoBtn.addEventListener("click", () => editor.undoEditor());
  dom.redoBtn.addEventListener("click", () => editor.redoEditor());

  dom.clearFormatBtn.addEventListener("click", () => {
    if (editor.isReadOnly()) return;
    editor.clearFormattingToPlainText();
  });

  dom.insertWikiLinkBtn.addEventListener("click", () => {
    if (editor.isReadOnly()) return;
    const target = prompt("输入 Wiki 链接（页面名 或 页面名#标题）", "首页#欢迎");
    if (!target) return;
    const text = `[[${target.trim()}]]`;
    editor.exec("insertHTML", text);
  });

  dom.imageUrlBtn.addEventListener("click", () => {
    if (editor.isReadOnly()) return;
    const src = prompt("输入图片 URL / DataURL");
    if (!src) return;
    editor.insertImageAtCursor(src.trim(), "image");
  });

  dom.colorBtn.addEventListener("click", () => {
    if (editor.isReadOnly()) return;
    panels.toggle("color");
  });
  dom.fontSizeBtn.addEventListener("click", () => {
    if (editor.isReadOnly()) return;
    panels.toggle("fontSize");
  });
  dom.insertTableBtn.addEventListener("click", () => {
    if (editor.isReadOnly()) return;
    panels.toggle("table");
  });

  tableModule.bindTableInsert(editor.exec);
}

function bindColorPanel(panels) {
  document.execCommand("styleWithCSS", false, true);

  const applyColor = (color) => {
    if (!color) return;
    editor.exec("foreColor", color);
    setStatus(`已设置颜色：${color}`);
    panels.hide("color");
  };

  dom.colorPickerPanel.addEventListener("input", () => applyColor(dom.colorPickerPanel.value));
  dom.colorPresetsPanel.addEventListener("click", (e) => {
    const chip = e.target.closest(".color-chip");
    if (!chip) return;
    applyColor(chip.getAttribute("data-color"));
  });
}

function bindFontSizePanel(panels) {
  dom.fontSizeList.addEventListener("click", (e) => {
    const btn = e.target.closest(".font-size-item");
    if (!btn) return;
    const size = Number(btn.getAttribute("data-size"));
    editor.applyFontSizePx(size);
    panels.hide("fontSize");
  });

  dom.fontSizeCustomApplyBtn.addEventListener("click", () => {
    editor.applyFontSizePx(dom.fontSizeCustomInput.value);
    panels.hide("fontSize");
  });

  dom.fontSizeCustomInput.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    editor.applyFontSizePx(dom.fontSizeCustomInput.value);
    panels.hide("fontSize");
  });
}

function bindContextMenuAndPaste() {
  dom.editor.addEventListener("contextmenu", (e) => {
    if (editor.isReadOnly()) return;
    e.preventDefault();
    showMenuInViewport(dom.contextMenu, e.clientX, e.clientY);
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest("#contextMenu")) dom.contextMenu.style.display = "none";
    if (!e.target.closest("#pageItemMenu")) dom.pageItemMenu.style.display = "none";
    if (!e.target.closest("#trashItemMenu")) dom.trashItemMenu.style.display = "none";
    if (!e.target.closest("#importModeMenu") && !e.target.closest("#importJsonBtn")) dom.importModeMenu.style.display = "none";
  });

  dom.pasteImageBtn.addEventListener("click", async () => {
    if (editor.isReadOnly()) return;
    await editor.pasteImageFromClipboard();
    dom.contextMenu.style.display = "none";
    queueAutoSave();
  });

  dom.editor.addEventListener("paste", (e) => {
    if (editor.isReadOnly()) {
      e.preventDefault();
      return;
    }
    editor.handlePasteEvent(e);
    queueAutoSave();
  });
}

function bindKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    const active = document.activeElement;
    const inInput = active && (
      active.tagName === "INPUT" ||
      active.tagName === "TEXTAREA" ||
      active.tagName === "SELECT" ||
      active.isContentEditable
    );
    if (e.key === "Delete" && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
      if (inInput || editor.isEditorContext()) return;
      if (!state.currentPage) return;
      e.preventDefault();
      wiki.deletePageByName(state.currentPage);
      return;
    }

    if (!editor.isEditorContext()) return;
    if (editor.isReadOnly()) return;
    const isMac = navigator.platform.toUpperCase().includes("MAC");
    const ctrlOrMeta = isMac ? e.metaKey : e.ctrlKey;
    if (!ctrlOrMeta) return;

    const key = e.key.toLowerCase();
    if (key === "z" && !e.shiftKey) {
      e.preventDefault();
      editor.undoEditor();
      return;
    }

    if (key === "y" || (key === "z" && e.shiftKey)) {
      e.preventDefault();
      editor.redoEditor();
    }
  });
}

function bindAutoSaveLifecycle() {
  window.addEventListener("beforeunload", () => {
    if (state.autoSaveTimer) clearTimeout(state.autoSaveTimer);
    wiki.saveCurrentPage(true);
  });
}

function bindWikiActions() {
  dom.trashList.addEventListener("click", (e) => {
    if (!e.target.closest("[data-trash-name]")) return;
    switchToReadMode();
  });

  dom.quickCreatePageBtn.addEventListener("click", () => {
    if (treeMode !== "pages") {
      setStatus("回收站视图下不可新建页面");
      return;
    }
    const parent = state.selectedPage && state.pages[state.selectedPage] ? state.selectedPage : null;
    const name = wiki.createAutoPage(parent, "页面");
    if (!name) return;
    wiki.openPage(name);
    switchToEditMode();
    dom.editor.focus();
  });

  dom.exportJsonBtn.addEventListener("click", () => {
    exportAllToJson();
  });

  dom.importJsonBtn.addEventListener("click", () => {
    const rect = dom.importJsonBtn.getBoundingClientRect();
    showMenuInViewport(dom.importModeMenu, rect.left, rect.bottom + 4);
  });

  dom.importMergeBtn.addEventListener("click", () => {
    dom.importModeMenu.style.display = "none";
    dom.importJsonInput.dataset.mode = "merge";
    dom.importJsonInput.click();
  });

  dom.importReplaceBtn.addEventListener("click", () => {
    dom.importModeMenu.style.display = "none";
    dom.importJsonInput.dataset.mode = "replace";
    dom.importJsonInput.click();
  });

  dom.importJsonInput.addEventListener("change", async () => {
    const file = dom.importJsonInput.files && dom.importJsonInput.files[0];
    dom.importJsonInput.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      importFromJsonText(text, dom.importJsonInput.dataset.mode || "merge");
    } catch {
      setStatus("导入失败：读取文件异常");
    } finally {
      dom.importJsonInput.dataset.mode = "";
    }
  });

  dom.modeToggleBtn.addEventListener("click", () => {
    if (state.trashPreviewName && isReadMode) {
      setStatus("回收站预览仅支持阅读模式");
      return;
    }
    isReadMode = !isReadMode;
    applyMode();
    if (isReadMode) dom.editor.focus();
  });

  dom.showPagesBtn.addEventListener("click", () => {
    treeMode = "pages";
    applyTreeMode();
  });
  dom.showTrashBtn.addEventListener("click", () => {
    treeMode = "trash";
    applyTreeMode();
  });
}

function bindPageTreeContextMenu() {
  let renamingPage = "";
  let renameInputEl = null;
  let renamingItemEl = null;
  let renamingNameSpan = null;
  let renamingMetaSpan = null;
  let lastClickPage = "";
  let lastClickAt = 0;

  const showMenu = (x, y, pageName) => {
    dom.pageItemMenu.dataset.page = pageName;
    showMenuInViewport(dom.pageItemMenu, x, y);
  };

  const getTargetPage = () => wiki.sanitizeName(dom.pageItemMenu.dataset.page);
  const findPageItemEl = (pageName) => Array.from(dom.pageList.querySelectorAll(".page-item"))
    .find((el) => wiki.sanitizeName(el.dataset.page) === pageName);

  const hideRenameInput = () => {
    if (renameInputEl && renameInputEl.parentNode) renameInputEl.remove();
    if (renamingNameSpan) renamingNameSpan.style.visibility = "";
    if (renamingMetaSpan) renamingMetaSpan.style.visibility = "";
    if (renamingItemEl) renamingItemEl.classList.remove("renaming");
    const selection = window.getSelection();
    if (selection) selection.removeAllRanges();
    renameInputEl = null;
    renamingItemEl = null;
    renamingNameSpan = null;
    renamingMetaSpan = null;
    renamingPage = "";
  };

  const commitRename = () => {
    if (!renameInputEl) return;
    const oldName = renamingPage;
    const nextName = wiki.sanitizeName(renameInputEl.value);
    hideRenameInput();
    if (!oldName) return;
    if (!nextName || nextName === oldName) return;
    if (!wiki.renamePage(oldName, nextName)) return;
    wiki.openPage(nextName);
  };

  const showRenameInput = (pageName) => {
    const cleanName = wiki.sanitizeName(pageName);
    if (!cleanName || !state.pages[cleanName]) return;
    if (state.autoSaveTimer) {
      clearTimeout(state.autoSaveTimer);
      state.autoSaveTimer = null;
      wiki.saveCurrentPage(true);
    }

    const item = findPageItemEl(cleanName);
    if (!item) return;
    if (renameInputEl && renamingPage === cleanName) {
      renameInputEl.focus();
      renameInputEl.select();
      return;
    }
    if (renameInputEl) commitRename();

    renamingPage = cleanName;

    const input = document.createElement("input");
    input.type = "text";
    input.className = "title-input page-rename-input";
    input.value = cleanName;
    input.maxLength = 120;
    input.spellcheck = false;
    input.setAttribute("autocomplete", "off");
    input.setAttribute("autocorrect", "off");
    input.setAttribute("autocapitalize", "off");
    input.setAttribute("data-gramm", "false");
    item.style.position = "relative";
    item.classList.add("renaming");
    renamingItemEl = item;
    renamingNameSpan = item.querySelector("span");
    renamingMetaSpan = item.querySelector(".meta-text");
    if (renamingNameSpan) renamingNameSpan.style.visibility = "hidden";
    if (renamingMetaSpan) renamingMetaSpan.style.visibility = "hidden";
    item.appendChild(input);
    renameInputEl = input;

    input.focus();
    const cursorPos = input.value.length;
    input.setSelectionRange(cursorPos, cursorPos);

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitRename();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        hideRenameInput();
      }
    });

    input.addEventListener("click", (e) => e.stopPropagation());
    input.addEventListener("dblclick", (e) => e.stopPropagation());
    input.addEventListener("blur", () => {
      // 失焦时：有输入则提交，空输入则保持原名并关闭输入框
      const nextName = wiki.sanitizeName(input.value);
      if (!nextName) {
        hideRenameInput();
        return;
      }
      commitRename();
    });
  };

  dom.pageList.addEventListener("contextmenu", (e) => {
    const item = e.target.closest(".page-item");
    if (!item) return;
    e.preventDefault();
    const pageName = wiki.sanitizeName(item.dataset.page);
    if (pageName) {
      state.selectedPage = pageName;
      wiki.renderPageList();
    }
    showMenu(e.clientX, e.clientY, item.dataset.page || "");
  });

  dom.pageList.addEventListener("click", (e) => {
    if (e.target.closest(".page-rename-input")) return;
    const item = e.target.closest(".page-item");
    if (item) {
      if (renameInputEl && item !== renamingItemEl) hideRenameInput();
      const pageName = wiki.sanitizeName(item.dataset.page);
      if (pageName) {
        state.selectedPage = pageName;
        const now = Date.now();
        if (lastClickPage === pageName && now - lastClickAt <= 320) {
          // 节点点击会触发列表重渲染，延后一帧再显示重命名输入框更稳定
          requestAnimationFrame(() => showRenameInput(pageName));
          lastClickPage = "";
          lastClickAt = 0;
        } else {
          lastClickPage = pageName;
          lastClickAt = now;
        }
      }
      return;
    }
    hideRenameInput();
    lastClickPage = "";
    lastClickAt = 0;
    if (!state.selectedPage) return;
    state.selectedPage = "";
    wiki.renderPageList();
  });

  document.addEventListener("click", (e) => {
    if (!state.selectedPage) return;
    if (treeMode !== "pages") return;
    if (e.target.closest(".page-item")) return;
    if (e.target.closest("#pageItemMenu")) return;
    if (e.target.closest(".page-rename-input")) return;
    hideRenameInput();
    state.selectedPage = "";
    wiki.renderPageList();
  });

  dom.pageMenuOpenBtn.addEventListener("click", () => {
    const page = getTargetPage();
    if (!page) return;
    wiki.openPage(page);
    dom.pageItemMenu.style.display = "none";
  });

  dom.pageMenuNewChildBtn.addEventListener("click", () => {
    const parent = getTargetPage();
    if (!parent) return;
    const name = wiki.createAutoPage(parent, "页面");
    if (!name) return;
    wiki.openPage(name);
    switchToEditMode();
    dom.editor.focus();
    dom.pageItemMenu.style.display = "none";
  });

  dom.pageMenuRenameBtn.addEventListener("click", () => {
    const page = getTargetPage();
    if (!page) return;
    showRenameInput(page);
    dom.pageItemMenu.style.display = "none";
  });

  dom.pageMenuSortUpBtn.addEventListener("click", () => {
    const page = getTargetPage();
    if (!page) return;
    wiki.movePageSort(page, "up");
    dom.pageItemMenu.style.display = "none";
  });

  dom.pageMenuSortDownBtn.addEventListener("click", () => {
    const page = getTargetPage();
    if (!page) return;
    wiki.movePageSort(page, "down");
    dom.pageItemMenu.style.display = "none";
  });

  dom.pageMenuSetSortBtn.addEventListener("click", () => {
    const page = getTargetPage();
    if (!page || !state.pages[page]) return;
    const current = Number(state.pages[page].sortKey ?? state.pages[page].order ?? 0);
    const input = prompt("输入排序值（数字，越小越靠前）", String(current));
    if (input === null) return;
    wiki.setPageSortKey(page, input);
    dom.pageItemMenu.style.display = "none";
  });

  dom.pageMenuMoveRootBtn.addEventListener("click", () => {
    const page = getTargetPage();
    if (!page) return;
    if (!wiki.movePage(page, null)) return;
    dom.pageItemMenu.style.display = "none";
  });

  dom.pageMenuDeleteBtn.addEventListener("click", () => {
    const page = getTargetPage();
    if (!page) return;
    wiki.deletePageByName(page);
    dom.pageItemMenu.style.display = "none";
  });

  dom.pageMenuDeleteKeepChildrenBtn.addEventListener("click", () => {
    const page = getTargetPage();
    if (!page) return;
    wiki.deletePageKeepChildrenByName(page);
    dom.pageItemMenu.style.display = "none";
  });
}

function bindPageTreeDragDrop() {
  let draggingPage = "";
  const isRenamingPage = () => Boolean(dom.pageList.querySelector(".page-item.renaming"));

  function clearDragMarks(includeDragging = false) {
    const selector = includeDragging
      ? ".page-item.drag-over, .page-item.dragging"
      : ".page-item.drag-over";
    dom.pageList.querySelectorAll(selector)
      .forEach((el) => el.classList.remove("drag-over", "drag-before", "drag-after", "dragging"));
  }

  dom.pageList.addEventListener("dragstart", (e) => {
    if (isRenamingPage()) {
      e.preventDefault();
      return;
    }
    const item = e.target.closest(".page-item");
    if (!item) return;
    draggingPage = item.dataset.page || "";
    item.classList.add("dragging");
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", draggingPage);
    }
  });

  dom.pageList.addEventListener("dragend", () => {
    draggingPage = "";
    clearDragMarks(true);
  });

  dom.pageList.addEventListener("dragover", (e) => {
    if (isRenamingPage()) return;
    const item = e.target.closest(".page-item");
    if (!item) return;
    e.preventDefault();
    clearDragMarks();
    item.classList.add("drag-over");
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
  });

  dom.pageList.addEventListener("drop", (e) => {
    if (isRenamingPage()) {
      e.preventDefault();
      return;
    }
    const item = e.target.closest(".page-item");
    if (!item || !draggingPage) return;
    e.preventDefault();
    const targetPage = item.dataset.page || "";
    clearDragMarks();
    if (!targetPage || draggingPage === targetPage) return;
    wiki.movePage(draggingPage, targetPage);
    if (state.currentPage === draggingPage) wiki.openPage(draggingPage);
  });
}

async function init() {
  const panels = createPanels(dom);

  editor = createEditor({ dom, state, onContentChanged, queueAutoSave, setStatus });
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

  state.pages = wiki.normalizePages(await loadPages(STORAGE_KEY));
  state.trash = wiki.normalizeTrash(await loadJson(STORAGE_TRASH_KEY, {}));
  if (!Object.keys(state.pages).length) {
    state.pages = wiki.normalizePages({ "首页": { title: "首页", content: "<h1>首页</h1><p>欢迎使用 Wiki。</p>", parent: null } });
  }

  bindEditorToolbar(panels, tableModule);
  bindColorPanel(panels);
  bindFontSizePanel(panels);
  bindContextMenuAndPaste();
  bindKeyboardShortcuts();
  bindAutoSaveLifecycle();
  bindWikiActions();
  bindPageTreeContextMenu();
  bindPageTreeDragDrop();

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
  applyTreeMode();
  wiki.openPage(Object.keys(state.pages)[0]);
  applyMode();
  setStatus("已加载");
}

init().catch((err) => {
  console.error(err);
  setStatus("初始化失败，请刷新页面重试");
});
