import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { z } from "zod";

const postSchema = z.object({
  city: z.string(),
  grossMonthly: z.number().positive(),
  effectiveFrom: z.string(),
  userId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUser(req);
    const body = postSchema.parse(await req.json());
    const rec = await prisma.incomeChange.create({
      data: {
        userId,
        city: body.city,
        grossMonthly: body.grossMonthly.toString(),
        effectiveFrom: new Date(body.effectiveFrom),
      },
    });
    return NextResponse.json({ id: rec.id });
  } catch (error) {
    console.error("Income change POST error:", error);

    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUser(req);
    const { searchParams } = new URL(req.url);
    const city = searchParams.get("city") || "Hangzhou";
    const page = Number(searchParams.get("page") || "1");
    const pageSize = Number(searchParams.get("pageSize") || "50");
    const skip = (page - 1) * pageSize;
    const [total, records] = await Promise.all([
      prisma.incomeChange.count({ where: { userId, city } }),
      prisma.incomeChange.findMany({
        where: { userId, city },
        orderBy: { effectiveFrom: "desc" },
        skip,
        take: pageSize,
      }),
    ]);
    return NextResponse.json({ records, total, page, pageSize });
  } catch (error) {
    console.error("Income change GET error:", error);

    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await getCurrentUser(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "缺少收入变更记录ID" },
        },
        { status: 400 }
      );
    }

    // 确保用户只能删除自己的收入变更记录
    const incomeChange = await prisma.incomeChange.findFirst({
      where: { id, userId },
    });

    if (!incomeChange) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "收入变更记录不存在" },
        },
        { status: 404 }
      );
    }

    await prisma.incomeChange.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      data: { message: "收入变更记录已删除" },
    });
  } catch (error) {
    console.error("Income change DELETE error:", error);

    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "请先登录" },
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "服务器内部错误" },
      },
      { status: 500 }
    );
  }
}

async function ensureUser() {
  const u = await prisma.user.findFirst();
  if (u) return u.id;
  const bcrypt = await import("bcryptjs");
  const hash = await bcrypt.hash("demo123", 10);
  const user = await prisma.user.create({
    data: { email: "demo@example.com", password: hash, name: "Demo" },
  });
  return user.id;
}
