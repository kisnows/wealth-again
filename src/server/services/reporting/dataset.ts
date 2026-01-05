import type { ReportDataset } from "@/server/db/types";
import db from "@/server/db";
import { reportDatasets } from "@/server/db/schema";
import { and, desc, eq } from "drizzle-orm";

export type ReportDatasetScope =
  | "accounts.summary"
  | "dashboard.overview"
  | "income.monthly";

type DbClientLike = typeof db;

export type UpsertReportDatasetParams = {
  userId: string;
  scope: ReportDatasetScope | (string & {});
  bucket?: string;
  payload: unknown;
  occurredAt?: Date | null;
  client?: DbClientLike;
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
    client = db,
  } = params;
  const normalizedPayload = normalizePayload(payload);
  const [record] = await client
    .insert(reportDatasets)
    .values({
      userId,
      scope,
      bucket,
      payload: normalizedPayload,
      occurredAt: occurredAt ?? null,
    })
    .onConflictDoUpdate({
      target: [reportDatasets.userId, reportDatasets.scope, reportDatasets.bucket],
      set: {
        payload: normalizedPayload,
        occurredAt: occurredAt ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();
  return record;
}

export async function getReportDataset(
  userId: string,
  scope: ReportDatasetScope | (string & {}),
  bucket = "default",
): Promise<ReportDataset | null> {
  const [record] = await db
    .select()
    .from(reportDatasets)
    .where(
      and(
        eq(reportDatasets.userId, userId),
        eq(reportDatasets.scope, scope),
        eq(reportDatasets.bucket, bucket),
      ),
    )
    .limit(1);
  return record ?? null;
}

export async function listReportDatasets(userId: string) {
  return db
    .select()
    .from(reportDatasets)
    .where(eq(reportDatasets.userId, userId))
    .orderBy(desc(reportDatasets.updatedAt));
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
