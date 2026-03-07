import { t } from "../i18n.js";

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function createSearchBindings({ dom, search, setStatus }) {
  let latestResults = [];
  let latestQuery = "";
  let searchTimer = null;

  function setSearchVisibility(visible) {
    dom.globalSearchResultMeta.classList.toggle("hidden", !visible);
    dom.globalSearchResults.classList.toggle("hidden", !visible);
  }

  function renderEmptyState(text) {
    dom.globalSearchResults.innerHTML = `<div class="search-result-empty">${escapeHtml(text)}</div>`;
  }

  function renderResults(rawQuery) {
    const query = search.normalizeSearchText(rawQuery);
    latestQuery = query;
    if (!query) {
      latestResults = [];
      dom.globalSearchResultMeta.textContent = "";
      dom.globalSearchResults.innerHTML = "";
      setSearchVisibility(false);
      return;
    }

    latestResults = search.searchPages(query);
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
        <div class="search-result-title">${escapeHtml(item.pageName)}<span class="search-result-count">${escapeHtml(t("search.resultMatch", { index: item.occurrence + 1 }))}</span></div>
        <div class="search-result-snippet">${item.snippetHtml}</div>
      `;
      dom.globalSearchResults.appendChild(resultBtn);
    });
  }

  function scheduleRender() {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchTimer = null;
      renderResults(dom.globalSearchInput.value);
    }, 80);
  }

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
        search.openSearchResult(latestResults[0]);
      }
    });

    dom.clearSearchBtn.addEventListener("click", () => {
      dom.globalSearchInput.value = "";
      renderResults("");
      dom.globalSearchInput.focus();
      setStatus(t("status.searchCleared"));
    });
  }

  function bindResultClicks() {
    dom.globalSearchResults.addEventListener("click", (e) => {
      const item = e.target.closest("[data-search-index]");
      if (!item) return;
      const index = Number(item.getAttribute("data-search-index"));
      if (!Number.isInteger(index) || index < 0 || index >= latestResults.length) return;
      search.openSearchResult(latestResults[index]);
    });
  }

  function bindEditorRefresh() {
    dom.editor.addEventListener("input", () => {
      if (!latestQuery) return;
      scheduleRender();
    });
  }

  function refreshActiveQuery() {
    if (!latestQuery) return;
    scheduleRender();
  }

  function bindAll() {
    bindInput();
    bindResultClicks();
    bindEditorRefresh();
    renderResults("");
  }

  return {
    bindAll,
    renderResults,
    refreshActiveQuery
  };
}
