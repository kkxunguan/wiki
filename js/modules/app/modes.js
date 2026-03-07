export function createModes({ dom, editor }) {
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
