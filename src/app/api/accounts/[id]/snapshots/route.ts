import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const accountId = params.id;
  
  try {
    const snapshots = await prisma.valuationSnapshot.findMany({
      where: { accountId },
      orderBy: { asOf: "asc" },
    });
    
    return NextResponse.json({ snapshots });
  } catch (error) {
    console.error("Error fetching snapshots:", error);
    return NextResponse.json({ error: "Failed to fetch snapshots" }, { status: 500 });
  }
}