import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import { paperTheme } from "@/styles";
import type { ColumnDef, ColumnGroup, ColumnGroupId, ExpandedGroups } from "@/types/spreadsheet.types";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Table2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSpreadsheetData } from "./useSpreadsheetData";

const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth();

// ── Active cell context ──────────────────────────────────────────

interface CellAddr {
  rowIdx: number;   // index into rows[]
  colIdx: number;   // index into flat visible columns
}

export default function SpreadsheetPage() {
  const [startYear, setStartYear] = useState(currentYear);
  const [endYear, setEndYear] = useState(currentYear);

  const { rows, columnGroups, loading, reload, updateEntry, removeEntry } =
    useSpreadsheetData(startYear, 0, endYear, 11);

  const [expanded, setExpanded] = useState<ExpandedGroups>({
    time: true,
    // Income is a single auto-derived column now, so no point hiding it.
    income: true,
    payments: false,
    savings: true,
    other: true,
  });

  const toggleGroup = useCallback((id: ColumnGroupId) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const shiftRange = (delta: number) => {
    setStartYear((y) => y + delta);
    setEndYear((y) => y + delta);
  };

  // Get visible columns for a group
  const getVisibleColumns = (group: ColumnGroup): ColumnDef[] => {
    if (group.alwaysExpanded || expanded[group.id]) {
      return group.columns;
    }
    const summary = group.columns.find((c) => c.key === group.summaryColumnKey);
    return summary ? [summary] : [group.columns[0]];
  };

  // Flat list of all visible columns (for keyboard nav)
  const flatColumns = useMemo(() => {
    const result: { col: ColumnDef; groupId: ColumnGroupId }[] = [];
    for (const group of columnGroups) {
      for (const col of getVisibleColumns(group)) {
        result.push({ col, groupId: group.id });
      }
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnGroups, expanded]);

  // ── Active cell & editing state ────────────────────────────────

  const [active, setActive] = useState<CellAddr | null>(null);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  const gridRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const committingRef = useRef(false);  // guard against double-commit

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  // ── Cell helpers ───────────────────────────────────────────────

  const canEditCell = useCallback((rowIdx: number, colIdx: number): boolean => {
    if (rowIdx < 0 || rowIdx >= rows.length) return false;
    if (colIdx < 0 || colIdx >= flatColumns.length) return false;
    return flatColumns[colIdx].col.editable;
  }, [rows, flatColumns]);

  const getCellDisplayValue = useCallback((rowIdx: number, colIdx: number): number | string | null | undefined => {
    if (rowIdx < 0 || rowIdx >= rows.length) return null;
    if (colIdx < 0 || colIdx >= flatColumns.length) return null;
    return rows[rowIdx].values[flatColumns[colIdx].col.key];
  }, [rows, flatColumns]);

  // ── Commit / cancel ────────────────────────────────────────────

  const doCommit = useCallback(async () => {
    if (!active || committingRef.current) return;
    committingRef.current = true;
    try {
      const { col } = flatColumns[active.colIdx];
      const monthKey = rows[active.rowIdx].monthKey;
      const trimmed = editValue.trim();

      if (trimmed === "" || trimmed === "0") {
        await removeEntry(monthKey, col.key);
      } else {
        const num = parseFloat(trimmed);
        if (!isNaN(num)) {
          await updateEntry(monthKey, col.key, num);
        }
      }
    } finally {
      committingRef.current = false;
    }
    setEditing(false);
  }, [active, flatColumns, rows, editValue, updateEntry, removeEntry]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setEditValue("");
    gridRef.current?.focus();
  }, []);

  const startEditing = useCallback((addr: CellAddr, initialValue?: string) => {
    if (!canEditCell(addr.rowIdx, addr.colIdx)) return;
    setActive(addr);
    if (initialValue !== undefined) {
      setEditValue(initialValue);
    } else {
      const val = getCellDisplayValue(addr.rowIdx, addr.colIdx);
      setEditValue(val != null && val !== 0 ? String(val) : "");
    }
    setEditing(true);
  }, [canEditCell, getCellDisplayValue]);

  // ── Keyboard handler ───────────────────────────────────────────

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (editing) {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        const nextRow = active && active.rowIdx < rows.length - 1
          ? { ...active, rowIdx: active.rowIdx + 1 }
          : active;
        doCommit().then(() => {
          setActive(nextRow);
          gridRef.current?.focus();
        });
      } else if (e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        const next = active
          ? e.shiftKey
            ? active.colIdx > 0 ? { ...active, colIdx: active.colIdx - 1 } : active
            : active.colIdx < flatColumns.length - 1 ? { ...active, colIdx: active.colIdx + 1 } : active
          : active;
        doCommit().then(() => {
          setActive(next);
          gridRef.current?.focus();
        });
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        cancelEdit();
      }
      return;
    }

    // Navigation mode
    if (!active) return;

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        setActive(prev => prev && prev.rowIdx > 0 ? { ...prev, rowIdx: prev.rowIdx - 1 } : prev);
        break;
      case "ArrowDown":
        e.preventDefault();
        setActive(prev => prev && prev.rowIdx < rows.length - 1 ? { ...prev, rowIdx: prev.rowIdx + 1 } : prev);
        break;
      case "ArrowLeft":
        e.preventDefault();
        setActive(prev => prev && prev.colIdx > 0 ? { ...prev, colIdx: prev.colIdx - 1 } : prev);
        break;
      case "ArrowRight":
        e.preventDefault();
        setActive(prev => prev && prev.colIdx < flatColumns.length - 1 ? { ...prev, colIdx: prev.colIdx + 1 } : prev);
        break;
      case "Tab": {
        e.preventDefault();
        setActive(prev => {
          if (!prev) return prev;
          if (e.shiftKey) {
            return prev.colIdx > 0 ? { ...prev, colIdx: prev.colIdx - 1 } : prev;
          }
          return prev.colIdx < flatColumns.length - 1 ? { ...prev, colIdx: prev.colIdx + 1 } : prev;
        });
        break;
      }
      case "Enter":
      case "F2":
        e.preventDefault();
        startEditing(active);
        break;
      case "Delete":
      case "Backspace": {
        e.preventDefault();
        if (canEditCell(active.rowIdx, active.colIdx)) {
          const { col } = flatColumns[active.colIdx];
          removeEntry(rows[active.rowIdx].monthKey, col.key);
        }
        break;
      }
      default:
        // Printable character → start editing with that character
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          if (canEditCell(active.rowIdx, active.colIdx)) {
            e.preventDefault();
            startEditing(active, e.key);
          }
        }
    }
  }, [editing, active, rows, flatColumns, doCommit, cancelEdit, startEditing, canEditCell, removeEntry]);

  // ── Click handlers ─────────────────────────────────────────────

  const handleCellClick = useCallback((rowIdx: number, colIdx: number) => {
    if (editing) doCommit();
    setActive({ rowIdx, colIdx });
    setEditing(false);
    gridRef.current?.focus();
  }, [editing, doCommit]);

  const handleCellDoubleClick = useCallback((rowIdx: number, colIdx: number) => {
    startEditing({ rowIdx, colIdx });
  }, [startEditing]);

  // Commit when focus leaves the grid entirely
  const handleGridBlur = useCallback((e: React.FocusEvent) => {
    if (!editing) return;
    // If focus moved to something inside the grid (like the cell input), ignore
    if (gridRef.current?.contains(e.relatedTarget as Node)) return;
    doCommit().then(() => gridRef.current?.focus());
  }, [editing, doCommit]);

  // ── Render ─────────────────────────────────────────────────────

  // Track flat column index for each cell
  let globalColIdx = 0;

  // Sticky offsets for the Time-group columns (kept in sync with the
  // widths declared in column-config.ts).
  const TIME_COL_WIDTHS = { year: 60, month: 80 } as const;

  return (
    <div className="min-h-screen w-full p-4 md:p-8 bg-[repeating-linear-gradient(0deg,#fbf6e9,#fbf6e9_28px,#f2e8cf_28px,#f2e8cf_29px)]">
      <div
        className={cn(
          "fixed inset-0 opacity-5 pointer-events-none",
          paperTheme.effects.paperTexture,
        )}
      />

      <div className="max-w-[98vw] mx-auto relative">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "p-3 rounded-xl",
                  paperTheme.colors.background.white,
                  paperTheme.colors.borders.amber,
                  paperTheme.effects.shadow.md,
                )}
              >
                <Table2 className="w-8 h-8 text-amber-600" />
              </div>
              <div>
                <h1
                  className={cn(
                    "text-3xl font-bold",
                    paperTheme.colors.text.accent,
                  )}
                  style={{ fontFamily: paperTheme.fonts.handwriting }}
                >
                  Spreadsheet
                </h1>
                <p className="text-stone-500 text-sm">
                  Click a cell to select, type to edit — Arrow keys to navigate
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => shiftRange(-1)}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  paperTheme.colors.interactive.ghost,
                )}
              >
                <ChevronLeft className="w-5 h-5 text-stone-600" />
              </button>
              <span
                className="text-lg font-bold text-amber-700 min-w-[80px] text-center"
                style={{ fontFamily: paperTheme.fonts.handwriting }}
              >
                {startYear === endYear ? startYear : `${startYear}–${endYear}`}
              </span>
              <button
                onClick={() => shiftRange(1)}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  paperTheme.colors.interactive.ghost,
                )}
              >
                <ChevronRight className="w-5 h-5 text-stone-600" />
              </button>
              <button
                onClick={reload}
                disabled={loading}
                className={cn(
                  "ml-2 p-2 rounded-lg transition-colors",
                  paperTheme.colors.borders.amber,
                  paperTheme.colors.interactive.ghost,
                  "border",
                )}
              >
                <RefreshCw
                  className={cn("w-4 h-4 text-stone-600", loading && "animate-spin")}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Spreadsheet */}
        {loading && rows.length === 0 ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
          </div>
        ) : (
          <div
            ref={gridRef}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onBlur={handleGridBlur}
            className={cn(
              "rounded-xl overflow-hidden outline-none",
              paperTheme.colors.borders.paper,
              paperTheme.effects.shadow.lg,
              "relative focus:ring-2 focus:ring-amber-300/50",
            )}
          >
            {/* Row-aware sticky cell backgrounds via CSS variable.
                Each row sets --row-bg on itself; sticky cells paint that
                colour, so hover and current-month state stay in sync
                between the frozen Time columns and the rest. */}
            <style>{SPREADSHEET_CSS}</style>
            <div className="overflow-x-auto">
              <table
                className="ss-table min-w-[600px]"
                style={{
                  tableLayout: "fixed",
                  borderCollapse: "separate",
                  borderSpacing: 0,
                }}
              >
                {/* Explicit per-column widths so table-layout: fixed has
                    something to use. Without this, fixed layout falls
                    back to even distribution. */}
                <colgroup>
                  {columnGroups.map((group) =>
                    getVisibleColumns(group).map((col) => (
                      <col
                        key={col.key}
                        style={{ width: col.width ?? 80 }}
                      />
                    )),
                  )}
                </colgroup>
                {/* Group headers row */}
                <thead>
                  <tr>
                    {columnGroups.flatMap((group) => {
                      const visCols = getVisibleColumns(group);
                      const isExpanded = group.alwaysExpanded || expanded[group.id];
                      const isTime = group.id === "time";

                      // Time group: render N separate sticky cells (no
                      // colSpan). colSpan + position:sticky is unreliable
                      // across browsers. The first cell carries the
                      // label; the rest are visually-continuous extensions
                      // styled identically with no left border.
                      if (isTime) {
                        return visCols.map((_col, idx) => (
                          <th
                            key={`time-group-${idx}`}
                            className={cn(
                              "ss-cell ss-th-group ss-sticky",
                              idx === visCols.length - 1 && "ss-freeze-edge",
                              groupHeaderBg(group.id),
                            )}
                            style={{
                              fontFamily: paperTheme.fonts.handwriting,
                              left: idx === 0 ? 0 : TIME_COL_WIDTHS.year,
                              zIndex: 32,
                            }}
                          >
                            {idx === 0 && (
                              <div className="flex items-center justify-center gap-1">
                                {group.label}
                              </div>
                            )}
                          </th>
                        ));
                      }

                      return [
                        <th
                          key={group.id}
                          colSpan={visCols.length}
                          className={cn(
                            "ss-cell ss-th-group",
                            groupHeaderBg(group.id),
                            !group.alwaysExpanded && "cursor-pointer select-none",
                          )}
                          style={{
                            fontFamily: paperTheme.fonts.handwriting,
                            zIndex: 21,
                          }}
                          onClick={
                            group.alwaysExpanded
                              ? undefined
                              : () => toggleGroup(group.id)
                          }
                        >
                          <div className="flex items-center justify-center gap-1">
                            {!group.alwaysExpanded && (
                              <span className="text-xs opacity-60">
                                {isExpanded ? "▼" : "▶"}
                              </span>
                            )}
                            {group.label}
                            {!group.alwaysExpanded && !isExpanded && (
                              <span className="text-xs font-normal opacity-50 ml-1">
                                ({group.columns.length})
                              </span>
                            )}
                          </div>
                        </th>,
                      ];
                    })}
                  </tr>
                  {/* Column headers row */}
                  <tr>
                    {columnGroups.map((group) => {
                      const visCols = getVisibleColumns(group);
                      return visCols.map((col, idx) => {
                        const isTime = group.id === "time";
                        const stickyLeft = isTime
                          ? idx === 0
                            ? 0
                            : TIME_COL_WIDTHS.year
                          : undefined;
                        const isFreezeEdge =
                          isTime && idx === visCols.length - 1;
                        return (
                          <th
                            key={col.key}
                            className={cn(
                              "ss-cell ss-th-col",
                              groupSubHeaderBg(group.id),
                              isTime && "ss-sticky",
                              isFreezeEdge && "ss-freeze-edge",
                            )}
                            style={{
                              fontFamily: paperTheme.fonts.handwriting,
                              left: stickyLeft,
                              zIndex: isTime ? 32 : 21,
                            }}
                          >
                            {col.label}
                          </th>
                        );
                      });
                    })}
                  </tr>
                </thead>

                {/* Data rows */}
                <tbody>
                  {rows.map((row, rowIdx) => {
                    const isCurrentMonth =
                      row.year === currentYear && row.month === currentMonth;

                    // Reset column counter for each row
                    globalColIdx = 0;

                    return (
                      <tr
                        key={row.monthKey}
                        className="ss-row"
                        data-state={isCurrentMonth ? "current" : "default"}
                      >
                        {columnGroups.map((group) => {
                          const visCols = getVisibleColumns(group);
                          return visCols.map((col, idxInGroup) => {
                            const colIdx = globalColIdx++;
                            const value = row.values[col.key];
                            const isActive = active?.rowIdx === rowIdx && active?.colIdx === colIdx;
                            const isEditing = isActive && editing;
                            const isTime = group.id === "time";
                            const stickyLeft = isTime
                              ? idxInGroup === 0
                                ? 0
                                : TIME_COL_WIDTHS.year
                              : undefined;
                            const isFreezeEdge =
                              isTime && idxInGroup === visCols.length - 1;

                            return (
                              <SpreadsheetCell
                                key={col.key}
                                col={col}
                                groupId={group.id}
                                value={value}
                                isActive={isActive}
                                isEditing={isEditing}
                                editValue={editValue}
                                inputRef={isEditing ? inputRef : undefined}
                                stickyLeft={stickyLeft}
                                isFreezeEdge={isFreezeEdge}
                                onEditValueChange={setEditValue}
                                onClick={() => handleCellClick(rowIdx, colIdx)}
                                onDoubleClick={() => handleCellDoubleClick(rowIdx, colIdx)}
                              />
                            );
                          });
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Keyboard hint */}
            <div className="bg-stone-50 border-t border-amber-200/60 px-4 py-1.5 text-[11px] text-stone-400 flex gap-4 flex-wrap">
              <span>↑↓←→ navigate</span>
              <span>Enter/type: edit</span>
              <span>Tab: move right</span>
              <span>Esc: cancel</span>
              <span>Del: clear</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// CELL COMPONENT
// ============================================

function SpreadsheetCell({
  col,
  groupId,
  value,
  isActive,
  isEditing,
  editValue,
  inputRef,
  stickyLeft,
  isFreezeEdge,
  onEditValueChange,
  onClick,
  onDoubleClick,
}: {
  col: ColumnDef;
  groupId: ColumnGroupId;
  value: number | string | null | undefined;
  isActive: boolean;
  isEditing: boolean;
  editValue: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  stickyLeft?: number;
  isFreezeEdge?: boolean;
  onEditValueChange: (v: string) => void;
  onClick: () => void;
  onDoubleClick: () => void;
}) {
  // Format display value. Empty/zero numerics render as a blank string —
  // the previous "-" placeholder created visual noise in a sparse grid.
  let display: string;
  if (value == null || value === "" || value === 0) {
    display = col.type === "text" ? (value as string) ?? "" : "";
  } else if (col.type === "currency" || col.type === "computed") {
    display = formatCurrency(value as number);
  } else if (col.type === "number") {
    display = formatNumber(value as number);
  } else {
    display = String(value);
  }

  const isNegative = typeof value === "number" && value < 0;
  const isText = col.type === "text";
  const isSticky = stickyLeft !== undefined;

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    // Let Enter/Tab/Escape bubble to the grid's onKeyDown which handles commit/cancel
    if (e.key === "Enter" || e.key === "Tab" || e.key === "Escape") return;
    // Stop other keys from propagating to the grid (so arrow keys type in input, not navigate)
    e.stopPropagation();
  };

  return (
    <td
      className={cn(
        "ss-cell ss-td",
        isText ? "text-left" : "text-right",
        isNegative ? "text-red-600" : "text-stone-800",
        col.editable && "cursor-cell",
        !col.editable && "cursor-default",
        col.type === "computed" && "ss-td-computed",
        isActive && !isEditing && "ss-td-active",
        isSticky && "ss-sticky",
        isFreezeEdge && "ss-freeze-edge",
        groupCellBg(groupId),
      )}
      style={{
        fontFamily:
          col.type === "text"
            ? paperTheme.fonts.handwriting
            : paperTheme.fonts.system,
        fontSize: isText ? "0.8rem" : undefined,
        left: stickyLeft,
      }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => onEditValueChange(e.target.value)}
          onKeyDown={handleInputKeyDown}
          className="ss-edit-input"
        />
      ) : (
        display
      )}
    </td>
  );
}

// ============================================
// SCOPED STYLESHEET
// ============================================

const SPREADSHEET_CSS = `
.ss-table {
  width: 100%;
}

/* Cells use per-side borders only (right + bottom), drawn via the
   collapsed-style trick on a separated table. This avoids the doubled
   borders that border-collapse:collapse produces around sticky cells. */
.ss-cell {
  border-right: 1px solid rgb(253 230 138 / 0.6);   /* amber-200/60 */
  border-bottom: 1px solid rgb(253 230 138 / 0.4);  /* amber-200/40 */
  padding: 4px 8px;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ss-table > thead > tr > .ss-cell {
  border-bottom: 1px solid rgb(253 230 138 / 0.6);
}
.ss-table > thead > tr:first-child > .ss-cell {
  border-top: 1px solid rgb(253 230 138 / 0.6);
}
.ss-table > tbody > tr > .ss-cell:first-child,
.ss-table > thead > tr > .ss-cell:first-child {
  border-left: 1px solid rgb(253 230 138 / 0.6);
}

.ss-th-group {
  text-align: center;
  font-weight: 700;
  font-size: 14px;
  padding: 8px;
}
.ss-th-col {
  text-align: inherit;
  font-weight: 600;
  font-size: 12px;
  color: rgb(68 64 60);
  padding: 6px 8px;
}

/* Row state drives both the row's background AND the sticky cells'
   background, via a single CSS variable. By painting the variable on
   the <tr>, every cell (sticky or not) shows the same tint — no seam
   between the frozen Time columns and the rest. */
.ss-row {
  --row-bg: rgba(255, 255, 255, 0.4);
  background: var(--row-bg);
  transition: background-color 120ms ease;
}
.ss-row[data-state="current"] {
  --row-bg: rgba(252, 211, 77, 0.42);  /* amber-300 ~ */
}
.ss-row:hover:not([data-state="current"]) {
  --row-bg: rgba(254, 243, 199, 0.55); /* amber-100 */
}

/* Sticky cells inherit the row's effective background so they don't
   leave a colored seam when the row hovers / changes state. Header
   sticky cells override with their own group-header colour, which is
   already opaque enough to mask anything scrolling under them. */
.ss-sticky {
  position: sticky;
}
.ss-table > tbody > tr > .ss-sticky {
  background: var(--row-bg);
}

/* The freeze line — a strong right edge on the last sticky column so
   the eye can read the boundary between frozen and scrolling area. */
.ss-freeze-edge {
  box-shadow: 2px 0 0 rgb(252 211 77);  /* amber-300 */
  border-right: 1px solid rgb(252 211 77);
}

/* Computed cells get a faint amber wash so totals stand out, but only
   on non-sticky cells — sticky ones must keep --row-bg to track row
   state. */
.ss-td-computed {
  font-weight: 600;
}
.ss-td-computed:not(.ss-sticky) {
  background: rgba(254, 243, 199, 0.35);
}

/* Active cell outline. Sits below sticky (z 6) so when the active cell
   scrolls under the freeze line, the outline is hidden along with it
   instead of bleeding on top. */
.ss-td-active {
  outline: 2px solid #3b82f6;
  outline-offset: -2px;
  position: relative;
  z-index: 4;
}
.ss-table > tbody > tr > .ss-sticky {
  z-index: 6;
}

/* Edit input lives strictly inside the cell border (1px inset) so its
   own border doesn't double up with the cell border. */
.ss-edit-input {
  position: absolute;
  inset: 1px;
  width: calc(100% - 2px);
  height: calc(100% - 2px);
  background: white;
  border: 1px solid #60a5fa;
  border-radius: 3px;
  padding: 0 6px;
  font-size: 12px;
  text-align: right;
  outline: none;
  z-index: 25;
  box-sizing: border-box;
}
.ss-edit-input:focus {
  box-shadow: 0 0 0 1px #3b82f6;
}

/* Position context for the absolute-positioned edit input. Skip sticky
   cells — they already establish a containing block via position:sticky,
   and overriding to relative would break their pinning. */
.ss-td:not(.ss-sticky) {
  position: relative;
}
`;


// ============================================
// GROUP COLOR HELPERS
// ============================================

function groupHeaderBg(id: ColumnGroupId): string {
  switch (id) {
    case "time":
      return "bg-stone-100";
    case "income":
      return "bg-emerald-100/80";
    case "payments":
      return "bg-red-100/80";
    case "savings":
      return "bg-blue-100/80";
    case "other":
      return "bg-purple-100/80";
  }
}

function groupSubHeaderBg(id: ColumnGroupId): string {
  switch (id) {
    case "time":
      return "bg-stone-50";
    case "income":
      return "bg-emerald-50/60";
    case "payments":
      return "bg-red-50/60";
    case "savings":
      return "bg-blue-50/60";
    case "other":
      return "bg-purple-50/60";
  }
}

function groupCellBg(id: ColumnGroupId): string {
  switch (id) {
    case "time":
      return "";
    case "income":
      return "";
    case "payments":
      return "";
    case "savings":
      return "";
    case "other":
      return "";
  }
}
