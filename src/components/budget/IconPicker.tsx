import { useState, useRef, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { CategoryIcon, AVAILABLE_ICONS } from "./CategoryIcon";
import { Search, ChevronDown } from "lucide-react";

const PAGE_SIZE = 80;

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
  color?: string;
}

export function IconPicker({ value, onChange, color = "#6b7280" }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open && searchRef.current) {
      searchRef.current.focus();
    }
    if (open) {
      setVisibleCount(PAGE_SIZE);
    }
  }, [open]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search]);

  const filtered = useMemo(() => {
    if (!search) return AVAILABLE_ICONS;
    const q = search.toLowerCase();
    return AVAILABLE_ICONS.filter((name) => name.includes(q));
  }, [search]);

  const visible = filtered.slice(0, visibleCount);

  function handleScroll() {
    const el = gridRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) {
      setVisibleCount((c) => Math.min(c + PAGE_SIZE, filtered.length));
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 h-8 px-2 w-full rounded-lg border border-stone-300 bg-white hover:border-amber-400 transition-colors text-sm"
      >
        <CategoryIcon name={value} className="w-4 h-4 shrink-0" style={{ color }} />
        <span className="flex-1 text-left text-stone-600 truncate">
          {value || "Pick icon"}
        </span>
        <ChevronDown className="w-3 h-3 text-stone-400 shrink-0" />
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1 right-0 w-72 p-2 rounded-xl border border-amber-200 shadow-lg bg-amber-50"
        >
          {/* Search */}
          <div className="relative mb-2">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search icons..."
              className="w-full h-7 pl-7 pr-2 text-xs rounded-lg border border-amber-200 bg-white text-stone-700 focus:outline-none focus:border-amber-400"
            />
          </div>

          {/* Icon grid */}
          <div
            ref={gridRef}
            onScroll={handleScroll}
            className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto"
          >
            {visible.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  onChange(name);
                  setOpen(false);
                  setSearch("");
                }}
                title={name}
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-lg transition-all",
                  "hover:bg-amber-100",
                  value === name
                    ? "bg-amber-200 ring-2 ring-amber-400"
                    : "bg-white"
                )}
              >
                <CategoryIcon
                  name={name}
                  className="w-4 h-4"
                  style={{ color }}
                />
              </button>
            ))}
          </div>

          {filtered.length === 0 && (
            <p className="text-xs text-stone-400 text-center py-3">No icons found</p>
          )}

          {filtered.length > 0 && (
            <p className="text-[10px] text-stone-400 text-center mt-1">
              {filtered.length} icons {search ? "matched" : "available"} &middot; scroll for more
            </p>
          )}
        </div>
      )}
    </div>
  );
}
