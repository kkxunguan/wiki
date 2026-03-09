// 页面数据持久化键（主页面树）。
export const STORAGE_KEY = "wiki-pages-v3";
// 回收站数据持久化键。
export const STORAGE_TRASH_KEY = "wiki-trash-v1";
// 存储结构版本号持久化键。
export const STORAGE_SCHEMA_KEY = "wiki-storage-schema-version";
// 自动保存延迟时间（毫秒）。
export const AUTO_SAVE_DELAY_MS = 1200;

// 全局运行时状态：集中保存页面、回收站与 UI 运行态信息。
export const state = {
  pages: {},
  trash: {},
  trashPreviewName: "",
  currentPage: "",
  selectedPage: "",
  autoSaveTimer: null,
  editorAdapter: null,
  // 运行时服务引用（由 main 初始化后写入）。
  wiki: null,
  editor: null,
  modes: null,
  search: null,
  searchBindings: null
};
