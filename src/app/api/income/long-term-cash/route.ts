import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { z } from "zod";

const postSchema = z.object({
  city: z.string(),
  totalAmount: z.number().positive(),
  effectiveDate: z.string(), // YYYY-MM-DD
  currency: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUser(req);
    const body = postSchema.parse(await req.json());

    const rec = await prisma.longTermCash.create({
      data: {
        userId,
        city: body.city,
        totalAmount: body.totalAmount.toString(),
        effectiveDate: new Date(body.effectiveDate),
        currency: body.currency || "CNY",
      },
    });

    return NextResponse.json({
      success: true,
      data: { id: rec.id },
    });
  } catch (error) {
    console.error("Long term cash API error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: error.issues[0].message },
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
      prisma.longTermCash.count({ where }),
      prisma.longTermCash.findMany({
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
    console.error("Long term cash GET error:", error);

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
          error: { code: "VALIDATION_ERROR", message: "缺少长期现金计划ID" },
        },
        { status: 400 }
      );
    }

    // 确保用户只能删除自己的长期现金计划
    const longTermCash = await prisma.longTermCash.findFirst({
      where: { id, userId },
    });

    if (!longTermCash) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "长期现金计划不存在" },
        },
        { status: 404 }
      );
    }

    await prisma.longTermCash.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      data: { message: "长期现金计划已删除" },
    });
  } catch (error) {
    console.error("Long term cash DELETE error:", error);

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