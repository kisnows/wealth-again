"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type Account,
  archiveAccount,
  deleteAccount,
  updateAccount,
} from "@/lib/api/accounts";
import type { AccountSummaryItem } from "@/lib/api/reports";
import {
  type EnrichedAccount,
  normalizeAccountData,
} from "@/components/modules/accounts/account-table-utils";
import { AccountCard } from "@/components/modules/accounts/AccountCard";

type TypeFilter = "ALL" | "ASSET" | "SAVINGS" | "INVESTMENT" | "LOAN" | "OTHER";
type StatusFilter = "ALL" | "ACTIVE" | "ARCHIVED";

const TYPE_FILTERS: Array<{ value: TypeFilter; label: string }> = [
  { value: "ALL", label: "全部" },
  { value: "ASSET", label: "资产" },
  { value: "INVESTMENT", label: "投资" },
  { value: "LOAN", label: "借贷" },
  { value: "SAVINGS", label: "储蓄" },
  { value: "OTHER", label: "其他" },
];

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "ACTIVE", label: "在用" },
  { value: "ARCHIVED", label: "已归档" },
  { value: "ALL", label: "全部状态" },
];

type AccountTableProps = {
  accounts: Account[];
  summaries: AccountSummaryItem[];
  isLoading: boolean;
  displayCurrency?: string | null;
};

const pendingKey = (action: string, id: string) => `${action}:${id}`;

function filterAccounts(
  accounts: EnrichedAccount[],
  typeFilter: TypeFilter,
  statusFilter: StatusFilter,
  searchTerm: string,
) {
  const lowerCaseSearch = searchTerm.trim().toLowerCase();
  return accounts
    .filter((account) => {
      const accountType = account.metrics.accountType || account.accountType;
      if (typeFilter === "ASSET" && accountType === "LOAN") return false;
      if (
        typeFilter !== "ALL" &&
        typeFilter !== "ASSET" &&
        accountType !== typeFilter
      ) {
        return false;
      }
      const status = account.status ?? "ACTIVE";
      if (statusFilter !== "ALL" && status !== statusFilter) return false;
      if (!lowerCaseSearch) return true;
      const haystack = [
        account.name,
        account.subType ?? "",
        account.description ?? "",
        account.baseCurrency,
        account.metrics.currency,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(lowerCaseSearch);
    })
    .sort((a, b) => {
      const aValue =
        typeof a.metrics.displayValue === "number"
          ? a.metrics.displayValue
          : a.metrics.valuation;
      const bValue =
        typeof b.metrics.displayValue === "number"
          ? b.metrics.displayValue
          : b.metrics.valuation;
      return bValue - aValue;
    });
}

export function AccountTable({
  accounts,
  summaries,
  isLoading,
  displayCurrency,
}: AccountTableProps) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ACTIVE");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const mergedAccounts = useMemo(
    () => normalizeAccountData(accounts, summaries),
    [accounts, summaries],
  );

  const filteredAccounts = useMemo(
    () =>
      filterAccounts(mergedAccounts, typeFilter, statusFilter, searchTerm),
    [mergedAccounts, typeFilter, statusFilter, searchTerm],
  );

  const isEmpty = filteredAccounts.length === 0;
  const hasActiveFilter =
    typeFilter !== "ALL" ||
    statusFilter !== "ACTIVE" ||
    searchTerm.trim().length > 0;

  const isPending = (action: "archive" | "restore" | "delete", id: string) =>
    pendingAction === pendingKey(action, id);

  const resetPending = () => setPendingAction(null);
  const parseErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error) {
      if (error.message.includes("account_has_related_records")) {
        return "账户存在交易或估值记录，无法直接删除，请确认后再试。";
      }
      return error.message;
    }
    return fallback;
  };

  const handleArchive = async (id: string) => {
    setPendingAction(pendingKey("archive", id));
    try {
      await archiveAccount(id);
      toast.success("账户已归档");
    } catch (error) {
      toast.error(parseErrorMessage(error, "归档失败，请稍后重试。"));
    } finally {
      resetPending();
    }
  };

  const handleRestore = async (id: string) => {
    setPendingAction(pendingKey("restore", id));
    try {
      await updateAccount(id, { status: "ACTIVE" });
      toast.success("账户已恢复为在用状态");
    } catch (error) {
      toast.error(parseErrorMessage(error, "恢复失败，请稍后重试。"));
    } finally {
      resetPending();
    }
  };

  const handleDelete = async (id: string) => {
    if (
      typeof window !== "undefined" &&
      // eslint-disable-next-line no-alert
      !window.confirm("删除后无法恢复，确认继续删除该账户吗？")
    ) {
      return;
    }
    setPendingAction(pendingKey("delete", id));
    try {
      await deleteAccount(id);
      toast.success("账户已删除");
      setExpandedId((prev) => (prev === id ? null : prev));
    } catch (error) {
      toast.error(
        parseErrorMessage(error, "删除失败，请检查账户是否仍有关联记录。"),
      );
    } finally {
      resetPending();
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border p-6 text-sm text-muted-foreground">
        加载中…
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="accounts-ui-list">
      <div
        className="flex flex-wrap items-center gap-2"
        data-testid="accounts-ui-filters"
      >
        <div className="flex flex-wrap gap-2">
          {TYPE_FILTERS.map((filter) => (
            <Button
              data-testid={`accounts-ui-filter-type-${filter.value.toLowerCase()}`}
              key={filter.value}
              onClick={() => setTypeFilter(filter.value)}
              size="sm"
              variant={typeFilter === filter.value ? "default" : "outline"}
            >
              {filter.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((filter) => (
            <Button
              data-testid={`accounts-ui-filter-status-${filter.value.toLowerCase()}`}
              key={filter.value}
              onClick={() => setStatusFilter(filter.value)}
              size="sm"
              variant={statusFilter === filter.value ? "default" : "outline"}
            >
              {filter.label}
            </Button>
          ))}
        </div>
        <Input
          className="ms-auto w-full max-w-xs"
          data-testid="accounts-ui-search"
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="搜索名称、币种或说明"
          value={searchTerm}
        />
        {hasActiveFilter ? (
          <Button
            data-testid="accounts-ui-filter-reset"
            onClick={() => {
              setTypeFilter("ALL");
              setStatusFilter("ACTIVE");
              setSearchTerm("");
            }}
            size="sm"
            variant="ghost"
          >
            重置筛选
          </Button>
        ) : null}
      </div>
      {isEmpty ? (
        <div
          className="space-y-3 rounded-lg border border-dashed p-6 text-sm"
          data-testid="accounts-ui-empty"
        >
          <p className="text-muted-foreground">
            暂无符合条件的账户，请调整筛选或重新搜索。
          </p>
          {!hasActiveFilter ? (
            <p className="text-muted-foreground">
              当前用户尚未创建任何账户，可以通过“新建账户”快速创建。
            </p>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2" data-testid="accounts-ui-list-grid">
          {filteredAccounts.map((account) => (
            <AccountCard
              account={account}
              displayCurrency={displayCurrency}
              expanded={expandedId === account.id}
              isPending={isPending}
              key={account.id}
              onArchive={handleArchive}
              onDelete={handleDelete}
              onRestore={handleRestore}
              onToggle={() =>
                setExpandedId((prev) =>
                  prev === account.id ? null : account.id,
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default AccountTable;
