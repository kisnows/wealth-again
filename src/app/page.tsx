"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return; // 等待加载完成
    
    if (session) {
      // 如果已登录，重定向到仪表盘
      router.push("/dashboard");
    }
  }, [session, status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  // 如果未登录，显示欢迎页面
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            财富管理系统
          </h1>
          <p className="text-gray-600">
            专业的个人财富管理平台，帮您管理收入、投资与税务
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-center">开始使用</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/login">
              <Button className="w-full" size="lg">
                登录
              </Button>
            </Link>
            
            <Link href="/register">
              <Button variant="outline" className="w-full" size="lg">
                注册账户
              </Button>
            </Link>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-gray-600">
          <p>系统功能包括：</p>
          <ul className="mt-2 space-y-1">
            <li>• 收入管理与税务计算</li>
            <li>• 投资组合跟踪分析</li>
            <li>• 财务数据可视化</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
