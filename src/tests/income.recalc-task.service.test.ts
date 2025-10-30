import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "@/tests/helpers/prismaMock";

const mockPrisma = prismaMock;
const logAuditMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/server/services/audit", () => ({ logAudit: logAuditMock }));

describe("Income recalc task service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPrismaMock();
    mockPrisma.incomeRecalcTask.findFirst.mockResolvedValue(null);
    mockPrisma.incomeRecalcTask.create.mockResolvedValue({
      id: "task-1",
      taxYear: 2025,
      startMonth: 3,
      endMonth: 12,
    });
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
  });
});
