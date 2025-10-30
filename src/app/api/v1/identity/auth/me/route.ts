import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db";
import { getUserFromRequest } from "@/server/utils/auth";

/**
 * GET /api/v1/identity/auth/me
 * - 获取当前登录用户的信息
 * - 返回: { id, email, name, currentCityId, displayCurrency }
 */

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || typeof user.id !== "string") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    // 从数据库获取完整的用户信息
    const userRecord = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        currentCityId: true,
        displayCurrency: true,
      },
    });

    if (!userRecord) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(userRecord);
  } catch (_error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

const ALLOWED_DISPLAY_CURRENCIES = new Set(["CNY", "USD", "EUR", "HKD", "JPY"]);

export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || typeof user.id !== "string") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: { displayCurrency?: string | null };
  try {
    payload = (await req.json()) as { displayCurrency?: string | null };
  } catch (_error) {
    return NextResponse.json({ error: "invalid_request_body" }, { status: 400 });
  }

  if (!("displayCurrency" in payload)) {
    return NextResponse.json({ error: "displayCurrency_required" }, { status: 400 });
  }

  const raw = payload.displayCurrency;
  let normalized: string | null = null;
  if (raw != null) {
    if (typeof raw !== "string" || raw.trim().length === 0) {
      return NextResponse.json(
        { error: "displayCurrency_invalid" },
        { status: 400 },
      );
    }
    const upper = raw.trim().toUpperCase();
    if (!ALLOWED_DISPLAY_CURRENCIES.has(upper)) {
      return NextResponse.json(
        { error: "displayCurrency_not_supported" },
        { status: 422 },
      );
    }
    normalized = upper;
  }

  try {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { displayCurrency: normalized },
      select: {
        id: true,
        email: true,
        name: true,
        currentCityId: true,
        displayCurrency: true,
      },
    });
    return NextResponse.json(updated);
  } catch (_error) {
    return NextResponse.json({ error: "failed_to_update_user" }, { status: 500 });
  }
}
