export const STORAGE_KEY = "wiki-pages-v3";
export const STORAGE_TRASH_KEY = "wiki-trash-v1";
export const STORAGE_SCHEMA_KEY = "wiki-storage-schema-version";
export const STORAGE_SCHEMA_VERSION = 2;
export const AUTO_SAVE_DELAY_MS = 1200;

export const state = {
  pages: {},
  trash: {},
  trashPreviewName: "",
  currentPage: "",
  selectedPage: "",
  autoSaveTimer: null,
  editorAdapter: null
};
