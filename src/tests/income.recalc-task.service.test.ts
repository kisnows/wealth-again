import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "@/tests/helpers/prismaMock";

const mockPrisma = prismaMock;
const logAuditMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/server/services/audit", () => ({ logAudit: logAuditMock }));
const writeOutboxEventMock = vi.fn().mockResolvedValue({ id: "evt" });
vi.mock("@/server/services/outbox", () => ({
  writeOutboxEvent: writeOutboxEventMock,
  fetchPendingOutboxEvents: vi.fn(),
  markOutboxEventDelivered: vi.fn(),
  markOutboxEventFailed: vi.fn(),
}));

describe("Income recalc task service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPrismaMock();
    writeOutboxEventMock.mockReset();
    mockPrisma.incomeRecalcTask.findFirst.mockResolvedValue(null);
    mockPrisma.incomeRecalcTask.create.mockImplementation(async ({ data }: { data: any }) => ({
      id: "task-1",
      userId: data?.userId ?? "u1",
      taxYear: data?.taxYear ?? 2025,
      startMonth: data?.startMonth ?? 3,
      endMonth: data?.endMonth ?? 12,
      cityId: data?.cityId ?? null,
      status: data?.status ?? "PENDING",
      attempts: data?.attempts ?? 0,
      scheduledFor: data?.scheduledFor ?? new Date(),
      processedAt: data?.processedAt ?? null,
      lastError: data?.lastError ?? null,
      triggeredBy: data?.triggeredBy ?? "u1",
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    mockPrisma.incomeRecalcTask.update.mockImplementation(async ({ data, where }: { data: any; where: any }) => ({
      id: where?.id ?? "task-1",
      userId: data?.userId ?? "u1",
      taxYear: data?.taxYear ?? 2025,
      startMonth: data?.startMonth ?? 3,
      endMonth: data?.endMonth ?? 12,
      cityId: data?.cityId ?? null,
      status: data?.status ?? "PENDING",
      attempts: data?.attempts ?? 0,
      scheduledFor: data?.scheduledFor ?? new Date(),
      processedAt: data?.processedAt ?? null,
      lastError: data?.lastError ?? null,
      triggeredBy: data?.triggeredBy ?? "u1",
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  });

  it("creates a new task when none pending", async () => {
    const { scheduleIncomeRecalcTask } = await import("@/server/services/income-tax/income");
    const id = await scheduleIncomeRecalcTask({
      userId: "u1",
      taxYear: 2025,
      startMonth: 3,
      endMonth: 6,
      triggeredBy: "u1",
    });
    expect(id).toBe("task-1");
    expect(mockPrisma.incomeRecalcTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "u1",
          taxYear: 2025,
          startMonth: 3,
          endMonth: 6,
          status: "PENDING",
        }),
      }),
    );
    expect(writeOutboxEventMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "income.recalc.requested" }),
    );
  });

  it("merges into existing pending task", async () => {
    mockPrisma.incomeRecalcTask.findFirst.mockResolvedValue({
      id: "task-2",
      userId: "u1",
      taxYear: 2025,
      startMonth: 5,
      endMonth: 8,
      cityId: "hangzhou",
      status: "PENDING",
      scheduledFor: new Date(),
    });
    mockPrisma.incomeRecalcTask.update.mockResolvedValue({
      id: "task-2",
      taxYear: 2025,
      startMonth: 3,
      endMonth: 12,
      cityId: "hangzhou",
      status: "PENDING",
      scheduledFor: new Date(),
    });
    const { scheduleIncomeRecalcTask } = await import("@/server/services/income-tax/income");
    const id = await scheduleIncomeRecalcTask({
      userId: "u1",
      taxYear: 2025,
      startMonth: 3,
      endMonth: 12,
      cityId: "hangzhou",
      triggeredBy: "u1",
    });
    expect(id).toBe("task-2");
    expect(mockPrisma.incomeRecalcTask.update).toHaveBeenCalledWith({
      where: { id: "task-2" },
      data: expect.objectContaining({
        startMonth: 3,
        endMonth: 12,
        cityId: "hangzhou",
      }),
    });
    expect(writeOutboxEventMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "income.recalc.requested" }),
    );
  });

  it("processes due tasks and marks them completed", async () => {
    const dueTask = {
      id: "task-3",
      userId: "u1",
      taxYear: 2025,
      startMonth: 1,
      endMonth: 3,
      cityId: null,
      status: "PENDING",
      attempts: 0,
      scheduledFor: new Date(Date.now() - 1000),
    };
    mockPrisma.incomeRecalcTask.findMany.mockResolvedValue([dueTask]);
    mockPrisma.incomeRecalcTask.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.incomeRecalcTask.update.mockResolvedValue({});
    const incomeService = await import("@/server/services/income-tax/income");

    const result = await incomeService.processDueIncomeRecalcTasks();

    expect(mockPrisma.incomeRecalcTask.update).toHaveBeenCalledWith({
      where: { id: "task-3" },
      data: expect.objectContaining({ status: "COMPLETED" }),
    });
    expect(result.processed).toBe(1);
    expect(writeOutboxEventMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "income.recalc.completed" }),
    );
  });
});
