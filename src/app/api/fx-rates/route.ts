import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUser(req);
    const body = await req.json();

    // 创建汇率记录
    const fxRate = await prisma.fxRate.create({
      data: {
        base: body.base,
        quote: body.quote,
        asOf: new Date(body.asOf),
        rate: body.rate.toString(),
      },
    });

    return NextResponse.json({ 
      success: true,
      data: fxRate
    });

  } catch (error) {
    console.error("FxRate creation error:", error);
    
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "请先登录" } },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "服务器内部错误" } },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUser(req);
    const { searchParams } = new URL(req.url);
    
    const base = searchParams.get("base");
    const quote = searchParams.get("quote");
    const asOf = searchParams.get("asOf");
    const page = Math.max(1, Number(searchParams.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || "20")));
    const skip = (page - 1) * pageSize;

    // 构建查询条件
    const where: any = {};
    
    if (base) {
      where.base = base;
    }
    
    if (quote) {
      where.quote = quote;
    }
    
    if (asOf) {
      where.asOf = {
        lte: new Date(asOf)
      };
    }

    const [total, fxRates] = await Promise.all([
      prisma.fxRate.count({ where }),
      prisma.fxRate.findMany({
        where,
        orderBy: { asOf: "desc" },
        skip,
        take: pageSize,
      })
    ]);

    return NextResponse.json({ 
      success: true,
      data: fxRates,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });

  } catch (error) {
    console.error("FxRate list error:", error);
    
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "请先登录" } },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "服务器内部错误" } },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const userId = await getCurrentUser(req);
    const body = await req.json();

    if (!body.id) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "缺少汇率记录ID" } },
        { status: 400 }
      );
    }

    // 更新汇率记录
    const fxRate = await prisma.fxRate.update({
      where: { id: body.id },
      data: {
        base: body.base,
        quote: body.quote,
        asOf: body.asOf ? new Date(body.asOf) : undefined,
        rate: body.rate ? body.rate.toString() : undefined,
      },
    });

    return NextResponse.json({ 
      success: true,
      data: fxRate
    });

  } catch (error) {
    console.error("FxRate update error:", error);
    
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "请先登录" } },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "服务器内部错误" } },
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
        { success: false, error: { code: "VALIDATION_ERROR", message: "缺少汇率记录ID" } },
        { status: 400 }
      );
    }

    // 删除汇率记录
    await prisma.fxRate.delete({
      where: { id }
    });

    return NextResponse.json({ 
      success: true,
      data: { message: "汇率记录已删除" }
    });

  } catch (error) {
    console.error("FxRate delete error:", error);
    
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "请先登录" } },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "服务器内部错误" } },
      { status: 500 }
    );
  }
}