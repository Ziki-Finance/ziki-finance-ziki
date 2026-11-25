import { CONTROL_FOCUS, PRIMARY_ACTION, SECONDARY_ACTION } from "@/lib/ui-style";
// Navigation links mirror Button's primary styling; actual actions use Button.
const focus = CONTROL_FOCUS;
export const feedbackPrimaryAction = PRIMARY_ACTION;
export const feedbackSecondaryAction = SECONDARY_ACTION;
export const feedbackTextLink = `inline-flex min-h-8 items-center gap-1.5 rounded-sm text-sm font-medium text-zk-accent hover:underline ${focus}`;
export const feedbackBackLink = `inline-flex min-h-8 items-center gap-1.5 rounded-sm text-sm font-medium text-zk-text hover:underline ${focus}`;
