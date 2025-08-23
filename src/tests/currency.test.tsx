import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom";
import { CurrencyDisplay, CurrencySelect, PercentageDisplay } from "@/components/shared/currency";
import {
  CURRENCIES,
  formatCurrency,
  formatPercentage,
  getCurrencyInfo,
} from "@/lib/currency-utils";

// Mock the useFxRates hook
vi.mock("@/hooks/use-fx-rates", () => ({
  useFxRates: () => ({
    convert: (amount: number, from: string, to: string) => amount, // Mock 1:1 conversion for testing
  }),
}));

describe("Currency Utils", () => {
  describe("formatCurrency", () => {
    it("formats positive amounts correctly", () => {
      expect(formatCurrency(1234.56, "CNY")).toMatch(/¥.*1,234.56/);
    });

    it("formats negative amounts correctly", () => {
      expect(formatCurrency(-1234.56, "CNY")).toMatch(/-.*¥.*1,234.56/);
    });

    it("handles null and undefined", () => {
      expect(formatCurrency(null)).toBe("-");
      expect(formatCurrency(undefined)).toBe("-");
    });

    it("handles NaN", () => {
      expect(formatCurrency(NaN)).toBe("-");
    });

    it("respects precision option", () => {
      const result = formatCurrency(1234.5678, "CNY", { precision: 0 });
      expect(result).not.toContain(".56");
    });

    it("works with different currencies", () => {
      expect(formatCurrency(100, "USD")).toContain("$");
      expect(formatCurrency(100, "EUR")).toContain("€");
    });
  });

  describe("formatPercentage", () => {
    it("formats percentage correctly", () => {
      expect(formatPercentage(0.1234)).toBe("12.34%");
    });

    it("handles negative percentages", () => {
      expect(formatPercentage(-0.05)).toBe("-5.00%");
    });

    it("handles null and undefined", () => {
      expect(formatPercentage(null)).toBe("-");
      expect(formatPercentage(undefined)).toBe("-");
    });

    it("respects precision", () => {
      expect(formatPercentage(0.1234, 1)).toBe("12.3%");
    });
  });

  describe("getCurrencyInfo", () => {
    it("returns correct currency info", () => {
      const cny = getCurrencyInfo("CNY");
      expect(cny.code).toBe("CNY");
      expect(cny.name).toBe("人民币");
      expect(cny.symbol).toBe("¥");
    });

    it("returns default currency for unknown codes", () => {
      const unknown = getCurrencyInfo("UNKNOWN");
      expect(unknown.code).toBe("CNY");
    });
  });

  describe("CURRENCIES", () => {
    it("contains expected currencies", () => {
      expect(CURRENCIES).toHaveLength(4);
      expect(CURRENCIES.map((c) => c.code)).toContain("CNY");
      expect(CURRENCIES.map((c) => c.code)).toContain("USD");
      expect(CURRENCIES.map((c) => c.code)).toContain("HKD");
      expect(CURRENCIES.map((c) => c.code)).toContain("EUR");
    });
  });
});

describe("Currency Components", () => {
  describe("CurrencyDisplay", () => {
    it("renders amount correctly", () => {
      render(<CurrencyDisplay amount={1234.56} data-testid="currency-display" />);
      const element = screen.getByTestId("currency-display");
      expect(element).toBeInTheDocument();
      expect(element).toHaveTextContent("1,234.56");
    });

    it("shows dash for null amounts", () => {
      render(<CurrencyDisplay amount={null} data-testid="currency-display" />);
      const element = screen.getByTestId("currency-display");
      expect(element).toHaveTextContent("-");
    });

    it("applies custom className", () => {
      render(
        <CurrencyDisplay amount={100} className="custom-class" data-testid="currency-display" />,
      );
      const element = screen.getByTestId("currency-display");
      expect(element).toHaveClass("custom-class");
    });
  });

  describe("PercentageDisplay", () => {
    it("renders percentage correctly", () => {
      render(<PercentageDisplay value={0.1234} data-testid="percentage-display" />);
      const element = screen.getByTestId("percentage-display");
      expect(element).toBeInTheDocument();
      expect(element).toHaveTextContent("12.34%");
    });

    it("shows dash for null values", () => {
      render(<PercentageDisplay value={null} data-testid="percentage-display" />);
      const element = screen.getByTestId("percentage-display");
      expect(element).toHaveTextContent("-");
    });
  });

  describe("CurrencySelect", () => {
    it("renders with all currency options", () => {
      const onChange = vi.fn();
      render(<CurrencySelect value="CNY" onChange={onChange} data-testid="currency-select" />);

      const element = screen.getByTestId("currency-select");
      expect(element).toBeInTheDocument();
    });

    it("displays current value correctly", () => {
      const onChange = vi.fn();
      render(<CurrencySelect value="USD" onChange={onChange} data-testid="currency-select" />);

      // The component should show the current selection
      expect(screen.getByText(/美元/)).toBeInTheDocument();
    });
  });
});
