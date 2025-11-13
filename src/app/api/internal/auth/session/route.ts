import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/server/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const headers = Object.fromEntries(req.headers.entries());
    const session = await auth.api.getSession({ headers, request: req });
    if (!session?.user?.id) {
      return NextResponse.json({ session: null }, { status: 401 });
    }
    return NextResponse.json({ session });
  } catch (error) {
    console.error("internal session resolve failed", error);
    return NextResponse.json(
      { error: "failed_to_resolve_session" },
      { status: 500 },
    );
  }
}
