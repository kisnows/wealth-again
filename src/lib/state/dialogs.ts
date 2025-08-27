"use client";

import { create } from "zustand";

type TransferContext = { fromAccountId?: string; toAccountId?: string } | null;

type DialogState = {
  transferOpen: boolean;
  valuationOpen: boolean;
  transferCtx: TransferContext;
  openTransfer: (ctx?: TransferContext) => void;
  closeTransfer: () => void;
  openValuation: () => void;
  closeValuation: () => void;
};

export const useDialogStore = create<DialogState>((set) => ({
  transferOpen: false,
  valuationOpen: false,
  transferCtx: null,
  openTransfer: (transferCtx) => set({ transferOpen: true, transferCtx: transferCtx ?? null }),
  closeTransfer: () => set({ transferOpen: false, transferCtx: null }),
  openValuation: () => set({ valuationOpen: true }),
  closeValuation: () => set({ valuationOpen: false }),
}));

