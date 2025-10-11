"use client";

import {
  BarChart3,
  BookMarked,
  Layers3,
  LayoutDashboard,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUserPrefsStore } from "@/lib/state/user-prefs";
import UserAvatar from "@/components/modules/UserAvatar";

type Props = { children: ReactNode };

export default function AppShell({ children }: Props) {
  const pathname = usePathname();
  const { displayCurrency, setDisplayCurrency, asOfDate, setAsOfDate } =
    useUserPrefsStore();
  const nav = [
    {
      href: "/dashboard",
      label: "总览",
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      href: "/accounts",
      label: "账户",
      icon: <Wallet className="h-4 w-4" />,
    },
    {
      href: "/income",
      label: "收入",
      icon: <Layers3 className="h-4 w-4" />,
    },
    {
      href: "/reports/accounts",
      label: "报表",
      icon: <BarChart3 className="h-4 w-4" />,
    },
    {
      href: "/rules/tax",
      label: "规则",
      icon: <BookMarked className="h-4 w-4" />,
    },
  ];
  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Topbar */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <div className="size-6 rounded bg-primary" />
            <span className="hidden sm:inline">Wealth Again</span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {nav.map((n) => {
              const active = pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`flex items-center gap-2 rounded px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  {n.icon}
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex-1" />

          {/* Search and Controls */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="搜索账户/备注/交易…"
              className="w-full max-w-xs hidden lg:block"
            />
            <Select
              value={displayCurrency ?? ""}
              onValueChange={(v) => setDisplayCurrency(v || null)}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="币种" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CNY">CNY</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="HKD">HKD</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={asOfDate ?? ""}
              onChange={(e) => setAsOfDate(e.target.value || null)}
              className="w-[140px] hidden sm:block"
            />
            <UserAvatar />
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="mx-auto max-w-7xl px-4 py-4">
        {/* Mobile Navigation */}
        <nav className="md:hidden mb-4">
          <div className="flex overflow-x-auto gap-2 pb-2">
            {nav.map((n) => {
              const active = pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`flex items-center gap-2 rounded px-3 py-2 text-sm whitespace-nowrap transition-colors ${
                    active
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  {n.icon}
                  {n.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Content */}
        <main>{children}</main>
      </div>
    </div>
  );
}
