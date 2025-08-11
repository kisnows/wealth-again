import Link from "next/link";
import IncomeForm from "@/components/income/income-form";
import { Button } from "@/components/ui/button";

export default function IncomePage() {
  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">个人收入管理</h1>
        <Link href="/income/summary">
          <Button variant="outline">查看汇总报表</Button>
        </Link>
      </div>
      <IncomeForm />
    </div>
  );
}
