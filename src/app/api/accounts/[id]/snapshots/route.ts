import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

type Params = Promise<{ id: string }>;

const createSnapshotSchema = z.object({
  totalValue: z.number().positive("估值必须为正数"),
  asOf: z.string().refine((date) => !isNaN(Date.parse(date)), "无效的日期格式"),
});

const deleteSnapshotSchema = z.object({
  snapshotId: z.string().uuid("无效的快照ID"),
});

export async function POST(req: NextRequest, props: { params: Params }) {
  try {
    const userId = await getCurrentUser(req);
    const params = await props.params;
    const accountId = params.id;

    // 验证账户所有权
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId },
    });

    if (!account) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "账户不存在或无权限访问" } },
        { status: 404 },
      );
    }

    // 解析和验证请求体
    const body = await req.json();
    const validation = createSnapshotSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "数据验证失败",
            details: validation.error.issues,
          },
        },
        { status: 400 },
      );
    }

    const { totalValue, asOf } = validation.data;
    const asOfDate = new Date(asOf);

    // 检查是否已存在相同日期的快照
    const existingSnapshot = await prisma.valuationSnapshot.findUnique({
      where: {
        accountId_asOf: {
          accountId,
          asOf: asOfDate,
        },
      },
    });

    if (existingSnapshot) {
      // 更新现有快照
      const updatedSnapshot = await prisma.valuationSnapshot.update({
        where: { id: existingSnapshot.id },
        data: { totalValue: totalValue.toString() },
      });

      return NextResponse.json({
        success: true,
        data: updatedSnapshot,
        message: "估值已更新",
      });
    } else {
      // 创建新快照
      const newSnapshot = await prisma.valuationSnapshot.create({
        data: {
          accountId,
          asOf: asOfDate,
          totalValue: totalValue.toString(),
        },
      });

      return NextResponse.json({
        success: true,
        data: newSnapshot,
        message: "估值已添加",
      });
    }
  } catch (error) {
    console.error("Error creating/updating snapshot:", error);

    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "请先登录" } },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "服务器内部错误" } },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, props: { params: Params }) {
  try {
    const userId = await getCurrentUser(req);
    const params = await props.params;
    const accountId = params.id;

    // 验证账户所有权
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId },
    });

    if (!account) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "账户不存在或无权限访问" } },
        { status: 404 },
      );
    }

    // 解析和验证请求体
    const body = await req.json();
    const validation = deleteSnapshotSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "数据验证失败",
            details: validation.error.issues,
          },
        },
        { status: 400 },
      );
    }

    const { snapshotId } = validation.data;

    // 验证快照属于该账户
    const snapshot = await prisma.valuationSnapshot.findFirst({
      where: { id: snapshotId, accountId },
    });

    if (!snapshot) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "快照不存在或无权限删除" } },
        { status: 404 },
      );
    }

    // 删除快照
    await prisma.valuationSnapshot.delete({
      where: { id: snapshotId },
    });

    return NextResponse.json({
      success: true,
      message: "快照已删除",
    });
  } catch (error) {
    console.error("Error deleting snapshot:", error);

    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "请先登录" } },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "服务器内部错误" } },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest, props: { params: Params }) {
  try {
    const userId = await getCurrentUser(req);
    const params = await props.params;
    const accountId = params.id;

    // 验证账户所有权
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId },
    });

    if (!account) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "账户不存在或无权限访问" } },
        { status: 404 },
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
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Error fetching snapshots:", error);

    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "请先登录" } },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "服务器内部错误" } },
      { status: 500 },
    );
  }
}
