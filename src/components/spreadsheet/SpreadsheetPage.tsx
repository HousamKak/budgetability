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
    income: false,
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

  const commitEdit = useCallback(async () => {
    if (!active) return;
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
        commitEdit().then(() => {
          setActive(prev => prev && prev.rowIdx < rows.length - 1
            ? { ...prev, rowIdx: prev.rowIdx + 1 }
            : prev
          );
          gridRef.current?.focus();
        });
      } else if (e.key === "Tab") {
        e.preventDefault();
        commitEdit().then(() => {
          setActive(prev => {
            if (!prev) return prev;
            if (e.shiftKey) {
              return prev.colIdx > 0 ? { ...prev, colIdx: prev.colIdx - 1 } : prev;
            }
            return prev.colIdx < flatColumns.length - 1 ? { ...prev, colIdx: prev.colIdx + 1 } : prev;
          });
          gridRef.current?.focus();
        });
      } else if (e.key === "Escape") {
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
  }, [editing, active, rows, flatColumns, commitEdit, cancelEdit, startEditing, canEditCell, removeEntry]);

  // ── Click handlers ─────────────────────────────────────────────

  const handleCellClick = useCallback((rowIdx: number, colIdx: number) => {
    if (editing) commitEdit();
    setActive({ rowIdx, colIdx });
    setEditing(false);
    gridRef.current?.focus();
  }, [editing, commitEdit]);

  const handleCellDoubleClick = useCallback((rowIdx: number, colIdx: number) => {
    startEditing({ rowIdx, colIdx });
  }, [startEditing]);

  // ── Render ─────────────────────────────────────────────────────

  // Track flat column index for each cell
  let globalColIdx = 0;

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
            className={cn(
              "rounded-xl overflow-hidden outline-none",
              paperTheme.colors.borders.paper,
              paperTheme.effects.shadow.lg,
              "relative focus:ring-2 focus:ring-amber-300/50",
            )}
          >
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[600px]">
                {/* Group headers row */}
                <thead>
                  <tr>
                    {columnGroups.map((group) => {
                      const visCols = getVisibleColumns(group);
                      const isExpanded = group.alwaysExpanded || expanded[group.id];
                      return (
                        <th
                          key={group.id}
                          colSpan={visCols.length}
                          className={cn(
                            "px-2 py-2 text-center text-sm font-bold border border-amber-200/60",
                            groupHeaderBg(group.id),
                            !group.alwaysExpanded && "cursor-pointer select-none",
                          )}
                          style={{ fontFamily: paperTheme.fonts.handwriting }}
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
                        </th>
                      );
                    })}
                  </tr>
                  {/* Column headers row */}
                  <tr>
                    {columnGroups.map((group) => {
                      const visCols = getVisibleColumns(group);
                      return visCols.map((col) => (
                        <th
                          key={col.key}
                          className={cn(
                            "px-2 py-1.5 text-xs font-semibold text-stone-700 border border-amber-200/60 whitespace-nowrap",
                            groupSubHeaderBg(group.id),
                          )}
                          style={{
                            minWidth: col.width ?? 80,
                            fontFamily: paperTheme.fonts.handwriting,
                          }}
                        >
                          {col.label}
                        </th>
                      ));
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
                        className={cn(
                          "transition-colors",
                          isCurrentMonth
                            ? "bg-amber-100/60"
                            : "bg-white/40 hover:bg-amber-50/40",
                        )}
                      >
                        {columnGroups.map((group) => {
                          const visCols = getVisibleColumns(group);
                          return visCols.map((col) => {
                            const colIdx = globalColIdx++;
                            const value = row.values[col.key];
                            const isActive = active?.rowIdx === rowIdx && active?.colIdx === colIdx;
                            const isEditing = isActive && editing;

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
                                onEditValueChange={setEditValue}
                                onCommit={commitEdit}
                                onCancel={cancelEdit}
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
  onEditValueChange,
  onCommit,
  onCancel,
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
  onEditValueChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  onClick: () => void;
  onDoubleClick: () => void;
}) {
  // Format display value
  let display: string;
  if (value == null || value === "" || value === 0) {
    display = col.type === "text" ? (value as string) ?? "" : "-";
  } else if (col.type === "currency" || col.type === "computed") {
    display = formatCurrency(value as number);
  } else if (col.type === "number") {
    display = formatNumber(value as number);
  } else {
    display = String(value);
  }

  const isNegative = typeof value === "number" && value < 0;
  const isText = col.type === "text";

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onCancel();
      return;
    }
    // Let the grid's keydown handler manage Enter/Tab
    if (e.key === "Enter" || e.key === "Tab") return;
    // Stop other keys from propagating to the grid
    e.stopPropagation();
  };

  return (
    <td
      className={cn(
        "px-2 py-1 text-xs border border-amber-200/40 whitespace-nowrap relative",
        isText ? "text-left" : "text-right",
        isNegative ? "text-red-600" : "text-stone-800",
        col.editable && "cursor-cell",
        !col.editable && "cursor-default",
        col.type === "computed" && "font-semibold bg-amber-50/30",
        isActive && !isEditing && "outline outline-2 outline-blue-500 -outline-offset-1 z-10",
        groupCellBg(groupId),
      )}
      style={{
        minWidth: col.width ?? 80,
        fontFamily:
          col.type === "text"
            ? paperTheme.fonts.handwriting
            : paperTheme.fonts.system,
        fontSize: isText ? "0.8rem" : undefined,
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
          onBlur={onCommit}
          onKeyDown={handleInputKeyDown}
          className="w-full bg-white border border-blue-400 rounded px-1 py-0.5 text-xs text-right outline-none focus:ring-1 focus:ring-blue-400 absolute inset-0 z-20"
        />
      ) : (
        display
      )}
    </td>
  );
}

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
