import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetDbMock } from "@/tests/helpers/dbMock";

const logAuditMock = vi.fn().mockResolvedValue(undefined);
const logAndEmitMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/server/services/audit", () => ({
  logAudit: logAuditMock,
  audit: {
    log: logAuditMock,
    logAndEmit: logAndEmitMock,
  },
}));
const writeOutboxEventMock = vi.fn().mockResolvedValue({ id: "evt" });
vi.mock("@/server/services/outbox", () => ({
  writeOutboxEvent: writeOutboxEventMock,
  fetchPendingOutboxEvents: vi.fn(),
  markOutboxEventDelivered: vi.fn(),
  markOutboxEventFailed: vi.fn(),
}));

const enqueueIncomeRecalcTaskMock = vi.fn();
const fetchPendingIncomeRecalcTasksMock = vi.fn();
const markIncomeRecalcRunningMock = vi.fn();
const markIncomeRecalcCompletedMock = vi.fn();
const markIncomeRecalcFailedMock = vi.fn();
const releaseIncomeRecalcTasksMock = vi.fn();

vi.mock("@/server/services/jobs/queue", () => ({
  enqueueIncomeRecalcTask: enqueueIncomeRecalcTaskMock,
  fetchPendingIncomeRecalcTasks: fetchPendingIncomeRecalcTasksMock,
  markIncomeRecalcRunning: markIncomeRecalcRunningMock,
  markIncomeRecalcCompleted: markIncomeRecalcCompletedMock,
  markIncomeRecalcFailed: markIncomeRecalcFailedMock,
  releaseIncomeRecalcTasks: releaseIncomeRecalcTasksMock,
}));

describe("Income recalc task service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMock();
    writeOutboxEventMock.mockReset();
    logAuditMock.mockReset();
    logAndEmitMock.mockReset();
    enqueueIncomeRecalcTaskMock.mockReset();
    fetchPendingIncomeRecalcTasksMock.mockReset();
    markIncomeRecalcRunningMock.mockReset();
    markIncomeRecalcCompletedMock.mockReset();
    markIncomeRecalcFailedMock.mockReset();
    releaseIncomeRecalcTasksMock.mockReset();
  });

  it("creates a new task when none pending", async () => {
    enqueueIncomeRecalcTaskMock.mockResolvedValueOnce({
      id: "task-1",
      userId: "u1",
      taxYear: 2025,
      startMonth: 3,
      endMonth: 6,
      cityId: null,
      status: "PENDING",
      attempts: 0,
      scheduledFor: new Date(),
      processedAt: null,
      lastError: null,
      triggeredBy: "u1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const { scheduleIncomeRecalcTask } = await import("@/server/services/income-tax/income");
    const id = await scheduleIncomeRecalcTask({
      userId: "u1",
      taxYear: 2025,
      startMonth: 3,
      endMonth: 6,
      triggeredBy: "u1",
    });
    expect(id).toBe("task-1");
    expect(enqueueIncomeRecalcTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        taxYear: 2025,
        startMonth: 3,
        endMonth: 6,
        triggeredBy: "u1",
      }),
    );
  });

  it("merges into existing pending task", async () => {
    enqueueIncomeRecalcTaskMock.mockResolvedValueOnce({
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
    expect(enqueueIncomeRecalcTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        taxYear: 2025,
        startMonth: 3,
        endMonth: 12,
        cityId: "hangzhou",
        triggeredBy: "u1",
      }),
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
    fetchPendingIncomeRecalcTasksMock.mockResolvedValue([dueTask]);
    markIncomeRecalcRunningMock.mockResolvedValue(true);
    markIncomeRecalcCompletedMock.mockResolvedValue(undefined);
    const incomeService = await import("@/server/services/income-tax/income");

    const result = await incomeService.processDueIncomeRecalcTasks();

    expect(result.processed).toBe(1);
    expect(markIncomeRecalcCompletedMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "task-3" }),
      0,
    );
  });
});
