import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import { paperTheme } from "@/styles";
import type { ColumnDef, ColumnGroup, ColumnGroupId, ExpandedGroups } from "@/types/spreadsheet.types";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Table2,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useSpreadsheetData } from "./useSpreadsheetData";

const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth();

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
                  Track income, expenses, and savings across months
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
            className={cn(
              "rounded-xl overflow-hidden",
              paperTheme.colors.borders.paper,
              paperTheme.effects.shadow.lg,
              "relative",
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
                  {rows.map((row) => {
                    const isCurrentMonth =
                      row.year === currentYear && row.month === currentMonth;
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
                          return visCols.map((col) => (
                            <SpreadsheetCell
                              key={col.key}
                              col={col}
                              groupId={group.id}
                              value={row.values[col.key]}
                              monthKey={row.monthKey}
                              onSave={updateEntry}
                              onClear={removeEntry}
                            />
                          ));
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
  monthKey,
  onSave,
  onClear,
}: {
  col: ColumnDef;
  groupId: ColumnGroupId;
  value: number | string | null | undefined;
  monthKey: string;
  onSave: (monthKey: string, columnKey: string, value: number) => Promise<void>;
  onClear: (monthKey: string, columnKey: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    if (!col.editable) return;
    setDraft(value != null && value !== 0 ? String(value) : "");
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const commitEdit = async () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed === "" || trimmed === "0") {
      await onClear(monthKey, col.key);
    } else {
      const num = parseFloat(trimmed);
      if (!isNaN(num)) {
        await onSave(monthKey, col.key, num);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") commitEdit();
    if (e.key === "Escape") setEditing(false);
  };

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

  return (
    <td
      className={cn(
        "px-2 py-1 text-xs border border-amber-200/40 whitespace-nowrap",
        isText ? "text-left" : "text-right",
        isNegative ? "text-red-600" : "text-stone-800",
        col.editable && "cursor-pointer hover:bg-amber-50/60",
        col.type === "computed" && "font-semibold bg-amber-50/30",
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
      onDoubleClick={startEdit}
    >
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          className="w-full bg-white border border-amber-300 rounded px-1 py-0.5 text-xs text-right outline-none focus:ring-1 focus:ring-amber-400"
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
