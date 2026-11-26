/**
 * The app's shared look (#app-look), defined in docs/style-guide.md: one place for the section
 * title style, the spacing and the toolbar controls, so every page reads alike.
 *
 * - Section titles are 16px, semibold, near-black, with an optional 14px gray line under them.
 * - Panels are white with a thin line and 12px corners; inside, 20px padding and 16px between blocks.
 * - Toolbar controls (Filter, New …, period pickers) are quiet, flat buttons: white, a thin line, 10px corners.
 */

/** A section's title: 16px, semibold, slightly tight. */
export const SECTION_TITLE = "m-0 text-base font-semibold leading-6 tracking-[-0.01em] text-zk-text";

/** The gray line under a section title. */
export const SECTION_SUB = "m-0 text-[14px] leading-5 text-zk-muted";

/** A white panel: a thin line, 12px corners, 20px padding. */
export const PANEL = "rounded-panel border border-zk-border bg-zk-surface p-5";

/** The space between blocks inside a panel, and between panels. */
export const GAP = "gap-4";

/** Shared by Button and links styled as actions. Keep all variants flat. */
export const CONTROL_FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue focus-visible:ring-offset-2";
export const BUTTON_BASE = `inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-control px-4 text-sm font-semibold shadow-none transition-colors ${CONTROL_FOCUS} disabled:cursor-not-allowed disabled:opacity-50`;
export const BUTTON_VARIANTS = {
  primary: "bg-electric-blue-strong text-white [&:not(:disabled):hover]:bg-zk-ink",
  accent: "bg-zk-blue text-white [&:not(:disabled):hover]:bg-teal-600",
  secondary: "bg-zk-surface text-zk-text border border-zk-border [&:not(:disabled):hover]:bg-zk-chip",
  ghost: "bg-transparent text-zk-text2 [&:not(:disabled):hover]:bg-zk-chip [&:not(:disabled):hover]:text-zk-text",
  danger: "bg-red-600 text-white [&:not(:disabled):hover]:bg-red-700",
  "danger-secondary": "bg-zk-surface text-red-600 border border-red-200 [&:not(:disabled):hover]:bg-red-50 [&:not(:disabled):hover]:border-red-300",
} as const;
// :not(:disabled) supports navigation links and native disabled buttons.
export const PRIMARY_ACTION = `${BUTTON_BASE} ${BUTTON_VARIANTS.primary}`;
export const SECONDARY_ACTION = `${BUTTON_BASE} ${BUTTON_VARIANTS.secondary}`;
export const DANGER_ACTION = `${BUTTON_BASE} ${BUTTON_VARIANTS["danger-secondary"]}`;
export const GHOST_ACTION = `${BUTTON_BASE} ${BUTTON_VARIANTS.ghost}`;

/** Inputs/selects share geometry; textarea adds its own height and vertical padding. */
export const FIELD_CONTROL = `w-full rounded-control border border-zk-border bg-zk-surface px-3 text-sm text-zk-text shadow-none placeholder:text-zk-muted ${CONTROL_FOCUS} disabled:cursor-not-allowed disabled:opacity-50`;

/** A toolbar control: a flat white button with a thin line, 10px corners, an optional icon, and dark text. */
export const TOOL_BUTTON =
  `${SECONDARY_ACTION} shrink-0 list-none [&::-webkit-details-marker]:hidden [&>svg]:text-zk-text2`;

/** A toolbar control while it is on (a filter is picked): the same, in the accent. */
export const TOOL_BUTTON_ON = "border-zk-accent/40 bg-zk-tint text-zk-accent [&>svg]:text-zk-accent";
