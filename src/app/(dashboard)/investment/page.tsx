import AccountManager from "@/components/investment/account-manager";
import PerformanceChart from "@/components/investment/performance-chart";

export default function InvestmentPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">投资管理系统</h1>
      <div className="space-y-8">
        <AccountManager />
        <PerformanceChart />
      </div>
    </div>
  );
}