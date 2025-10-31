"use client";
import {
  BarChart3,
  History,
  Layers3,
  LayoutDashboard,
  Loader2,
  Settings2,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import UserAvatar from "@/components/modules/identity/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useUserPrefsStore } from "@/lib/state/identity";
import { useCurrentUser } from "@/lib/api/auth";
import { useLiveStatus } from "@/lib/hooks/useLiveStatus";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { notifyAsync } from "@/lib/utils/notify";
import { updateDisplayCurrency } from "@/lib/api/user";

type Props = { children: ReactNode };

export default function AppShell({ children }: Props) {
  const pathname = usePathname();
  const { data: currentUser } = useCurrentUser();
  useLiveStatus({ enabled: Boolean(currentUser) });
  const { displayCurrency, setDisplayCurrency } = useUserPrefsStore(
    (state) => ({
      displayCurrency: state.displayCurrency,
      setDisplayCurrency: state.setDisplayCurrency,
    }),
  );
  const [updatingCurrency, setUpdatingCurrency] = useState(false);

  useEffect(() => {
    if (
      currentUser &&
      currentUser.displayCurrency !== undefined &&
      currentUser.displayCurrency !== displayCurrency
    ) {
      setDisplayCurrency(currentUser.displayCurrency);
    }
  }, [currentUser?.displayCurrency, displayCurrency, setDisplayCurrency]);
  const isAdmin = Boolean(currentUser?.isAdmin || currentUser?.role === "ADMIN");
  const currencyLabel = displayCurrency ?? "自动";

  const handleCurrencyChange = async (value: string | null) => {
    const normalized = value === "AUTO" ? null : value;
    if ((displayCurrency ?? null) === normalized) return;
    setUpdatingCurrency(true);
    try {
      await notifyAsync(
        async () => {
          await updateDisplayCurrency(normalized);
          setDisplayCurrency(normalized);
          return normalized;
        },
        {
          loading: "正在更新展示币种…",
          success: normalized ? `已切换为 ${normalized}` : "已恢复自动识别币种",
          error: "更新展示币种失败，请稍后重试",
        },
      );
    } finally {
      setUpdatingCurrency(false);
    }
  };

  const nav = useMemo(() => {
    const items = [
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
        href: "/reporting",
        label: "报表",
        icon: <BarChart3 className="h-4 w-4" />,
      },
      {
        href: "/settings",
        label: "设置",
        icon: <Settings2 className="h-4 w-4" />,
      },
      {
        href: "/activity",
        label: "任务",
        icon: <History className="h-4 w-4" />,
      },
    ];
    if (isAdmin) {
      items.push({
        href: "/admin/users",
        label: "Identity",
        icon: <ShieldCheck className="h-4 w-4" />,
      });
    }
    return items;
  }, [isAdmin]);
  const buildTestIdSegment = (href: string) => {
    const segment = href === "/" ? "home" : href.replace(/^\//, "");
    return segment.replace(/\//g, "-");
  };
  return (
    <div
      className="min-h-dvh bg-background text-foreground"
      data-testid="layout-ui-shell"
    >
      {/* Topbar */}
      <header
        className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60"
        data-testid="layout-ui-topbar"
      >
        <div className="mx-auto flex w-full max-w-[1560px] items-center gap-4 px-4 py-3 md:px-6">
          <Link
            className="flex items-center gap-2 font-semibold text-foreground transition-colors hover:text-primary"
            data-testid="layout-ui-logo"
            href="/dashboard"
          >
            <div className="grid size-8 place-items-center rounded-md bg-primary/90 text-sm font-bold text-primary-foreground">
              WA
            </div>
            <span className="hidden text-base sm:inline">Wealth Again</span>
          </Link>

          {/* Navigation */}
          <nav
            className="hidden items-center gap-1 rounded-full border border-transparent px-2 py-1 md:flex"
            data-testid="layout-ui-nav-desktop"
          >
            {nav.map((n) => {
              const active = pathname.startsWith(n.href);
              return (
                <Link
                  className={cn(
                    "flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-primary/5 hover:text-foreground",
                  )}
                  data-testid={`layout-ui-nav-item-${buildTestIdSegment(n.href)}`}
                  href={n.href}
                  key={n.href}
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
              className="hidden w-full max-w-xs lg:block"
              data-testid="layout-ui-search"
              placeholder="搜索账户/备注/交易…"
            />
            <div
              className="hidden items-center gap-2 sm:flex"
              data-testid="layout-ui-pref-readonly"
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    className="whitespace-nowrap"
                    data-testid="layout-ui-display-currency"
                    size="sm"
                    variant="secondary"
                  >
                    {updatingCurrency ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    币种: {currencyLabel}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[160px]">
                  <DropdownMenuItem
                    data-testid="layout-ui-display-currency-auto"
                    onSelect={() => handleCurrencyChange("AUTO")}
                  >
                    自动（按偏好）
                  </DropdownMenuItem>
                  {["CNY", "USD", "EUR", "HKD", "JPY"].map((code) => (
                    <DropdownMenuItem
                      data-testid={`layout-ui-display-currency-${code.toLowerCase()}`}
                      key={code}
                      onSelect={() => handleCurrencyChange(code)}
                    >
                      {code}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                asChild
                data-testid="layout-ui-preference-link"
                size="sm"
                variant="outline"
              >
                <Link href="/settings">偏好设置</Link>
              </Button>
            </div>
            <Link
              className="text-xs text-muted-foreground underline sm:hidden"
              data-testid="layout-ui-preference-link-mobile"
              href="/settings"
            >
              偏好设置
            </Link>
            <UserAvatar />
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="mx-auto w-full max-w-[1560px] px-4 pb-8 pt-6 md:px-6">
        {/* Mobile Navigation */}
        <nav
          className="mb-4 md:hidden"
          data-testid="layout-ui-nav-mobile"
        >
          <div className="flex gap-2 overflow-x-auto pb-2">
            {nav.map((n) => {
              const active = pathname.startsWith(n.href);
              return (
                <Link
                  className={cn(
                    "flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-primary/5 hover:text-foreground",
                  )}
                  data-testid={`layout-ui-nav-mobile-item-${buildTestIdSegment(n.href)}`}
                  href={n.href}
                  key={n.href}
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
