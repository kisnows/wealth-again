"use client";

import { useRouter } from "next/navigation";
import { BonusDialog } from "@/components/modules/IncomeDialogs";

export default function BonusPage() {
  const router = useRouter();
  return <BonusDialog open onClose={() => router.push("/income")} />;
}
