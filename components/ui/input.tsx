import type { InputHTMLAttributes } from "react";
import { FIELD_CONTROL } from "@/lib/ui-style";

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`${FIELD_CONTROL} h-9 ${className}`}
      {...props}
    />
  );
}
