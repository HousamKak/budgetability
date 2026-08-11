// Multi-currency core (see docs/currency-spec.md).
//
// Three ideas, kept separate:
//  * account currency  — each account is denominated in one currency
//  * base currency     — the planning domain (budgets/expenses/forecast) uses one
//  * exchange rates    — user-entered, stored as units of currency per 1 USD
//
// The pure formatting/conversion helpers below read a module-level snapshot so
// existing call sites (`formatCurrency(x)`) keep working without prop drilling.
// CurrencyProvider (currency-context.tsx) primes and refreshes the snapshot.

export type CurrencyCode = "USD" | "AED" | "LBP";

export type CurrencyDef = {
  code: CurrencyCode;
  name: string;
  /** Display symbol, always rendered as a prefix. */
  symbol: string;
  /** Space between symbol and number ("AED 100" vs "$100"). */
  symbolSpace: boolean;
  /** Max fraction digits (trailing zeros are always trimmed). */
  decimals: number;
  /** Amount-input placeholder and step. */
  inputPlaceholder: string;
  inputStep: string;
  /** Quick-amount buttons, scaled to the currency's magnitudes. */
  presets: number[];
};

export const CURRENCIES: Record<CurrencyCode, CurrencyDef> = {
  USD: {
    code: "USD",
    name: "US Dollar",
    symbol: "$",
    symbolSpace: false,
    decimals: 2,
    inputPlaceholder: "0.00",
    inputStep: "0.01",
    presets: [100, 250, 500, 1000],
  },
  AED: {
    code: "AED",
    name: "UAE Dirham",
    symbol: "AED",
    symbolSpace: true,
    decimals: 2,
    inputPlaceholder: "0.00",
    inputStep: "0.01",
    presets: [250, 500, 1000, 2500],
  },
  LBP: {
    code: "LBP",
    name: "Lebanese Lira",
    symbol: "LBP",
    symbolSpace: true,
    decimals: 0,
    inputPlaceholder: "0",
    inputStep: "1",
    presets: [1_000_000, 5_000_000, 10_000_000, 50_000_000],
  },
};

export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[];

export function isCurrencyCode(v: unknown): v is CurrencyCode {
  return typeof v === "string" && v in CURRENCIES;
}

/** Exchange rates as units of currency per 1 USD. USD is always 1. */
export type ExchangeRates = Partial<Record<CurrencyCode, number>>;

/** Sensible seeds: AED is pegged; LBP defaults to a recent market rate (editable). */
export const DEFAULT_RATES: Required<Omit<ExchangeRates, "USD">> = {
  AED: 3.6725,
  LBP: 89500,
};

export type CurrencySettings = {
  baseCurrency: CurrencyCode;
  rates: ExchangeRates;
};

// ─── Active snapshot ─────────────────────────────────────────────────────────

let active: CurrencySettings = {
  baseCurrency: "USD",
  rates: { USD: 1, ...DEFAULT_RATES },
};

export function setActiveCurrencySettings(settings: CurrencySettings): void {
  active = {
    baseCurrency: settings.baseCurrency,
    rates: { USD: 1, ...DEFAULT_RATES, ...settings.rates },
  };
}

export function getActiveCurrencySettings(): CurrencySettings {
  return active;
}

export function getBaseCurrency(): CurrencyCode {
  return active.baseCurrency;
}

// ─── Conversion ──────────────────────────────────────────────────────────────

function rateOf(code: CurrencyCode): number {
  if (code === "USD") return 1;
  const r = active.rates[code];
  return r && r > 0 ? r : (DEFAULT_RATES[code] ?? 1);
}

/** Convert between currencies via the USD anchor. Round-half-up to 2 dp. */
export function convert(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
): number {
  if (from === to) return amount;
  const converted = (amount * rateOf(to)) / rateOf(from);
  return Math.round(converted * 100) / 100;
}

/** Convert an amount denominated in `from` into the base currency. */
export function toBase(amount: number, from: CurrencyCode): number {
  return convert(amount, from, active.baseCurrency);
}

// ─── Formatting ──────────────────────────────────────────────────────────────

function def(code?: CurrencyCode): CurrencyDef {
  return CURRENCIES[code ?? active.baseCurrency];
}

/** The display symbol for a currency (defaults to the active base). */
export function currencySymbol(code?: CurrencyCode): string {
  return def(code).symbol;
}

/** placeholder/step/inputMode attributes for an amount input in a currency. */
export function currencyInputProps(code?: CurrencyCode): {
  placeholder: string;
  step: string;
} {
  const d = def(code);
  return { placeholder: d.inputPlaceholder, step: d.inputStep };
}

/**
 * Format an amount in a currency (defaults to the active base currency).
 * Preserves the app's historic style: thousands separators, trailing zeros
 * trimmed ("$100", "$100.5", "AED 1,234.56", "LBP 1,500,000").
 */
export function formatCurrency(amount: number, code?: CurrencyCode): string {
  const d = def(code);
  const sign = amount < 0 ? "-" : "";
  const body = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: d.decimals,
  }).format(Math.abs(amount));
  return `${sign}${d.symbol}${d.symbolSpace ? " " : ""}${body}`;
}

/**
 * Compact form for chart axes and tight badges: $12.4k, AED 3.4M, LBP 1.2B.
 * LBP amounts routinely reach millions/billions, hence the extra tiers.
 */
export function formatCurrencyCompact(
  amount: number,
  code?: CurrencyCode,
): string {
  const d = def(code);
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  const prefix = `${d.symbol}${d.symbolSpace ? " " : ""}`;

  const tier = (value: number, suffix: string) => {
    const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
    // Trim trailing zeros ("1.50M" -> "1.5M", "2.00k" -> "2k")
    const body = parseFloat(value.toFixed(digits)).toString();
    return `${sign}${prefix}${body}${suffix}`;
  };

  if (abs >= 1_000_000_000) return tier(abs / 1_000_000_000, "B");
  if (abs >= 1_000_000) return tier(abs / 1_000_000, "M");
  if (abs >= 1_000) return tier(abs / 1_000, "k");
  return `${sign}${prefix}${abs.toFixed(0)}`;
}
