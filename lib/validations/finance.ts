import { z } from "zod";

/**
 * Finance criteria and screening (FIN-CR-013, Stream A).
 *
 * This is the only input boundary for `app/api/v1/finance/*` and the
 * `/finance` form. Finance belongs to no organisation: everything is scoped to
 * the owner, and the schema never accepts an organisation or project id.
 */

/** The three suggested presets, plus the owner's own words (§4.1). */
export const FINANCE_PRESETS = {
  steady_dividend_growers: {
    label: "Steady dividend growers",
    words:
      "Companies that have grown their dividend for years, with steady cash flow, modest debt and a business I can understand.",
  },
  quality_at_a_fair_price: {
    label: "Quality at a fair price",
    words:
      "Durable, profitable companies with a lasting advantage, bought at a price that leaves room for a long-term return.",
  },
  long_term_growth_leaders: {
    label: "Long-term growth leaders",
    words:
      "Companies leading a growing market, with rising revenue and a clear path to keep growing for the next decade.",
  },
  own_words: {
    label: "My own words",
    words: "",
  },
} as const;

export const financePresetValues = [
  "steady_dividend_growers",
  "quality_at_a_fair_price",
  "long_term_growth_leaders",
  "own_words",
] as const;
export const financePresetSchema = z.enum(financePresetValues);
export type FinancePreset = z.infer<typeof financePresetSchema>;

/** A code-checkable company-size tag. `any` checks nothing. */
export const financeCompanySizeValues = ["any", "small", "mid", "large"] as const;
export const financeCompanySizeSchema = z.enum(financeCompanySizeValues);
export type FinanceCompanySize = z.infer<typeof financeCompanySizeSchema>;

/** The only stock counts the owner may choose (§4.1). */
export const FINANCE_STOCK_COUNTS = [5, 10, 15] as const;
export const DEFAULT_FINANCE_STOCK_COUNT = 10;

const tagSchema = z
  .string()
  .trim()
  .min(1, "A tag cannot be empty")
  .max(60, "A tag must be at most 60 characters");

const tagsSchema = z.array(tagSchema).max(20, "Use at most 20 tags").default([]);

const idSchema = z.string().trim().min(1).max(191);

/** Uppercase a ticker before checking it, so `aapl` and `AAPL` are one stock. */
export const normalizeTicker = (raw: string): string => raw.trim().toUpperCase();

/** A US ticker: one leading letter, then letters, digits, dots or dashes. */
export const FINANCE_TICKER_PATTERN = /^[A-Z][A-Z0-9.-]{0,9}$/;

export const financeTickerSchema = z.preprocess(
  (value) => (typeof value === "string" ? normalizeTicker(value) : value),
  z
    .string({ message: "A ticker is required" })
    .regex(FINANCE_TICKER_PATTERN, "A ticker is 1–10 characters: letters, digits, dots or dashes"),
);

const stockCountSchema = z.preprocess(
  (value) => {
    if (typeof value === "string" && value.trim() !== "" && /^\d+$/.test(value.trim())) {
      return Number(value.trim());
    }
    return value;
  },
  z
    .number({ message: "How many stocks must be a number" })
    .int("How many stocks must be a whole number")
    .refine(
      (value) => (FINANCE_STOCK_COUNTS as readonly number[]).includes(value),
      `How many stocks must be ${FINANCE_STOCK_COUNTS.join(", ")}`,
    ),
);

/**
 * Criteria create/update payload (§4.1). A preset with no words of its own
 * keeps the preset's text; `own_words` requires the owner's words. Tags are
 * lower-cased so industry matching against Finnhub is predictable.
 */
export const financeCriteriaInputSchema = z
  .object({
    preset: financePresetSchema.default("own_words"),
    words: z
      .string()
      .trim()
      .max(4000, "The criteria must be at most 4000 characters")
      .optional()
      .default(""),
    companySize: financeCompanySizeSchema.default("any"),
    industries: tagsSchema,
    leaveOut: tagsSchema,
    howManyStocks: stockCountSchema.default(DEFAULT_FINANCE_STOCK_COUNT),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.preset === "own_words" && value.words.length < 10) {
      ctx.addIssue({
        code: "custom",
        path: ["words"],
        message: "Describe the companies you want in at least 10 characters, or choose a preset.",
      });
    }

    const leaveOut = new Set(value.leaveOut.map((tag) => tag.toLowerCase()));
    const overlap = value.industries.filter((tag) => leaveOut.has(tag.toLowerCase()));
    if (overlap.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["leaveOut"],
        message: `These industries are both wanted and left out: ${overlap.join(", ")}`,
      });
    }
  })
  .transform((value) => {
    const presetWords = value.preset === "own_words" ? "" : FINANCE_PRESETS[value.preset].words;
    const lower = (tags: string[]) => [...new Set(tags.map((tag) => tag.toLowerCase()))];
    return {
      ...value,
      words: value.words || presetWords,
      industries: lower(value.industries),
      leaveOut: lower(value.leaveOut),
    };
  });

export type FinanceCriteriaInput = z.input<typeof financeCriteriaInputSchema>;
export type ParsedFinanceCriteriaInput = z.output<typeof financeCriteriaInputSchema>;

/** The label a preset is shown with, or the owner's own words trimmed short. */
export function financeCriteriaTitle(criteria: {
  preset: string;
  words: string;
}): string {
  if (criteria.preset !== "own_words") {
    const preset = FINANCE_PRESETS[criteria.preset as FinancePreset];
    if (preset) return preset.label;
  }
  const firstLine = criteria.words.split(/\r?\n/)[0]?.trim() ?? "";
  if (firstLine.length <= 80) return firstLine;
  return `${firstLine.slice(0, 77).trimEnd()}…`;
}

/** One "why it fits" entry, one per criterion (§4.2). */
export const financeWhyItFitsSchema = z
  .object({
    criterion: z
      .string()
      .trim()
      .min(1, "Name the criterion this answers")
      .max(200, "A criterion must be at most 200 characters"),
    why: z
      .string()
      .trim()
      .min(1, "Say why the stock fits")
      .max(1000, "A reason must be at most 1000 characters"),
  })
  .strict();

const sourceUrlSchema = z
  .url()
  .max(2048, "A source address must be at most 2048 characters")
  .refine((value) => /^https?:\/\//i.test(value), "A source must start with http:// or https://");

/** An agent's screening submission: propose a stock, or confirm another's. */
export const financeCandidateSignalSchema = z
  .object({
    runId: idSchema,
    ticker: financeTickerSchema,
    companyName: z
      .string()
      .trim()
      .max(200, "A company name must be at most 200 characters")
      .nullable()
      .optional()
      .transform((value) => value || null),
    kind: z.enum(["proposed", "confirmed"]).default("proposed"),
    whyItFits: z
      .array(financeWhyItFitsSchema)
      .min(1, "Give at least one reason it fits")
      .max(20, "Give at most 20 reasons"),
    sources: z
      .array(sourceUrlSchema)
      .min(1, "Cite at least one public source")
      .max(20, "Cite at most 20 sources"),
  })
  .strict();

export type FinanceCandidateSignalInput = z.output<typeof financeCandidateSignalSchema>;

/** Split comma-separated tags from the form into the array the schema wants. */
export function splitFinanceTags(raw: FormDataEntryValue | null): string[] {
  return String(raw ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}
