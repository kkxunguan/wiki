export function setStatus(dom, text) {
  const content = String(text || "");

  const currentPageMatch = content.match(/^当前页面：(.+)$/);
  if (currentPageMatch) {
    if (dom.pagePathEl) dom.pagePathEl.textContent = currentPageMatch[1].trim();
    dom.statusEl.textContent = "";
    return;
  }

  const saveMatch = content.match(/^已(?:自动)?保存：(.+?)\s*·\s*(\d{2}:\d{2}:\d{2})$/);
  if (saveMatch) {
    if (dom.pagePathEl) dom.pagePathEl.textContent = saveMatch[1].trim();
    dom.statusEl.textContent = `已自动保存：${saveMatch[2]}`;
    return;
  }

  const trashPathMatch = content.match(/^回收站路径：(.+)$/);
  if (trashPathMatch) {
    if (dom.pagePathEl) dom.pagePathEl.textContent = trashPathMatch[1].trim();
    dom.statusEl.textContent = "回收站预览";
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
