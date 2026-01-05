"use client";

import { useRouter } from "next/navigation";
import { BonusDialog } from "@/components/modules/income/IncomeDialogs";

/**
 * 一次性奖金页面组件
 *
 * 以独立路由形式打开奖金管理弹窗。
 * 关闭弹窗时自动返回 /income 页面。
 */
export default function BonusPage() {
  const router = useRouter();
  return <BonusDialog onClose={() => router.push("/income")} open />;
}
