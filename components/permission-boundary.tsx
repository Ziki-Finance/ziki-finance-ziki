import { notFound } from "next/navigation";
import type { ReactNode } from "react";

/**
 * A server-side permission boundary. When the viewer may not see the page,
 * the route answers 404 rather than revealing that it exists — the Finance
 * page is unlinked and `noindex` (FIN-D-011).
 */
export function PermissionBoundary({
  allowed,
  children,
}: {
  allowed: boolean;
  children: ReactNode;
}) {
  if (!allowed) notFound();
  return <>{children}</>;
}
