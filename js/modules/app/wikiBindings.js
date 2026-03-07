import { t } from "../i18n.js";

export function createWikiBindings({
  dom,
  state,
  wiki,
  editor,
  modes,
  setStatus,
  showMenuInViewport,
  exportAllToJson,
  importFromJsonText
}) {
  function focusEditor(atEnd = false) {
    if (editor && typeof editor.focus === "function") {
      editor.focus(atEnd);
      return;
    }
    if (dom.editor && typeof dom.editor.focus === "function") {
      dom.editor.focus();
    }
  }

  function bindWikiActions() {
    dom.trashList.addEventListener("click", (e) => {
      if (!e.target.closest("[data-trash-name]")) return;
      modes.switchToReadMode();
    });

    dom.quickCreatePageBtn.addEventListener("click", () => {
      if (modes.getTreeMode() !== "pages") {
        setStatus(t("error.cannotCreateInTrashView"));
        return;
      }
      const parent = state.selectedPage && state.pages[state.selectedPage] ? state.selectedPage : null;
      const name = wiki.createAutoPage(parent, t("page.defaultPrefix"));
      if (!name) return;
      wiki.openPage(name);
      modes.switchToEditMode();
      focusEditor(true);
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
        setStatus(t("error.importReadFile"));
      } finally {
        dom.importJsonInput.dataset.mode = "";
      }
    });

    dom.modeToggleBtn.addEventListener("click", () => {
      if (state.trashPreviewName && modes.getIsReadMode()) {
        setStatus(t("error.trashPreviewReadOnlyMode"));
        return;
      }
      modes.toggleMode();
      if (modes.getIsReadMode()) focusEditor(false);
    });

    dom.showPagesBtn.addEventListener("click", () => {
      modes.setTreeMode("pages");
    });
    dom.showTrashBtn.addEventListener("click", () => {
      modes.setTreeMode("trash");
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

    const clearEditorCaret = () => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        if (dom.editor.contains(range.commonAncestorContainer)) {
          selection.removeAllRanges();
        }
      }
      if (document.activeElement === dom.editor) {
        dom.editor.blur();
      }
    };

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
        clearEditorCaret();
        if (renameInputEl && item !== renamingItemEl) hideRenameInput();
        const pageName = wiki.sanitizeName(item.dataset.page);
        if (pageName) {
          state.selectedPage = pageName;
          const now = Date.now();
          if (lastClickPage === pageName && now - lastClickAt <= 320) {
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
      if (modes.getTreeMode() !== "pages") return;
      if (e.target.closest(".main")) return;
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
      const name = wiki.createAutoPage(parent, t("page.defaultPrefix"));
      if (!name) return;
      wiki.openPage(name);
      modes.switchToEditMode();
      focusEditor(true);
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
      const input = prompt(t("prompt.sortValue"), String(current));
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

  function bindAll() {
    bindWikiActions();
    bindPageTreeContextMenu();
    bindPageTreeDragDrop();
  }

  return {
    bindAll,
    bindWikiActions,
    bindPageTreeContextMenu,
    bindPageTreeDragDrop
  };
}
