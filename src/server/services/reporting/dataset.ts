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

function getReportDelegate(client: PrismaClientLike) {
  const delegate = (client as unknown as Record<string, unknown>).reportDataset;
  if (!delegate || typeof delegate !== "object") return null;
  return delegate as {
    upsert?: typeof prisma.reportDataset.upsert;
    findUnique?: typeof prisma.reportDataset.findUnique;
    findMany?: typeof prisma.reportDataset.findMany;
  };
}

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
  const delegate = getReportDelegate(client);
  if (!delegate?.upsert) {
    const now = new Date();
    return {
      id: "report-dataset-disabled",
      userId,
      scope,
      bucket,
      payload: normalizedPayload as Prisma.InputJsonValue,
      occurredAt: occurredAt ?? null,
      createdAt: now,
      updatedAt: now,
    } as ReportDataset;
  }
  return delegate.upsert({
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
  const delegate = getReportDelegate(prisma);
  if (!delegate?.findUnique) return null;
  return delegate.findUnique({
    where: {
      userId_scope_bucket: {
        userId,
        scope,
        bucket,
      },
    },
  });
}

export async function listReportDatasets(userId: string) {
  const delegate = getReportDelegate(prisma);
  if (!delegate?.findMany) return [] as ReportDataset[];
  return delegate.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
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
