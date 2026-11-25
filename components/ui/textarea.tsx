import { forwardRef, type TextareaHTMLAttributes } from "react";
import { FIELD_CONTROL } from "@/lib/ui-style";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className = "", ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={`${FIELD_CONTROL} min-h-24 py-2 ${className}`}
      {...props}
    />
  );
});
