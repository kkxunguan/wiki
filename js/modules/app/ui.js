import { t } from "../i18n.js";

function parsePathAndTime(content, prefix) {
  if (!content.startsWith(prefix)) return null;
  const body = content.slice(prefix.length).trim();
  const separator = t("common.separator");
  const index = body.lastIndexOf(separator);
  if (index < 0) return null;
  return {
    path: body.slice(0, index).trim(),
    time: body.slice(index + separator.length).trim()
  };
}

export function setStatus(dom, text) {
  const content = String(text || "");

  const currentPagePrefix = t("status.currentPagePrefix");
  if (content.startsWith(currentPagePrefix)) {
    if (dom.pagePathEl) dom.pagePathEl.textContent = content.slice(currentPagePrefix.length).trim();
    dom.statusEl.textContent = "";
    return;
  }

  const autoSaved = parsePathAndTime(content, t("status.autoSavedPrefix"));
  const saved = autoSaved || parsePathAndTime(content, t("status.savedPrefix"));
  if (saved) {
    if (dom.pagePathEl) dom.pagePathEl.textContent = saved.path;
    dom.statusEl.textContent = t("status.autoSavedAt", { time: saved.time });
    return;
  }

  const trashPathPrefix = t("status.trashPathPrefix");
  if (content.startsWith(trashPathPrefix)) {
    if (dom.pagePathEl) dom.pagePathEl.textContent = content.slice(trashPathPrefix.length).trim();
    dom.statusEl.textContent = t("status.trashPreview");
    return;
  }

  dom.statusEl.textContent = content;
}

export function showMenuInViewport(menuEl, clientX, clientY) {
  if (!menuEl) return;
  const margin = 8;
  menuEl.style.visibility = "hidden";
  menuEl.style.display = "block";
  const rect = menuEl.getBoundingClientRect();
  const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
  const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
  const left = Math.min(Math.max(clientX, margin), maxLeft);
  const top = Math.min(Math.max(clientY, margin), maxTop);
  menuEl.style.left = `${left}px`;
  menuEl.style.top = `${top}px`;
  menuEl.style.visibility = "visible";
}
