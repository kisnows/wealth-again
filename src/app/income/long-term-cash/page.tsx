"use client";

import { useRouter } from "next/navigation";
import { LongTermCashDialog } from "@/components/modules/income/IncomeDialogs";

/**
 * 长期现金计划页面组件
 *
 * 以独立路由形式打开长期现金计划管理弹窗。
 * 关闭弹窗时自动返回 /income 页面。
 */
export default function LongTermCashPage() {
  const router = useRouter();
  return <LongTermCashDialog onClose={() => router.push("/income")} open />;
}
