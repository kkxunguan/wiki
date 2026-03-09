import { t } from "../text.js";
import { dom } from "./dom.js";
import { state } from "../document/state.js";

// Manages pages/trash tree view mode and per-page lock mode.
export function createModes() {
  let treeMode = "pages";
  let currentReadMode = false;

  function getCurrentPage() {
    if (!state.currentPage) return null;
    return state.pages[state.currentPage] || null;
  }

  function isCurrentPageLocked() {
    const page = getCurrentPage();
    return Boolean(page && page.locked);
  }

  function resolveReadOnlyState() {
    return Boolean(state.trashPreviewName) || isCurrentPageLocked();
  }

  function applyTreeMode() {
    const showPages = treeMode === "pages";
    dom.pageList.classList.toggle("hidden", !showPages);
    dom.trashList.classList.toggle("hidden", showPages);
    dom.showPagesBtn.classList.toggle("active", showPages);
    dom.showTrashBtn.classList.toggle("active", !showPages);
    dom.quickCreatePageBtn.disabled = !showPages;
  }

  function applyMode() {
    const hasCurrentPage = Boolean(getCurrentPage());
    const inTrashPreview = Boolean(state.trashPreviewName);
    const currentPageLocked = isCurrentPageLocked();
    const isReadMode = resolveReadOnlyState();
    currentReadMode = isReadMode;

    document.body.classList.toggle("read-mode", isReadMode);
    document.body.classList.toggle("trash-preview-mode", inTrashPreview);
    document.body.classList.toggle("page-locked-mode", !inTrashPreview && currentPageLocked);
    if (state.editor && typeof state.editor.setReadOnly === "function") {
      state.editor.setReadOnly(isReadMode);
    }

    if (!dom.modeToggleBtn) return;
    if (inTrashPreview) {
      dom.modeToggleBtn.disabled = true;
      dom.modeToggleBtn.textContent = t("mode.lockInTrashPreview");
      return;
    }

    dom.modeToggleBtn.disabled = !hasCurrentPage;
    dom.modeToggleBtn.textContent = isCurrentPageLocked() ? t("mode.unlock") : t("mode.lock");
  }

  function setCurrentPageLocked(nextLocked) {
    if (state.trashPreviewName) return false;
    const pageName = state.currentPage;
    const page = getCurrentPage();
    if (!pageName || !page) return false;
    if (!state.wiki || typeof state.wiki.setPageLocked !== "function") return false;

    const targetLocked = Boolean(nextLocked);
    const currentLocked = Boolean(page.locked);
    if (targetLocked === currentLocked) {
      applyMode();
      return true;
    }

    // Locking should capture latest unsaved content once before entering read-only mode.
    if (targetLocked && state.autoSaveTimer) {
      clearTimeout(state.autoSaveTimer);
      state.autoSaveTimer = null;
      if (typeof state.wiki.saveCurrentPage === "function") state.wiki.saveCurrentPage(true);
    }

    return state.wiki.setPageLocked(pageName, targetLocked);
  }

  function switchToEditMode() {
    if (state.trashPreviewName) {
      applyMode();
      return false;
    }
    return setCurrentPageLocked(false);
  }

  function switchToReadMode() {
    if (state.trashPreviewName) {
      applyMode();
      return true;
    }
    return setCurrentPageLocked(true);
  }

  function toggleMode() {
    if (state.trashPreviewName) {
      applyMode();
      return false;
    }
    return setCurrentPageLocked(!isCurrentPageLocked());
  }

  function setTreeMode(mode) {
    treeMode = mode === "trash" ? "trash" : "pages";
    applyTreeMode();
  }

  return {
    applyMode,
    applyTreeMode,
    switchToEditMode,
    switchToReadMode,
    toggleMode,
    setTreeMode,
    getTreeMode: () => treeMode,
    getIsReadMode: () => currentReadMode
  };
}
