import { t } from "../text.js";

// 创建阅读/编辑模式与页面树/回收站视图模式管理器。
export function createModes({ dom, editor }) {
  const MODE_STORAGE_KEY = "wiki-mode-v1";
  const MODE_READ = "read";
  const MODE_EDIT = "edit";

  // 从本地存储读取上次模式，默认阅读模式。
  function loadModeFromStorage() {
    try {
      const raw = localStorage.getItem(MODE_STORAGE_KEY);
      if (raw === MODE_EDIT) return false;
      if (raw === MODE_READ) return true;
    } catch {}
    return true;
  }

  // 将当前模式写回本地存储。
  function saveModeToStorage() {
    try {
      localStorage.setItem(MODE_STORAGE_KEY, isReadMode ? MODE_READ : MODE_EDIT);
    } catch {}
  }

  let isReadMode = loadModeFromStorage();
  let treeMode = "pages";

  // 应用左侧树视图（页面列表/回收站列表）显示状态。
  function applyTreeMode() {
    const showPages = treeMode === "pages";
    dom.pageList.classList.toggle("hidden", !showPages);
    dom.trashList.classList.toggle("hidden", showPages);
    dom.showPagesBtn.classList.toggle("active", showPages);
    dom.showTrashBtn.classList.toggle("active", !showPages);
    dom.quickCreatePageBtn.disabled = !showPages;
  }

  // 应用阅读/编辑模式到页面和编辑器。
  function applyMode() {
    document.body.classList.toggle("read-mode", isReadMode);
    editor.setReadOnly(isReadMode);
    dom.modeToggleBtn.textContent = isReadMode ? t("mode.edit") : t("mode.read");
    saveModeToStorage();
  }

  // 切换到编辑模式（若已是编辑模式则跳过）。
  function switchToEditMode() {
    if (!isReadMode) return;
    isReadMode = false;
    applyMode();
  }

  // 切换到阅读模式（若已是阅读模式则跳过）。
  function switchToReadMode() {
    if (isReadMode) return;
    isReadMode = true;
    applyMode();
  }

  // 在阅读/编辑两种模式间切换。
  function toggleMode() {
    isReadMode = !isReadMode;
    applyMode();
  }

  // 设置树视图模式，仅允许 pages 或 trash。
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
