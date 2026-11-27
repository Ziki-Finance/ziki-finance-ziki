"use client";

import { useEffect } from "react";
import Link from "next/link";
import { StatusPage, primaryActionClass, secondaryActionClass } from "@/components/status-page";

export default function FinanceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[finance:error]", error.digest ?? "", error.message, error);
  }, [error]);

  return (
    <StatusPage
      title="Finance failed to load"
      actions={
        <>
          <button type="button" onClick={() => reset()} className={primaryActionClass}>
            Try again
          </button>
          <Link href="/home" className={secondaryActionClass}>
            Go to issues
          </Link>
        </>
      }
    >
      <p className="text-sm text-zk-text2">{error.message || "Unknown server error."}</p>
      {error.digest ? (
        <p className="text-xs text-slate-500">
          Reference: <code className="rounded bg-slate-100 px-1 py-0.5">{error.digest}</code>
        </p>
      ) : null}
    </StatusPage>
  );
}
