import IncomeSummary from "@/components/income/income-summary";

export default function IncomeSummaryPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">收入汇总报表</h1>
      <IncomeSummary />
    </div>
  );
}