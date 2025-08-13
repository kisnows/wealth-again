"use client";

import { SessionProvider } from "next-auth/react";
import { AppStateProvider } from "@/lib/app-state";
import { ErrorBoundary } from "@/components/error-boundary";

interface ProvidersProps {
  children: React.ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <ErrorBoundary>
      <SessionProvider>
        <AppStateProvider>
          {children}
        </AppStateProvider>
      </SessionProvider>
    </ErrorBoundary>
  );
}