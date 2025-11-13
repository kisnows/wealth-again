import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { accentTokens, type AccentKey } from "@/lib/theme/palette";

type MetricCardVariant = "default" | "compact";

interface MetricCardProps {
  icon: LucideIcon;
  title: string;
  value: string | ReactNode;
  hint?: string | ReactNode;
  accent: AccentKey;
  testId: string;
  variant?: MetricCardVariant;
  showTopBorder?: boolean;
}

export function MetricCard({
  icon: Icon,
  title,
  value,
  hint,
  accent,
  testId,
  variant = "default",
  showTopBorder = true,
}: MetricCardProps) {
  const accentToken = accentTokens[accent];
  const isCompact = variant === "compact";

  if (isCompact) {
    return (
      <div
        className="space-y-2 rounded-lg border border-border/60 bg-card/80 p-4 shadow-sm"
        data-testid={testId}
      >
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <span
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full",
              accentToken.surface,
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
          {title}
        </div>
        <div className={cn("text-xl font-semibold", accentToken.emphasis)}>
          {value}
        </div>
        {hint ? (
          <div className="text-xs text-muted-foreground">{hint}</div>
        ) : null}
      </div>
    );
  }

  return (
    <Card
      className="relative overflow-hidden border border-border/60 bg-card shadow-sm"
      data-testid={testId}
    >
      {showTopBorder && (
        <div
          className={cn(
            "absolute inset-x-0 top-0 h-1 bg-linear-to-r",
            accentToken.gradient,
          )}
        />
      )}
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="text-sm font-medium text-muted-foreground">{title}</div>
        <div className={cn("rounded-md p-2", accentToken.surface)}>
          <Icon className="h-5 w-5" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div
          className={cn(
            "text-2xl font-semibold md:text-3xl",
            accentToken.emphasis,
          )}
        >
          {value}
        </div>
        {hint ? (
          <div className="mt-2 text-xs text-muted-foreground">{hint}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}
