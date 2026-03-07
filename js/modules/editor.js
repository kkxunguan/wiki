import { t } from "./i18n.js";

function htmlToPlainText(html) {
  const template = document.createElement("template");
  template.innerHTML = String(html || "");
  return (template.content.textContent || "").replace(/\s+/g, "").trim();
}

function ensureHtml(input) {
  const raw = String(input || "").trim();
  return raw || "<p><br></p>";
}

function mapLocaleToWang(locale) {
  return String(locale || "").toLowerCase().startsWith("en") ? "en" : "zh-CN";
}

export function createEditor({ dom, state, onContentChanged, queueAutoSave, setStatus }) {
  let readOnly = false;
  let suppressChange = false;
  let wangEditor = null;
  let wangToolbar = null;
  let localeListenerBound = false;

  function hasWangEditor() {
    return Boolean(
      window.wangEditor
      && typeof window.wangEditor.createEditor === "function"
      && typeof window.wangEditor.createToolbar === "function"
    );
  }

  function getHtml() {
    if (wangEditor && typeof wangEditor.getHtml === "function") {
      return ensureHtml(wangEditor.getHtml());
    }
    return ensureHtml(dom.editor && dom.editor.innerHTML);
  }

  function setHtml(nextHtml) {
    const safeHtml = ensureHtml(nextHtml);
    suppressChange = true;
    try {
      if (wangEditor && typeof wangEditor.setHtml === "function") {
        wangEditor.setHtml(safeHtml);
      } else if (dom.editor) {
        dom.editor.innerHTML = safeHtml;
      }
    } finally {
      suppressChange = false;
    }
    updateCounter();
  }

  function getText() {
    if (wangEditor && typeof wangEditor.getText === "function") {
      return String(wangEditor.getText() || "").replace(/\s+/g, "").trim();
    }
    return htmlToPlainText(getHtml());
  }

  function isEditorContext() {
    if (!dom.editor) return false;
    const active = document.activeElement;
    if (active && (active === dom.editor || dom.editor.contains(active))) return true;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;
    return dom.editor.contains(sel.getRangeAt(0).commonAncestorContainer);
  }

  function focus(atEnd = false) {
    if (wangEditor && typeof wangEditor.focus === "function") {
      try {
        wangEditor.focus(Boolean(atEnd));
        return;
      } catch {}
    }
    if (dom.editor && typeof dom.editor.focus === "function") {
      dom.editor.focus();
    }
  }

  function updateCounter() {
    if (!dom.counter) return;
    dom.counter.textContent = t("counter.words", { count: getText().length });
  }

  function notifyContentChanged() {
    if (suppressChange) return;
    onContentChanged();
    document.dispatchEvent(new CustomEvent("editor:content-change"));
  }

  function destroyWangEditor() {
    if (wangToolbar && typeof wangToolbar.destroy === "function") {
      try {
        wangToolbar.destroy();
      } catch {}
    }
    if (wangEditor && typeof wangEditor.destroy === "function") {
      try {
        wangEditor.destroy();
      } catch {}
    }
    wangToolbar = null;
    wangEditor = null;
    if (dom.editorToolbar) dom.editorToolbar.innerHTML = "";
    if (dom.editor) dom.editor.innerHTML = "";
  }

  function applyReadOnlyState() {
    if (!wangEditor) {
      if (dom.editor) dom.editor.setAttribute("contenteditable", readOnly ? "false" : "true");
      return;
    }
    try {
      if (readOnly && typeof wangEditor.disable === "function") wangEditor.disable();
      if (!readOnly && typeof wangEditor.enable === "function") wangEditor.enable();
    } catch {}
  }

  function initWangEditor(initialHtml = "") {
    if (!hasWangEditor() || !dom.editor || !dom.editorToolbar) return false;

    const E = window.wangEditor;
    try {
      if (typeof E.i18nChangeLanguage === "function") {
        E.i18nChangeLanguage(mapLocaleToWang(t("locale.tag")));
      }

      wangEditor = E.createEditor({
        selector: "#editor",
        html: ensureHtml(initialHtml),
        config: {
          placeholder: t("editor.emptyPlaceholder"),
          scroll: false,
          onChange: () => notifyContentChanged(),
          MENU_CONF: {
            uploadImage: {
              base64LimitSize: 10 * 1024 * 1024
            }
          }
        }
      });

      wangToolbar = E.createToolbar({
        editor: wangEditor,
        selector: "#editorToolbar",
        config: {
          excludeKeys: ["fullScreen"]
        }
      });

      applyReadOnlyState();
      updateCounter();
      return true;
    } catch (err) {
      console.error(err);
      destroyWangEditor();
      return false;
    }
  }

  function initFallbackEditor() {
    if (!dom.editor) return;
    dom.editor.setAttribute("contenteditable", readOnly ? "false" : "true");
    dom.editor.addEventListener("input", () => notifyContentChanged());
    updateCounter();
  }

  function rebuildEditorForLocale() {
    if (!hasWangEditor()) return;
    const html = getHtml();
    const wasReadOnly = readOnly;
    destroyWangEditor();
    initWangEditor(html);
    readOnly = wasReadOnly;
    applyReadOnlyState();
  }

  function bindLocaleListenerOnce() {
    if (localeListenerBound) return;
    localeListenerBound = true;
    document.addEventListener("i18n:changed", () => {
      rebuildEditorForLocale();
    });
  }

  function setReadOnly(value) {
    readOnly = Boolean(value);
    applyReadOnlyState();
  }

  function isReadOnly() {
    return readOnly;
  }

  function undoEditor() {
    if (!wangEditor || readOnly) return;
    if (typeof wangEditor.undo === "function") {
      wangEditor.undo();
      setStatus(t("status.undo"));
      queueAutoSave();
    }
  }

  function redoEditor() {
    if (!wangEditor || readOnly) return;
    if (typeof wangEditor.redo === "function") {
      wangEditor.redo();
      setStatus(t("status.redo"));
      queueAutoSave();
    }
  }

  function jumpToTextOccurrence() {
    return false;
  }

  function noOp() {}
  async function noOpAsync() {}

  function insertImageAtCursor(src, alt = "image") {
    if (!src || readOnly) return;
    if (wangEditor && typeof wangEditor.dangerouslyInsertHtml === "function") {
      const safeSrc = String(src).replace(/"/g, "&quot;");
      const safeAlt = String(alt || "image").replace(/"/g, "&quot;");
      wangEditor.dangerouslyInsertHtml(`<img src="${safeSrc}" alt="${safeAlt}" />`);
      notifyContentChanged();
      return;
    }
    if (dom.editor) {
      dom.editor.innerHTML = `${dom.editor.innerHTML || ""}<img src="${src}" alt="${alt}" />`;
      notifyContentChanged();
    }
  }

  state.editorAdapter = {
    getHtml,
    setHtml,
    getText,
    focus,
    isReadOnly: () => readOnly
  };

  const bootHtml = ensureHtml(dom.editor && dom.editor.innerHTML);
  const inited = initWangEditor(bootHtml);
  if (!inited) {
    setStatus(t("error.wangEditorLoadFailed"));
    initFallbackEditor();
  }
  bindLocaleListenerOnce();

  return {
    exec: noOp,
    undoEditor,
    redoEditor,
    resetHistoryStorage: noOpAsync,
    captureHistorySnapshot: noOp,
    updateCounter,
    insertImageAtCursor,
    applyFontSizePx: noOp,
    clearFormattingToPlainText: noOp,
    clearBackgroundColor: noOp,
    applyBlockPreset: noOp,
    pasteImageFromClipboard: noOpAsync,
    handlePasteEvent: noOp,
    isEditorContext,
    isReadOnly,
    setReadOnly,
    jumpToTextOccurrence,
    saveSelectionIfInsideEditor: noOp,
    restoreSavedSelection: noOp,
    bindSelectionTracking: noOp,
    bindReadOnlyGuard: noOp,
    bindImageTooling: noOp
  };
}
