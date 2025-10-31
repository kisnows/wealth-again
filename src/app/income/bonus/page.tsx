"use client";

import { useRouter } from "next/navigation";
import { BonusDialog } from "@/components/modules/income/IncomeDialogs";

export default function BonusPage() {
  const router = useRouter();
  return <BonusDialog onClose={() => router.push("/income")} open />;
}
