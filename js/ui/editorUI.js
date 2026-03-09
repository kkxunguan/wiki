import { t } from "../text.js";
import { dom } from "./dom.js";
import { AUTO_SAVE_DELAY_MS, state } from "../document/state.js";
import { setStatus } from "./uiShared.js";

// 将 HTML 转为纯文本并压缩空白，用于字数统计。
function htmlToPlainText(html) {
  const template = document.createElement("template");
  template.innerHTML = String(html || "");
  return (template.content.textContent || "").replace(/\s+/g, "").trim();
}

// 兜底保证编辑器内容至少是一个可编辑的空段落。
function ensureHtml(input) {
  const raw = String(input || "").trim();
  return raw || "<p><br></p>";
}

// 创建编辑器适配层，统一 WangEditor 与降级编辑模式行为。
export function createEditor() {
  let readOnly = false;
  let suppressChange = false;
  let wangEditor = null;
  let wangToolbar = null;
  let wangReady = false;
  let pendingHtml = null;
  let pendingSetHtmlFrame = 0;
  let pendingSetHtmlRetry = 0;

  // 读取当前编辑器 HTML（优先 WangEditor）。
  function getHtml() {
    if (wangEditor && typeof wangEditor.getHtml === "function") {
      return ensureHtml(wangEditor.getHtml());
    }
    return ensureHtml(dom.editor && dom.editor.innerHTML);
  }

  // 执行延迟 setHtml：等待编辑器 ready 后再写入，避免初始化阶段失败。
  function flushPendingSetHtml() {
    pendingSetHtmlFrame = 0;
    if (!wangEditor || typeof wangEditor.setHtml !== "function") {
      // 编辑器不可用时丢弃待写队列，避免重复重试。
      pendingHtml = null;
      pendingSetHtmlRetry = 0;
      return;
    }
    if (!wangReady) {
      // 尚未 ready 时继续下一帧等待。
      pendingSetHtmlFrame = requestAnimationFrame(flushPendingSetHtml);
      return;
    }

    const html = pendingHtml;
    pendingHtml = null;
    if (html === null) return;

    // setHtml 期间抑制 onChange，避免“程序写入”触发自动保存。
    suppressChange = true;
    try {
      if (typeof wangEditor.blur === "function") {
        wangEditor.blur();
      }
      wangEditor.setHtml(html);
      pendingSetHtmlRetry = 0;
    } catch (err) {
      // 短暂失败最多重试 3 次，避免无限循环。
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
      // 若执行中又有新写入请求，继续调度下一帧处理。
      pendingSetHtmlFrame = requestAnimationFrame(flushPendingSetHtml);
    }
  }

  // 安排一次异步 setHtml，合并短时间内多次写入请求。
  function scheduleSetHtml(safeHtml) {
    if (!wangEditor || typeof wangEditor.setHtml !== "function") return false;
    pendingHtml = safeHtml;
    if (!pendingSetHtmlFrame) {
      pendingSetHtmlFrame = requestAnimationFrame(flushPendingSetHtml);
    }
    return true;
  }

  // 对外写入 HTML 接口，自动选择 WangEditor 或降级容器。
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

  // 读取纯文本内容，用于字数统计和其他文本处理。
  function getText() {
    if (wangEditor && typeof wangEditor.getText === "function") {
      return String(wangEditor.getText() || "").replace(/\s+/g, "").trim();
    }
    return htmlToPlainText(getHtml());
  }

  // 聚焦编辑器。
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

  // 刷新底部字数统计显示。
  function updateCounter() {
    if (!dom.counter) return;
    dom.counter.textContent = t("counter.words", { count: getText().length });
  }

  // 自动保存调度器（防抖）：编辑变更后延迟保存并刷新搜索结果。
  function queueAutoSave() {
    if (state.autoSaveTimer) clearTimeout(state.autoSaveTimer);
    state.autoSaveTimer = setTimeout(() => {
      if (!state.wiki || typeof state.wiki.saveCurrentPage !== "function") return;
      const saved = state.wiki.saveCurrentPage(true);
      if (!saved) return;
      if (state.searchBindings && typeof state.searchBindings.refreshActiveQuery === "function") {
        state.searchBindings.refreshActiveQuery();
      }
    }, AUTO_SAVE_DELAY_MS);
  }

  // 向外通知“内容发生变化”，并抛出全局自定义事件。
  function notifyContentChanged() {
    if (suppressChange) return;
    updateCounter();
    queueAutoSave();
    document.dispatchEvent(new CustomEvent("editor:content-change"));
  }

  // 应用只读状态到当前编辑器实现。
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

  // 初始化 WangEditor 及工具栏，失败时由调用方决定降级策略。
  // https://www.wangeditor.com/v5/getting-started.html#%E5%BC%95%E5%85%A5-css-%E5%AE%9A%E4%B9%89%E6%A0%B7%E5%BC%8F
  function initWangEditor() {
    const E = window.wangEditor;
    wangReady = false;

    // 先创建编辑器实例，再创建工具栏并与实例绑定。
    wangEditor = E.createEditor({
      selector: "#editor",
      html: "<p><br></p>",
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

    // 创建 toolbar
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
      // 下一帧再标记 ready，确保初次渲染完成后再消费 pendingHtml。
      wangReady = true;
      if (pendingHtml !== null && !pendingSetHtmlFrame) {
        pendingSetHtmlFrame = requestAnimationFrame(flushPendingSetHtml);
      }
    });
  }

  // 设置编辑器只读状态。
  function setReadOnly(value) {
    readOnly = Boolean(value);
    applyReadOnlyState();
  }

  // 获取用于搜索定位的根节点（兼容 Slate 结构）。
  function getSearchRoot() {
    if (!dom.editor) return null;
    const slateRoot = dom.editor.querySelector("[data-slate-editor='true']");
    return slateRoot || dom.editor;
  }

  // 建立“规范化文本 -> 原始 DOM 文本节点偏移”的映射表。
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
          // 规范化连续空白：多个空白折叠为一个空格，并记录映射位置。
          if (!hasOutput || previousWasSpace) continue;
          text += " ";
          map.push({ node, offset: i });
          previousWasSpace = true;
          hasOutput = true;
          continue;
        }
        // 非空白字符直接追加，并建立文本索引到 DOM 偏移的映射。
        text += ch;
        map.push({ node, offset: i });
        previousWasSpace = false;
        hasOutput = true;
      }
      node = walker.nextNode();
    }

    if (text.endsWith(" ")) {
      // 去掉尾部规范化空格，保持命中计算稳定。
      text = text.slice(0, -1);
      map.pop();
    }
    return { text, map };
  }

  // 查找关键词第 N 次出现的位置索引。
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

  // 跳转到关键词的指定命中次数，并高亮滚动到可见区域。
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

    // 用映射表反推真实 Range，并选中命中内容。
    const range = document.createRange();
    range.setStart(startPoint.node, startPoint.offset);
    range.setEnd(endPoint.node, endPoint.offset + 1);

    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }

    // 尝试滚动到合适块级元素，并短暂加高亮类。
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

  initWangEditor();

  return {
    focus,
    updateCounter,
    setReadOnly,
    jumpToTextOccurrence
  };
}
