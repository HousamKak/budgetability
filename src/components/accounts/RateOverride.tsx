import { useEffect, useState } from "react";
import {
  type CurrencyCode,
  displayRate,
  formatRate,
  parseDecimal,
  rateBetween,
} from "@/lib/currency";
import { cn } from "@/lib/utils";

interface RateOverrideProps {
  from: CurrencyCode;
  to: CurrencyCode;
  /**
   * The pair rate in force for this transaction: units of `to` per 1 `from`.
   * `null` means "use the Settings default".
   */
  rate: number | null;
  onChange: (rate: number | null) => void;
  className?: string;
}

/**
 * "1 USD = 89,500 L.L." with an editable number. Settings supplies the
 * default; typing a different rate overrides it for this one transaction so
 * the record keeps the rate the bank or exchange actually applied.
 *
 * Renders nothing for same-currency movements.
 */
export function RateOverride({
  from,
  to,
  rate,
  onChange,
  className,
}: RateOverrideProps) {
  const defaultRate = rateBetween(from, to);
  const effective = rate ?? defaultRate;
  const view = displayRate(from, to, effective);
  const defaultView = displayRate(from, to, defaultRate);
  const [text, setText] = useState(formatRate(view.perAnchor));
  const [editing, setEditing] = useState(false);

  // Keep the field in sync with external changes while it isn't focused.
  useEffect(() => {
    if (!editing) setText(formatRate(view.perAnchor));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.perAnchor, editing]);

  if (from === to) return null;

  const commit = () => {
    setEditing(false);
    const typed = parseDecimal(text);
    if (!(typed > 0)) {
      setText(formatRate(view.perAnchor));
      return;
    }
    // Convert the anchored figure back into "to per 1 from".
    const toPerFrom = view.anchor === from ? typed : 1 / typed;
    // Typing the default back clears the override.
    const isDefault =
      Math.abs(toPerFrom - defaultRate) / defaultRate < 0.000001;
    onChange(isDefault ? null : toPerFrom);
  };

  const overridden = rate !== null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-600",
        className,
      )}
    >
      <span>Rate: 1 {view.anchor} =</span>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={text}
        onFocus={() => setEditing(true)}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className={cn(
          "h-7 w-28 px-2 text-right rounded-md border bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400/50",
          overridden ? "border-amber-400 font-semibold" : "border-stone-300",
        )}
        aria-label={`Exchange rate, ${view.other} per 1 ${view.anchor}`}
      />
      <span>{view.other}</span>
      {overridden ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-amber-700 underline underline-offset-2 hover:text-amber-800 cursor-pointer"
        >
          reset to default ({formatRate(defaultView.perAnchor)})
        </button>
      ) : (
        <span className="text-stone-400">Settings default — edit to override</span>
      )}
    </div>
  );
}
