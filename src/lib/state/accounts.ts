"use client";

import { create } from "zustand";

export type TransferContext = {
  fromAccountId?: string;
  toAccountId?: string;
} | null;

type AccountDialogState = {
  transferOpen: boolean;
  valuationOpen: boolean;
  transferCtx: TransferContext;
  openTransfer: (ctx?: TransferContext) => void;
  closeTransfer: () => void;
  openValuation: () => void;
  closeValuation: () => void;
};

export const useAccountDialogStore = create<AccountDialogState>((set) => ({
  transferOpen: false,
  valuationOpen: false,
  transferCtx: null,
  openTransfer: (transferCtx) =>
    set({ transferOpen: true, transferCtx: transferCtx ?? null }),
  closeTransfer: () => set({ transferOpen: false, transferCtx: null }),
  openValuation: () => set({ valuationOpen: true }),
  closeValuation: () => set({ valuationOpen: false }),
}));

type AccountSelectionState = {
  selectedIds: Set<string>;
  toggle: (id: string) => void;
  clear: () => void;
};

export const useAccountSelectionStore = create<AccountSelectionState>(
  (set, get) => ({
    selectedIds: new Set<string>(),
    toggle: (id) => {
      const next = new Set(get().selectedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      set({ selectedIds: next });
    },
    clear: () => set({ selectedIds: new Set() }),
  }),
);

// 兼容旧的命名，后续逐步收敛到新导出
export const useDialogStore = useAccountDialogStore;
export const useSelectionStore = useAccountSelectionStore;
