import { t } from "../i18n.js";

export function createTransfer({
  state,
  wiki,
  persistPages,
  persistTrash,
  setStatus,
  storageKey,
  trashStorageKey
}) {
  function exportAllToJson() {
    if (state.autoSaveTimer) clearTimeout(state.autoSaveTimer);
    wiki.saveCurrentPage(true);

    const now = new Date();
    const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
    const payload = {
      exportedAt: now.toISOString(),
      storageKey,
      trashStorageKey,
      currentPage: state.currentPage,
      pages: state.pages,
      trash: state.trash
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wiki-backup-${ts}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus(t("status.exportedJson"));
  }

  function normalizeImportedPagesPayload(parsed) {
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.pages && typeof parsed.pages === "object") return parsed.pages;
    return parsed;
  }

  function normalizeImportedTrashPayload(parsed) {
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.trash && typeof parsed.trash === "object") return parsed.trash;
    return null;
  }

  function importFromJsonText(rawText, mode = "merge") {
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      setStatus(t("error.importInvalidJson"));
      return;
    }

    const incomingPages = normalizeImportedPagesPayload(parsed);
    const incomingTrash = normalizeImportedTrashPayload(parsed);
    const hasPages = incomingPages && typeof incomingPages === "object";
    const hasTrash = incomingTrash && typeof incomingTrash === "object";
    if (!hasPages && !hasTrash) {
      setStatus(t("error.importMissingData"));
      return;
    }

    if (state.autoSaveTimer) clearTimeout(state.autoSaveTimer);
    wiki.saveCurrentPage(true);

    let importedCount = 0;
    let overwrittenCount = 0;
    let importedTrashCount = 0;
    let overwrittenTrashCount = 0;

    if (mode === "replace") {
      const nextPages = {};
      if (hasPages) {
        Object.keys(incomingPages).forEach((name) => {
          const key = wiki.sanitizeName(name);
          if (!key) return;
          importedCount += 1;
          nextPages[key] = incomingPages[name];
        });
      }

      const nextTrash = {};
      if (hasTrash) {
        Object.keys(incomingTrash).forEach((name) => {
          const key = wiki.sanitizeName(name);
          if (!key) return;
          importedTrashCount += 1;
          nextTrash[key] = incomingTrash[name];
        });
      }

      state.pages = wiki.normalizePages(nextPages);
      state.trash = wiki.normalizeTrash(nextTrash);
    } else {
      if (hasPages) {
        const merged = { ...state.pages };
        Object.keys(incomingPages).forEach((name) => {
          const key = wiki.sanitizeName(name);
          if (!key) return;
          if (merged[key]) overwrittenCount += 1;
          importedCount += 1;
          merged[key] = incomingPages[name];
        });
        if (importedCount) state.pages = wiki.normalizePages(merged);
      }

      if (hasTrash) {
        const mergedTrash = { ...state.trash };
        Object.keys(incomingTrash).forEach((name) => {
          const key = wiki.sanitizeName(name);
          if (!key) return;
          if (mergedTrash[key]) overwrittenTrashCount += 1;
          importedTrashCount += 1;
          mergedTrash[key] = incomingTrash[name];
        });
        if (importedTrashCount) state.trash = wiki.normalizeTrash(mergedTrash);
      }
    }

    let dedupedTrashCount = 0;
    if (Object.keys(state.pages).length && Object.keys(state.trash).length) {
      Object.keys(state.trash).forEach((name) => {
        if (!state.pages[name]) return;
        delete state.trash[name];
        dedupedTrashCount += 1;
      });
    }

    persistPages(state.pages);
    wiki.renderPageList();
    persistTrash(state.trash);
    wiki.renderTrashList();

    if (!importedCount && !importedTrashCount) {
      setStatus(t("error.importNoUsableData"));
      return;
    }

    const openTarget = state.pages[state.currentPage]
      ? state.currentPage
      : (parsed.currentPage && state.pages[parsed.currentPage] ? parsed.currentPage : Object.keys(state.pages)[0]);
    if (openTarget) wiki.openPage(openTarget);

    const dedupe = dedupedTrashCount ? t("status.importDedupe", { count: dedupedTrashCount }) : "";
    const modeText = t(mode === "replace" ? "status.importMode.replace" : "status.importMode.merge");
    setStatus(t("status.importComplete", {
      mode: modeText,
      pages: importedCount,
      pagesOver: overwrittenCount,
      trash: importedTrashCount,
      trashOver: overwrittenTrashCount,
      dedupe
    }));
  }

  return { exportAllToJson, importFromJsonText };
}
