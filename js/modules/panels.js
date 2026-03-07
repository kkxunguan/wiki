export function createPanels(dom) {
  const panelMap = {
    color: { btn: dom.colorBtn, panel: dom.palettePanel },
    bgColor: { btn: dom.colorBtn, panel: dom.palettePanel },
    pageBg: { btn: dom.colorBtn, panel: dom.palettePanel },
    fontSize: { btn: dom.fontSizeBtn, panel: dom.fontSizePanel },
    table: { btn: dom.insertTableBtn, panel: dom.tablePanel }
  };

  function positionNearButton(panel, btn) {
    const rect = btn.getBoundingClientRect();
    panel.style.left = `${Math.max(8, rect.left)}px`;
    panel.style.top = `${rect.bottom + 8}px`;
  }

  function hide(name) {
    const entry = panelMap[name];
    if (!entry || !entry.panel) return;
    entry.panel.style.display = "none";
  }

  function show(name) {
    const entry = panelMap[name];
    if (!entry || !entry.panel || !entry.btn) return;
    const { panel, btn } = entry;
    Object.keys(panelMap).forEach((n) => {
      if (n !== name) hide(n);
    });
    positionNearButton(panel, btn);
    panel.style.display = "block";
  }

  function toggle(name) {
    const entry = panelMap[name];
    if (!entry || !entry.panel) return;
    const panel = entry.panel;
    if (panel.style.display === "block") hide(name);
    else show(name);
  }

  function hideAll() {
    Object.keys(panelMap).forEach(hide);
  }

  function bindGlobalDismiss(extraIgnoreSelectors = []) {
    document.addEventListener("click", (e) => {
      const insideAnyPanel = Object.values(panelMap).some(({ panel, btn }) =>
        (panel && e.target.closest(`#${panel.id}`)) || (btn && e.target.closest(`#${btn.id}`))
      );
      const insideExtra = extraIgnoreSelectors.some((sel) => e.target.closest(sel));
      if (!insideAnyPanel && !insideExtra) hideAll();
    });
    document.addEventListener("scroll", hideAll, true);
    window.addEventListener("resize", hideAll);
  }

  return { toggle, show, hide, hideAll, bindGlobalDismiss };
}
