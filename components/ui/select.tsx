import type { SelectHTMLAttributes } from "react";
import { FIELD_CONTROL } from "@/lib/ui-style";

export function Select({
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`${FIELD_CONTROL} h-9 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
