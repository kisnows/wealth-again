// Re-export formatMoney from domain for convenience
export { formatMoney } from "@/lib/domain/money";
// Alias for backward compatibility
export { formatMoney as formatAmount } from "@/lib/domain/money";

export function formatPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(2)}%`;
}

export function formatDatetime(value: string | Date | null | undefined) {
  if (!value) return "暂无估值";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "暂无估值";
  const datePart = date.toLocaleDateString("zh-CN");
  const timePart = date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${datePart} ${timePart}`;
}

export function formatDateOnly(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatFxRate(value: number | null | undefined, fraction = 6) {
  if (value == null || Number.isNaN(value)) return null;
  return value.toFixed(fraction);
}
