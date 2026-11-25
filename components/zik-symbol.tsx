/**
 * The Zik's symbol (#ziki-coins): a Z with a vertical bar through it, the way the dollar sign is an S with one. It is
 * drawn, not typed, so it takes the colour and size of the text around it and looks the same on every device. It sits
 * before the number, like the dollar sign: `<ZikAmount amount={50} />` reads "Z̶50". Where a symbol can't go (a sentence,
 * an email, a Stripe page) say "Ziks" in words.
 */
export function ZikSymbol({ className = "" }: { className?: string }) {
  // Sized to the digits beside it (#zik-symbol-align): the Z's outer edges span y 3 to 17 of the 20-unit box, which is
  // 0.72em, the figures' height. The box's bottom sits on the baseline (inline or in a baseline-aligned flex row), and
  // translating it down 3 units (0.154em) puts the Z's foot on the baseline too; only the bar reaches above and below.
  return (
    <svg
      viewBox="0 0 14 20"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="butt"
      strokeLinejoin="miter"
      className={`inline-block h-[1.03em] w-[0.72em] shrink-0 translate-y-[0.154em] align-baseline ${className}`}
    >
      <path d="M2.5 4.1H11.5L2.5 15.9H11.5" />
      <path d="M7 1V19" />
    </svg>
  );
}

/** An amount of Ziks with the symbol in front. A screen reader hears the number and the word "Ziks". */
export function ZikAmount({ amount, className = "" }: { amount: number; className?: string }) {
  const text = Math.round(amount).toLocaleString("en-US");
  return (
    <span className={`inline-flex items-baseline gap-[0.12em] whitespace-nowrap ${className}`}>
      <span aria-hidden="true" className="inline-flex items-baseline gap-[0.12em]">
        <ZikSymbol />
        {text}
      </span>
      <span className="sr-only">{text} Ziks</span>
    </span>
  );
}
