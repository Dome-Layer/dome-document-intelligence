"use client";

import { type ReactNode } from "react";
import { AuthProvider as DomeAuthProvider, useAuth } from "@dome-layer/dome-ui";
import { deleteSession } from "@/lib/api";

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <DomeAuthProvider onSignOut={deleteSession}>
      {children}
    </DomeAuthProvider>
  );
}

export { useAuth };
