import { t } from "../text.js";

function htmlToPlainText(html) {
  const template = document.createElement("template");
  template.innerHTML = String(html || "");
  return (template.content.textContent || "").replace(/\s+/g, "").trim();
}

function ensureHtml(input) {
  const raw = String(input || "").trim();
  return raw || "<p><br></p>";
}

export function createEditor({ dom, state, onContentChanged, setStatus }) {
  let readOnly = false;
  let suppressChange = false;
  let wangEditor = null;
  let wangToolbar = null;
  let wangReady = false;
  let pendingHtml = null;
  let pendingSetHtmlFrame = 0;
  let pendingSetHtmlRetry = 0;

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

  function flushPendingSetHtml() {
    pendingSetHtmlFrame = 0;
    if (!wangEditor || typeof wangEditor.setHtml !== "function") {
      pendingHtml = null;
      pendingSetHtmlRetry = 0;
      return;
    }
    if (!wangReady) {
      pendingSetHtmlFrame = requestAnimationFrame(flushPendingSetHtml);
      return;
    }

    const html = pendingHtml;
    pendingHtml = null;
    if (html === null) return;

    suppressChange = true;
    try {
      if (typeof wangEditor.blur === "function") {
        wangEditor.blur();
      }
      wangEditor.setHtml(html);
      pendingSetHtmlRetry = 0;
    } catch (err) {
      pendingHtml = html;
      pendingSetHtmlRetry += 1;
      if (pendingSetHtmlRetry <= 3) {
        pendingSetHtmlFrame = requestAnimationFrame(flushPendingSetHtml);
      } else {
        pendingHtml = null;
        pendingSetHtmlRetry = 0;
        console.error(err);
      }
    } finally {
      suppressChange = false;
      updateCounter();
    }

    if (pendingHtml !== null && !pendingSetHtmlFrame) {
      pendingSetHtmlFrame = requestAnimationFrame(flushPendingSetHtml);
    }
  }

  function scheduleSetHtml(safeHtml) {
    if (!wangEditor || typeof wangEditor.setHtml !== "function") return false;
    pendingHtml = safeHtml;
    if (!pendingSetHtmlFrame) {
      pendingSetHtmlFrame = requestAnimationFrame(flushPendingSetHtml);
    }
    return true;
  }

  function setHtml(nextHtml) {
    const safeHtml = ensureHtml(nextHtml);
    if (scheduleSetHtml(safeHtml)) return;

    suppressChange = true;
    try {
      if (dom.editor) dom.editor.innerHTML = safeHtml;
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
    wangReady = false;
    pendingHtml = null;
    pendingSetHtmlRetry = 0;
    if (pendingSetHtmlFrame) {
      cancelAnimationFrame(pendingSetHtmlFrame);
      pendingSetHtmlFrame = 0;
    }

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
      wangReady = false;

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
      requestAnimationFrame(() => {
        if (!wangEditor) return;
        wangReady = true;
        if (pendingHtml !== null && !pendingSetHtmlFrame) {
          pendingSetHtmlFrame = requestAnimationFrame(flushPendingSetHtml);
        }
      });
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

  function setReadOnly(value) {
    readOnly = Boolean(value);
    applyReadOnlyState();
  }

  function getSearchRoot() {
    if (!dom.editor) return null;
    const slateRoot = dom.editor.querySelector("[data-slate-editor='true']");
    return slateRoot || dom.editor;
  }

  function buildNormalizedTextMap(root) {
    if (!root) return { text: "", map: [] };
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const map = [];
    let text = "";
    let hasOutput = false;
    let previousWasSpace = true;
    let node = walker.nextNode();

    while (node) {
      const source = String(node.textContent || "");
      for (let i = 0; i < source.length; i += 1) {
        const ch = source[i];
        const isSpace = /\s/.test(ch);
        if (isSpace) {
          if (!hasOutput || previousWasSpace) continue;
          text += " ";
          map.push({ node, offset: i });
          previousWasSpace = true;
          hasOutput = true;
          continue;
        }
        text += ch;
        map.push({ node, offset: i });
        previousWasSpace = false;
        hasOutput = true;
      }
      node = walker.nextNode();
    }

    if (text.endsWith(" ")) {
      text = text.slice(0, -1);
      map.pop();
    }
    return { text, map };
  }

  function findOccurrenceStartIndex(sourceText, keywordText, occurrenceIndex = 0) {
    const sourceLower = String(sourceText || "").toLowerCase();
    const keywordLower = String(keywordText || "").toLowerCase();
    if (!keywordLower) return -1;

    let start = 0;
    let count = 0;
    while (start <= sourceLower.length) {
      const found = sourceLower.indexOf(keywordLower, start);
      if (found === -1) return -1;
      if (count === occurrenceIndex) return found;
      count += 1;
      start = found + Math.max(1, keywordLower.length);
    }
    return -1;
  }

  function jumpToTextOccurrence(rawKeyword, rawOccurrence = 0) {
    const keyword = String(rawKeyword || "").trim();
    if (!keyword) return false;

    const root = getSearchRoot();
    if (!root) return false;
    const occurrence = Math.max(0, Number(rawOccurrence) || 0);
    const { text, map } = buildNormalizedTextMap(root);
    if (!text || !map.length) return false;

    const startIndex = findOccurrenceStartIndex(text, keyword, occurrence);
    if (startIndex < 0) return false;
    const endIndex = startIndex + keyword.length - 1;
    const startPoint = map[startIndex];
    const endPoint = map[endIndex];
    if (!startPoint || !endPoint) return false;

    const range = document.createRange();
    range.setStart(startPoint.node, startPoint.offset);
    range.setEnd(endPoint.node, endPoint.offset + 1);

    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }

    const startElement = startPoint.node.parentElement;
    const focusEl = startElement
      ? (startElement.closest("p,h1,h2,h3,li,td,th,blockquote,div") || startElement)
      : null;
    if (focusEl && focusEl.scrollIntoView) {
      root.querySelectorAll(".jump-target").forEach((el) => el.classList.remove("jump-target"));
      focusEl.scrollIntoView({ behavior: "smooth", block: "center" });
      if (focusEl.classList) {
        focusEl.classList.add("jump-target");
        setTimeout(() => focusEl.classList.remove("jump-target"), 1200);
      }
    }
    return true;
  }

  state.editorAdapter = {
    getHtml,
    setHtml
  };

  const bootHtml = ensureHtml(dom.editor && dom.editor.innerHTML);
  const inited = initWangEditor(bootHtml);
  if (!inited) {
    setStatus(t("error.wangEditorLoadFailed"));
    initFallbackEditor();
  }

  return {
    focus,
    updateCounter,
    setReadOnly,
    jumpToTextOccurrence
  };
}
