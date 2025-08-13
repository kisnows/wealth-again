import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1, "账户名称不能为空"),
  baseCurrency: z.string().default("CNY"),
});

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUser(req);
    const body = schema.parse(await req.json());

    // 检查同名账户
    const exists = await prisma.account.findFirst({
      where: { userId, name: body.name },
      select: { id: true },
    });

    if (exists) {
      return NextResponse.json(
        { success: false, error: { code: "DUPLICATE_NAME", message: "账户名已存在" } },
        { status: 409 }
      );
    }

    const account = await prisma.account.create({
      data: { 
        name: body.name, 
        baseCurrency: body.baseCurrency, 
        userId 
      },
    });

    return NextResponse.json({ 
      success: true,
      data: account
    });

  } catch (error) {
    console.error("Account creation error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: error.errors[0].message } },
        { status: 400 }
      );
    }

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
    
    const page = Math.max(1, Number(searchParams.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || "20")));
    const skip = (page - 1) * pageSize;

    const [total, accounts] = await Promise.all([
      prisma.account.count({ where: { userId } }),
      prisma.account.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: {
          _count: {
            select: {
              transactions: true,
              snapshots: true,
            }
          }
        }
      })
    ]);

    return NextResponse.json({ 
      success: true,
      data: accounts,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });

  } catch (error) {
    console.error("Account list error:", error);
    
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
        { success: false, error: { code: "VALIDATION_ERROR", message: "缺少账户ID" } },
        { status: 400 }
      );
    }

    // 确保用户只能删除自己的账户
    const account = await prisma.account.findFirst({
      where: { id, userId }
    });

    if (!account) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "账户不存在" } },
        { status: 404 }
      );
    }

    // 删除相关数据（级联删除）
    await prisma.$transaction(async (tx) => {
      await tx.transaction.deleteMany({ where: { accountId: id } });
      await tx.valuationSnapshot.deleteMany({ where: { accountId: id } });
      await tx.lot.deleteMany({ where: { accountId: id } });
      await tx.account.delete({ where: { id } });
    });

    return NextResponse.json({ 
      success: true,
      data: { message: "账户已删除" }
    });

  } catch (error) {
    console.error("Account delete error:", error);
    
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
