"use client";

import Link from "next/link";
import { DomeLogo, ThemeToggle, useAuth } from "@dome-layer/dome-ui";
import { getAuthSiteUrl } from "@/lib/auth";

export function Header() {
  const { isAuthenticated, signOut } = useAuth();

  return (
    <header className="app-topbar">
      <div className="flex items-center justify-between w-full">
        <Link href="/" aria-label="Home">
          <DomeLogo size="md" />
        </Link>

        <nav style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {isAuthenticated ? (
            <button
              onClick={async () => {
                await signOut();
                window.location.href = `${getAuthSiteUrl()}/login`;
              }}
              className="btn btn-neutral btn-sm"
            >
              Sign out
            </button>
          ) : (
            <button
              onClick={() => {
                const returnUrl = encodeURIComponent(window.location.href);
                window.location.href = `${getAuthSiteUrl()}/login?redirect=${returnUrl}`;
              }}
              className="btn btn-primary btn-sm"
            >
              Sign in
            </button>
          )}

          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
