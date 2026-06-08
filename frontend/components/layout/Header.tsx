"use client";

import Link from "next/link";
import { ToolHeader } from "@dome-layer/dome-ui";

export function Header() {
  // Full-width / edge-aligned to match the app shell (sidebar + main).
  // Page navigation lives in the sidebar, so the header carries no navLinks.
  return (
    <ToolHeader
      toolName="Document Intelligence"
      width="fluid"
      renderLink={({ href, children, ...rest }) => (
        <Link href={href} {...rest}>
          {children}
        </Link>
      )}
    />
  );
}
