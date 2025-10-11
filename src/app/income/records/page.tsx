"use client";

import { useRouter } from "next/navigation";
import { IncomeRecordsDialog } from "@/components/modules/IncomeDialogs";

export default function IncomeRecordsPage() {
  const router = useRouter();
  return <IncomeRecordsDialog open onClose={() => router.push("/income")} />;
}
