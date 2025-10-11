"use client";

import { useRouter } from "next/navigation";
import { LongTermCashDialog } from "@/components/modules/IncomeDialogs";

export default function LongTermCashPage() {
  const router = useRouter();
  return <LongTermCashDialog onClose={() => router.push("/income")} open />;
}
