// 全局 DOM 引用表：统一缓存页面上会频繁使用的节点。
export const dom = {
  editorWrap: document.getElementById("editorWrap"),
  editor: document.getElementById("editor"),
  editorToolbar: document.getElementById("editorToolbar"),

  pageList: document.getElementById("pageList"),
  trashList: document.getElementById("trashList"),
  showPagesBtn: document.getElementById("showPagesBtn"),
  showTrashBtn: document.getElementById("showTrashBtn"),
  quickCreatePageBtn: document.getElementById("quickCreatePageBtn"),

  globalSearchInput: document.getElementById("globalSearchInput"),
  clearSearchBtn: document.getElementById("clearSearchBtn"),
  globalSearchResultMeta: document.getElementById("globalSearchResultMeta"),
  globalSearchResults: document.getElementById("globalSearchResults"),

  pageItemMenu: document.getElementById("pageItemMenu"),
  pageMenuOpenBtn: document.getElementById("pageMenuOpenBtn"),
  pageMenuNewChildBtn: document.getElementById("pageMenuNewChildBtn"),
  pageMenuSortUpBtn: document.getElementById("pageMenuSortUpBtn"),
  pageMenuSortDownBtn: document.getElementById("pageMenuSortDownBtn"),
  pageMenuSetSortBtn: document.getElementById("pageMenuSetSortBtn"),
  pageMenuMoveRootBtn: document.getElementById("pageMenuMoveRootBtn"),
  pageMenuDeleteBtn: document.getElementById("pageMenuDeleteBtn"),
  pageMenuDeleteKeepChildrenBtn: document.getElementById("pageMenuDeleteKeepChildrenBtn"),

  trashItemMenu: document.getElementById("trashItemMenu"),
  trashMenuRestoreBtn: document.getElementById("trashMenuRestoreBtn"),
  trashMenuDeleteBtn: document.getElementById("trashMenuDeleteBtn"),

  counter: document.getElementById("counter"),
  statusEl: document.getElementById("status"),
  pagePathEl: document.getElementById("pagePath"),
  modeToggleBtn: document.getElementById("modeToggleBtn")
};
