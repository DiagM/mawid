import type { HTMLAttributes } from "react";

export function Card({
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-navy/10 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
