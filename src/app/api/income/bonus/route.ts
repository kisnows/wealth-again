import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { z } from "zod";
import { endOfMonth, parseYMD } from "@/lib/date";

const postSchema = z.object({
  city: z.string(),
  amount: z.number().positive(),
  effectiveDate: z.string(), // YYYY-MM-DD
});

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUser(req);
    const body = postSchema.parse(await req.json());

    const rec = await prisma.bonusPlan.create({
      data: {
        userId,
        city: body.city,
        amount: body.amount.toString(),
        // 规则：按自然月最后一天生效；为避免时区导致 ISO 日期回退，设置到当天中午
        effectiveDate: (() => {
          const d = endOfMonth(parseYMD(body.effectiveDate));
          d.setHours(12, 0, 0, 0);
          return d;
        })(),
      },
    });

    return NextResponse.json({
      success: true,
      data: { id: rec.id },
    });
  } catch (error) {
    console.error("Bonus API error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: error.errors[0].message },
        },
        { status: 400 }
      );
    }

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

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUser(req);
    const { searchParams } = new URL(req.url);

    const city = searchParams.get("city");
    const page = Math.max(1, Number(searchParams.get("page") || "1"));
    const pageSize = Math.min(
      100,
      Math.max(1, Number(searchParams.get("pageSize") || "20"))
    );
    const skip = (page - 1) * pageSize;

    const where: any = { userId };
    if (city) {
      where.city = city;
    }

    const [total, records] = await Promise.all([
      prisma.bonusPlan.count({ where }),
      prisma.bonusPlan.findMany({
        where,
        orderBy: { effectiveDate: "desc" },
        skip,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: records,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Bonus GET error:", error);

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

export async function DELETE(req: NextRequest) {
  try {
    const userId = await getCurrentUser(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "缺少奖金计划ID" },
        },
        { status: 400 }
      );
    }

    // 确保用户只能删除自己的奖金计划
    const bonusPlan = await prisma.bonusPlan.findFirst({
      where: { id, userId },
    });

    if (!bonusPlan) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "奖金计划不存在" },
        },
        { status: 404 }
      );
    }

    await prisma.bonusPlan.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      data: { message: "奖金计划已删除" },
    });
  } catch (error) {
    console.error("Bonus DELETE error:", error);

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
