import { formatCurrency, formatNumber } from "@/lib/utils";
import { paperTheme } from "@/styles";
import { cn } from "@/lib/utils";
import { RefreshCw, Table2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSpreadsheetData } from "./useSpreadsheetData";
import type { RowDef, SectionDef } from "./useSpreadsheetData";

// ── Flat display-row types ───────────────────────────────────────

type DisplayRow =
  | { kind: "header"; label: string; color: string }
  | { kind: "data"; row: RowDef; sectionId: string }
  | { kind: "total"; id: string; label: string; sectionId: string; sectionRows: RowDef[] }
  | { kind: "summary-header" }
  | { kind: "summary"; id: "net_income" | "after_savings"; label: string };

function isSelectable(dr: DisplayRow): boolean {
  return dr.kind === "data" || dr.kind === "total" || dr.kind === "summary";
}

// ── Component ────────────────────────────────────────────────────

export default function SpreadsheetPage() {
  const {
    sections, months, getCellValue, getSectionTotal, getSummary,
    isCellEditable, updateCell, clearCell, loading, reload,
  } = useSpreadsheetData();

  // Build flat display rows
  const displayRows: DisplayRow[] = useMemo(() => {
    const result: DisplayRow[] = [];
    for (const sec of sections) {
      result.push({ kind: "header", label: sec.label, color: sec.color });
      for (const row of sec.rows) {
        result.push({ kind: "data", row, sectionId: sec.id });
      }
      if (sec.totalRow) {
        result.push({ kind: "total", id: sec.totalRow.id, label: sec.totalRow.label, sectionId: sec.id, sectionRows: sec.rows });
      }
    }
    result.push({ kind: "summary-header" });
    result.push({ kind: "summary", id: "net_income", label: "Net Income" });
    result.push({ kind: "summary", id: "after_savings", label: "After Savings" });
    return result;
  }, [sections]);

  // ── Active cell & editing state ────────────────────────────────

  const [activeRow, setActiveRow] = useState<number | null>(null);
  const [activeCol, setActiveCol] = useState<number | null>(null); // 0 = first month, 1 = second month
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  const gridRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  // ── Cell helpers ───────────────────────────────────────────────

  const getRowId = (dr: DisplayRow): string | null => {
    if (dr.kind === "data") return dr.row.id;
    if (dr.kind === "total") return dr.id;
    if (dr.kind === "summary") return dr.id;
    return null;
  };

  const getCellDisplayValue = useCallback((dr: DisplayRow, monthKey: string): number | null => {
    if (dr.kind === "data") return getCellValue(dr.row.id, monthKey);
    if (dr.kind === "total") return getSectionTotal(dr.sectionRows, monthKey);
    if (dr.kind === "summary") {
      const s = getSummary(monthKey);
      return dr.id === "net_income" ? s.netIncome : s.afterSavings;
    }
    return null;
  }, [getCellValue, getSectionTotal, getSummary]);

  const isCellActive = (rowIdx: number, colIdx: number) =>
    activeRow === rowIdx && activeCol === colIdx;

  const canEdit = useCallback((rowIdx: number, colIdx: number): boolean => {
    const dr = displayRows[rowIdx];
    if (!dr || !isSelectable(dr)) return false;
    if (dr.kind === "total" || dr.kind === "summary") return false;
    if (dr.kind === "data") return isCellEditable(dr.row.id, months[colIdx].key);
    return false;
  }, [displayRows, isCellEditable, months]);

  // ── Navigation helpers ─────────────────────────────────────────

  const findNextSelectable = useCallback((from: number, direction: 1 | -1): number | null => {
    let i = from + direction;
    while (i >= 0 && i < displayRows.length) {
      if (isSelectable(displayRows[i])) return i;
      i += direction;
    }
    return null;
  }, [displayRows]);

  // ── Commit / cancel editing ────────────────────────────────────

  const commitEdit = useCallback(async () => {
    if (activeRow == null || activeCol == null) return;
    const dr = displayRows[activeRow];
    const rowId = getRowId(dr);
    if (!rowId) return;
    const monthKey = months[activeCol].key;

    const trimmed = editValue.trim();
    if (trimmed === "" || trimmed === "0") {
      await clearCell(rowId, monthKey);
    } else {
      const num = parseFloat(trimmed);
      if (!isNaN(num)) await updateCell(rowId, monthKey, num);
    }
    setEditing(false);
  }, [activeRow, activeCol, editValue, displayRows, months, updateCell, clearCell]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setEditValue("");
    gridRef.current?.focus();
  }, []);

  const startEditing = useCallback((rowIdx: number, colIdx: number, initialValue?: string) => {
    if (!canEdit(rowIdx, colIdx)) return;
    setActiveRow(rowIdx);
    setActiveCol(colIdx);
    if (initialValue !== undefined) {
      setEditValue(initialValue);
    } else {
      const dr = displayRows[rowIdx];
      const val = getCellDisplayValue(dr, months[colIdx].key);
      setEditValue(val != null && val !== 0 ? String(val) : "");
    }
    setEditing(true);
  }, [canEdit, displayRows, getCellDisplayValue, months]);

  // ── Keyboard handler ───────────────────────────────────────────

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (editing) {
      if (e.key === "Enter") {
        e.preventDefault();
        commitEdit().then(() => {
          // Move down
          if (activeRow != null) {
            const next = findNextSelectable(activeRow, 1);
            if (next != null) setActiveRow(next);
          }
          gridRef.current?.focus();
        });
      } else if (e.key === "Tab") {
        e.preventDefault();
        commitEdit().then(() => {
          // Move right or wrap
          if (activeCol != null) {
            if (e.shiftKey) {
              setActiveCol(c => c != null && c > 0 ? c - 1 : months.length - 1);
            } else {
              setActiveCol(c => c != null && c < months.length - 1 ? c + 1 : 0);
            }
          }
          gridRef.current?.focus();
        });
      } else if (e.key === "Escape") {
        cancelEdit();
      }
      return; // Don't handle other keys while editing
    }

    // Not editing — navigation mode
    if (activeRow == null || activeCol == null) return;

    switch (e.key) {
      case "ArrowUp": {
        e.preventDefault();
        const next = findNextSelectable(activeRow, -1);
        if (next != null) setActiveRow(next);
        break;
      }
      case "ArrowDown": {
        e.preventDefault();
        const next = findNextSelectable(activeRow, 1);
        if (next != null) setActiveRow(next);
        break;
      }
      case "ArrowLeft":
        e.preventDefault();
        setActiveCol(c => c != null && c > 0 ? c - 1 : c);
        break;
      case "ArrowRight":
        e.preventDefault();
        setActiveCol(c => c != null && c < months.length - 1 ? c + 1 : c);
        break;
      case "Tab": {
        e.preventDefault();
        if (e.shiftKey) {
          setActiveCol(c => c != null && c > 0 ? c - 1 : months.length - 1);
        } else {
          setActiveCol(c => c != null && c < months.length - 1 ? c + 1 : 0);
        }
        break;
      }
      case "Enter":
      case "F2":
        e.preventDefault();
        startEditing(activeRow, activeCol);
        break;
      case "Delete":
      case "Backspace": {
        e.preventDefault();
        const dr = displayRows[activeRow];
        const rowId = getRowId(dr);
        if (rowId && canEdit(activeRow, activeCol)) {
          clearCell(rowId, months[activeCol].key);
        }
        break;
      }
      default:
        // Printable character → start editing with that character
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          if (canEdit(activeRow, activeCol)) {
            e.preventDefault();
            startEditing(activeRow, activeCol, e.key === "-" ? "-" : e.key);
          }
        }
    }
  }, [editing, activeRow, activeCol, commitEdit, cancelEdit, findNextSelectable, startEditing, canEdit, displayRows, months, clearCell]);

  // ── Click handler ──────────────────────────────────────────────

  const handleCellClick = useCallback((rowIdx: number, colIdx: number) => {
    if (!isSelectable(displayRows[rowIdx])) return;
    if (editing) commitEdit();
    setActiveRow(rowIdx);
    setActiveCol(colIdx);
    setEditing(false);
    gridRef.current?.focus();
  }, [displayRows, editing, commitEdit]);

  const handleCellDoubleClick = useCallback((rowIdx: number, colIdx: number) => {
    startEditing(rowIdx, colIdx);
  }, [startEditing]);

  // ── Format value ───────────────────────────────────────────────

  function formatValue(val: number | null, dr: DisplayRow): string {
    if (val == null || val === 0) return "-";
    if (dr.kind === "data" && dr.row.type === "number") return formatNumber(val);
    return formatCurrency(val);
  }

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="min-h-screen w-full p-4 md:p-8 bg-[repeating-linear-gradient(0deg,#fbf6e9,#fbf6e9_28px,#f2e8cf_28px,#f2e8cf_29px)]">
      <div className={cn("fixed inset-0 opacity-5 pointer-events-none", paperTheme.effects.paperTexture)} />

      <div className="max-w-3xl mx-auto relative">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className={cn("p-3 rounded-xl", paperTheme.colors.background.white, paperTheme.colors.borders.amber, paperTheme.effects.shadow.md)}>
                <Table2 className="w-8 h-8 text-amber-600" />
              </div>
              <div>
                <h1 className={cn("text-3xl font-bold", paperTheme.colors.text.accent)} style={{ fontFamily: paperTheme.fonts.handwriting }}>
                  Spreadsheet
                </h1>
                <p className="text-stone-500 text-sm">
                  {months[0].label} & {months[1].label} — click a cell, type to edit
                </p>
              </div>
            </div>
            <button
              onClick={reload}
              disabled={loading}
              className={cn("p-2 rounded-lg transition-colors border", paperTheme.colors.borders.amber, paperTheme.colors.interactive.ghost)}
            >
              <RefreshCw className={cn("w-4 h-4 text-stone-600", loading && "animate-spin")} />
            </button>
          </div>
        </div>

        {/* Grid */}
        {loading && displayRows.length <= 4 ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
          </div>
        ) : (
          <div
            ref={gridRef}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            className={cn(
              "rounded-xl overflow-hidden border border-amber-200/80 shadow-lg outline-none",
              "focus:ring-2 focus:ring-amber-300/50",
            )}
          >
            <table className="w-full border-collapse">
              {/* Column headers */}
              <thead>
                <tr className="bg-stone-100">
                  <th
                    className="px-4 py-2.5 text-left text-sm font-bold text-stone-600 border-b border-r border-amber-200/60 w-[45%]"
                    style={{ fontFamily: paperTheme.fonts.handwriting }}
                  />
                  {months.map(m => (
                    <th
                      key={m.key}
                      className={cn(
                        "px-4 py-2.5 text-right text-sm font-bold border-b border-amber-200/60 w-[27.5%]",
                        m.isCurrent ? "text-amber-700 bg-amber-50/60" : "text-stone-600",
                      )}
                      style={{ fontFamily: paperTheme.fonts.handwriting }}
                    >
                      {m.label}
                      {m.isCurrent && <span className="ml-1.5 text-[10px] bg-amber-200/60 px-1.5 py-0.5 rounded-full font-normal">current</span>}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {displayRows.map((dr, rowIdx) => {
                  // Section header
                  if (dr.kind === "header") {
                    return (
                      <tr key={`hdr-${dr.label}`} className={dr.color}>
                        <td
                          colSpan={1 + months.length}
                          className="px-4 py-2 text-sm font-bold text-stone-700 border-b border-amber-200/60"
                          style={{ fontFamily: paperTheme.fonts.handwriting }}
                        >
                          {dr.label}
                        </td>
                      </tr>
                    );
                  }

                  // Summary section header
                  if (dr.kind === "summary-header") {
                    return (
                      <tr key="summary-hdr" className="bg-amber-100/80">
                        <td
                          colSpan={1 + months.length}
                          className="px-4 py-2 text-sm font-bold text-stone-700 border-b border-t-2 border-amber-300/60"
                          style={{ fontFamily: paperTheme.fonts.handwriting }}
                        >
                          Summary
                        </td>
                      </tr>
                    );
                  }

                  // Data / total / summary rows
                  const isTotal = dr.kind === "total";
                  const isSummary = dr.kind === "summary";
                  const label = dr.kind === "data" ? dr.row.label : dr.label;

                  return (
                    <tr
                      key={`row-${rowIdx}`}
                      className={cn(
                        "transition-colors",
                        isTotal && "bg-stone-50/80 border-t border-amber-200/40",
                        isSummary && "bg-amber-50/60",
                        !isTotal && !isSummary && "bg-white/60 hover:bg-amber-50/30",
                      )}
                    >
                      {/* Label cell */}
                      <td
                        className={cn(
                          "px-4 py-1.5 text-sm border-b border-r border-amber-200/40",
                          isTotal || isSummary ? "font-bold text-stone-700" : "text-stone-600 pl-8",
                        )}
                        style={{ fontFamily: paperTheme.fonts.handwriting }}
                      >
                        {label}
                      </td>

                      {/* Value cells */}
                      {months.map((m, colIdx) => {
                        const val = getCellDisplayValue(dr, m.key);
                        const active = isCellActive(rowIdx, colIdx);
                        const isEditing = active && editing;
                        const editable = canEdit(rowIdx, colIdx);
                        const isNegative = val != null && val < 0;

                        return (
                          <td
                            key={m.key}
                            className={cn(
                              "px-2 py-1.5 text-sm border-b border-amber-200/40 text-right relative",
                              "select-none cursor-default",
                              editable && "cursor-cell",
                              isTotal && "font-bold text-stone-800",
                              isSummary && "font-bold",
                              isSummary && dr.id === "after_savings" && (val != null && val >= 0 ? "text-emerald-700" : "text-red-600"),
                              isSummary && dr.id === "net_income" && (val != null && val >= 0 ? "text-stone-800" : "text-red-600"),
                              !isTotal && !isSummary && isNegative && "text-red-600",
                              !isTotal && !isSummary && !isNegative && "text-stone-800",
                              active && !isEditing && "outline outline-2 outline-blue-500 -outline-offset-1 z-10",
                              !editable && !isTotal && !isSummary && "text-stone-400",
                            )}
                            style={{ fontFamily: paperTheme.fonts.system, minWidth: 120 }}
                            onClick={() => handleCellClick(rowIdx, colIdx)}
                            onDoubleClick={() => handleCellDoubleClick(rowIdx, colIdx)}
                          >
                            {isEditing ? (
                              <input
                                ref={inputRef}
                                type="text"
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                onBlur={() => commitEdit()}
                                className="w-full bg-white border border-blue-400 rounded px-1.5 py-0.5 text-sm text-right outline-none focus:ring-1 focus:ring-blue-400 absolute inset-0"
                                style={{ fontFamily: paperTheme.fonts.system }}
                              />
                            ) : (
                              formatValue(val, dr)
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Keyboard hint */}
            <div className="bg-stone-50 border-t border-amber-200/60 px-4 py-1.5 text-[11px] text-stone-400 flex gap-4">
              <span>Arrow keys: navigate</span>
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
