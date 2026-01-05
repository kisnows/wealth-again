"use client";

import { useRouter } from "next/navigation";
import { SalaryChangesDialog } from "@/components/modules/income/IncomeDialogs";

/**
 * 工资变更页面组件
 *
 * 以独立路由形式打开工资变更管理弹窗。
 * 关闭弹窗时自动返回 /income 页面。
 */
export default function SalaryChangesPage() {
  const router = useRouter();
  return <SalaryChangesDialog onClose={() => router.push("/income")} open />;
}
