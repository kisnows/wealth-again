"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

const navigation = [
  { name: "首页", href: "/" },
  { name: "仪表板", href: "/dashboard" },
  { name: "收入管理", href: "/income" },
  { name: "投资管理", href: "/investment" },
  { name: "参数配置", href: "/config" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="border-b">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold">
              财富管理系统
            </Link>
          </div>
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
        </div>
      </div>
    </header>
  );
}