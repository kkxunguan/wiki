import { t } from "../text.js";

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeSearchText(rawText) {
  return String(rawText || "").replace(/\s+/g, " ").trim();
}

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
        if (!hasOutput || previousWasSpace) continue;
        text += " ";
        previousWasSpace = true;
        hasOutput = true;
        continue;
      }
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

function extractNormalizedTextFromHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = String(html || "");
  return extractNormalizedTextFromRoot(template.content);
}

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

export function createSearch({ state, wiki, editor, setStatus }) {
  function searchPages(rawQuery, options = {}) {
    const query = normalizeSearchText(rawQuery);
    if (!query) return [];

    const maxResults = Math.max(1, Number(options.maxResults) || 180);
    const maxPerPage = Math.max(1, Number(options.maxPerPage) || 20);
    const results = [];

    Object.keys(state.pages || {}).forEach((pageName) => {
      if (results.length >= maxResults) return;
      const page = state.pages[pageName] || {};
      const pageText = extractNormalizedTextFromHtml(page.content || "");
      if (!pageText) return;

      const hitPositions = findAllOccurrences(pageText, query, maxPerPage);
      hitPositions.forEach((position, occurrence) => {
        if (results.length >= maxResults) return;
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

  function openSearchResult(result) {
    const pageName = wiki.sanitizeName(result && result.pageName);
    const query = normalizeSearchText(result && result.query);
    if (!pageName || !query) return false;
    if (!state.pages[pageName]) {
      setStatus(t("error.searchPageMissing", { page: pageName }));
      return false;
    }
    const occurrence = Math.max(0, Number(result.occurrence) || 0);

    wiki.openPage(pageName);

    requestAnimationFrame(() => {
      const jumped = editor.jumpToTextOccurrence(query, occurrence)
        || editor.jumpToTextOccurrence(query, 0);
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
