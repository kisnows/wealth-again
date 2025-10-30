import type { Prisma, ReportDataset } from "@prisma/client";
import prisma from "@/server/db";

export type ReportDatasetScope =
  | "accounts.summary"
  | "dashboard.overview"
  | "income.monthly";

type PrismaClientLike = Prisma.TransactionClient | typeof prisma;

export type UpsertReportDatasetParams = {
  userId: string;
  scope: ReportDatasetScope | (string & {});
  bucket?: string;
  payload: unknown;
  occurredAt?: Date | null;
  client?: PrismaClientLike;
};

export async function upsertReportDataset(
  params: UpsertReportDatasetParams,
): Promise<ReportDataset> {
  const {
    userId,
    scope,
    bucket = "default",
    payload,
    occurredAt,
    client = prisma,
  } = params;
  const normalizedPayload = normalizePayload(payload);
  return client.reportDataset.upsert({
    where: {
      userId_scope_bucket: {
        userId,
        scope,
        bucket,
      },
    },
    update: {
      payload: normalizedPayload,
      occurredAt: occurredAt ?? null,
    },
    create: {
      userId,
      scope,
      bucket,
      payload: normalizedPayload,
      occurredAt: occurredAt ?? null,
    },
  });
}

export async function getReportDataset(
  userId: string,
  scope: ReportDatasetScope | (string & {}),
  bucket = "default",
): Promise<ReportDataset | null> {
  return prisma.reportDataset.findUnique({
    where: {
      userId_scope_bucket: {
        userId,
        scope,
        bucket,
      },
    },
  });
}

function normalizePayload(payload: unknown): unknown {
  if (payload == null) return {};
  if (typeof payload === "object") {
    try {
      return JSON.parse(JSON.stringify(payload));
    } catch (error) {
      throw new Error(
        `report_dataset_payload_not_serializable: ${
          (error as Error).message
        }`,
      );
    }
  }
  return payload;
}
