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
  pageMenuRenameBtn: document.getElementById("pageMenuRenameBtn"),
  pageMenuNewChildBtn: document.getElementById("pageMenuNewChildBtn"),
  pageMenuSortUpBtn: document.getElementById("pageMenuSortUpBtn"),
  pageMenuSortDownBtn: document.getElementById("pageMenuSortDownBtn"),
  pageMenuSetSortBtn: document.getElementById("pageMenuSetSortBtn"),
  pageMenuDeleteBtn: document.getElementById("pageMenuDeleteBtn"),

  trashItemMenu: document.getElementById("trashItemMenu"),
  trashMenuRestoreBtn: document.getElementById("trashMenuRestoreBtn"),
  trashMenuDeleteBtn: document.getElementById("trashMenuDeleteBtn"),
  renameDialogBackdrop: document.getElementById("renameDialogBackdrop"),
  renameDialog: document.getElementById("renameDialog"),
  renameDialogTitle: document.getElementById("renameDialogTitle"),
  renamePageInput: document.getElementById("renamePageInput"),
  renameDialogCancelBtn: document.getElementById("renameDialogCancelBtn"),
  renameDialogConfirmBtn: document.getElementById("renameDialogConfirmBtn"),

  counter: document.getElementById("counter"),
  statusEl: document.getElementById("status"),
  pagePathEl: document.getElementById("pagePath"),
  modeToggleBtn: document.getElementById("modeToggleBtn")
};
