export function createEditor({ dom, state, onContentChanged, queueAutoSave, setStatus }) {
  let selectedImage = null;
  let readOnly = false;

  function saveSelectionIfInsideEditor() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!dom.editor.contains(range.commonAncestorContainer)) return;
    state.savedRange = range.cloneRange();
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
    dom.editor.focus();
    document.execCommand("undo", false, null);
    saveSelectionIfInsideEditor();
    onContentChanged();
    queueAutoSave();
    setStatus("已撤销");
  }

  function redoEditor() {
    if (readOnly) return;
    dom.editor.focus();
    document.execCommand("redo", false, null);
    saveSelectionIfInsideEditor();
    onContentChanged();
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
      if (!readOnly) return;
      e.preventDefault();
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

  function showImageToolMenu(img) {
    if (readOnly || !img || !dom.editor.contains(img)) return;
    if (selectedImage && selectedImage !== img) selectedImage.classList.remove("image-selected");
    selectedImage = img;
    selectedImage.classList.add("image-selected");

    const width = parseInt(selectedImage.style.width || "", 10);
    const height = parseInt(selectedImage.style.height || "", 10);
    dom.imageWidthInput.value = Number.isFinite(width) && width > 0 ? String(width) : "";
    dom.imageHeightInput.value = Number.isFinite(height) && height > 0 ? String(height) : "";

    positionImageToolMenu(img);
    dom.imageToolMenu.style.display = "block";
  }

  function applyImageDefaultSize() {
    if (readOnly || !selectedImage || !dom.editor.contains(selectedImage)) return;
    selectedImage.style.width = "";
    selectedImage.style.height = "";
    selectedImage.removeAttribute("width");
    selectedImage.removeAttribute("height");
    onContentChanged();
    queueAutoSave();
    setStatus("图片已恢复默认大小");
  }

  function applyImageCustomSize() {
    if (readOnly || !selectedImage || !dom.editor.contains(selectedImage)) return;
    const width = Number(dom.imageWidthInput.value);
    const height = Number(dom.imageHeightInput.value);
    if (!Number.isFinite(width) || width <= 0) {
      setStatus("请输入有效的图片宽度(px)");
      return;
    }
    selectedImage.style.width = `${Math.round(width)}px`;
    if (Number.isFinite(height) && height > 0) selectedImage.style.height = `${Math.round(height)}px`;
    else selectedImage.style.height = "auto";
    onContentChanged();
    queueAutoSave();
    setStatus("图片尺寸已更新");
  }

  function bindImageTooling() {
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

    dom.imageHeightInput.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      applyImageCustomSize();
    });
  }

  return {
    exec,
    undoEditor,
    redoEditor,
    updateCounter,
    insertImageAtCursor,
    applyFontSizePx,
    clearFormattingToPlainText,
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
