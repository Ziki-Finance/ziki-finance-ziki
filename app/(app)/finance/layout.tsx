import type { Metadata } from "next";

/**
 * Ziki Finance is unlisted (FIN-D-011): anyone with the link can open it, but
 * search engines are told not to list it, and nothing on Ziki links to it.
 */
export const metadata: Metadata = {
  title: "Finance",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
