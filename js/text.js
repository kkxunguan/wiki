const messages = {
  "common.separator": " / ",

  "content.homeWelcome": "<h1>首页</h1><p>欢迎使用 Wiki。</p>",
  "content.newPage": "<h1>{title}</h1><p>这是新页面，开始编辑吧。</p>",
  "content.newWiki": "<h1>首页</h1><p>新 Wiki 已创建。</p>",
  "content.usage": "<h1>使用说明</h1><p>支持页面树、内链和图片粘贴。</p>",

  "counter.words": "{count} 字",
  "editor.emptyPlaceholder": "输入 [[页面名]] 可创建 Wiki 内链",

  "error.cannotCreateInTrashView": "回收站视图下不可新建页面",
  "error.moveToDescendant": "不能移动到自己的子孙页面",
  "error.openOrCreateFirst": "请先创建或打开页面",
  "error.pageExists": "页面“{name}”已存在",
  "error.pageNameRequired": "页面名不能为空",
  "error.parentCannotSelf": "父级不能是自己",
  "error.searchPageMissing": "页面不存在：{page}",
  "error.sortMustBeNumber": "排序值必须是数字",
  "error.targetParentMissing": "目标父级不存在",
  "error.trashPreviewReadOnlyMode": "回收站预览仅支持阅读模式",
  "error.trashPreviewReadOnlySave": "回收站预览不可保存",
  "error.wangEditorLoadFailed": "WangEditor 加载失败，已降级为基础编辑器。",

  "mode.edit": "编辑",
  "mode.read": "阅读",

  "page.defaultPrefix": "页面",
  "page.home": "首页",
  "page.restoreSuffix": "恢复",
  "page.unnamed": "未命名",
  "page.usage": "使用说明",

  "prompt.sortValue": "输入排序值（数字，越小越靠前）",

  "search.empty": "未找到匹配内容",
  "search.meta": "关键词“{query}” | {count} 条结果",
  "search.resultMatch": "匹配 #{index}",

  "status.alreadyBottom": "已经在最下方",
  "status.alreadyTop": "已经在最上方",
  "status.autoSaved": "已自动保存：{path} / {time}",
  "status.autoSavedAt": "已自动保存：{time}",
  "status.autoSavedPrefix": "已自动保存：",
  "status.currentPage": "当前页面：{path}",
  "status.currentPagePrefix": "当前页面：",
  "status.deletedPromoteChildren": "已删除页面并提升子页面：{name}",
  "status.hierarchyUpdated": "已更新层级：{path}",
  "status.initFailed": "初始化失败，请刷新页面重试。",
  "status.loaded": "已加载",
  "status.movedDown": "已下移：{name}",
  "status.movedToTrash": "已移入回收站：{name}",
  "status.movedUp": "已上移：{name}",
  "status.pageCreated": "已创建页面：{name}",
  "status.purgedFromTrash": "已从回收站彻底删除：{name}",
  "status.renamed": "已重命名：{oldName} -> {newName}",
  "status.restoredFromTrash": "已从回收站恢复：{name}",
  "status.saved": "已保存页面：{path} / {time}",
  "status.savedPrefix": "已保存页面：",
  "status.searchCleared": "已清空搜索",
  "status.searchJumped": "已跳转到：{page}",
  "status.searchOpenedNoHit": "已打开页面：{page}（未定位到关键词）",
  "status.sortSet": "已设置排序值：{name} -> {value}",
  "status.trashPath": "回收站路径：{path}",
  "status.trashPathPrefix": "回收站路径：",
  "status.trashPreview": "回收站预览",

  "wiki.pageMeta": "{count}字 / 排序{sortKey}",
  "wiki.trashDepth": "层级{depth}",
  "wiki.trashDepthRoot": "根",
  "wiki.trashEmpty": "回收站为空"
};

function formatTemplate(template, params) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => {
    if (params && Object.prototype.hasOwnProperty.call(params, key)) {
      const value = params[key];
      return value === null || value === undefined ? "" : String(value);
    }
    return "";
  });
}

export function t(key, params = null) {
  const template = Object.prototype.hasOwnProperty.call(messages, key) ? messages[key] : key;
  if (!params) return String(template);
  return formatTemplate(template, params);
}
