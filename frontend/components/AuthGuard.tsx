"use client";

import { AuthGuard as DomeAuthGuard } from "@dome-layer/dome-ui";

const SKIP_AUTH = process.env.NEXT_PUBLIC_SKIP_AUTH === "true";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  return <DomeAuthGuard skip={SKIP_AUTH}>{children}</DomeAuthGuard>;
}
