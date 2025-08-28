"use client";

import {
  BarChart3,
  BookMarked,
  Home,
  Layers3,
  LayoutDashboard,
  Settings,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUserPrefsStore } from "@/lib/state/user-prefs";

type Props = { children: ReactNode };

export default function AppShell({ children }: Props) {
  const pathname = usePathname();
  const { displayCurrency, setDisplayCurrency, asOfDate, setAsOfDate } =
    useUserPrefsStore();
  const nav = [
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      href: "/accounts",
      label: "Accounts",
      icon: <Wallet className="h-4 w-4" />,
    },
    {
      href: "/income/records",
      label: "Income",
      icon: <Layers3 className="h-4 w-4" />,
    },
    {
      href: "/rules/tax",
      label: "Rules (Admin)",
      icon: <BookMarked className="h-4 w-4" />,
    },
    {
      href: "/reports/accounts",
      label: "Reports",
      icon: <BarChart3 className="h-4 w-4" />,
    },
    {
      href: "/settings",
      label: "Settings",
      icon: <Settings className="h-4 w-4" />,
    },
  ];
  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Topbar */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <div className="size-6 rounded bg-primary" />
            <span className="hidden sm:inline">Wealth Again</span>
          </Link>
          <div className="ml-2 flex-1">
            <Input
              placeholder="搜索账户/备注/交易…"
              className="w-full max-w-xl"
            />
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <Select
              value={displayCurrency ?? ""}
              onValueChange={(v) => setDisplayCurrency(v || null)}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="展示币种" />
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
              className="w-[150px]"
            />
            <Button variant="ghost" size="icon" className="rounded-full">
              <Home className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="mx-auto max-w-7xl px-4 py-4 grid grid-cols-12 gap-4">
        {/* Sidebar */}
        <aside className="col-span-12 md:col-span-3 lg:col-span-2">
          <nav className="rounded-md border p-2">
            {nav.map((n) => {
              const active = pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`flex items-center gap-2 rounded px-2 py-2 text-sm transition-colors ${active ? "bg-accent text-accent-foreground" : "hover:bg-accent"}`}
                >
                  {n.icon}
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        {/* Content */}
        <main className="col-span-12 md:col-span-9 lg:col-span-10">
          {children}
        </main>
      </div>
    </div>
  );
}
