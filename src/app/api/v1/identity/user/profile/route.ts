import type { User } from "@/server/db/types";

import { type NextRequest, NextResponse } from "next/server";

import db from "@/server/db";
import { users } from "@/server/db/schema";
import { audit } from "@/server/services/audit";
import { getUserFromRequest } from "@/server/utils/auth";
import {
  ensureIdempotent,
  markIdempotencyUsed,
} from "@/server/utils/idempotency";
import { eq } from "drizzle-orm";

/**
 * PATCH /api/v1/identity/user/profile
 * - 更新用户基础信息
 * - 入参: { name?: string }
 * - 返回: 更新后的用户信息
 */
export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const data = (await req.json()) as Partial<
      Pick<User, "currentCityId" | "name">
    >;
    const { currentCityId, name } = data;
    const userId = user.id;

    // 验证输入
    const updateData: Partial<Pick<User, "name">> = {};

    if (currentCityId) {
      return NextResponse.json(
        { error: "请通过城市迁移功能更新工作城市" },
        { status: 400 },
      );
    }

    if (name !== undefined) {
      updateData.name = name;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    // 更新用户信息
    const { key, existed } = await ensureIdempotent(
      req,
      userId,
      `${userId}:${updateData.name ?? ""}`,
    );
    if (existed) {
      return NextResponse.json(
        { error: "Idempotency key reused" },
        { status: 409 },
      );
    }

    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        currentCityId: users.currentCityId,
        displayCurrency: users.displayCurrency,
      });

    // 记录审计日志
    await audit.logAndEmit("USER_PROFILE_UPDATE", {
      userId,
      meta: updateData,
      eventType: "audit.identity.profile_updated",
    });
    await markIdempotencyUsed(key);

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Update user profile error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
