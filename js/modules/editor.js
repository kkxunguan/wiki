export function createEditor({ dom, state, onContentChanged, queueAutoSave, setStatus }) {
  const SHARED_DB_NAME = "wiki-richtext-db";
  const HISTORY_DB_VERSION = 1;
  const HISTORY_STORE_NAME = "kv";
  const HISTORY_DB_KEY = "wiki-editor-history-v1";
  const LEGACY_HISTORY_DB_NAME = "wiki-editor-history-db";
  const HISTORY_PERSIST_DEBOUNCE_MS = 180;
  const HISTORY_LIMIT = 120;
  const HISTORY_MAX_TRACK_BYTES = 8 * 1024 * 1024;
  let selectedImage = null;
  let selectedImageAspectRatio = 0;
  let draggingFromImageSizeInput = false;
  let readOnly = false;
  let suppressHistoryCapture = false;
  let sessionHistory = {};
  let historyPersistTimer = null;
  const BLOCK_STYLE_PRESETS = {
    P: {
      fontSize: "16px",
      fontWeight: "400",
      color: "#000000",
      backgroundColor: "transparent",
      lineHeight: "1.6",
      padding: "0",
      borderRadius: "0",
      margin: "0 0 10px 0"
    },
    H1: {
      fontSize: "32px",
      fontWeight: "700",
      color: "#000000",
      backgroundColor: "transparent",
      lineHeight: "1.6",
      padding: "0",
      borderRadius: "0",
      margin: "14px 0 10px 0"
    },
    H2: {
      fontSize: "26px",
      fontWeight: "700",
      color: "#000000",
      backgroundColor: "transparent",
      lineHeight: "1.6",
      padding: "0",
      borderRadius: "0",
      margin: "12px 0 8px 0"
    },
    H3: {
      fontSize: "21px",
      fontWeight: "600",
      color: "#000000",
      backgroundColor: "transparent",
      lineHeight: "1.6",
      padding: "0",
      borderRadius: "0",
      margin: "10px 0 8px 0"
    }
  };

  function saveSelectionIfInsideEditor() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!dom.editor.contains(range.commonAncestorContainer)) return;
    state.savedRange = range.cloneRange();
  }

  function openHistoryDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(SHARED_DB_NAME, HISTORY_DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(HISTORY_STORE_NAME)) {
          db.createObjectStore(HISTORY_STORE_NAME, { keyPath: "key" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function writeHistoryToDb(historyPayload) {
    try {
      const db = await openHistoryDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(HISTORY_STORE_NAME, "readwrite");
        tx.objectStore(HISTORY_STORE_NAME).put({ key: HISTORY_DB_KEY, value: historyPayload });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch {
      // ignore storage errors to keep editor usable
    }
  }

  async function clearHistoryDb() {
    try {
      const db = await openHistoryDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(HISTORY_STORE_NAME, "readwrite");
        tx.objectStore(HISTORY_STORE_NAME).delete(HISTORY_DB_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch {
      // ignore storage errors to keep editor usable
    }
  }

  async function deleteLegacyHistoryDb() {
    try {
      await new Promise((resolve) => {
        const req = indexedDB.deleteDatabase(LEGACY_HISTORY_DB_NAME);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });
    } catch {
      // ignore cleanup errors
    }
  }

  function estimateTextBytes(text) {
    if (typeof text !== "string") return 0;
    return text.length * 2;
  }

  function getTrackBytes(track) {
    if (!track || !Array.isArray(track.entries)) return 0;
    return track.entries.reduce((sum, item) => sum + estimateTextBytes(item), 0);
  }

  function normalizeTrack(track) {
    if (!track || !Array.isArray(track.entries)) return { entries: [], index: -1 };
    const entries = track.entries.filter((entry) => typeof entry === "string");
    if (!entries.length) return { entries: [], index: -1 };
    const parsedIndex = Number(track.index);
    const index = Number.isInteger(parsedIndex)
      ? Math.min(Math.max(parsedIndex, 0), entries.length - 1)
      : entries.length - 1;
    return { entries, index };
  }

  function clampTrack(track, maxEntries = HISTORY_LIMIT, maxBytes = HISTORY_MAX_TRACK_BYTES) {
    if (!track || !Array.isArray(track.entries)) return;

    while (track.entries.length > maxEntries) {
      track.entries.shift();
      track.index -= 1;
    }

    while (track.entries.length > 1 && getTrackBytes(track) > maxBytes) {
      track.entries.shift();
      track.index -= 1;
    }

    if (!track.entries.length) {
      track.index = -1;
      return;
    }
    if (track.index < 0) track.index = 0;
    if (track.index >= track.entries.length) track.index = track.entries.length - 1;
  }

  function queuePersistHistory() {
    if (historyPersistTimer) clearTimeout(historyPersistTimer);
    historyPersistTimer = setTimeout(() => {
      historyPersistTimer = null;
      const payload = JSON.parse(JSON.stringify(sessionHistory));
      writeHistoryToDb(payload);
    }, HISTORY_PERSIST_DEBOUNCE_MS);
  }

  async function resetHistoryStorage() {
    if (historyPersistTimer) {
      clearTimeout(historyPersistTimer);
      historyPersistTimer = null;
    }
    sessionHistory = {};
    await clearHistoryDb();
    await deleteLegacyHistoryDb();
  }

  function getHistoryPageKey() {
    if (state.trashPreviewName) return `trash:${state.trashPreviewName}`;
    if (state.currentPage) return `page:${state.currentPage}`;
    return "";
  }

  function ensureHistoryTrack(pageKey) {
    if (!pageKey) return null;
    const current = normalizeTrack(sessionHistory[pageKey]);
    if (current.entries.length || sessionHistory[pageKey]) {
      clampTrack(current);
      sessionHistory[pageKey] = current;
      return current;
    }
    const track = { entries: [], index: -1 };
    sessionHistory[pageKey] = track;
    return track;
  }

  function placeCaretAtEnd() {
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    range.selectNodeContents(dom.editor);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    saveSelectionIfInsideEditor();
  }

  function captureHistorySnapshot(force = false) {
    if (suppressHistoryCapture) return;
    const pageKey = getHistoryPageKey();
    if (!pageKey) return;
    const track = ensureHistoryTrack(pageKey);
    if (!track) return;

    const html = dom.editor.innerHTML || "<p></p>";
    if (!force && track.index >= 0 && track.entries[track.index] === html) return;

    if (track.index < track.entries.length - 1) {
      track.entries = track.entries.slice(0, track.index + 1);
    }

    track.entries.push(html);
    track.index = track.entries.length - 1;
    clampTrack(track);
    queuePersistHistory();
  }

  function applyHistorySnapshot(track, index) {
    if (!track || index < 0 || index >= track.entries.length) return false;
    const html = track.entries[index];
    if (typeof html !== "string") return false;

    suppressHistoryCapture = true;
    try {
      dom.editor.innerHTML = html;
      placeCaretAtEnd();
      onContentChanged();
    } finally {
      suppressHistoryCapture = false;
    }
    return true;
  }

  function restoreSavedSelection() {
    if (!state.savedRange) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(state.savedRange);
  }

  function updateCounter() {
    const text = dom.editor.innerText.replace(/\s+/g, "");
    dom.counter.textContent = `${text.length} 字`;
  }

  function exec(cmd, value = null) {
    if (readOnly) return;
    dom.editor.focus();
    restoreSavedSelection();
    document.execCommand(cmd, false, value);
    saveSelectionIfInsideEditor();
    onContentChanged();
  }

  function undoEditor() {
    if (readOnly) return;
    const pageKey = getHistoryPageKey();
    const track = ensureHistoryTrack(pageKey);
    if (!track || track.index <= 0) {
      setStatus("没有可撤销的操作");
      return;
    }
    const nextIndex = track.index - 1;
    if (!applyHistorySnapshot(track, nextIndex)) {
      setStatus("撤销失败");
      return;
    }
    track.index = nextIndex;
    queuePersistHistory();
    queueAutoSave();
    setStatus("已撤销");
  }

  function redoEditor() {
    if (readOnly) return;
    const pageKey = getHistoryPageKey();
    const track = ensureHistoryTrack(pageKey);
    if (!track || track.index >= track.entries.length - 1) {
      setStatus("没有可前进的操作");
      return;
    }
    const nextIndex = track.index + 1;
    if (!applyHistorySnapshot(track, nextIndex)) {
      setStatus("前进失败");
      return;
    }
    track.index = nextIndex;
    queuePersistHistory();
    queueAutoSave();
    setStatus("已前进");
  }

  function insertImageAtCursor(src, alt = "image") {
    if (readOnly || !src) return;
    dom.editor.focus();
    restoreSavedSelection();
    const safeSrc = src.replace(/"/g, "&quot;");
    const safeAlt = (alt || "image").replace(/"/g, "&quot;");
    document.execCommand("insertHTML", false, `<img src="${safeSrc}" alt="${safeAlt}" />`);
    onContentChanged();
  }

  function applyFontSizePx(rawSize) {
    if (readOnly) return;
    const size = Number(rawSize);
    if (!Number.isFinite(size) || size <= 0) {
      setStatus("请输入有效字号（px）");
      return;
    }

    dom.editor.focus();
    restoreSavedSelection();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return setStatus("请先选中文本");
    const range = sel.getRangeAt(0);
    if (!dom.editor.contains(range.commonAncestorContainer) || range.collapsed) return setStatus("请先在编辑区选中文本");

    const fragment = range.extractContents();
    const span = document.createElement("span");
    span.style.fontSize = `${Math.round(size)}px`;
    span.appendChild(fragment);
    range.insertNode(span);

    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    sel.removeAllRanges();
    sel.addRange(newRange);
    saveSelectionIfInsideEditor();
    onContentChanged();
    queueAutoSave();
    setStatus(`已设置字号：${Math.round(size)}px`);
  }

  function clearFormattingToPlainText() {
    if (readOnly) return;
    const blockTags = new Set(["P", "DIV", "LI", "UL", "OL", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "PRE"]);
    const fragment = document.createDocumentFragment();
    let paragraph = document.createElement("p");
    let hasText = false;

    function appendText(text) {
      const value = (text || "").replace(/\s+/g, " ");
      if (!value.trim()) return;
      paragraph.appendChild(document.createTextNode(value));
      hasText = true;
    }

    function flush() {
      if (!hasText) return;
      fragment.appendChild(paragraph);
      paragraph = document.createElement("p");
      hasText = false;
    }

    function appendImage(imgNode) {
      flush();
      const img = document.createElement("img");
      img.src = imgNode.getAttribute("src") || "";
      const alt = imgNode.getAttribute("alt");
      if (alt) img.alt = alt;
      if (img.src) fragment.appendChild(img);
    }

    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) return appendText(node.textContent);
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const tag = node.tagName.toUpperCase();
      if (tag === "IMG") return appendImage(node);
      if (tag === "BR") return flush();
      const isBlock = blockTags.has(tag);
      if (isBlock) flush();
      node.childNodes.forEach(walk);
      if (isBlock) flush();
    }

    dom.editor.childNodes.forEach(walk);
    flush();

    if (!fragment.childNodes.length) dom.editor.innerHTML = "<p></p>";
    else {
      dom.editor.innerHTML = "";
      dom.editor.appendChild(fragment);
    }

    saveSelectionIfInsideEditor();
    onContentChanged();
    queueAutoSave();
    setStatus("已转换为普通正文文本");
  }

  function clearBackgroundColor() {
    if (readOnly) return;
    dom.editor.focus();
    restoreSavedSelection();
    document.execCommand("hiliteColor", false, "transparent");
    saveSelectionIfInsideEditor();
    onContentChanged();
    queueAutoSave();
    setStatus("已清除底色");
  }

  function collectSelectedBlocks() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return [];
    const range = sel.getRangeAt(0);
    const blockSelector = "p,h1,h2,h3";
    const container = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;
    if (!container) return [];

    const blocks = [];
    if (container.matches && container.matches(blockSelector)) blocks.push(container);
    if (container.querySelectorAll) {
      container.querySelectorAll(blockSelector).forEach((el) => {
        if (!dom.editor.contains(el)) return;
        try {
          if (range.intersectsNode(el)) blocks.push(el);
        } catch {}
      });
    }

    if (!blocks.length) {
      const anchor = (range.startContainer.nodeType === Node.ELEMENT_NODE
        ? range.startContainer
        : range.startContainer.parentElement);
      const fallback = anchor ? anchor.closest(blockSelector) : null;
      if (fallback && dom.editor.contains(fallback)) blocks.push(fallback);
    }

    return Array.from(new Set(blocks));
  }

  function applyPresetStyleToBlock(block, fallbackTag = "P") {
    if (!block || !dom.editor.contains(block)) return;
    const tag = (block.tagName || fallbackTag || "P").toUpperCase();
    const preset = BLOCK_STYLE_PRESETS[tag] || BLOCK_STYLE_PRESETS[fallbackTag] || BLOCK_STYLE_PRESETS.P;
    Object.keys(preset).forEach((styleKey) => {
      block.style[styleKey] = preset[styleKey];
    });
  }

  function rebuildBlockAsPlainText(block, formatTag = "P") {
    if (!block || !block.parentNode) return null;
    const text = (block.textContent || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const next = document.createElement(String(formatTag || "P").toLowerCase());
    if (text) next.textContent = text;
    else next.appendChild(document.createElement("br"));
    block.parentNode.replaceChild(next, block);
    return next;
  }

  function applyBlockPreset(rawTag = "P") {
    if (readOnly) return;
    const formatTag = String(rawTag || "P").toUpperCase();
    dom.editor.focus();
    restoreSavedSelection();
    document.execCommand("formatBlock", false, formatTag);

    const blocks = collectSelectedBlocks();
    const normalizedBlocks = blocks
      .map((block) => rebuildBlockAsPlainText(block, formatTag))
      .filter(Boolean);
    normalizedBlocks.forEach((block) => applyPresetStyleToBlock(block, formatTag));

    if (normalizedBlocks.length) {
      const sel = window.getSelection();
      if (sel) {
        const range = document.createRange();
        range.selectNodeContents(normalizedBlocks[normalizedBlocks.length - 1]);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }

    saveSelectionIfInsideEditor();
    onContentChanged();
    queueAutoSave();

    const labelMap = { P: "正文", H1: "标题1", H2: "标题2", H3: "标题3" };
    setStatus(`已应用${labelMap[formatTag] || formatTag}预设样式`);
  }

  async function pasteImageFromClipboard() {
    if (readOnly) return;
    if (!navigator.clipboard || !navigator.clipboard.read) {
      setStatus("当前浏览器不支持 clipboard.read，请使用 Ctrl+V 粘贴图片。");
      return;
    }
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((t) => t.startsWith("image/"));
        if (!imageType) continue;
        const blob = await item.getType(imageType);
        const reader = new FileReader();
        reader.onload = () => {
          insertImageAtCursor(String(reader.result || ""), "clipboard-image");
          setStatus("已从剪贴板插入图片");
        };
        reader.readAsDataURL(blob);
        return;
      }
      setStatus("剪贴板中没有图片");
    } catch {
      setStatus("读取剪贴板失败，请允许剪贴板权限，或改用 Ctrl+V");
    }
  }

  function insertPlainTextAtCursor(rawText) {
    const text = String(rawText || "");
    if (!text) return false;

    dom.editor.focus();
    restoreSavedSelection();
    const sel = window.getSelection();
    if (!sel) return false;

    if (sel.rangeCount === 0) {
      const fallbackRange = document.createRange();
      fallbackRange.selectNodeContents(dom.editor);
      fallbackRange.collapse(false);
      sel.addRange(fallbackRange);
    }

    let range = sel.getRangeAt(0);
    if (!dom.editor.contains(range.commonAncestorContainer)) {
      const fallbackRange = document.createRange();
      fallbackRange.selectNodeContents(dom.editor);
      fallbackRange.collapse(false);
      sel.removeAllRanges();
      sel.addRange(fallbackRange);
      range = fallbackRange;
    }

    const normalized = text
      .replace(/\u00a0/g, " ")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");

    range.deleteContents();
    const lines = normalized.split("\n");
    const fragment = document.createDocumentFragment();
    lines.forEach((line, index) => {
      if (index > 0) fragment.appendChild(document.createElement("br"));
      if (line) fragment.appendChild(document.createTextNode(line));
    });

    const caret = document.createTextNode("");
    fragment.appendChild(caret);
    range.insertNode(fragment);

    const caretRange = document.createRange();
    caretRange.setStartAfter(caret);
    caretRange.collapse(true);
    if (caret.parentNode) caret.parentNode.removeChild(caret);
    sel.removeAllRanges();
    sel.addRange(caretRange);

    saveSelectionIfInsideEditor();
    onContentChanged();
    return true;
  }

  function handlePasteEvent(e) {
    if (readOnly) {
      e.preventDefault();
      return;
    }
    const cd = e.clipboardData;
    if (!cd || !cd.items) return;

    for (const item of cd.items) {
      if (!item.type.startsWith("image/")) continue;
      const file = item.getAsFile();
      if (!file) continue;
      e.preventDefault();
      const reader = new FileReader();
      reader.onload = () => {
        insertImageAtCursor(String(reader.result || ""), file.name || "pasted-image");
        setStatus("已通过 Ctrl+V 插入图片");
      };
      reader.readAsDataURL(file);
      return;
    }
    // 文本粘贴保留原网页格式，交给浏览器默认行为处理。
  }

  function isEditorContext() {
    if (document.activeElement === dom.editor) return true;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;
    return dom.editor.contains(sel.getRangeAt(0).commonAncestorContainer);
  }

  function isReadOnly() {
    return readOnly;
  }

  function setReadOnly(value) {
    readOnly = Boolean(value);
    if (readOnly) hideImageToolMenu();
  }

  function bindSelectionTracking() {
    dom.editor.addEventListener("mouseup", saveSelectionIfInsideEditor);
    dom.editor.addEventListener("keyup", saveSelectionIfInsideEditor);
    document.addEventListener("selectionchange", saveSelectionIfInsideEditor);
  }

  function bindReadOnlyGuard() {
    dom.editor.addEventListener("beforeinput", (e) => {
      if (!readOnly) return;
      e.preventDefault();
    });
    dom.editor.addEventListener("drop", (e) => {
      if (readOnly) {
        e.preventDefault();
        return;
      }
      const dt = e.dataTransfer;
      if (!dt) return;
      const hasFiles = Boolean(dt.files && dt.files.length);
      if (hasFiles) return;
      const text = dt.getData("text/plain");
      if (!text) return;
      e.preventDefault();
      insertPlainTextAtCursor(text);
      queueAutoSave();
      setStatus("已插入纯文本");
    });
  }

  function hideImageToolMenu() {
    dom.imageToolMenu.style.display = "none";
  }

  function clearSelectedImage() {
    if (selectedImage) selectedImage.classList.remove("image-selected");
    selectedImage = null;
    hideImageToolMenu();
  }

  function positionImageToolMenu(img) {
    const rect = img.getBoundingClientRect();
    const left = Math.max(8, rect.left);
    const top = Math.max(8, rect.top - 64);
    dom.imageToolMenu.style.left = `${left}px`;
    dom.imageToolMenu.style.top = `${top}px`;
  }

  function parsePositiveNumber(raw) {
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) return 0;
    return value;
  }

  function getCurrentImageAspectRatio(img) {
    if (!img) return 0;
    const styleWidth = parsePositiveNumber(parseInt(img.style.width || "", 10));
    const styleHeight = parsePositiveNumber(parseInt(img.style.height || "", 10));
    if (styleWidth && styleHeight) return styleWidth / styleHeight;

    const attrWidth = parsePositiveNumber(parseInt(img.getAttribute("width") || "", 10));
    const attrHeight = parsePositiveNumber(parseInt(img.getAttribute("height") || "", 10));
    if (attrWidth && attrHeight) return attrWidth / attrHeight;

    const rect = img.getBoundingClientRect();
    const renderedWidth = parsePositiveNumber(Math.round(rect.width));
    const renderedHeight = parsePositiveNumber(Math.round(rect.height));
    if (renderedWidth && renderedHeight) return renderedWidth / renderedHeight;

    const naturalWidth = parsePositiveNumber(img.naturalWidth);
    const naturalHeight = parsePositiveNumber(img.naturalHeight);
    if (naturalWidth && naturalHeight) return naturalWidth / naturalHeight;
    return 0;
  }

  function syncImageSizeInputs(img) {
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const styleWidth = parseInt(img.style.width || "", 10);
    const styleHeight = parseInt(img.style.height || "", 10);
    const attrWidth = parseInt(img.getAttribute("width") || "", 10);
    const attrHeight = parseInt(img.getAttribute("height") || "", 10);
    const renderedWidth = Math.round(rect.width);
    const renderedHeight = Math.round(rect.height);

    const width = [styleWidth, attrWidth, renderedWidth, img.naturalWidth]
      .find((v) => Number.isFinite(v) && v > 0);
    const height = [styleHeight, attrHeight, renderedHeight, img.naturalHeight]
      .find((v) => Number.isFinite(v) && v > 0);

    dom.imageWidthInput.value = width ? String(width) : "";
    dom.imageHeightInput.value = height ? String(height) : "";
    if (width && height) selectedImageAspectRatio = width / height;
    else selectedImageAspectRatio = getCurrentImageAspectRatio(img);
  }

  function syncHeightFromWidthInput() {
    if (!selectedImage) return;
    const ratio = selectedImageAspectRatio || getCurrentImageAspectRatio(selectedImage);
    if (!ratio) return;
    const width = parsePositiveNumber(dom.imageWidthInput.value);
    if (!width) return;
    dom.imageHeightInput.value = String(Math.round(width / ratio));
  }

  function syncWidthFromHeightInput() {
    if (!selectedImage) return;
    const ratio = selectedImageAspectRatio || getCurrentImageAspectRatio(selectedImage);
    if (!ratio) return;
    const height = parsePositiveNumber(dom.imageHeightInput.value);
    if (!height) return;
    dom.imageWidthInput.value = String(Math.round(height * ratio));
  }

  function showImageToolMenu(img) {
    if (readOnly || !img || !dom.editor.contains(img)) return;
    if (selectedImage && selectedImage !== img) selectedImage.classList.remove("image-selected");
    selectedImage = img;
    selectedImage.classList.add("image-selected");
    syncImageSizeInputs(selectedImage);

    positionImageToolMenu(img);
    dom.imageToolMenu.style.display = "block";
  }

  function applyImageDefaultSize() {
    if (readOnly || !selectedImage || !dom.editor.contains(selectedImage)) return;
    selectedImage.style.width = "";
    selectedImage.style.height = "";
    selectedImage.removeAttribute("width");
    selectedImage.removeAttribute("height");
    syncImageSizeInputs(selectedImage);
    onContentChanged();
    queueAutoSave();
    setStatus("图片已恢复默认大小");
  }

  function applyImageCustomSize() {
    if (readOnly || !selectedImage || !dom.editor.contains(selectedImage)) return;
    const ratio = selectedImageAspectRatio || getCurrentImageAspectRatio(selectedImage);
    if (!ratio) {
      setStatus("无法获取图片比例，请重新选择图片");
      return;
    }
    const widthInput = parsePositiveNumber(dom.imageWidthInput.value);
    const heightInput = parsePositiveNumber(dom.imageHeightInput.value);
    if (!widthInput && !heightInput) {
      setStatus("请输入有效的图片宽度或高度(px)");
      return;
    }

    const targetWidth = widthInput || Math.round(heightInput * ratio);
    const targetHeight = Math.max(1, Math.round(targetWidth / ratio));
    selectedImage.style.width = `${Math.round(targetWidth)}px`;
    selectedImage.style.height = `${targetHeight}px`;
    syncImageSizeInputs(selectedImage);
    onContentChanged();
    queueAutoSave();
    setStatus("图片尺寸已按等比例更新");
  }

  function bindImageTooling() {
    const blockInputDrag = (e) => {
      draggingFromImageSizeInput = true;
      e.preventDefault();
    };
    const clearInputDrag = () => {
      draggingFromImageSizeInput = false;
    };

    dom.imageWidthInput.setAttribute("draggable", "false");
    dom.imageHeightInput.setAttribute("draggable", "false");
    dom.imageWidthInput.addEventListener("dragstart", blockInputDrag);
    dom.imageHeightInput.addEventListener("dragstart", blockInputDrag);
    dom.imageWidthInput.addEventListener("drop", blockInputDrag);
    dom.imageHeightInput.addEventListener("drop", blockInputDrag);
    document.addEventListener("dragend", clearInputDrag, true);
    document.addEventListener("mouseup", clearInputDrag, true);

    dom.editor.addEventListener("dragover", (e) => {
      if (!draggingFromImageSizeInput) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "none";
    });
    dom.editor.addEventListener("drop", (e) => {
      if (!draggingFromImageSizeInput) return;
      e.preventDefault();
      clearInputDrag();
    });

    dom.editor.addEventListener("click", (e) => {
      if (readOnly) return;
      const img = e.target.closest("img");
      if (img && dom.editor.contains(img)) {
        e.preventDefault();
        showImageToolMenu(img);
        return;
      }
      if (!e.target.closest("#imageToolMenu")) clearSelectedImage();
    });

    document.addEventListener("click", (e) => {
      if (e.target.closest("#imageToolMenu")) return;
      const editorImg = e.target.closest("#editor img");
      if (editorImg) return;
      clearSelectedImage();
    });

    dom.editor.addEventListener("input", () => {
      if (selectedImage && !dom.editor.contains(selectedImage)) clearSelectedImage();
    });

    document.addEventListener("scroll", () => {
      if (selectedImage && dom.editor.contains(selectedImage)) positionImageToolMenu(selectedImage);
    }, true);
    window.addEventListener("resize", () => {
      if (selectedImage && dom.editor.contains(selectedImage)) positionImageToolMenu(selectedImage);
    });

    dom.imageDefaultBtn.addEventListener("click", () => {
      applyImageDefaultSize();
    });

    dom.imageResizeApplyBtn.addEventListener("click", () => {
      applyImageCustomSize();
    });

    dom.imageWidthInput.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      applyImageCustomSize();
    });
    dom.imageWidthInput.addEventListener("input", () => {
      syncHeightFromWidthInput();
    });

    dom.imageHeightInput.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      applyImageCustomSize();
    });
    dom.imageHeightInput.addEventListener("input", () => {
      syncWidthFromHeightInput();
    });
  }

  return {
    exec,
    undoEditor,
    redoEditor,
    resetHistoryStorage,
    captureHistorySnapshot,
    updateCounter,
    insertImageAtCursor,
    applyFontSizePx,
    clearFormattingToPlainText,
    clearBackgroundColor,
    applyBlockPreset,
    pasteImageFromClipboard,
    handlePasteEvent,
    isEditorContext,
    isReadOnly,
    setReadOnly,
    saveSelectionIfInsideEditor,
    restoreSavedSelection,
    bindSelectionTracking,
    bindReadOnlyGuard,
    bindImageTooling
  };
}
