import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { z } from "zod";

const updateProfileSchema = z.object({
  baseCurrency: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUser(req);
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "用户不存在" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        baseCurrency: user.baseCurrency,
      },
    });
  } catch (error) {
    console.error("User profile GET error:", error);

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
    const body = updateProfileSchema.parse(await req.json());

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        baseCurrency: body.baseCurrency,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        baseCurrency: user.baseCurrency,
      },
    });
  } catch (error) {
    console.error("User profile PUT error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: error.issues[0].message } },
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