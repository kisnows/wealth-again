import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { z } from "zod";

const payloadSchema = z.object({
  accountId: z.string().uuid(),
  csv: z.string(),
  delimiter: z.string().length(1).default(","),
  mapping: z.record(z.string(), z.string()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUser(req);
    const body = payloadSchema.parse(await req.json());
    
    // 验证账户所有权
    const account = await prisma.account.findFirst({
      where: { id: body.accountId, userId }
    });
    
    if (!account) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "无权访问此账户" } },
        { status: 403 }
      );
    }
    
    const lines = body.csv
      .split(/\r?\n/)
      .filter((l: string) => l.trim().length > 0);
      
    if (lines.length < 2)
      return NextResponse.json({ error: "no data" }, { status: 400 });
      
    const headers = lines[0].split(body.delimiter).map((h: string) => h.trim());
    const map = body.mapping || {
      date: "date",
      type: "type",
      amount: "amount",
      currency: "currency",
    };
    
    const headerIndex: Record<string, number> = {};
    for (const [k, v] of Object.entries(map)) {
      const idx = headers.findIndex(
        (h: string) => h.toLowerCase() === String(v).toLowerCase()
      );
      if (idx >= 0) headerIndex[k] = idx;
    }
    
    const created: string[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(body.delimiter);
      if (cols.length !== headers.length) continue;
      
      try {
        const type = cols[headerIndex["type"]];
        const tradeDate = new Date(cols[headerIndex["date"]]);
        const amount = 
          headerIndex["amount"] != null 
            ? Number(cols[headerIndex["amount"]]) 
            : undefined;
        const currency = 
          headerIndex["currency"] != null 
            ? cols[headerIndex["currency"]] 
            : "CNY";
            
        // 验证交易类型
        if (!["DEPOSIT", "WITHDRAW", "TRANSFER_IN", "TRANSFER_OUT"].includes(type)) {
          continue;
        }
        
        const rec = await prisma.transaction.create({
          data: {
            accountId: body.accountId,
            type: type as any,
            tradeDate,
            amount: amount !== undefined ? amount.toString() : "0",
            currency,
          },
        });
        
        created.push(rec.id);
      } catch (e) {
        console.error("Error importing transaction:", e);
      }
    }
    
    return NextResponse.json({ 
      success: true,
      data: { imported: created.length, ids: created } 
    });
    
  } catch (error) {
    console.error("Transaction import error:", error);
    
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
