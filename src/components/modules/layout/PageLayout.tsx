"use client";

import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PageContainerProps = {
  children: ReactNode;
  className?: string;
  maxWidth?: "xl" | "lg" | "full";
  padding?: "none" | "md" | "lg";
  gap?: "md" | "lg";
  testId: string;
};

const paddingClassMap: Record<NonNullable<PageContainerProps["padding"]>, string> =
  {
    none: "",
    md: "py-6 md:py-8",
    lg: "py-8 md:py-10",
  };

const gapClassMap: Record<NonNullable<PageContainerProps["gap"]>, string> = {
  md: "gap-6 md:gap-8",
  lg: "gap-8 md:gap-10",
};

const widthClassMap: Record<NonNullable<PageContainerProps["maxWidth"]>, string> =
  {
    xl: "mx-auto w-full max-w-[1560px]",
    lg: "mx-auto w-full max-w-[1320px]",
    full: "w-full",
  };

export function PageContainer({
  children,
  className,
  maxWidth = "xl",
  padding = "md",
  gap = "lg",
  testId,
}: PageContainerProps) {
  return (
    <main
      className={cn(
        "flex w-full flex-col",
        widthClassMap[maxWidth],
        paddingClassMap[padding],
        gapClassMap[gap],
        className,
      )}
      data-testid={testId}
    >
      {children}
    </main>
  );
}

type PageHeaderProps = {
  overline?: string;
  title: string;
  description?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  align?: "start" | "center";
  testId: string;
  className?: string;
};

export function PageHeader({
  overline,
  title,
  description,
  meta,
  actions,
  align = "start",
  testId,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 border-b border-border/60 pb-4",
        align === "center"
          ? "sm:flex-row sm:items-center sm:justify-between"
          : "sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
      data-testid={testId}
    >
      <div className="flex flex-col gap-2">
        {overline ? (
          <span className="text-xs font-medium uppercase tracking-wide text-primary">
            {overline}
          </span>
        ) : null}
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
              {description}
            </p>
          ) : null}
          {meta ? <div className="text-sm text-muted-foreground">{meta}</div> : null}
        </div>
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

type PageSectionProps = {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  testId: string;
  bleed?: boolean;
  className?: string;
  contentClassName?: string;
};

export function PageSection({
  title,
  description,
  actions,
  children,
  testId,
  bleed = false,
  className,
  contentClassName,
}: PageSectionProps) {
  if (bleed) {
    return (
      <section
        className={cn("flex flex-col gap-4", className)}
        data-testid={testId}
      >
        {(title || description || actions) && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
            <div>
              {title ? (
                <h2 className="text-lg font-semibold text-foreground md:text-xl">
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p className="text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>
            {actions ? (
              <div className="flex flex-wrap gap-2">{actions}</div>
            ) : null}
          </div>
        )}
        <div
          className={cn(
            "rounded-lg border border-border/70 bg-card shadow-sm",
            contentClassName,
          )}
        >
          {children}
        </div>
      </section>
    );
  }

  return (
    <Card
      className={cn("border-border/70 bg-card shadow-sm", className)}
      data-testid={testId}
    >
      {(title || description || actions) && (
        <CardHeader className="flex flex-col gap-2 space-y-0 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {title ? (
              <CardTitle className="text-lg font-semibold text-foreground">
                {title}
              </CardTitle>
            ) : null}
            {description ? (
              <CardDescription className="text-sm text-muted-foreground">
                {description}
              </CardDescription>
            ) : null}
          </div>
          {actions ? (
            <div className="flex flex-wrap gap-2">{actions}</div>
          ) : null}
        </CardHeader>
      )}
      <CardContent className={cn("space-y-4", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}
