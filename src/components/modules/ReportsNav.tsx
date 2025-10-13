"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const REPORT_LINKS = [
  {
    href: "/reports/accounts",
    label: "账户汇总",
    testId: "reports-ui-nav-accounts",
  },
  {
    href: "/reports/income",
    label: "收入时序",
    testId: "reports-ui-nav-income",
  },
];

export default function ReportsNav() {
  const pathname = usePathname();
  return (
    <nav
      className="flex flex-wrap gap-2"
      data-testid="reports-ui-nav"
    >
      {REPORT_LINKS.map((link) => {
        const active = pathname.startsWith(link.href);
        return (
          <Link
            className={cn(
              "rounded-md border px-3 py-2 text-sm transition-colors",
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-muted bg-muted/60 text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary",
            )}
            data-testid={link.testId}
            href={link.href}
            key={link.href}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
