import {
  STORAGE_KEY,
  STORAGE_TRASH_KEY,
  state
} from "./document/state.js";
import { loadPages, loadJson } from "./document/storage.js";
import { createEditor } from "./ui/editorUI.js";
import { createWiki } from "./document/wiki.js";
import { setStatus } from "./ui/uiShared.js";
import { createModes } from "./ui/treeModes.js";
import { createWikiBindings } from "./ui/treeUI.js";
import { createSearch } from "./document/search.js";
import { createSearchBindings } from "./ui/searchUI.js";
import { t } from "./text.js";

async function init() {
  state.wiki = createWiki();
  state.editor = createEditor();

  state.modes = createModes();
  state.search = createSearch();
  state.searchBindings = createSearchBindings();

  const rawPages = await loadPages(STORAGE_KEY);
  const rawTrash = await loadJson(STORAGE_TRASH_KEY, {});

  state.pages = state.wiki.normalizePages(rawPages);
  state.trash = state.wiki.normalizeTrash(rawTrash);
  if (!Object.keys(state.pages).length) {
    const homePage = t("page.home");
    state.pages = state.wiki.normalizePages({
      [homePage]: {
        title: homePage,
        content: t("content.homeWelcome"),
        parent: null
      }
    });
  }

  createWikiBindings().bindAll();
  state.searchBindings.bindAll();

  state.wiki.bindTrashActions();
  state.wiki.renderPageList();
  state.wiki.renderTrashList();
  state.modes.applyTreeMode();
  state.wiki.openPage(Object.keys(state.pages)[0]);
  state.modes.applyMode();
  setStatus(t("status.loaded"));
}

init();
