import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    console.log("Testing session in /api/test-session");
    const userId = await getCurrentUser();
    console.log("User ID from session:", userId);
    return NextResponse.json({ success: true, userId });
  } catch (error) {
    console.error("Session test error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unknown error" });
  }
}