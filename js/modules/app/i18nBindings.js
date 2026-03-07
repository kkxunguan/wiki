import { getCurrentLocale, setLocale } from "../i18n.js";

export function createI18nBindings({ dom, modes, wiki, editor, searchBindings }) {
  function refreshRuntimeLocalizedUi() {
    modes.applyMode();
    wiki.renderPageList();
    wiki.renderTrashList();
    wiki.renderPreview();
    editor.updateCounter();
    if (searchBindings && typeof searchBindings.refreshActiveQuery === "function") {
      searchBindings.refreshActiveQuery();
    }
  }

  function bindLocaleSwitch() {
    if (!dom.localeSelect) return;
    dom.localeSelect.value = getCurrentLocale();
    dom.localeSelect.addEventListener("change", () => {
      const locale = setLocale(dom.localeSelect.value, { apply: true, persist: true, root: document });
      dom.localeSelect.value = locale;
      refreshRuntimeLocalizedUi();
    });
  }

  function bindAll() {
    bindLocaleSwitch();
  }

  return {
    bindAll,
    refreshRuntimeLocalizedUi
  };
}
