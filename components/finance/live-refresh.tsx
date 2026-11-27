"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export function FinanceLiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    const interval = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, 5000);
    return () => clearInterval(interval);
  }, [router]);
  return null;
}
