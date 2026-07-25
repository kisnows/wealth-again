"use client";

import { toast } from "sonner";

type SuccessContent<T> = string | ((value: T) => string);
type ErrorContent = string | ((error: unknown) => string);

export type NotifyAsyncMessages<T> = {
  loading: string;
  success: SuccessContent<T>;
  error?: ErrorContent;
};

const resolveSuccess = <T>(content: SuccessContent<T>, value: T) =>
  typeof content === "function" ? content(value) : content;

const resolveError = (content: ErrorContent | undefined, error: unknown) => {
  if (!content) {
    return error instanceof Error ? error.message : "操作失败，请稍后重试";
  }
  return typeof content === "function" ? content(error) : content;
};

export function notifyAsync<T>(
  task: () => Promise<T>,
  messages: NotifyAsyncMessages<T>,
) {
  let runner: Promise<T>;
  try {
    runner = task();
  } catch (error) {
    runner = Promise.reject(error);
  }
  toast.promise(runner, {
    loading: messages.loading,
    success: (value: T) => resolveSuccess(messages.success, value),
    error: (error: unknown) => resolveError(messages.error, error),
  });
  return runner;
}
