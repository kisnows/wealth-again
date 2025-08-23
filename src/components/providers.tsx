"use client";

import { SessionProvider } from "next-auth/react";
import { ErrorBoundary } from "@/components/error-boundary";
import { AppStateProvider } from "@/lib/app-state";

interface ProvidersProps {
  children: React.ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <ErrorBoundary>
      <SessionProvider>
        <AppStateProvider>{children}</AppStateProvider>
      </SessionProvider>
    </ErrorBoundary>
  );
}
