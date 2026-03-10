import { t } from "../text.js";
import { state } from "../document/state.js";
import { dom } from "./dom.js";
import { setStatus } from "./uiShared.js";

// 转义文本，避免渲染搜索结果时插入不安全 HTML。
function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// 创建全局搜索的 UI 绑定逻辑（输入、渲染、点击跳转）。
export function createSearchBindings() {
  let latestResults = [];
  let latestQuery = "";
  let searchTimer = null;

  // 控制搜索结果区域与统计信息显隐。
  function setSearchVisibility(visible) {
    dom.globalSearchResultMeta.classList.toggle("hidden", !visible);
    dom.globalSearchResults.classList.toggle("hidden", !visible);
  }

  // 渲染“无结果”占位内容。
  function renderEmptyState(text) {
    dom.globalSearchResults.innerHTML = `<div class="search-result-empty">${escapeHtml(text)}</div>`;
  }

  // 根据输入关键词执行搜索并刷新结果列表。
  function renderResults(rawQuery) {
    if (!state.search) return;
    const query = state.search.normalizeSearchText(rawQuery);
    latestQuery = query;
    if (!query) {
      latestResults = [];
      dom.globalSearchResultMeta.textContent = "";
      dom.globalSearchResults.innerHTML = "";
      setSearchVisibility(false);
      return;
    }

    latestResults = state.search.searchPages(query);
    setSearchVisibility(true);
    dom.globalSearchResultMeta.textContent = t("search.meta", { query, count: latestResults.length });

    if (!latestResults.length) {
      renderEmptyState(t("search.empty"));
      return;
    }

    dom.globalSearchResults.innerHTML = "";
    latestResults.forEach((item, index) => {
      const resultBtn = document.createElement("button");
      resultBtn.type = "button";
      resultBtn.className = "search-result-item";
      resultBtn.dataset.searchIndex = String(index);
      resultBtn.innerHTML = `
        <div class="search-result-title">${escapeHtml(item.displayName || item.pageName)}<span class="search-result-count">${escapeHtml(t("search.resultMatch", { index: item.occurrence + 1 }))}</span></div>
        <div class="search-result-snippet">${item.snippetHtml}</div>
      `;
      dom.globalSearchResults.appendChild(resultBtn);
    });
  }

  // 防抖调度搜索渲染，降低输入过程重算频率。
  function scheduleRender() {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchTimer = null;
      renderResults(dom.globalSearchInput.value);
    }, 80);
  }

  // 绑定搜索输入框与清空按钮行为。
  function bindInput() {
    dom.globalSearchInput.addEventListener("input", scheduleRender);

    dom.globalSearchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        dom.globalSearchInput.value = "";
        renderResults("");
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (!latestResults.length) return;
        state.search.openSearchResult(latestResults[0]);
      }
    });

    dom.clearSearchBtn.addEventListener("click", () => {
      dom.globalSearchInput.value = "";
      renderResults("");
      dom.globalSearchInput.focus();
      setStatus(t("status.searchCleared"));
    });
  }

  // 绑定结果列表点击事件，打开对应页面命中。
  function bindResultClicks() {
    dom.globalSearchResults.addEventListener("click", (e) => {
      const item = e.target.closest("[data-search-index]");
      if (!item) return;
      const index = Number(item.getAttribute("data-search-index"));
      if (!Number.isInteger(index) || index < 0 || index >= latestResults.length) return;
      state.search.openSearchResult(latestResults[index]);
    });
  }

  // 监听编辑器内容变化，在有查询词时自动刷新结果。
  function bindEditorRefresh() {
    if (dom.editor) {
      dom.editor.addEventListener("input", () => {
        if (!latestQuery) return;
        scheduleRender();
      });
    }
    document.addEventListener("editor:content-change", () => {
      if (!latestQuery) return;
      scheduleRender();
    });
  }

  // 外部触发：按当前关键词刷新结果。
  function refreshActiveQuery() {
    if (!latestQuery) return;
    scheduleRender();
  }

  // 一次性绑定搜索相关全部事件并初始化视图。
  function bindAll() {
    bindInput();
    bindResultClicks();
    bindEditorRefresh();
    renderResults("");
  }

  return {
    bindAll,
    refreshActiveQuery
  };
}
