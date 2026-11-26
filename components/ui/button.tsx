import type { ButtonHTMLAttributes, ReactNode } from "react";
import { BUTTON_BASE, BUTTON_VARIANTS } from "@/lib/ui-style";

type Variant = keyof typeof BUTTON_VARIANTS;

/**
 * Ziki's buttons (#flat-buttons, docs/style-guide.md): flat, never a shadow, gradient or lift; 10px corners; the same
 * height in every variant. Hover changes only the fill.
 */

export function Button({
  children,
  className = "",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: Variant;
}) {
  return (
    <button
      className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
