import { CURRENCIES, type CurrencyCode } from "@/lib/currency";
import { cn } from "@/lib/utils";

interface CurrencyChipsProps {
  /** The currencies on offer (a wallet's held set). */
  currencies: CurrencyCode[];
  value: CurrencyCode;
  onChange: (code: CurrencyCode) => void;
  className?: string;
}

/**
 * Chip row for picking which of a wallet's currencies a movement uses.
 * Renders nothing when there is no real choice (single-currency wallet).
 */
export function CurrencyChips({
  currencies,
  value,
  onChange,
  className,
}: CurrencyChipsProps) {
  if (currencies.length <= 1) return null;
  return (
    <div className={cn("flex gap-1.5", className)}>
      {currencies.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => onChange(code)}
          className={cn(
            "px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors cursor-pointer",
            value === code
              ? "border-amber-400 bg-amber-50 text-amber-800"
              : "border-stone-200 bg-white/70 text-stone-500 hover:border-amber-300",
          )}
        >
          {CURRENCIES[code].symbol}
        </button>
      ))}
    </div>
  );
}
