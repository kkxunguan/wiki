import { getLatestVersion } from "../featureLog.js";
import { t } from "../i18n.js";

export function createVersionBindings({ dom }) {
  function renderLatestVersion() {
    if (!dom.latestVersionEl) return;
    const latestVersion = getLatestVersion();
    dom.latestVersionEl.textContent = t("version.latest", { version: latestVersion });
  }

  function bindAll() {
    renderLatestVersion();
    document.addEventListener("i18n:changed", renderLatestVersion);
  }

  return {
    bindAll,
    renderLatestVersion
  };
}

