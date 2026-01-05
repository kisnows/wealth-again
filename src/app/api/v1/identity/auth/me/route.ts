import { type NextRequest, NextResponse } from "next/server";
import db from "@/server/db";
import { users } from "@/server/db/schema";
import { audit } from "@/server/services/audit";
import { DISPLAY_CURRENCY_SET } from "@/server/services/identity/constants";
import { getUserFromRequest } from "@/server/utils/auth";
import {
  ensureIdempotent,
  markIdempotencyUsed,
} from "@/server/utils/idempotency";
import { eq } from "drizzle-orm";

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
    const [userRecord] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        currentCityId: users.currentCityId,
        displayCurrency: users.displayCurrency,
      })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

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
    if (!DISPLAY_CURRENCY_SET.has(upper)) {
      return NextResponse.json(
        { error: "displayCurrency_not_supported" },
        { status: 422 },
      );
    }
    normalized = upper;
  }

  try {
    const { key, existed } = await ensureIdempotent(
      req,
      user.id,
      `${user.id}:${normalized ?? "AUTO"}`,
    );
    if (existed) {
      return NextResponse.json(
        { error: "Idempotency key reused" },
        { status: 409 },
      );
    }

    const [updated] = await db
      .update(users)
      .set({ displayCurrency: normalized })
      .where(eq(users.id, user.id))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        currentCityId: users.currentCityId,
        displayCurrency: users.displayCurrency,
      });

    await audit.logAndEmit("USER_DISPLAY_CURRENCY_UPDATE", {
      userId: user.id,
      meta: { displayCurrency: updated.displayCurrency },
      eventType: "audit.identity.display_currency_updated",
    });
    await markIdempotencyUsed(key);

    return NextResponse.json(updated);
  } catch (_error) {
    return NextResponse.json({ error: "failed_to_update_user" }, { status: 500 });
  }
}
