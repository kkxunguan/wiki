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
  const rawPages = await loadPages(STORAGE_KEY);
  const rawTrash = await loadJson(STORAGE_TRASH_KEY, {});

  const wiki = createWiki();
  const editor = createEditor();
  const modes = createModes();
  const search = createSearch();
  const searchBindings = createSearchBindings();

  state.wiki = wiki;
  state.editor = editor;
  state.modes = modes;
  state.search = search;
  state.searchBindings = searchBindings;

  state.pages = wiki.normalizePages(rawPages);
  state.trash = wiki.normalizeTrash(rawTrash);

  if (!Object.keys(state.pages).length) {
    const homePage = t("page.home");
    state.pages = wiki.normalizePages({
      [homePage]: {
        title: homePage,
        content: t("content.homeWelcome"),
        parent: null
      }
    });
  }

  const wikiBindings = createWikiBindings();
  wikiBindings.bindAll();
  searchBindings.bindAll();

  wiki.bindTrashActions();
  wiki.renderPageList();
  wiki.renderTrashList();
  modes.applyTreeMode();
  wiki.openPage(Object.keys(state.pages)[0]);
  modes.applyMode();
  setStatus(t("status.loaded"));
}

init();
