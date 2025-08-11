import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">个人财富管理系统</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/dashboard">
          <Button variant="outline" className="w-full h-32 text-lg hover:bg-gray-50 hover:shadow-md transition-all cursor-pointer">
            财务概览
          </Button>
        </Link>
        <Link href="/income">
          <Button variant="outline" className="w-full h-32 text-lg hover:bg-gray-50 hover:shadow-md transition-all cursor-pointer">
            个人收入管理
          </Button>
        </Link>
        <Link href="/investment">
          <Button variant="outline" className="w-full h-32 text-lg hover:bg-gray-50 hover:shadow-md transition-all cursor-pointer">
            投资管理系统
          </Button>
        </Link>
        <Link href="/config">
          <Button variant="outline" className="w-full h-32 text-lg hover:bg-gray-50 hover:shadow-md transition-all cursor-pointer">
            税务参数配置
          </Button>
        </Link>
      </div>
    </div>
  );
}
