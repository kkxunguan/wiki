import { t } from "../i18n.js";

export function createModes({ dom, editor }) {
  const MODE_STORAGE_KEY = "wiki-mode-v1";
  const MODE_READ = "read";
  const MODE_EDIT = "edit";

  function loadModeFromStorage() {
    try {
      const raw = localStorage.getItem(MODE_STORAGE_KEY);
      if (raw === MODE_EDIT) return false;
      if (raw === MODE_READ) return true;
    } catch {}
    return true;
  }

  function saveModeToStorage() {
    try {
      localStorage.setItem(MODE_STORAGE_KEY, isReadMode ? MODE_READ : MODE_EDIT);
    } catch {}
  }

  let isReadMode = loadModeFromStorage();
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
    dom.modeToggleBtn.textContent = isReadMode ? t("mode.edit") : t("mode.read");
    if (isReadMode) {
      if (dom.contextMenu) dom.contextMenu.style.display = "none";
      if (dom.tableToolBar) dom.tableToolBar.style.display = "none";
      if (dom.imageToolMenu) dom.imageToolMenu.style.display = "none";
      if (dom.palettePanel) dom.palettePanel.style.display = "none";
      if (dom.fontSizePanel) dom.fontSizePanel.style.display = "none";
      if (dom.tablePanel) dom.tablePanel.style.display = "none";
    }
    saveModeToStorage();
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

  function toggleMode() {
    isReadMode = !isReadMode;
    applyMode();
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
    getIsReadMode: () => isReadMode
  };
}
