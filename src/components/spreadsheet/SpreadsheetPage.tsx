import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import { paperTheme } from "@/styles";
import type {
  ColumnDef,
  ColumnGroup,
  ColumnGroupId,
  ExpandedGroups,
} from "@/types/spreadsheet.types";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  RotateCw,
  Table2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DrillDownItem } from "./useSpreadsheetData";
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

  const {
    rows,
    columnGroups,
    loading,
    reload,
    updateEntry,
    removeEntry,
    drillDown,
  } = useSpreadsheetData(startYear, 0, endYear, 11);

  // Footer aggregator: sum / avg / min / max across visible months.
  type AggKind = "sum" | "avg" | "min" | "max";
  const [aggKind, setAggKind] = useState<AggKind>("sum");

  // Save-status toast — fades in for ~1.5s after every commit/clear.
  type SaveStatus = { state: "ok" | "error"; ts: number };
  const [saveStatus, setSaveStatus] = useState<SaveStatus | null>(null);
  useEffect(() => {
    if (!saveStatus) return;
    const t = setTimeout(() => setSaveStatus(null), 1600);
    return () => clearTimeout(t);
  }, [saveStatus]);

  // Drill-down popover — open per cell, content lazily fetched on open.
  type Drill = {
    rowIdx: number;
    colIdx: number;
    items: DrillDownItem[];
    title: string;
  };
  const [drill, setDrill] = useState<Drill | null>(null);

  const [expanded, setExpanded] = useState<ExpandedGroups>({
    time: true,
    // Income is a single auto-derived column now, so no point hiding it.
    income: true,
    payments: false,
    net: true,
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
      setSaveStatus({ state: "ok", ts: Date.now() });
    } catch (err) {
      console.error("Failed to save cell:", err);
      setSaveStatus({ state: "error", ts: Date.now() });
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

    // Single click on a non-editable derived cell opens the drill-down
    // popover when there's something to show.
    const colInfo = flatColumns[colIdx];
    const row = rows[rowIdx];
    if (!colInfo || !row) {
      setDrill(null);
      return;
    }
    if (colInfo.col.editable) {
      setDrill(null);
      return;
    }
    const items = drillDown(row.monthKey, colInfo.col.key);
    if (items && items.length > 0) {
      setDrill({
        rowIdx,
        colIdx,
        items,
        title: `${row.monthLabel} ${row.year} — ${colInfo.col.label}`,
      });
    } else {
      setDrill(null);
    }
  }, [editing, doCommit, flatColumns, rows, drillDown]);

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

  // Sticky-top offsets — the column-header row's top must match the
  // height of the group-header row. Heights set via CSS below.
  const HEADER_ROW_HEIGHT = 30;

  // Aggregates over visible months — one number per numeric column.
  const aggregates = useMemo(() => {
    const out: Record<string, number | null> = {};
    if (rows.length === 0) return out;
    for (const { col } of flatColumns) {
      if (col.type === "text" || !col.key) {
        out[col.key] = null;
        continue;
      }
      const values: number[] = [];
      for (const row of rows) {
        const v = row.values[col.key];
        if (typeof v === "number" && !isNaN(v)) values.push(v);
      }
      if (values.length === 0) {
        out[col.key] = null;
        continue;
      }
      switch (aggKind) {
        case "sum":
          out[col.key] = values.reduce((s, v) => s + v, 0);
          break;
        case "avg":
          out[col.key] = values.reduce((s, v) => s + v, 0) / values.length;
          break;
        case "min":
          out[col.key] = Math.min(...values);
          break;
        case "max":
          out[col.key] = Math.max(...values);
          break;
      }
    }
    return out;
  }, [rows, flatColumns, aggKind]);

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
              "rounded-xl overflow-hidden outline-none bg-white",
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
            <div
              className="overflow-auto"
              style={{ maxHeight: "calc(100vh - 240px)" }}
            >
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
                              "ss-cell ss-th-group ss-sticky ss-sticky-top",
                              idx === visCols.length - 1 && "ss-freeze-edge",
                              groupHeaderBg(group.id),
                            )}
                            style={{
                              fontFamily: paperTheme.fonts.handwriting,
                              left: idx === 0 ? 0 : TIME_COL_WIDTHS.year,
                              top: 0,
                              zIndex: 40,
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
                            "ss-cell ss-th-group ss-sticky-top",
                            groupHeaderBg(group.id),
                            !group.alwaysExpanded && "cursor-pointer select-none",
                          )}
                          style={{
                            fontFamily: paperTheme.fonts.handwriting,
                            top: 0,
                            zIndex: 30,
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
                              "ss-cell ss-th-col ss-sticky-top",
                              groupSubHeaderBg(group.id),
                              isTime && "ss-sticky",
                              isFreezeEdge && "ss-freeze-edge",
                            )}
                            style={{
                              fontFamily: paperTheme.fonts.handwriting,
                              left: stickyLeft,
                              top: HEADER_ROW_HEIGHT,
                              zIndex: isTime ? 40 : 30,
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

                {/* Aggregate footer row — sticky to bottom of the
                    scroll container. The leftmost cell carries the
                    Sum/Avg/Min/Max selector. */}
                <tfoot>
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
                        const agg = aggregates[col.key];
                        const isFirstFooterCell =
                          isTime && idx === 0;

                        let display: string | React.ReactNode = "";
                        if (isFirstFooterCell) {
                          display = (
                            <select
                              value={aggKind}
                              onChange={(e) =>
                                setAggKind(e.target.value as AggKind)
                              }
                              className="bg-transparent border-0 text-xs font-bold text-stone-700 focus:outline-none cursor-pointer w-full text-center"
                              aria-label="Aggregate function"
                            >
                              <option value="sum">Sum</option>
                              <option value="avg">Avg</option>
                              <option value="min">Min</option>
                              <option value="max">Max</option>
                            </select>
                          );
                        } else if (col.type === "text") {
                          display = "";
                        } else if (agg == null) {
                          display = "";
                        } else if (col.type === "number") {
                          display = formatNumber(agg);
                        } else {
                          display = formatCurrency(agg);
                        }

                        const isNegative =
                          typeof agg === "number" && agg < 0;
                        const isPositiveNet =
                          col.key === "net" &&
                          typeof agg === "number" &&
                          agg > 0;

                        return (
                          <th
                            key={col.key}
                            scope="col"
                            className={cn(
                              "ss-cell ss-tfoot-cell",
                              isTime && "ss-sticky",
                              isFreezeEdge && "ss-freeze-edge",
                              !isTime && "text-right",
                              isNegative
                                ? "text-red-600"
                                : isPositiveNet
                                  ? "text-green-700"
                                  : "text-stone-800",
                            )}
                            style={{
                              fontFamily:
                                col.type === "text"
                                  ? paperTheme.fonts.handwriting
                                  : paperTheme.fonts.system,
                              left: stickyLeft,
                              bottom: 0,
                              zIndex: isTime ? 35 : 25,
                            }}
                          >
                            {display}
                          </th>
                        );
                      });
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Keyboard hint */}
            <div className="bg-stone-50 border-t border-amber-200/60 px-4 py-1.5 text-[11px] text-stone-400 flex gap-4 flex-wrap">
              <span>↑↓←→ navigate</span>
              <span>Enter/type: edit</span>
              <span>Click derived cell: details</span>
              <span>Tab: move right</span>
              <span>Esc: cancel</span>
              <span>Del: clear</span>
            </div>

            {/* Drill-down panel — appears when a derived (income or
                per-category payment) cell is clicked. Lists the actual
                rows that produced that cell's value. */}
            {drill && (
              <DrillDownPanel
                title={drill.title}
                items={drill.items}
                onClose={() => setDrill(null)}
              />
            )}

            {/* Save-status pill — fades in for ~1.5s after every commit. */}
            {saveStatus && (
              <div
                role="status"
                className={cn(
                  "absolute top-3 right-3 z-50 px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-md transition-opacity",
                  saveStatus.state === "ok"
                    ? "bg-green-100 text-green-700 border border-green-300"
                    : "bg-red-100 text-red-700 border border-red-300",
                )}
              >
                {saveStatus.state === "ok" ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Saved
                  </>
                ) : (
                  <>
                    <RotateCw className="w-3.5 h-3.5" />
                    Save failed
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// DRILL-DOWN PANEL
// ============================================

function DrillDownPanel({
  title,
  items,
  onClose,
}: {
  title: string;
  items: DrillDownItem[];
  onClose: () => void;
}) {
  const total = items.reduce((s, it) => {
    if (it.kind === "deposit") return s + it.tx.amount;
    return s + it.expense.amount;
  }, 0);

  return (
    <div
      className={cn(
        "absolute right-3 bottom-12 z-50 w-80 max-h-80 overflow-y-auto",
        "bg-white border-2 rounded-xl shadow-xl",
        paperTheme.colors.borders.amber,
      )}
    >
      <div className="sticky top-0 bg-amber-50 border-b border-amber-200 px-3 py-2 flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-amber-700">{title}</div>
          <div className="text-[10px] text-stone-500">
            {items.length} item{items.length === 1 ? "" : "s"} · Total{" "}
            {formatCurrency(total)}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-stone-400 hover:text-stone-700 px-2 py-0.5 rounded"
        >
          ✕
        </button>
      </div>
      <ul className="divide-y divide-stone-100">
        {items.map((it, idx) => {
          if (it.kind === "deposit") {
            return (
              <li key={idx} className="px-3 py-2 text-xs">
                <div className="flex justify-between items-baseline">
                  <span className="font-semibold text-green-700">
                    +{formatCurrency(it.tx.amount)}
                  </span>
                  <span className="text-[10px] text-stone-400">
                    {new Date(it.tx.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {it.tx.note && (
                  <div className="text-stone-500 mt-0.5">{it.tx.note}</div>
                )}
              </li>
            );
          }
          return (
            <li key={idx} className="px-3 py-2 text-xs">
              <div className="flex justify-between items-baseline">
                <span className="font-semibold text-red-600">
                  -{formatCurrency(it.expense.amount)}
                </span>
                <span className="text-[10px] text-stone-400">
                  {new Date(it.expense.date).toLocaleDateString()}
                </span>
              </div>
              {it.expense.note && (
                <div className="text-stone-500 mt-0.5">{it.expense.note}</div>
              )}
            </li>
          );
        })}
      </ul>
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
  const isPositiveNet =
    col.key === "net" && typeof value === "number" && value > 0;
  const isText = col.type === "text";
  const isSticky = stickyLeft !== undefined;
  const hasValue =
    typeof value === "number" ? value !== 0 : value != null && value !== "";
  // A cell is drillable when single-click should open the popover —
  // only non-editable derived cells (income, per-category payments)
  // with a non-zero underlying value.
  const isDrillable =
    !col.editable &&
    hasValue &&
    (col.key === "income_total" ||
      (col.key.startsWith("payment_") && col.key !== "payment_total"));

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
        isNegative
          ? "text-red-600"
          : isPositiveNet
            ? "text-green-700"
            : "text-stone-800",
        col.editable && "cursor-cell",
        !col.editable && !isDrillable && "cursor-default",
        isDrillable && "cursor-pointer ss-drillable",
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
  font-size: 13px;
  /* Padding keeps the row at HEADER_ROW_HEIGHT (30px) so the
     column-header row's sticky top-offset lines up perfectly. */
  padding: 5px 8px;
  height: 30px;
  box-sizing: border-box;
}
.ss-th-col {
  text-align: inherit;
  font-weight: 600;
  font-size: 12px;
  color: rgb(68 64 60);
  padding: 4px 8px;
  height: 26px;
  box-sizing: border-box;
}

/* Row state drives both the row's background AND the sticky cells'
   background, via a single CSS variable. Backgrounds are fully opaque
   so the page's lined-paper gradient cannot bleed through any cell —
   especially important for sticky cells, where any transparency would
   let scrolling content show through. */
.ss-row {
  --row-bg: #ffffff;
  background: var(--row-bg);
  transition: background-color 120ms ease;
}
.ss-row[data-state="current"] {
  --row-bg: #fef3c7;  /* amber-100 */
}
.ss-row:hover:not([data-state="current"]) {
  --row-bg: #fffbeb;  /* amber-50 */
}
/* Subtle zebra so a long horizontal row stays trackable. Applied only
   to default-state rows so it doesn't fight the current-month tint. */
.ss-row[data-state="default"]:nth-child(even) {
  --row-bg: #fafaf9;  /* stone-50 */
}
.ss-row[data-state="default"]:nth-child(even):hover {
  --row-bg: #fffbeb;
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

/* Sticky-top header rows. Each header row pins itself; the column-row
   sits below the group-row at an explicit offset. */
.ss-sticky-top {
  position: sticky;
}

/* Group header rows have an opaque background already (bg-* classes
   apply). The column-header row needs to KEEP its own background even
   when the user scrolls vertically, so non-sticky-left column headers
   get an explicit white-ish backstop here. */
.ss-th-col {
  background-color: inherit;
}

/* Aggregate footer row — sticky bottom and visually distinct. Cells
   inherit a beige tint so they read as "summary" without competing
   with row tints. */
.ss-tfoot-cell {
  position: sticky;
  background: #f5f5f4;            /* stone-100 */
  border-top: 2px solid rgb(252 211 77);  /* amber-300 — matches freeze line */
  font-weight: 700;
  padding: 6px 8px;
  font-size: 12px;
  white-space: nowrap;
}
.ss-tfoot-cell.ss-sticky {
  background: #f5f5f4;
}

/* Drill-down trigger affordance: clickable derived cells get a faint
   underline on hover so the user knows they can drill in. Only fires
   on rows that have a non-zero value (we leave it to the click handler
   to no-op on empty cells). */
.ss-td.ss-drillable:hover {
  text-decoration: underline dotted;
  text-underline-offset: 3px;
  text-decoration-color: rgb(120 113 108);  /* stone-500 */
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
    case "net":
      return "bg-amber-100/80";
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
    case "net":
      return "bg-amber-50/60";
    case "savings":
      return "bg-blue-50/60";
    case "other":
      return "bg-purple-50/60";
  }
}

function groupCellBg(id: ColumnGroupId): string {
  switch (id) {
    case "time":
    case "income":
    case "payments":
    case "net":
    case "savings":
    case "other":
      return "";
  }
}
