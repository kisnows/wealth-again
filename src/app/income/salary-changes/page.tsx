"use client";

import { useRouter } from "next/navigation";
import { SalaryChangesDialog } from "@/components/modules/IncomeDialogs";

export default function SalaryChangesPage() {
  const router = useRouter();
  return <SalaryChangesDialog onClose={() => router.push("/income")} open />;
}
