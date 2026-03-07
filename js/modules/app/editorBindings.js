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

  function bindColorPanel() {
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

  function bindAll() {
    bindEditorToolbar();
    bindColorPanel();
    bindFontSizePanel();
    bindContextMenuAndPaste();
    bindKeyboardShortcuts();
    bindAutoSaveLifecycle();
  }

  return {
    bindAll,
    bindEditorToolbar,
    bindColorPanel,
    bindFontSizePanel,
    bindContextMenuAndPaste,
    bindKeyboardShortcuts,
    bindAutoSaveLifecycle
  };
}
