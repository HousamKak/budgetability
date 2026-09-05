import { useMemo, useRef, useState } from "react";
import {
  CURRENCIES,
  CURRENCY_CODES,
  type CurrencyCode,
  convertAt,
  rateBetween,
} from "@/lib/currency";
import { cn, formatCurrency } from "@/lib/utils";

/**
 * Safe little expression evaluator: + - * / ( ) and postfix %.
 * Accepts the display glyphs (x and division sign) and thousands commas.
 * Returns null for incomplete or invalid input, so the live result simply
 * stays hidden while typing.
 */
function evaluate(expr: string): number | null {
  const s = expr
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/,/g, "")
    .replace(/\s+/g, "");
  if (!s) return null;
  let i = 0;

  function parseExpr(): number {
    let v = parseTerm();
    for (;;) {
      const c = s[i];
      if (c === "+") {
        i++;
        v += parseTerm();
      } else if (c === "-") {
        i++;
        v -= parseTerm();
      } else break;
    }
    return v;
  }

  function parseTerm(): number {
    let v = parseFactor();
    for (;;) {
      const c = s[i];
      if (c === "*") {
        i++;
        v *= parseFactor();
      } else if (c === "/") {
        i++;
        v /= parseFactor();
      } else break;
    }
    return v;
  }

  function parseFactor(): number {
    const c = s[i];
    if (c === "+") {
      i++;
      return parseFactor();
    }
    if (c === "-") {
      i++;
      return -parseFactor();
    }
    let v: number;
    if (c === "(") {
      i++;
      v = parseExpr();
      if (s[i] !== ")") throw new Error("unbalanced");
      i++;
    } else {
      const m = /^(?:\d+\.?\d*|\.\d+)/.exec(s.slice(i));
      if (!m) throw new Error("number expected");
      v = parseFloat(m[0]);
      i += m[0].length;
    }
    while (s[i] === "%") {
      i++;
      v = v / 100;
    }
    return v;
  }

  try {
    const v = parseExpr();
    if (i !== s.length) return null;
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });

/** Only what the parser understands may enter the display. */
function sanitize(text: string): string {
  return text.replace(/[^0-9+\-*/().,%\s×÷]/g, "");
}

const KEYS: { label: string; input?: string; kind?: "clear" | "back" | "eq" }[] = [
  { label: "C", kind: "clear" },
  { label: "(", input: "(" },
  { label: ")", input: ")" },
  { label: "÷", input: "÷" },
  { label: "7", input: "7" },
  { label: "8", input: "8" },
  { label: "9", input: "9" },
  { label: "×", input: "×" },
  { label: "4", input: "4" },
  { label: "5", input: "5" },
  { label: "6", input: "6" },
  { label: "-", input: "-" },
  { label: "1", input: "1" },
  { label: "2", input: "2" },
  { label: "3", input: "3" },
  { label: "+", input: "+" },
  { label: "%", input: "%" },
  { label: "0", input: "0" },
  { label: ".", input: "." },
  { label: "=", kind: "eq" },
];

/**
 * The planner's pocket calculator. Type or tap an expression, see the live
 * result, and read it in the other currencies at the Settings rates.
 */
export function CalculatorView() {
  const [expr, setExpr] = useState("");
  const [previous, setPrevious] = useState<string | null>(null);
  const [unit, setUnit] = useState<CurrencyCode>("USD");
  const inputRef = useRef<HTMLInputElement>(null);

  const result = useMemo(() => evaluate(expr), [expr]);
  // A bare number is not worth echoing back as "= n".
  const showsResult =
    result !== null && !/^\s*\d*\.?\d*\s*$/.test(expr.replace(/,/g, ""));

  const append = (text: string) => {
    setExpr((prev) => sanitize(prev + text));
    inputRef.current?.focus();
  };

  const equals = () => {
    if (result === null) return;
    setPrevious(`${expr.trim()} =`);
    setExpr(String(Math.round(result * 1e8) / 1e8));
    inputRef.current?.focus();
  };

  const clear = () => {
    setExpr("");
    setPrevious(null);
    inputRef.current?.focus();
  };

  const backspace = () => {
    setExpr((prev) => prev.slice(0, -1));
    inputRef.current?.focus();
  };

  const others = CURRENCY_CODES.filter((c) => c !== unit);

  return (
    <div className="p-4 space-y-3">
      {/* Display */}
      <div className="rounded-xl border-2 border-amber-200 bg-white/80 px-3 py-2 shadow-inner">
        <div className="h-4 text-right text-xs text-stone-400 handwriting truncate">
          {previous ?? ""}
        </div>
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={expr}
            onChange={(e) => setExpr(sanitize(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                equals();
              } else if (e.key === "Escape") {
                e.preventDefault();
                clear();
              }
            }}
            placeholder="0"
            aria-label="Calculator expression"
            className="w-full bg-transparent text-right text-2xl font-bold text-stone-800 handwriting focus:outline-none placeholder:text-stone-300"
          />
          <button
            type="button"
            onClick={backspace}
            aria-label="Backspace"
            className="shrink-0 w-8 h-8 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
          >
            {"⌫"}
          </button>
        </div>
        <div className="h-6 text-right text-lg text-amber-700 handwriting tabular-nums">
          {showsResult ? `= ${nf.format(result)}` : ""}
        </div>
      </div>

      {/* Keys */}
      <div className="grid grid-cols-4 gap-1.5">
        {KEYS.map((k) => (
          <button
            key={k.label}
            type="button"
            onClick={() => {
              if (k.kind === "clear") clear();
              else if (k.kind === "eq") equals();
              else if (k.input) append(k.input);
            }}
            className={cn(
              "h-11 rounded-lg border text-lg font-medium transition-colors cursor-pointer handwriting",
              k.kind === "eq"
                ? "bg-amber-500 hover:bg-amber-600 border-amber-500 text-white"
                : k.kind === "clear"
                  ? "bg-red-50 hover:bg-red-100 border-red-200 text-red-600"
                  : /\d|\./.test(k.label)
                    ? "bg-white/80 hover:bg-white border-stone-200 text-stone-800"
                    : "bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-700",
            )}
          >
            {k.label}
          </button>
        ))}
      </div>

      {/* Currency helper: read the result as one currency, see the others */}
      <div className="rounded-xl border border-stone-200 bg-white/70 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-stone-500">Result is in</p>
          <div className="flex gap-1.5">
            {CURRENCY_CODES.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setUnit(code)}
                className={cn(
                  "px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors cursor-pointer",
                  unit === code
                    ? "border-amber-400 bg-amber-50 text-amber-800"
                    : "border-stone-200 bg-white/70 text-stone-500 hover:border-amber-300",
                )}
              >
                {CURRENCIES[code].symbol}
              </button>
            ))}
          </div>
        </div>
        {result !== null && result !== 0 ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1 justify-end text-sm handwriting tabular-nums">
            {others.map((code) => (
              <span key={code} className="text-stone-700">
                {"≈"}{" "}
                {formatCurrency(convertAt(result, rateBetween(unit, code)), code)}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-right text-xs text-stone-400">
            Converted at your Settings rates as you type
          </p>
        )}
      </div>
    </div>
  );
}

export default CalculatorView;
