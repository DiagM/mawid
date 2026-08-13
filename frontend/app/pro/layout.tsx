"use client";

import { usePathname } from "next/navigation";
import { ProShell } from "./ProShell";

/**
 * Coquille commune à tout `/pro/*`, sauf la page de connexion (qui doit
 * rester accessible sans token, et ne doit pas afficher la navigation).
 */
export default function ProLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (pathname === "/pro/connexion") {
    return <>{children}</>;
  }

  return <ProShell>{children}</ProShell>;
}
