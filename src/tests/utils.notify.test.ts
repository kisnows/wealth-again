import type { Mock } from "vitest";
import { describe, expect, it, vi } from "vitest";

const toastPromise = vi.hoisted(() =>
  vi.fn(
    async <T>(
      promise: Promise<T>,
      options: {
        loading: string;
        success: ((value: T) => string) | string;
        error?: ((err: unknown) => string) | string;
      },
    ) => {
      try {
        const result = await promise;
        if (typeof options.success === "function") {
          options.success(result);
        }
        return result;
      } catch (error) {
        if (typeof options.error === "function") {
          options.error(error);
        }
        throw error;
      }
    },
  ),
);

vi.mock("sonner", () => ({
  toast: {
    promise: toastPromise,
  },
}));

import { notifyAsync } from "@/lib/utils/notify";

describe("notifyAsync", () => {
  it("封装异步任务并触发提示文案", async () => {
    const task = vi.fn(async () => "ok");
    const result = await notifyAsync(task, {
      loading: "加载中",
      success: (value) => `成功: ${value}`,
      error: () => "失败",
    });

    expect(result).toBe("ok");
    expect(task).toHaveBeenCalledTimes(1);
    const promiseMock = toastPromise as unknown as Mock;
    expect(promiseMock).toHaveBeenCalledTimes(1);
    const [, options] = promiseMock.mock.calls[0];
    expect(options.loading).toBe("加载中");
  });
});
