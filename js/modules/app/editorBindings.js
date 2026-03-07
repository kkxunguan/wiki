import { t } from "../i18n.js";

export function createEditorBindings({
  dom,
  state,
  editor,
  wiki,
  panels,
  tableModule,
  setStatus,
  queueAutoSave,
  showMenuInViewport
}) {
  const SHARED_COLOR_VALUES = [
    "rgb(0, 0, 0)", "rgb(38, 38, 38)", "rgb(89, 89, 89)", "rgb(140, 140, 140)", "rgb(191, 191, 191)",
    "rgb(217, 217, 217)", "rgb(233, 233, 233)", "rgb(245, 245, 245)", "rgb(250, 250, 250)", "rgb(255, 255, 255)",
    "rgb(225, 60, 57)", "rgb(231, 95, 51)", "rgb(235, 144, 58)", "rgb(245, 219, 77)", "rgb(114, 192, 64)",
    "rgb(89, 191, 192)", "rgb(66, 144, 247)", "rgb(54, 88, 226)", "rgb(106, 57, 201)", "rgb(216, 68, 147)",
    "rgb(251, 233, 230)", "rgb(252, 237, 225)", "rgb(252, 239, 212)", "rgb(252, 251, 207)", "rgb(231, 246, 213)",
    "rgb(218, 244, 240)", "rgb(217, 237, 250)", "rgb(224, 232, 250)", "rgb(237, 225, 248)", "rgb(246, 226, 234)",
    "rgb(255, 163, 158)", "rgb(255, 187, 150)", "rgb(255, 213, 145)", "rgb(255, 251, 143)", "rgb(183, 235, 143)",
    "rgb(135, 232, 222)", "rgb(145, 213, 255)", "rgb(173, 198, 255)", "rgb(211, 173, 247)", "rgb(255, 173, 210)",
    "rgb(255, 77, 79)", "rgb(255, 122, 69)", "rgb(255, 169, 64)", "rgb(255, 236, 61)", "rgb(115, 209, 61)",
    "rgb(54, 207, 201)", "rgb(64, 169, 255)", "rgb(89, 126, 247)", "rgb(146, 84, 222)", "rgb(247, 89, 171)",
    "rgb(207, 19, 34)", "rgb(212, 56, 13)", "rgb(212, 107, 8)", "rgb(212, 177, 6)", "rgb(56, 158, 13)",
    "rgb(8, 151, 156)", "rgb(9, 109, 217)", "rgb(29, 57, 196)", "rgb(83, 29, 171)", "rgb(196, 29, 127)",
    "rgb(130, 0, 20)", "rgb(135, 20, 0)", "rgb(135, 56, 0)", "rgb(97, 71, 0)", "rgb(19, 82, 0)",
    "rgb(0, 71, 79)", "rgb(0, 58, 140)", "rgb(6, 17, 120)", "rgb(34, 7, 94)", "rgb(120, 6, 80)"
  ];

  const PALETTE_MODE_META = {
    text: {
      panelName: "color",
      clearLabelKey: "palette.clear.text",
      clearAction: () => applyPaletteColorByMode("text", "rgb(0, 0, 0)")
    },
    bg: {
      panelName: "bgColor",
      clearLabelKey: "palette.clear.bg",
      clearAction: () => {
        editor.clearBackgroundColor();
        return true;
      }
    },
    page: {
      panelName: "pageBg",
      clearLabelKey: "palette.clear.page",
      clearAction: () => {
        if (!wiki.clearCurrentPageBackground(true)) return false;
        setStatus(t("status.pageBgReset"));
        return true;
      }
    }
  };

  let currentPaletteMode = "text";
  const modeLastColor = {
    text: "rgb(0, 0, 0)",
    bg: "",
    page: ""
  };

  function normalizePaletteColor(raw) {
    return String(raw || "").trim().toLowerCase().replace(/\s+/g, "");
  }

  function applyPaletteColorByMode(mode, color) {
    if (editor.isReadOnly()) return false;
    const value = String(color || "").trim();
    if (!value) return false;
    if (mode === "text") {
      editor.exec("foreColor", value);
      modeLastColor.text = value;
      setStatus(t("status.textColor", { color: value }));
      return true;
    }
    if (mode === "bg") {
      editor.exec("hiliteColor", value);
      modeLastColor.bg = value;
      setStatus(t("status.highlightColor", { color: value }));
      return true;
    }
    if (!wiki.setCurrentPageBackground(value, true)) return false;
    modeLastColor.page = value;
    setStatus(t("status.pageBgColor", { color: value }));
    return true;
  }

  function renderPaletteColorList() {
    if (!dom.paletteColorList) return;
    dom.paletteColorList.innerHTML = "";
    const modeMeta = PALETTE_MODE_META[currentPaletteMode] || PALETTE_MODE_META.text;
    const activeColor = normalizePaletteColor(modeLastColor[currentPaletteMode]);

    const clearItem = document.createElement("li");
    clearItem.className = "palette-clear-item";
    clearItem.dataset.paletteAction = "clear";
    clearItem.textContent = t(modeMeta.clearLabelKey);
    dom.paletteColorList.appendChild(clearItem);

    SHARED_COLOR_VALUES.forEach((color) => {
      const item = document.createElement("li");
      item.className = "palette-color-item";
      item.setAttribute("data-value", color);
      if (activeColor && normalizePaletteColor(color) === activeColor) {
        item.classList.add("active");
      }

      const block = document.createElement("div");
      block.className = "color-block";
      block.setAttribute("data-value", color);
      block.style.backgroundColor = color;
      item.appendChild(block);
      dom.paletteColorList.appendChild(item);
    });
  }

  function setPaletteMode(mode) {
    const nextMode = PALETTE_MODE_META[mode] ? mode : "text";
    currentPaletteMode = nextMode;
    if (dom.paletteModeTabs) {
      dom.paletteModeTabs.querySelectorAll("[data-palette-mode]").forEach((btn) => {
        btn.classList.toggle("active", btn.getAttribute("data-palette-mode") === nextMode);
      });
    }
    renderPaletteColorList();
  }

  function openPalettePanel(mode) {
    const nextMode = PALETTE_MODE_META[mode] ? mode : "text";
    const panelName = PALETTE_MODE_META[nextMode].panelName;
    const isOpen = dom.palettePanel && dom.palettePanel.style.display === "block";
    const sameMode = currentPaletteMode === nextMode;
    if (isOpen && sameMode) {
      panels.hide(panelName);
      return;
    }
    setPaletteMode(nextMode);
    panels.show(panelName);
  }

  function insertImageFromUrl() {
    const src = prompt(t("prompt.imageUrl"));
    if (!src) return;
    const value = String(src).trim();
    if (!value) return;
    editor.insertImageAtCursor(value, "image");
    setStatus(t("status.imageFromUrl"));
  }

  function insertImageFromFile() {
    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept = "image/*";
    picker.style.display = "none";

    picker.addEventListener("change", () => {
      const file = picker.files && picker.files[0];
      picker.remove();
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        editor.insertImageAtCursor(String(reader.result || ""), file.name || "image");
        setStatus(t("status.imageFromFile"));
      };
      reader.onerror = () => {
        setStatus(t("error.readLocalImageFailed"));
      };
      reader.readAsDataURL(file);
    }, { once: true });

    document.body.appendChild(picker);
    picker.click();
  }

  function chooseImageInsertMode() {
    const choice = prompt(t("prompt.imageMode"), "1");
    if (choice === null) return;
    const mode = String(choice || "").trim();
    if (mode === "1") {
      insertImageFromFile();
      return;
    }
    if (mode === "2") {
      insertImageFromUrl();
      return;
    }
    setStatus(t("error.inputOneOrTwo"));
  }

  function bindEditorToolbar() {
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
      editor.applyBlockPreset(dom.formatBlock.value);
    });

    dom.undoBtn.addEventListener("click", () => editor.undoEditor());
    dom.redoBtn.addEventListener("click", () => editor.redoEditor());

    dom.clearFormatBtn.addEventListener("click", () => {
      if (editor.isReadOnly()) return;
      editor.clearFormattingToPlainText();
    });

    dom.insertWikiLinkBtn.addEventListener("click", () => {
      if (editor.isReadOnly()) return;
      const target = prompt(t("prompt.wikiLink"), t("prompt.wikiLinkDefault"));
      if (!target) return;
      const text = `[[${target.trim()}]]`;
      editor.exec("insertHTML", text);
    });

    dom.imageUrlBtn.addEventListener("click", () => {
      if (editor.isReadOnly()) return;
      chooseImageInsertMode();
    });

    dom.colorBtn.addEventListener("click", () => {
      if (editor.isReadOnly()) return;
      openPalettePanel(currentPaletteMode);
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

  function bindPalettePanel() {
    document.execCommand("styleWithCSS", false, true);

    if (dom.paletteModeTabs) {
      dom.paletteModeTabs.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-palette-mode]");
        if (!btn) return;
        if (editor.isReadOnly()) return;
        setPaletteMode(btn.getAttribute("data-palette-mode"));
      });
    }

    if (dom.paletteColorList) {
      dom.paletteColorList.addEventListener("click", (e) => {
        if (editor.isReadOnly()) return;

        const clearItem = e.target.closest("[data-palette-action='clear']");
        if (clearItem) {
          const modeMeta = PALETTE_MODE_META[currentPaletteMode] || PALETTE_MODE_META.text;
          const ok = modeMeta.clearAction();
          if (ok !== false) {
            renderPaletteColorList();
            panels.hide(modeMeta.panelName);
          }
          return;
        }

        const colorItem = e.target.closest(".palette-color-item");
        if (!colorItem) return;
        const color = colorItem.getAttribute("data-value");
        if (!color) return;
        if (applyPaletteColorByMode(currentPaletteMode, color)) {
          renderPaletteColorList();
          const modeMeta = PALETTE_MODE_META[currentPaletteMode] || PALETTE_MODE_META.text;
          panels.hide(modeMeta.panelName);
        }
      });
    }

    setPaletteMode("text");
    document.addEventListener("i18n:changed", () => {
      renderPaletteColorList();
    });
  }

  function bindFontSizePanel() {
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
      if (!e.target.closest("#importModeMenu") && !e.target.closest("#importJsonBtn")) {
        dom.importModeMenu.style.display = "none";
      }
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
      if (typeof editor.resetHistoryStorage === "function") {
        editor.resetHistoryStorage();
      }
    });
  }

  function bindAll() {
    bindEditorToolbar();
    bindPalettePanel();
    bindFontSizePanel();
    bindContextMenuAndPaste();
    bindKeyboardShortcuts();
    bindAutoSaveLifecycle();
  }

  return {
    bindAll,
    bindEditorToolbar,
    bindPalettePanel,
    bindFontSizePanel,
    bindContextMenuAndPaste,
    bindKeyboardShortcuts,
    bindAutoSaveLifecycle
  };
}
