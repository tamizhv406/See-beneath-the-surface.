"use client";

import React from "react";
import { OceanDataProvider } from "@/lib/ocean-context";
import { AppShellLayout } from "./app-shell-layout";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <OceanDataProvider>
      <AppShellLayout>{children}</AppShellLayout>
    </OceanDataProvider>
  );
}
