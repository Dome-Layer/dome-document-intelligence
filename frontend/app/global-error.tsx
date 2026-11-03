"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { useT } from "@/lib/i18n";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ padding: "4rem 2rem", textAlign: "center" }}>
          <h2>{t.globalError.title}</h2>
          <button onClick={() => reset()}>{t.globalError.retry}</button>
        </div>
      </body>
    </html>
  );
}
