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

  // 绑定页面树右键菜单、重命名和相关点击行为。
  function bindPageTreeContextMenu() {
    let renamingPage = "";
    let renameInputEl = null;
    let renamingItemEl = null;
    let renamingNameSpan = null;
    let renamingMetaSpan = null;
    let lastClickPage = "";
    let lastClickAt = 0;

    // 在指定坐标显示页面菜单，并记录目标页面名。
    const showMenu = (x, y, pageName) => {
      dom.pageItemMenu.dataset.page = pageName;
      showMenuInViewport(dom.pageItemMenu, x, y);
    };

    // 读取右键菜单当前对应的页面名。
    const getTargetPage = () => wiki.sanitizeName(dom.pageItemMenu.dataset.page);
    // 在树列表中查找对应页面节点元素。
    const findPageItemEl = (pageName) => Array.from(dom.pageList.querySelectorAll(".page-item"))
      .find((el) => wiki.sanitizeName(el.dataset.page) === pageName);

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

    // 关闭重命名输入框并恢复节点原始显示。
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

    // 提交重命名结果并在成功后打开新页面名。
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

    // 在指定页面节点上展示内联重命名输入框。
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
      // 右键时同步选中该节点，确保菜单操作对象明确。
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
          // 双击触发内联重命名；单击仅更新选中态。
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
      // 点击树区域外时清空选中态，避免误操作。
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

  // 绑定页面树拖拽逻辑，用于调整页面父子层级。
  function bindPageTreeDragDrop() {
    let draggingPage = "";
    // 判断当前是否处于重命名态，重命名时禁用拖拽。
    const isRenamingPage = () => Boolean(dom.pageList.querySelector(".page-item.renaming"));

    // 清除拖拽高亮状态。
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
      if (isRenamingPage()) return;
      const item = e.target.closest(".page-item");
      if (!item) return;
      e.preventDefault();
      // 拖拽悬停时仅给目标节点高亮，不直接修改数据。
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
