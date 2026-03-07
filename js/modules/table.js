import { t } from "./i18n.js";

export function createTableModule({ dom, state, onContentChanged, queueAutoSave, setStatus }) {
  let selectedTableWrap = null;

  function clearTableSelection() {
    if (selectedTableWrap) selectedTableWrap.classList.remove("table-selected");
    selectedTableWrap = null;
  }

  function applyTableSelectionByCell(cell) {
    const table = cell ? cell.closest("table.wiki-table") : null;
    const wrap = table ? (table.closest(".table-wrap") || table) : null;
    if (selectedTableWrap && selectedTableWrap !== wrap) selectedTableWrap.classList.remove("table-selected");
    selectedTableWrap = wrap;
    if (selectedTableWrap) selectedTableWrap.classList.add("table-selected");
  }

  function buildTableHtml(rows, cols) {
    const safeRows = Math.min(20, Math.max(1, rows));
    const safeCols = Math.min(12, Math.max(1, cols));
    const defaultColWidth = Math.max(80, Math.floor(100 / safeCols));
    const colgroup = Array.from({ length: safeCols }, () => `<col style="width:${defaultColWidth}%;">`).join("");
    const header = `<tr>${Array.from({ length: safeCols }, (_, i) => `<th>${t("table.colLabel", { index: i + 1 })}</th>`).join("")}</tr>`;
    const bodyRows = Array.from({ length: safeRows - 1 }, () => `<tr>${Array.from({ length: safeCols }, () => "<td><br></td>").join("")}</tr>`).join("");
    return `<div class="table-wrap"><table class="wiki-table"><colgroup>${colgroup}</colgroup><tbody>${header}${bodyRows}</tbody></table></div><p><br></p>`;
  }

  function ensureTableColgroup(table) {
    const firstRow = table.rows[0];
    const colCount = firstRow ? firstRow.cells.length : 0;
    if (!colCount) return null;
    let colgroup = table.querySelector("colgroup");
    if (!colgroup) {
      colgroup = document.createElement("colgroup");
      for (let i = 0; i < colCount; i += 1) {
        const col = document.createElement("col");
        col.style.width = `${Math.max(80, Math.floor(100 / colCount))}%`;
        colgroup.appendChild(col);
      }
      table.insertBefore(colgroup, table.firstChild);
    }
    while (colgroup.children.length < colCount) {
      const col = document.createElement("col");
      col.style.width = `${Math.max(80, Math.floor(100 / colCount))}%`;
      colgroup.appendChild(col);
    }
    while (colgroup.children.length > colCount) colgroup.removeChild(colgroup.lastChild);
    return colgroup;
  }

  function findResizableCell(event) {
    const cell = event.target.closest("td,th");
    if (!cell || !dom.editor.contains(cell)) return null;
    const table = cell.closest("table.wiki-table");
    if (!table) return null;
    const rect = cell.getBoundingClientRect();
    if (event.clientX < rect.right - 6) return null;
    if (event.clientX > rect.right + 2) return null;
    return cell;
  }

  function getCurrentTableCell() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const node = sel.getRangeAt(0).commonAncestorContainer;
    const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    if (!el || !dom.editor.contains(el)) return null;
    return el.closest("td,th");
  }

  function hideToolBar() {
    dom.tableToolBar.style.display = "none";
    state.tableToolTargetCell = null;
    clearTableSelection();
  }

  function showToolBarForCell(cell) {
    if (!cell) return hideToolBar();
    const table = cell.closest("table.wiki-table");
    if (!table) return hideToolBar();
    const rect = table.getBoundingClientRect();
    applyTableSelectionByCell(cell);
    state.tableToolTargetCell = cell;
    dom.tableToolBar.style.left = `${Math.max(8, rect.left)}px`;
    dom.tableToolBar.style.top = `${Math.max(8, rect.top - 40)}px`;
    dom.tableToolBar.style.display = "inline-flex";
  }

  function updateToolBarFromSelection() {
    const cell = getCurrentTableCell();
    if (!cell) return hideToolBar();
    showToolBarForCell(cell);
  }

  function commit(msg) {
    onContentChanged();
    queueAutoSave();
    setStatus(msg);
  }

  function addRowAtCell(cell) {
    const table = cell.closest("table.wiki-table");
    if (!table) return;
    const body = table.tBodies[0] || table;
    const rowRef = cell.parentElement;
    const rowIndex = rowRef ? rowRef.rowIndex : body.rows.length - 1;
    const colCount = body.rows[0] ? body.rows[0].cells.length : 0;
    if (!colCount) return;
    const row = document.createElement("tr");
    for (let i = 0; i < colCount; i += 1) {
      const td = document.createElement("td");
      td.innerHTML = "<br>";
      row.appendChild(td);
    }
    if (rowIndex >= body.rows.length - 1) body.appendChild(row);
    else body.insertBefore(row, body.rows[rowIndex + 1]);
    commit(t("status.tableRowAdded"));
    showToolBarForCell(row.cells[0]);
  }

  function removeRowAtCell(cell) {
    const table = cell.closest("table.wiki-table");
    if (!table) return;
    const body = table.tBodies[0] || table;
    if (body.rows.length <= 1) return;
    const row = cell.parentElement;
    const index = row.rowIndex;
    body.deleteRow(index);
    commit(t("status.tableRowRemoved"));
    const next = body.rows[Math.min(index, body.rows.length - 1)];
    showToolBarForCell(next ? next.cells[0] : null);
  }

  function addColAtCell(cell) {
    const table = cell.closest("table.wiki-table");
    if (!table) return;
    const body = table.tBodies[0] || table;
    if (!body.rows.length) return;
    const colIndex = cell.cellIndex + 1;
    Array.from(body.rows).forEach((row, idx) => {
      const newCell = document.createElement(idx === 0 ? "th" : "td");
      newCell.innerHTML = idx === 0 ? t("table.colLabel", { index: colIndex + 1 }) : "<br>";
      if (colIndex >= row.cells.length) row.appendChild(newCell);
      else row.insertBefore(newCell, row.cells[colIndex]);
    });
    const colgroup = ensureTableColgroup(table);
    if (colgroup) {
      const col = document.createElement("col");
      col.style.width = "120px";
      if (colIndex >= colgroup.children.length) colgroup.appendChild(col);
      else colgroup.insertBefore(col, colgroup.children[colIndex]);
    }
    commit(t("status.tableColAdded"));
    const first = body.rows[0];
    showToolBarForCell(first ? first.cells[Math.min(colIndex, first.cells.length - 1)] : cell);
  }

  function removeColAtCell(cell) {
    const table = cell.closest("table.wiki-table");
    if (!table) return;
    const body = table.tBodies[0] || table;
    if (!body.rows.length || body.rows[0].cells.length <= 1) return;
    const colIndex = cell.cellIndex;
    Array.from(body.rows).forEach((row) => {
      if (colIndex >= 0 && colIndex < row.cells.length) row.deleteCell(colIndex);
    });
    const colgroup = table.querySelector("colgroup");
    if (colgroup && colgroup.children.length > 1) {
      const target = colgroup.children[colIndex] || colgroup.lastChild;
      if (target) colgroup.removeChild(target);
    }
    commit(t("status.tableColRemoved"));
    const first = body.rows[0];
    showToolBarForCell(first ? first.cells[Math.max(0, colIndex - 1)] : null);
  }

  function deleteTableAtCell(cell) {
    const table = cell.closest("table.wiki-table");
    if (!table) return;
    const wrap = table.closest(".table-wrap");
    (wrap || table).remove();
    commit(t("status.tableDeleted"));
    hideToolBar();
  }

  function exitTableEdit(cell) {
    const table = cell.closest("table.wiki-table");
    if (!table) return;
    const anchor = table.closest(".table-wrap") || table;
    const range = document.createRange();
    range.setStartAfter(anchor);
    range.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    dom.editor.focus();
    hideToolBar();
  }

  function bindResizeBehavior() {
    dom.editor.addEventListener("mousemove", (e) => {
      if (state.tableResizeState) return;
      const cell = findResizableCell(e);
      dom.editor.style.cursor = cell ? "col-resize" : "";
    });
    dom.editor.addEventListener("mouseleave", () => {
      if (!state.tableResizeState) dom.editor.style.cursor = "";
    });

    dom.editor.addEventListener("mousedown", (e) => {
      const cell = findResizableCell(e);
      if (!cell) return;
      const table = cell.closest("table.wiki-table");
      const colgroup = ensureTableColgroup(table);
      if (!colgroup) return;
      const col = colgroup.children[cell.cellIndex];
      if (!col) return;
      const rect = cell.getBoundingClientRect();
      state.tableResizeState = { col, startX: e.clientX, startWidth: rect.width };
      e.preventDefault();
      dom.editor.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    });

    window.addEventListener("mousemove", (e) => {
      if (!state.tableResizeState) return;
      const delta = e.clientX - state.tableResizeState.startX;
      const width = Math.max(60, state.tableResizeState.startWidth + delta);
      state.tableResizeState.col.style.width = `${width}px`;
    });

    window.addEventListener("mouseup", () => {
      if (!state.tableResizeState) return;
      state.tableResizeState = null;
      dom.editor.style.cursor = "";
      document.body.style.userSelect = "";
      queueAutoSave();
      setStatus(t("status.tableResized"));
    });
  }

  function bindToolbarActions() {
    dom.tableToolBar.addEventListener("mousedown", (e) => e.preventDefault());
    dom.tableExitBtn.addEventListener("click", () => state.tableToolTargetCell && exitTableEdit(state.tableToolTargetCell));
    dom.tableInsertRowBtn.addEventListener("click", () => state.tableToolTargetCell && addRowAtCell(state.tableToolTargetCell));
    dom.tableDeleteRowBtn.addEventListener("click", () => state.tableToolTargetCell && removeRowAtCell(state.tableToolTargetCell));
    dom.tableInsertColBtn.addEventListener("click", () => state.tableToolTargetCell && addColAtCell(state.tableToolTargetCell));
    dom.tableDeleteColBtn.addEventListener("click", () => state.tableToolTargetCell && removeColAtCell(state.tableToolTargetCell));
    dom.tableDeleteBtn.addEventListener("click", () => state.tableToolTargetCell && deleteTableAtCell(state.tableToolTargetCell));
  }

  function bindTableSelectionTracking() {
    dom.editor.addEventListener("click", updateToolBarFromSelection);
    dom.editor.addEventListener("keyup", updateToolBarFromSelection);
    dom.editor.addEventListener("mouseup", updateToolBarFromSelection);
    document.addEventListener("selectionchange", updateToolBarFromSelection);
    document.addEventListener("scroll", hideToolBar, true);
    window.addEventListener("resize", hideToolBar);
  }

  function bindTableInsert(exec) {
    const apply = () => {
      const rows = Number(dom.tableRowsInput.value);
      const cols = Number(dom.tableColsInput.value);
      if (!Number.isFinite(rows) || !Number.isFinite(cols) || rows <= 0 || cols <= 0) {
        setStatus(t("error.tableInvalidNumber"));
        return;
      }
      exec("insertHTML", buildTableHtml(Math.round(rows), Math.round(cols)));
      queueAutoSave();
      setStatus(t("status.tableInserted", { rows: Math.round(rows), cols: Math.round(cols) }));
    };

    dom.tableCustomApplyBtn.addEventListener("click", () => {
      apply();
    });

    dom.tableColsInput.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      apply();
    });
  }

  return {
    bindResizeBehavior,
    bindToolbarActions,
    bindTableSelectionTracking,
    bindTableInsert,
    hideToolBar,
    getCurrentTableCell
  };
}
