import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface TableSkeletonColumn {
  header: string;
  align?: "left" | "right" | "center";
  width?: string;
}

interface TableSkeletonProps {
  columns: TableSkeletonColumn[];
  rows?: number;
  testId?: string;
}

export function TableSkeleton({
  columns,
  rows = 5,
  testId,
}: TableSkeletonProps) {
  return (
    <Table data-testid={testId}>
      <TableHeader>
        <TableRow>
          {columns.map((col, i) => (
            <TableHead
              key={`header-${col.header}-${i}`}
              className={col.align === "right" ? "text-right" : ""}
            >
              {col.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <TableRow key={`row-${rowIndex}`}>
            {columns.map((col, colIndex) => (
              <TableCell
                key={`cell-${rowIndex}-${colIndex}`}
                className={col.align === "right" ? "text-right" : ""}
              >
                <Skeleton className={cn("h-5", col.width ?? "w-24")} />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

interface CardSkeletonProps {
  title?: boolean;
  description?: boolean;
  contentLines?: number;
  testId?: string;
}

export function CardSkeleton({
  title = true,
  description = true,
  contentLines = 3,
  testId,
}: CardSkeletonProps) {
  return (
    <Card data-testid={testId}>
      {(title || description) && (
        <CardHeader>
          {title && (
            <CardTitle>
              <Skeleton className="h-5 w-32" />
            </CardTitle>
          )}
          {description && (
            <CardDescription>
              <Skeleton className="h-4 w-64" />
            </CardDescription>
          )}
        </CardHeader>
      )}
      <CardContent className="space-y-2">
        {Array.from({ length: contentLines }).map((_, i) => (
          <Skeleton key={`line-${i}`} className="h-4 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

interface MetricCardSkeletonProps {
  count?: number;
  testId?: string;
}

export function MetricCardSkeleton({
  count = 4,
  testId,
}: MetricCardSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={`metric-skeleton-${i}`}
          className="space-y-2 rounded-lg border border-border/60 bg-card/80 p-4 shadow-sm"
          data-testid={`${testId}-${i}`}
        >
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-3 w-40" />
        </div>
      ))}
    </>
  );
}
