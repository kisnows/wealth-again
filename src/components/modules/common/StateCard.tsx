import { AlertCircleIcon, AlertTriangleIcon, InfoIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StateCardVariant = "empty" | "error" | "info" | "warning";

interface StateCardProps {
  variant?: StateCardVariant;
  title?: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  testId?: string;
  className?: string;
}

const VARIANT_CONFIG = {
  empty: {
    icon: AlertCircleIcon,
    titleColor: "text-muted-foreground",
    descColor: "text-muted-foreground",
    iconColor: "text-muted-foreground",
  },
  error: {
    icon: AlertTriangleIcon,
    titleColor: "text-destructive",
    descColor: "text-destructive",
    iconColor: "text-destructive",
  },
  info: {
    icon: InfoIcon,
    titleColor: "text-foreground",
    descColor: "text-muted-foreground",
    iconColor: "text-primary",
  },
  warning: {
    icon: AlertTriangleIcon,
    titleColor: "text-orange-700 dark:text-orange-400",
    descColor: "text-orange-600 dark:text-orange-400/80",
    iconColor: "text-orange-600 dark:text-orange-400",
  },
};

export function StateCard({
  variant = "empty",
  title,
  description,
  icon: CustomIcon,
  testId,
  className,
}: StateCardProps) {
  const config = VARIANT_CONFIG[variant];
  const Icon = CustomIcon ?? config.icon;

  if (title) {
    return (
      <Card className={className} data-testid={testId}>
        <CardHeader>
          <CardTitle
            className={cn("flex items-center gap-2", config.titleColor)}
          >
            <Icon className={cn("h-5 w-5 shrink-0", config.iconColor)} />
            {title}
          </CardTitle>
          {description && (
            <CardDescription className={config.descColor}>
              {description}
            </CardDescription>
          )}
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={className} data-testid={testId}>
      <CardContent
        className={cn("flex items-center gap-3 py-8 text-sm", config.descColor)}
      >
        <Icon className={cn("h-5 w-5 shrink-0", config.iconColor)} />
        <span>{description ?? "无数据"}</span>
      </CardContent>
    </Card>
  );
}
