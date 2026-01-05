import { redirect } from "next/navigation";

/**
 * 回算状态重定向页面组件
 *
 * 访问 /income/recalc-status 时重定向至收入页面的回算任务中心锚点。
 */
export default function IncomeRecalcRedirectPage() {
  redirect("/income#recalc");
}
