import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ id: string }>;

export async function GET(
  _req: NextRequest,
  props: { params: Params }
) {
  const params = await props.params;
  const accountId = params.id;
  try {
    const url = new URL(_req.url);
    const page = Number(url.searchParams.get("page") || "1");
    const pageSize = Number(url.searchParams.get("pageSize") || "50");
    const skip = (page - 1) * pageSize;
    const [total, snapshots] = await Promise.all([
      prisma.valuationSnapshot.count({ where: { accountId } }),
      prisma.valuationSnapshot.findMany({
        where: { accountId },
        orderBy: { asOf: "desc" },
        skip,
        take: pageSize,
      }),
    ]);
    return NextResponse.json({ snapshots, total, page, pageSize });
  } catch (error) {
    console.error("Error fetching snapshots:", error);
    return NextResponse.json(
      { error: "Failed to fetch snapshots" },
      { status: 500 }
    );
  }
}
