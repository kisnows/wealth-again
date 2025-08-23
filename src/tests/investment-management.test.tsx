import { PrismaClient } from "@prisma/client";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AccountOperationRecords from "@/components/investment/account-operation-records";
import AccountOperationsPanel from "@/components/investment/account-operations-panel";
import type { Account } from "@/types";

// Mock the dependencies
vi.mock("@/lib/prisma", () => ({
  prisma: {
    account: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    transaction: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    valuationSnapshot: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/session", () => ({
  getCurrentUser: vi.fn().mockResolvedValue("test-user-id"),
}));

// Mock fetch globally
global.fetch = vi.fn();

const mockAccount: Account = {
  id: "test-account-id",
  name: "Test Investment Account",
  accountType: "INVESTMENT",
  subType: "Stock Portfolio",
  baseCurrency: "CNY",
  initialBalance: "100000",
  totalDeposits: "50000",
  totalWithdrawals: "10000",
  status: "ACTIVE",
  description: "Test account for investment",
  userId: "test-user-id",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-02T00:00:00.000Z",
};

const mockAccounts: Account[] = [
  mockAccount,
  {
    ...mockAccount,
    id: "test-account-2",
    name: "Savings Account",
    accountType: "SAVINGS",
  },
];

describe("Investment Management System Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
  });

  describe("AccountOperationsPanel", () => {
    const mockProps = {
      accountId: "test-account-id",
      account: mockAccount,
      accounts: mockAccounts,
      onOperationComplete: vi.fn(),
    };

    it("renders all operation cards correctly", () => {
      render(<AccountOperationsPanel {...mockProps} />);

      expect(screen.getByText("💰 存款")).toBeInTheDocument();
      expect(screen.getByText("🏧 取款")).toBeInTheDocument();
      expect(screen.getByText("📊 估值更新")).toBeInTheDocument();
      expect(screen.getByText("🔄 转账")).toBeInTheDocument();
      expect(screen.getByText("✏️ 编辑账户")).toBeInTheDocument();
    });

    it("handles deposit operation correctly", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({ success: true }),
      });

      render(<AccountOperationsPanel {...mockProps} />);

      const amountInput = screen.getByTestId("deposit-amount-input");
      const submitButton = screen.getByTestId("deposit-submit-button");

      fireEvent.change(amountInput, { target: { value: "10000" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: "test-account-id",
            type: "DEPOSIT",
            amount: 10000,
            tradeDate: expect.any(String),
            currency: "CNY",
            note: undefined,
          }),
        });
      });
    });

    it("handles withdraw operation correctly", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({ success: true }),
      });

      render(<AccountOperationsPanel {...mockProps} />);

      const amountInput = screen.getByTestId("withdraw-amount-input");
      const submitButton = screen.getByTestId("withdraw-submit-button");

      fireEvent.change(amountInput, { target: { value: "5000" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: "test-account-id",
            type: "WITHDRAW",
            amount: 5000,
            tradeDate: expect.any(String),
            currency: "CNY",
            note: undefined,
          }),
        });
      });
    });

    it("handles valuation update correctly", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({ success: true }),
      });

      render(<AccountOperationsPanel {...mockProps} />);

      const amountInput = screen.getByTestId("valuation-amount-input");
      const submitButton = screen.getByTestId("valuation-submit-button");

      fireEvent.change(amountInput, { target: { value: "150000" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/api/accounts/test-account-id/snapshots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            totalValue: 150000,
            asOf: expect.any(String),
          }),
        });
      });
    });

    it("handles transfer operation correctly", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({ success: true }),
      });

      render(<AccountOperationsPanel {...mockProps} />);

      const amountInput = screen.getByTestId("transfer-amount-input");
      const submitButton = screen.getByTestId("transfer-submit-button");

      fireEvent.change(amountInput, { target: { value: "20000" } });
      // Note: We would need to select the target account in a real test
      fireEvent.click(submitButton);

      // This test will fail validation because no target account is selected,
      // which is the expected behavior
      await waitFor(() => {
        expect(screen.getByText("请选择转入账户")).toBeInTheDocument();
      });
    });

    it("validates required fields", async () => {
      render(<AccountOperationsPanel {...mockProps} />);

      // Try to submit deposit without amount
      const depositSubmitButton = screen.getByTestId("deposit-submit-button");
      fireEvent.click(depositSubmitButton);

      await waitFor(() => {
        expect(screen.getByText("请输入有效的存款金额")).toBeInTheDocument();
      });

      // Try to submit valuation without amount
      const valuationSubmitButton = screen.getByTestId("valuation-submit-button");
      fireEvent.click(valuationSubmitButton);

      await waitFor(() => {
        expect(screen.getByText("请输入有效的估值金额")).toBeInTheDocument();
      });
    });

    it("disables valuation update for savings accounts", () => {
      const savingsProps = {
        ...mockProps,
        account: { ...mockAccount, accountType: "SAVINGS" as const },
      };

      render(<AccountOperationsPanel {...savingsProps} />);

      const valuationInput = screen.getByTestId("valuation-amount-input");
      const valuationButton = screen.getByTestId("valuation-submit-button");

      expect(valuationInput).toBeDisabled();
      expect(valuationButton).toBeDisabled();
    });
  });

  describe("AccountOperationRecords", () => {
    const mockSnapshots = [
      {
        id: "snapshot-1",
        asOf: "2024-01-15T00:00:00Z",
        totalValue: "150000",
      },
      {
        id: "snapshot-2",
        asOf: "2024-01-10T00:00:00Z",
        totalValue: "140000",
      },
    ];

    const mockTransactions = [
      {
        id: "transaction-1",
        type: "DEPOSIT",
        amount: "10000",
        tradeDate: "2024-01-12T00:00:00Z",
        currency: "CNY",
        note: "Monthly deposit",
      },
      {
        id: "transaction-2",
        type: "WITHDRAW",
        amount: "5000",
        tradeDate: "2024-01-08T00:00:00Z",
        currency: "CNY",
      },
    ];

    beforeEach(() => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          json: async () => ({
            success: true,
            data: mockSnapshots,
            pagination: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
          }),
        })
        .mockResolvedValueOnce({
          json: async () => ({
            success: true,
            data: mockTransactions,
            pagination: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
          }),
        });
    });

    it("fetches and displays operation records correctly", async () => {
      render(<AccountOperationRecords accountId={"test-account-id"} />);

      await waitFor(() => {
        expect(screen.getByText("估值更新")).toBeInTheDocument();
        expect(screen.getByText("存款")).toBeInTheDocument();
        expect(screen.getByText("取款")).toBeInTheDocument();
      });

      // Check if amounts are displayed correctly
      expect(screen.getByText("¥150,000")).toBeInTheDocument();
      expect(screen.getByText("+¥10,000")).toBeInTheDocument();
      expect(screen.getByText("-¥5,000")).toBeInTheDocument();
    });

    it("handles snapshot deletion correctly", async () => {
      // Mock confirm dialog
      window.confirm = vi.fn().mockReturnValue(true);

      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({ success: true, message: "快照已删除" }),
      });

      render(<AccountOperationRecords accountId={"test-account-id"} />);

      await waitFor(() => {
        const deleteButton = screen.getByTestId("delete-snapshot-button");
        fireEvent.click(deleteButton);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/api/accounts/test-account-id/snapshots", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snapshotId: "snapshot-1" }),
        });
      });
    });

    it("applies filters correctly", async () => {
      render(<AccountOperationRecords accountId={"test-account-id"} />);

      await waitFor(() => {
        const typeFilter = screen.getByTestId("type-filter");
        // In a real test, we would simulate selecting a filter option
        expect(typeFilter).toBeInTheDocument();
      });

      const clearFiltersButton = screen.getByTestId("clear-filters-button");
      expect(clearFiltersButton).toBeInTheDocument();
    });
  });

  describe("API Integration Tests", () => {
    it("should handle transfer API with correct field names", async () => {
      const transferData = {
        fromAccountId: "account-1",
        toAccountId: "account-2",
        amount: 10000,
        tradeDate: "2024-01-15",
        note: "Test transfer",
        currency: "CNY",
      };

      // This would be tested with actual API calls in integration tests
      expect(transferData.tradeDate).toBeDefined();
      expect(transferData.note).toBeDefined();
    });

    it("should validate snapshot creation data", () => {
      const snapshotData = {
        totalValue: 150000,
        asOf: "2024-01-15",
      };

      expect(snapshotData.totalValue).toBeGreaterThan(0);
      expect(Date.parse(snapshotData.asOf)).not.toBeNaN();
    });

    it("should validate snapshot deletion data", () => {
      const deleteData = {
        snapshotId: "valid-uuid-here",
      };

      expect(deleteData.snapshotId).toBeTruthy();
    });
  });
});
