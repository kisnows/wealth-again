"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

const navigation = [
  { name: "仪表板", href: "/dashboard" },
  { name: "收入管理", href: "/income" },
  { name: "投资管理", href: "/investment" },
  { name: "税务管理", href: "/tax/calculator" },
  { name: "系统设置", href: "/settings" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  if (status === "loading") {
    return null; // 或者显示加载状态
  }

  return (
    <header className="border-b">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link href="/dashboard" className="text-xl font-bold">
              财富管理系统
            </Link>
          </div>
          
          {session && (
            <>
              <nav className="hidden md:flex space-x-8">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`${
                      pathname === item.href
                        ? "text-gray-900 font-medium"
                        : "text-gray-500 hover:text-gray-900 cursor-pointer"
                    }`}
                  >
                    {item.name}
                  </Link>
                ))}
              </nav>
              
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-700">
                  欢迎, {session.user?.name || session.user?.email}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => signOut({ callbackUrl: "/auth/login" })}
                >
                  登出
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}