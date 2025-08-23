import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUser(req);
    return NextResponse.json({ userId });
  } catch (error) {
    console.error("Session error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
}