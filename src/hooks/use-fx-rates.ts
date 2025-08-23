import { useCallback, useEffect, useMemo, useState } from "react";

interface FxRate {
  base: string;
  quote: string;
  asOf: string;
  rate: number;
}

interface FxRatesMap {
  [key: string]: number; // key is "base-quote", value is rate
}

export function useFxRates(baseCurrency: string, currencies: string[]) {
  const [fxRates, setFxRates] = useState<FxRatesMap>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 使用 useMemo 来稳定 currencies 数组的引用，避免无限循环
  const stableCurrencies = useMemo(() => currencies, [currencies.join(",")]);

  useEffect(() => {
    const fetchFxRates = async () => {
      if (!baseCurrency || stableCurrencies.length === 0) return;

      setLoading(true);
      setError(null);

      try {
        // We need to fetch rates for all currency pairs involving baseCurrency
        // For example, if baseCurrency is "CNY" and currencies are ["CNY", "USD", "HKD"],
        // we need to fetch rates for "USD-CNY" and "HKD-CNY" (or their reverses)

        // Create a list of required currency pairs
        const pairs: { base: string; quote: string }[] = [];
        stableCurrencies.forEach((currency) => {
          if (currency !== baseCurrency) {
            pairs.push({ base: currency, quote: baseCurrency });
          }
        });

        // If there are no pairs to fetch, we're done
        if (pairs.length === 0) {
          setFxRates({});
          setLoading(false);
          return;
        }

        // For simplicity in this implementation, we'll fetch one by one
        // In a production app, you might want to batch these requests
        const rates: FxRatesMap = {};

        for (const pair of pairs) {
          try {
            // Construct query parameters
            const params = new URLSearchParams({
              base: pair.base,
              quote: pair.quote,
              // We'll fetch the most recent rate, so no need for asOf
              page: "1",
              pageSize: "1",
            });

            const response = await fetch(`/api/fx-rates?${params}`);
            const data = await response.json();

            if (data.success && data.data && data.data.length > 0) {
              const rate = Number(data.data[0].rate);
              rates[`${pair.base}-${pair.quote}`] = rate;
            } else {
              // Try the reverse pair
              const revParams = new URLSearchParams({
                base: pair.quote,
                quote: pair.base,
                page: "1",
                pageSize: "1",
              });

              const revResponse = await fetch(`/api/fx-rates?${revParams}`);
              const revData = await revResponse.json();

              if (revData.success && revData.data && revData.data.length > 0) {
                const rate = 1 / Number(revData.data[0].rate);
                rates[`${pair.base}-${pair.quote}`] = rate;
              } else {
                // If we can't find a rate, we'll use 1 as a fallback
                rates[`${pair.base}-${pair.quote}`] = 1;
                console.warn(
                  `Could not find FX rate for ${pair.base}-${pair.quote}, using 1 as fallback`,
                );
              }
            }
          } catch (err) {
            console.error(`Error fetching rate for ${pair.base}-${pair.quote}:`, err);
            // Use 1 as a fallback rate if there's an error
            rates[`${pair.base}-${pair.quote}`] = 1;
          }
        }

        setFxRates(rates);
      } catch (err) {
        console.error("Error fetching fx rates:", err);
        setError("获取汇率失败");
      } finally {
        setLoading(false);
      }
    };

    fetchFxRates();
  }, [baseCurrency, stableCurrencies]);

  // Function to convert an amount from one currency to another
  const convert = useCallback(
    (amount: number, fromCurrency: string, toCurrency: string): number => {
      // If from and to currencies are the same, no conversion needed
      if (fromCurrency === toCurrency) {
        return amount;
      }

      // If base currency is not set or no rates available, return amount as is
      if (!baseCurrency || Object.keys(fxRates).length === 0) {
        console.warn(`FX rates not available, returning amount as is`);
        return amount;
      }

      // If converting to base currency
      if (toCurrency === baseCurrency) {
        const key = `${fromCurrency}-${baseCurrency}`;
        const rate = fxRates[key];
        if (rate !== undefined) {
          return amount * rate;
        }
        // If rate not found, return amount as is
        console.warn(`FX rate not found for ${fromCurrency}-${toCurrency}, returning amount as is`);
        return amount;
      }

      // If converting from base currency
      if (fromCurrency === baseCurrency) {
        // We need to check if we have the reverse rate stored
        const reverseKey = `${toCurrency}-${baseCurrency}`;
        const reverseRate = fxRates[reverseKey];
        if (reverseRate !== undefined) {
          return amount / reverseRate;
        }

        // If rate not found, return amount as is
        console.warn(`FX rate not found for ${fromCurrency}-${toCurrency}, returning amount as is`);
        return amount;
      }

      // For conversions between two non-base currencies, we need to go through base currency
      // First convert fromCurrency to baseCurrency
      const fromToBaseReverseKey = `${baseCurrency}-${fromCurrency}`;
      let amountInBase = amount;

      const fromToBaseRate = fxRates[`${fromCurrency}-${baseCurrency}`];
      const fromToBaseReverseRate = fxRates[fromToBaseReverseKey];

      if (fromToBaseRate !== undefined) {
        amountInBase = amount * fromToBaseRate;
      } else if (fromToBaseReverseRate !== undefined) {
        amountInBase = amount / fromToBaseReverseRate;
      } else {
        // If we can't convert to base currency, return original amount
        console.warn(
          `FX rate not found for ${fromCurrency}-${baseCurrency}, returning amount as is`,
        );
        return amount;
      }

      // Then convert baseCurrency to toCurrency
      const baseToToReverseKey = `${toCurrency}-${baseCurrency}`;

      const baseToToRate = fxRates[`${baseCurrency}-${toCurrency}`];
      const baseToToReverseRate = fxRates[baseToToReverseKey];

      if (baseToToRate !== undefined) {
        return amountInBase * baseToToRate;
      } else if (baseToToReverseRate !== undefined) {
        return amountInBase / baseToToReverseRate;
      }

      // If we can't convert from base currency, return amount in base currency
      console.warn(
        `FX rate not found for ${baseCurrency}-${toCurrency}, returning amount in base currency`,
      );
      return amountInBase;
    },
    [baseCurrency, fxRates],
  );

  return { fxRates, loading, error, convert };
}
