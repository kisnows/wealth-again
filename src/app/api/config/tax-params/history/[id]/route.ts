import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ id: string }>;

export async function DELETE(
  request: NextRequest,
  props: { params: Params }
) {
  try {
    const params = await props.params;
    const id = params.id;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    // 检查是否存在该记录
    const existingRecord = await prisma.socialInsuranceConfig.findUnique({
      where: { id },
    });

    if (!existingRecord) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    // 删除记录
    await prisma.socialInsuranceConfig.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "记录已删除" });
  } catch (error) {
    console.error("DELETE /api/config/tax-params/history error:", error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}