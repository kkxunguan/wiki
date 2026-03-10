import { t } from "../text.js";
import { dom } from "./dom.js";
import { state } from "../document/state.js";
import { setStatus, showMenuInViewport } from "./uiShared.js";

// 创建页面树相关的 UI 事件绑定器。
export function createWikiBindings() {
  const wiki = state.wiki;
  const editor = state.editor;
  const modes = state.modes;
  // 聚焦编辑器，可选择将光标置于末尾。
  function focusEditor(atEnd = false) {
    if (editor && typeof editor.focus === "function") {
      editor.focus(atEnd);
      return;
    }
    if (dom.editor && typeof dom.editor.focus === "function") {
      dom.editor.focus();
    }
  }

  // 绑定顶层操作按钮：新建页、模式切换、页面/回收站切换。
  function bindWikiActions() {
    dom.quickCreatePageBtn.addEventListener("click", () => {
      if (modes.getTreeMode() !== "pages") {
        setStatus(t("error.cannotCreateInTrashView"));
        return;
      }
      const parent = state.selectedPage && state.pages[state.selectedPage] ? state.selectedPage : null;
      const name = wiki.createAutoPage(parent, t("page.defaultPrefix"));
      if (!name) return;
      wiki.openPage(name);
      focusEditor(true);
    });

    dom.modeToggleBtn.addEventListener("click", () => {
      if (state.trashPreviewName) {
        setStatus(t("error.trashPreviewLockToggle"));
        return;
      }
      const toggled = modes.toggleMode();
      if (!toggled) return;
      if (!modes.getIsReadMode()) focusEditor(false);
    });

    dom.showPagesBtn.addEventListener("click", () => {
      modes.setTreeMode("pages");
    });
    dom.showTrashBtn.addEventListener("click", () => {
      modes.setTreeMode("trash");
    });
  }

  function bindPageTreeContextMenu() {

    // 在指定坐标显示页面菜单，并记录目标页面名。
    const showMenu = (x, y, pageName) => {
      dom.pageItemMenu.dataset.page = pageName;
      const page = wiki.sanitizeName(pageName);
      const pageData = page ? state.pages[page] : null;
      const isRootPage = Boolean(pageData && !pageData.parent);
      const toggleBtn = (btn, visible) => {
        if (!btn) return;
        btn.style.display = visible ? "" : "none";
      };
      const canShowRootRestrictedActions = !isRootPage;
      toggleBtn(dom.pageMenuSortUpBtn, canShowRootRestrictedActions);
      toggleBtn(dom.pageMenuSortDownBtn, canShowRootRestrictedActions);
      toggleBtn(dom.pageMenuSetSortBtn, canShowRootRestrictedActions);
      toggleBtn(dom.pageMenuDeleteBtn, canShowRootRestrictedActions);
      if (dom.pageMenuDeleteBtn) dom.pageMenuDeleteBtn.disabled = isRootPage;
      showMenuInViewport(dom.pageItemMenu, x, y);
    };

    // 读取右键菜单当前对应的页面名。
    const getTargetPage = () => wiki.sanitizeName(dom.pageItemMenu.dataset.page);

    const closeRenameDialog = () => {
      if (!dom.renameDialogBackdrop) return;
      dom.renameDialogBackdrop.classList.add("hidden");
      dom.renameDialogBackdrop.dataset.page = "";
      dom.renameDialogBackdrop.dataset.action = "";
      if (dom.renameDialogTitle) dom.renameDialogTitle.textContent = "重命名页面";
      if (dom.renamePageInput) dom.renamePageInput.value = "";
    };

    const openInputDialog = (pageName, action, title, inputValue) => {
      const page = wiki.sanitizeName(pageName);
      if (!page || !dom.renameDialogBackdrop || !dom.renamePageInput) return;
      dom.renameDialogBackdrop.dataset.page = page;
      dom.renameDialogBackdrop.dataset.action = action;
      if (dom.renameDialogTitle) dom.renameDialogTitle.textContent = title;
      dom.renamePageInput.value = String(inputValue ?? "");
      dom.renameDialogBackdrop.classList.remove("hidden");
      requestAnimationFrame(() => {
        dom.renamePageInput.focus();
        dom.renamePageInput.select();
      });
    };

    const openRenameDialog = (pageName) => {
      const currentTitle = state.pages[pageName] ? (state.pages[pageName].title || pageName) : pageName;
      openInputDialog(pageName, "rename", "重命名页面", currentTitle);
    };

    const openSortDialog = (pageName, currentSort) => {
      openInputDialog(pageName, "sort", "设置排序值", String(currentSort ?? 0));
    };

    const submitInputDialog = () => {
      if (!dom.renameDialogBackdrop || !dom.renamePageInput) return;
      const page = wiki.sanitizeName(dom.renameDialogBackdrop.dataset.page);
      const action = dom.renameDialogBackdrop.dataset.action || "rename";
      if (!page) {
        closeRenameDialog();
        return;
      }
      const value = dom.renamePageInput.value;
      const success = action === "sort"
        ? wiki.setPageSortKey(page, value)
        : wiki.renamePage(page, value);
      if (success) {
        closeRenameDialog();
        return;
      }
      requestAnimationFrame(() => {
        dom.renamePageInput.focus();
        dom.renamePageInput.select();
      });
    };

    // 清除编辑器选区与光标，避免树节点操作与编辑区冲突。
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

    dom.pageList.addEventListener("contextmenu", (e) => {
      const item = e.target.closest(".page-item");
      if (!item) return;
      e.preventDefault();
      // 右键时同步选中该节点，确保菜单操作对象明确。
      const pageName = wiki.sanitizeName(item.dataset.page);
      if (pageName) {
        state.selectedPage = pageName;
        wiki.renderPageList();
      }
      showMenu(e.clientX, e.clientY, item.dataset.page || "");
    });

    dom.pageList.addEventListener("click", (e) => {
      const item = e.target.closest(".page-item");
      if (item) {
        clearEditorCaret();
        const pageName = wiki.sanitizeName(item.dataset.page);
        if (pageName) state.selectedPage = pageName;
        return;
      }
      if (!state.selectedPage) return;
      state.selectedPage = "";
      wiki.renderPageList();
    });

    document.addEventListener("click", (e) => {
      const clickedInPageMenu = Boolean(e.target.closest("#pageItemMenu"));
      const clickedInTrashMenu = Boolean(e.target.closest("#trashItemMenu"));
      const clickedInRenameDialog = Boolean(e.target.closest("#renameDialogBackdrop"));
      if (!clickedInPageMenu && dom.pageItemMenu) dom.pageItemMenu.style.display = "none";
      if (!clickedInTrashMenu && dom.trashItemMenu) dom.trashItemMenu.style.display = "none";

      if (!state.selectedPage) return;
      if (modes.getTreeMode() !== "pages") return;
      if (clickedInRenameDialog) return;
      if (e.target.closest(".main")) return;
      if (e.target.closest(".page-item")) return;
      if (clickedInPageMenu) return;
      state.selectedPage = "";
      wiki.renderPageList();
    });

    if (dom.pageMenuRenameBtn) {
      dom.pageMenuRenameBtn.addEventListener("click", () => {
        const page = getTargetPage();
        dom.pageItemMenu.style.display = "none";
        if (!page) return;
        requestAnimationFrame(() => openRenameDialog(page));
      });
    }

    if (dom.renameDialogCancelBtn) {
      dom.renameDialogCancelBtn.addEventListener("click", () => {
        closeRenameDialog();
      });
    }

    if (dom.renameDialogConfirmBtn) {
      dom.renameDialogConfirmBtn.addEventListener("click", () => {
        submitInputDialog();
      });
    }

    if (dom.renamePageInput) {
      dom.renamePageInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          submitInputDialog();
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          closeRenameDialog();
        }
      });
    }

    if (dom.renameDialogBackdrop) {
      dom.renameDialogBackdrop.addEventListener("click", (e) => {
        if (e.target === dom.renameDialogBackdrop) closeRenameDialog();
      });
    }

    dom.pageMenuNewChildBtn.addEventListener("click", () => {
      const parent = getTargetPage();
      if (!parent) return;
      const name = wiki.createAutoPage(parent, t("page.defaultPrefix"));
      if (!name) return;
      wiki.openPage(name);
      focusEditor(true);
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
      dom.pageItemMenu.style.display = "none";
      requestAnimationFrame(() => openSortDialog(page, current));
    });

    dom.pageMenuDeleteBtn.addEventListener("click", () => {
      const page = getTargetPage();
      if (!page) return;
      wiki.deletePageKeepChildrenByName(page);
      dom.pageItemMenu.style.display = "none";
    });
  }

  // 绑定页面树拖拽逻辑，用于调整页面父子层级。
  function bindPageTreeDragDrop() {
    let draggingPage = "";
    // 清除拖拽高亮状态。
    function clearDragMarks(includeDragging = false) {
      const selector = includeDragging
        ? ".page-item.drag-over, .page-item.dragging"
        : ".page-item.drag-over";
      dom.pageList.querySelectorAll(selector)
        .forEach((el) => el.classList.remove("drag-over", "drag-before", "drag-after", "dragging"));
    }

    dom.pageList.addEventListener("dragstart", (e) => {
      const item = e.target.closest(".page-item");
      if (!item) return;
      // 记录拖拽源页面名，后续 drop 用于执行 movePage。
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
      const item = e.target.closest(".page-item");
      if (!item) return;
      e.preventDefault();
      // 拖拽悬停时仅给目标节点高亮，不直接修改数据。
      clearDragMarks();
      item.classList.add("drag-over");
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    });

    dom.pageList.addEventListener("drop", (e) => {
      const item = e.target.closest(".page-item");
      if (!item || !draggingPage) return;
      e.preventDefault();
      const targetPage = item.dataset.page || "";
      clearDragMarks();
      if (!targetPage || draggingPage === targetPage) return;
      // drop 时将拖拽源挂到目标节点下，形成新的父子关系。
      wiki.movePage(draggingPage, targetPage);
      if (state.currentPage === draggingPage) wiki.openPage(draggingPage);
    });
  }

  // 统一绑定页面树相关全部事件。
  function bindAll() {
    bindWikiActions();
    bindPageTreeContextMenu();
    bindPageTreeDragDrop();
  }

  return {
    bindAll
  };
}
