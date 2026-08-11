import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { dataService } from "@/lib/data-service";
import {
  type CurrencyCode,
  type CurrencySettings,
  type ExchangeRates,
  DEFAULT_RATES,
  setActiveCurrencySettings,
} from "@/lib/currency";

interface CurrencyContextType {
  baseCurrency: CurrencyCode;
  rates: ExchangeRates;
  setBaseCurrency: (code: CurrencyCode) => Promise<void>;
  setRate: (code: CurrencyCode, rate: number) => Promise<void>;
  /**
   * Remounts the app subtree so every formatted amount picks up the new
   * snapshot. Call after a batch of changes (e.g. closing Settings) — not on
   * each keystroke, or the dialog making the changes would unmount itself.
   */
  refreshView: () => void;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(
  undefined,
);

// eslint-disable-next-line react-refresh/only-export-components
export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}

/**
 * Loads the user's base currency + exchange rates, primes the module-level
 * snapshot that the pure `formatCurrency`/`convert` helpers read, and remounts
 * the subtree (key bump) when they change so every formatted amount is redrawn.
 * Currency changes are rare, so a full remount is the simple correct choice.
 */
export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<CurrencySettings>({
    baseCurrency: "USD",
    rates: { USD: 1, ...DEFAULT_RATES },
  });
  const [version, setVersion] = useState(0);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    const loaded = await dataService.getCurrencySettings();
    setActiveCurrencySettings(loaded);
    setSettings(loaded);
    setVersion((v) => v + 1);
    setReady(true);
  }, []);

  // Reload on login/logout so we pick up the right user's settings.
  useEffect(() => {
    load();
  }, [load, user?.id]);

  // Changes take effect in the snapshot immediately (new formats/conversions
  // from here on) but do NOT remount the subtree — refreshView() does that.
  const setBaseCurrency = useCallback(async (code: CurrencyCode) => {
    await dataService.setBaseCurrency(code);
    setSettings((prev) => {
      const next = { ...prev, baseCurrency: code };
      setActiveCurrencySettings(next);
      return next;
    });
  }, []);

  const setRate = useCallback(async (code: CurrencyCode, rate: number) => {
    await dataService.setExchangeRate(code, rate);
    setSettings((prev) => {
      const next = { ...prev, rates: { ...prev.rates, [code]: rate } };
      setActiveCurrencySettings(next);
      return next;
    });
  }, []);

  const refreshView = useCallback(() => setVersion((v) => v + 1), []);

  if (!ready) return null;

  return (
    <CurrencyContext.Provider
      value={{
        baseCurrency: settings.baseCurrency,
        rates: settings.rates,
        setBaseCurrency,
        setRate,
        refreshView,
      }}
    >
      <div key={version} className="contents">
        {children}
      </div>
    </CurrencyContext.Provider>
  );
}
