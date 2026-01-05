import { vi } from "vitest";

type CallRecord = {
  table: unknown;
  values?: unknown;
  set?: unknown;
  where?: unknown;
  onConflict?: unknown;
};

const selectQueue: unknown[] = [];
const insertQueue: unknown[] = [];
const updateQueue: unknown[] = [];
const deleteQueue: unknown[] = [];
let selectFallback:
  | ((ctx: {
      table: unknown | null;
      callIndex: number;
      tableCallIndex: number;
    }) => unknown)
  | null = null;
let selectCallIndex = 0;
let tableCallCounts = new WeakMap<object, number>();

export const insertCalls: CallRecord[] = [];
export const updateCalls: CallRecord[] = [];
export const deleteCalls: CallRecord[] = [];

function createSelectChain(result: unknown) {
  let selectedTable: unknown | null = null;
  const resolveNow = () => {
    const currentIndex = selectCallIndex++;
    let tableCallIndex = 0;
    if (selectedTable && typeof selectedTable === "object") {
      const currentCount = tableCallCounts.get(selectedTable as object) ?? 0;
      tableCallIndex = currentCount;
      tableCallCounts.set(selectedTable as object, currentCount + 1);
    }
    let resolved = result;
    if (resolved === undefined && selectFallback) {
      resolved = selectFallback({
        table: selectedTable,
        callIndex: currentIndex,
        tableCallIndex,
      });
    } else if (typeof resolved === "function") {
      resolved = (
        resolved as (ctx: {
          table: unknown | null;
          callIndex: number;
          tableCallIndex: number;
        }) => unknown
      )({
        table: selectedTable,
        callIndex: currentIndex,
        tableCallIndex,
      });
    }
    const normalized =
      resolved == null ? [] : Array.isArray(resolved) ? resolved : [resolved];
    return normalized;
  };
  const chain = {
    from: (table: unknown) => {
      selectedTable = table;
      return chain;
    },
    where: () => chain,
    orderBy: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    groupBy: () => chain,
    having: () => chain,
    limit: () => chain,
    offset: () => chain,
    all: () => resolveNow(),
    get: () => resolveNow()[0],
    then: (
      resolve: (value: unknown) => unknown,
      reject?: (err: unknown) => unknown
    ) => {
      return Promise.resolve(resolveNow()).then(resolve, reject);
    },
  };
  return chain;
}

function createInsertChain(table: unknown, resultProvider: () => unknown) {
  const record: CallRecord = { table };
  const resolveReturningNow = () => {
    const result = resultProvider();
    let normalized = Array.isArray(result)
      ? result
      : result == null
      ? []
      : [result];
    if (normalized.length === 0) {
      const fallback = record.values;
      if (Array.isArray(fallback)) {
        normalized = fallback;
      } else if (fallback && typeof fallback === "object") {
        normalized = [{ ...fallback }];
      } else {
        normalized = [{ id: "mock-id" }];
      }
    }
    normalized = normalized.map((row) => {
      const base = row && typeof row === "object" ? { ...(row as object) } : {};
      if (!("id" in base)) {
        (base as { id: string }).id = "mock-id";
      }
      if (!("createdAt" in base)) {
        (base as { createdAt: Date }).createdAt = new Date();
      }
      if (!("updatedAt" in base)) {
        (base as { updatedAt: Date }).updatedAt = (
          base as { createdAt: Date }
        ).createdAt;
      }
      return base;
    });
    return normalized;
  };
  const chain = {
    values: (values: unknown) => {
      record.values = values;
      insertCalls.push(record);
      return chain;
    },
    onConflictDoUpdate: (onConflict: unknown) => {
      record.onConflict = onConflict;
      return chain;
    },
    returning: () => {
      const normalized = resolveReturningNow();
      return {
        all: () => normalized,
        get: () => normalized[0],
        then: (
          resolve: (value: unknown) => unknown,
          reject?: (err: unknown) => unknown
        ) => Promise.resolve(normalized).then(resolve, reject),
      };
    },
    run: () => ({ changes: 1 }),
  };
  return chain;
}

function createUpdateChain(table: unknown, result: unknown) {
  const record: CallRecord = { table };
  const resolveReturningNow = () => {
    let normalized = Array.isArray(result)
      ? result
      : result == null
      ? []
      : [result];
    if (normalized.length === 0) {
      const fallback = record.set;
      if (Array.isArray(fallback)) {
        normalized = fallback;
      } else if (fallback && typeof fallback === "object") {
        normalized = [{ ...fallback }];
      } else {
        normalized = [{ id: "mock-id" }];
      }
    }
    normalized = normalized.map((row) => {
      const base = row && typeof row === "object" ? { ...(row as object) } : {};
      if (!("id" in base)) {
        (base as { id: string }).id = "mock-id";
      }
      if (!("createdAt" in base)) {
        (base as { createdAt: Date }).createdAt = new Date();
      }
      if (!("updatedAt" in base)) {
        (base as { updatedAt: Date }).updatedAt = (
          base as { createdAt: Date }
        ).createdAt;
      }
      return base;
    });
    return normalized;
  };
  const chain = {
    set: (values: unknown) => {
      record.set = values;
      updateCalls.push(record);
      return chain;
    },
    where: (where: unknown) => {
      record.where = where;
      return chain;
    },
    returning: () => {
      const normalized = resolveReturningNow();
      return {
        all: () => normalized,
        get: () => normalized[0],
        then: (
          resolve: (value: unknown) => unknown,
          reject?: (err: unknown) => unknown
        ) => Promise.resolve(normalized).then(resolve, reject),
      };
    },
    run: () => ({ changes: 1 }),
    then: (
      resolve: (value: unknown) => unknown,
      reject?: (err: unknown) => unknown
    ) => {
      const normalized =
        result && typeof result === "object" && "changes" in (result as any)
          ? result
          : { changes: 1 };
      return Promise.resolve(normalized).then(resolve, reject);
    },
  };
  return chain;
}

function createDeleteChain(table: unknown, result: unknown) {
  const record: CallRecord = { table };
  const chain = {
    where: (where: unknown) => {
      record.where = where;
      deleteCalls.push(record);
      return chain;
    },
    run: () => ({ changes: 1 }),
    then: (
      resolve: (value: unknown) => unknown,
      reject?: (err: unknown) => unknown
    ) => {
      const normalized =
        result && typeof result === "object" && "changes" in (result as any)
          ? result
          : { changes: 1 };
      return Promise.resolve(normalized).then(resolve, reject);
    },
  };
  return chain;
}

export const dbMock = {
  select: vi.fn((..._args: unknown[]) =>
    createSelectChain(selectQueue.shift())
  ),
  insert: vi.fn((table: unknown) =>
    createInsertChain(table, () => insertQueue.shift() ?? [])
  ),
  update: vi.fn((table: unknown) =>
    createUpdateChain(table, updateQueue.shift() ?? [])
  ),
  delete: vi.fn((table: unknown) =>
    createDeleteChain(table, deleteQueue.shift() ?? { changes: 0 })
  ),
  transaction: vi.fn((fn: (tx: typeof dbMock) => unknown) => {
    const res = fn(dbMock);
    if (res && typeof (res as any).then === "function") {
      throw new TypeError("Transaction function cannot return a promise");
    }
    return res;
  }),
  execute: vi.fn(),
};

export function queueSelectResults(...results: unknown[]) {
  selectQueue.push(...results);
}

export function queueInsertResults(...results: unknown[]) {
  insertQueue.push(...results);
}

export function queueUpdateResults(...results: unknown[]) {
  updateQueue.push(...results);
}

export function queueDeleteResults(...results: unknown[]) {
  deleteQueue.push(...results);
}

export function resetDbMock() {
  selectQueue.length = 0;
  insertQueue.length = 0;
  updateQueue.length = 0;
  deleteQueue.length = 0;
  selectFallback = null;
  selectCallIndex = 0;
  tableCallCounts = new WeakMap<object, number>();
  insertCalls.length = 0;
  updateCalls.length = 0;
  deleteCalls.length = 0;
  dbMock.select.mockClear();
  dbMock.insert.mockClear();
  dbMock.update.mockClear();
  dbMock.delete.mockClear();
  dbMock.transaction.mockClear();
  dbMock.execute.mockClear();
}

export function setSelectFallback(
  fn:
    | ((ctx: {
        table: unknown | null;
        callIndex: number;
        tableCallIndex: number;
      }) => unknown)
    | null
) {
  selectFallback = fn;
}
