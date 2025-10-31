import { type NextRequest, NextResponse } from "next/server";
import { listReportDatasets } from "@/server/services/reporting/dataset";
import { getUserFromRequest } from "@/server/utils/auth";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || typeof user.id !== "string") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") ?? undefined;
  const datasets = await listReportDatasets(user.id);
  const filtered = scope
    ? datasets.filter((dataset) => dataset.scope === scope)
    : datasets;

  return NextResponse.json({
    items: filtered.map((dataset) => ({
      id: dataset.id,
      scope: dataset.scope,
      bucket: dataset.bucket,
      updatedAt: dataset.updatedAt.toISOString(),
      occurredAt: dataset.occurredAt
        ? dataset.occurredAt.toISOString()
        : null,
      payload: dataset.payload,
    })),
  });
}
