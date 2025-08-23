import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

type Params = Promise<{ id: string }>;

export async function GET(
  req: NextRequest,
  props: { params: Params }
) {
  try {
    const userId = await getCurrentUser(req);
    const params = await props.params;
    const accountId = params.id;
    
    // 验证账户所有权
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId }
    });
    
    if (!account) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "账户不存在或无权限访问" } },
        { status: 404 }
      );
    }
    
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") || "50")));
    const skip = (page - 1) * pageSize;
    
    const [total, snapshots] = await Promise.all([
      prisma.valuationSnapshot.count({ where: { accountId } }),
      prisma.valuationSnapshot.findMany({
        where: { accountId },
        orderBy: { asOf: "desc" },
        skip,
        take: pageSize,
      }),
    ]);
    
    return NextResponse.json({ 
      success: true,
      data: snapshots,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });
    
  } catch (error) {
    console.error("Error fetching snapshots:", error);
    
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
