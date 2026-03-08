import { t } from "../text.js";
import { setStatus } from "../ui/uiShared.js";
import { state } from "./state.js";

// 转义文本中的 HTML 特殊字符，避免拼接结果片段时注入标签。
function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// 规范化搜索词：压缩空白并去掉首尾空格。
function normalizeSearchText(rawText) {
  return String(rawText || "").replace(/\s+/g, " ").trim();
}

// 从 DOM 文本节点提取“规范化纯文本”，并统一空白符规则。
function extractNormalizedTextFromRoot(rootNode) {
  const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT);
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
        // 多空白折叠为单空格，保持搜索行为稳定。
        if (!hasOutput || previousWasSpace) continue;
        text += " ";
        previousWasSpace = true;
        hasOutput = true;
        continue;
      }
      // 非空白字符原样拼接。
      text += ch;
      previousWasSpace = false;
      hasOutput = true;
    }
    node = walker.nextNode();
  }

  if (text.endsWith(" ")) {
    text = text.slice(0, -1);
  }
  return text;
}

// 将 HTML 转成模板节点，再复用统一的纯文本提取逻辑。
function extractNormalizedTextFromHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = String(html || "");
  return extractNormalizedTextFromRoot(template.content);
}

// 在文本中查找所有命中位置，支持限制最大命中数。
function findAllOccurrences(sourceText, queryText, maxCount = 20) {
  const sourceLower = String(sourceText || "").toLowerCase();
  const queryLower = String(queryText || "").toLowerCase();
  if (!sourceLower || !queryLower) return [];

  const out = [];
  let start = 0;
  while (start <= sourceLower.length && out.length < maxCount) {
    const found = sourceLower.indexOf(queryLower, start);
    if (found === -1) break;
    out.push(found);
    start = found + Math.max(1, queryLower.length);
  }
  return out;
}

// 构造搜索结果摘要片段，并高亮命中关键词。
function buildSnippetHtml(fullText, hitStart, hitLength, radius = 32) {
  const safeLength = Math.max(1, Number(hitLength) || 1);
  const from = Math.max(0, hitStart - radius);
  const to = Math.min(fullText.length, hitStart + safeLength + radius);
  const prefix = fullText.slice(from, hitStart);
  const hit = fullText.slice(hitStart, hitStart + safeLength);
  const suffix = fullText.slice(hitStart + safeLength, to);
  const left = from > 0 ? "..." : "";
  const right = to < fullText.length ? "..." : "";
  return `${left}${escapeHtml(prefix)}<mark>${escapeHtml(hit)}</mark>${escapeHtml(suffix)}${right}`;
}

// 创建搜索服务：负责检索页面内容与跳转命中位置。
export function createSearch() {
  // 扫描全部页面内容，返回匹配结果列表。
  function searchPages(rawQuery, options = {}) {
    const query = normalizeSearchText(rawQuery);
    if (!query) return [];

    const maxResults = Math.max(1, Number(options.maxResults) || 180);
    const maxPerPage = Math.max(1, Number(options.maxPerPage) || 20);
    const results = [];

    // 按页面遍历正文文本，逐页收集命中位置与摘要。
    Object.keys(state.pages || {}).forEach((pageName) => {
      if (results.length >= maxResults) return;
      const page = state.pages[pageName] || {};
      const pageText = extractNormalizedTextFromHtml(page.content || "");
      if (!pageText) return;

      const hitPositions = findAllOccurrences(pageText, query, maxPerPage);
      hitPositions.forEach((position, occurrence) => {
        if (results.length >= maxResults) return;
        // 记录命中的页名、序号与片段，供 UI 列表展示。
        results.push({
          id: `${pageName}::${occurrence}::${position}`,
          query,
          pageName,
          occurrence,
          position,
          snippetHtml: buildSnippetHtml(pageText, position, query.length)
        });
      });
    });

    return results;
  }

  // 打开结果所在页面，并尝试定位到对应第 N 次命中处。
  function openSearchResult(result) {
    if (!state.wiki || !state.editor) return false;
    const pageName = state.wiki.sanitizeName(result && result.pageName);
    const query = normalizeSearchText(result && result.query);
    if (!pageName || !query) return false;
    if (!state.pages[pageName]) {
      setStatus(t("error.searchPageMissing", { page: pageName }));
      return false;
    }
    const occurrence = Math.max(0, Number(result.occurrence) || 0);

    state.wiki.openPage(pageName);

    requestAnimationFrame(() => {
      // 先尝试定位到指定 occurrence，失败则回退到第一个命中。
      const jumped = state.editor.jumpToTextOccurrence(query, occurrence)
        || state.editor.jumpToTextOccurrence(query, 0);
      if (jumped) {
        setStatus(t("status.searchJumped", { page: pageName }));
        return;
      }
      setStatus(t("status.searchOpenedNoHit", { page: pageName }));
    });

    return true;
  }

  return {
    normalizeSearchText,
    searchPages,
    openSearchResult
  };
}
