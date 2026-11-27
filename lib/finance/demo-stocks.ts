import type { ResearchStockItem } from "@/components/finance/finance-research-board";
import type {
  SerializedDecision,
  SerializedEvaluationItem,
  SerializedEvidenceItem,
} from "@/components/finance/finance-ticker-pipeline";

export type DemoStockDetail = {
  item: ResearchStockItem;
  criteriaLabel: string;
  criteriaVersion: number;
  proposedCount: number;
  sectionsCovered: number;
  buyRange: string;
  reviewIfBelow: string;
  holdFor: string;
  evidence: SerializedEvidenceItem[];
  evaluations: SerializedEvaluationItem[];
  breakdown: {
    total: number;
    buy: number;
    hold: number;
    dontBuy: number;
    against: number;
    averageConfidence: number | null;
  };
  overallVerdictLabel: string;
  overallVerdictKey: "buy" | "hold" | "dont_buy";
  decision: SerializedDecision | null;
};

export const DEMO_STOCKS: DemoStockDetail[] = [
  {
    item: {
      id: "demo-msft",
      symbol: "MSFT",
      name: "Microsoft",
      bucket: "needs_you",
      call: "go",
      stage: "decide",
      summary:
        "Durable enterprise cloud moat, 35% ROIC, and disciplined capital return.",
      reviewGo: 4,
      reviewTotal: 5,
      origin: "review",
      criteriaId: null,
      isHeld: false,
      latestPrice: 418.5,
      buyRange: "$395.00 – $435.00",
      position: null,
      isDemo: true,
    },
    criteriaLabel: "Quality at a fair price",
    criteriaVersion: 1,
    proposedCount: 2,
    sectionsCovered: 4,
    buyRange: "$395.00 – $435.00",
    reviewIfBelow: "$365.00",
    holdFor: "5+ years",
    evidence: [
      {
        id: "demo-msft-ev-1",
        section: "business",
        summary:
          "Azure and Microsoft 365 create high enterprise switching costs with >42% operating margins.",
        tier: 1,
        tierLabel: "SEC Filing",
        codeChecked: true,
        codeCheckNote: "Verified against FY26 10-K",
        url: "https://www.sec.gov",
      },
      {
        id: "demo-msft-ev-2",
        section: "numbers",
        summary:
          "Free cash flow margin above 30% with net cash position funding AI infrastructure capex.",
        tier: 1,
        tierLabel: "Financials",
        codeChecked: true,
        codeCheckNote: null,
        url: "https://www.sec.gov",
      },
      {
        id: "demo-msft-ev-3",
        section: "filings",
        summary:
          "10-K highlights $80B+ annual capex commitment for data-center expansion.",
        tier: 1,
        tierLabel: "SEC Filing",
        codeChecked: false,
        codeCheckNote: null,
        url: "https://www.sec.gov",
      },
      {
        id: "demo-msft-ev-4",
        section: "news",
        summary:
          "Commercial cloud backlog grew 22% YoY driven by enterprise Copilot adoption.",
        tier: 2,
        tierLabel: "News",
        codeChecked: false,
        codeCheckNote: null,
        url: "https://www.sec.gov",
      },
    ],
    evaluations: [
      {
        id: "demo-msft-eval-1",
        call: "buy",
        callLabel: "Buy",
        against: false,
        confidence: 86,
        createdAt: "2026-11-25",
        reasons: [
          "Enterprise cloud + productivity lock-in supports durable double-digit FCF compounding.",
          "Balance sheet remains net-cash despite elevated AI capex.",
        ],
        risks: ["AI monetization lagging data-center depreciation."],
        changeMind:
          "Operating margin falling below 38% for two consecutive quarters.",
        buyRangeLow: "$395.00",
        buyRangeHigh: "$435.00",
        reviewIfBelow: "$365.00",
        holdDuration: "5+ years",
        citedCount: 4,
      },
      {
        id: "demo-msft-eval-2",
        call: "hold",
        callLabel: "Hold",
        against: true,
        confidence: 71,
        createdAt: "2026-11-25",
        reasons: [
          "Capex intensity reduces near-term free cash flow conversion.",
        ],
        risks: ["Multiple compression if Azure growth slows below 20%."],
        changeMind: "Clear acceleration in AI software gross margins.",
        buyRangeLow: "$370.00",
        buyRangeHigh: "$400.00",
        reviewIfBelow: "$350.00",
        holdDuration: "3–5 years",
        citedCount: 3,
      },
    ],
    breakdown: {
      total: 2,
      buy: 1,
      hold: 1,
      dontBuy: 0,
      against: 1,
      averageConfidence: 79,
    },
    overallVerdictLabel: "Buy",
    overallVerdictKey: "buy",
    decision: {
      id: "demo-msft-decision",
      call: "go",
      origin: "review",
      actorLabel: "Finance Committee",
      sentence:
        "Durable enterprise cloud moat, 35% ROIC, and disciplined capital return.",
      reviewGo: 4,
      reviewTotal: 5,
      reasons: [
        "High-margin recurring enterprise software & cloud infrastructure.",
        "Consistent dividend growth and share repurchases backed by FCF.",
      ],
      answerAgainst:
        "Elevated AI capex is funded organically from operating cash flow without taking on net debt.",
      answerDissent:
        "1 reviewer preferred waiting for a pullback toward $395 due to near-term capex drag.",
      changeMind:
        "Sustained Azure deceleration below 18% YoY or operating margin compression below 38%.",
      reviews: [
        {
          id: "demo-msft-rev-1",
          actorLabel: "Reviewer A",
          call: "go",
          summary: "Strongest balance sheet in megacap tech.",
          answerAgainst: "Capex is high-ROIC contracted demand.",
        },
        {
          id: "demo-msft-rev-2",
          actorLabel: "Reviewer B",
          call: "no_go",
          summary: "Valuation leaves modest margin of safety.",
          answerAgainst: "Would revisit below $395.",
        },
      ],
    },
  },
  {
    item: {
      id: "demo-cost",
      symbol: "COST",
      name: "Costco Wholesale",
      bucket: "needs_you",
      call: "go",
      stage: "decide",
      summary:
        "93% membership renewal rate drives predictable fee income and scale pricing power.",
      reviewGo: 4,
      reviewTotal: 5,
      origin: "review",
      criteriaId: null,
      isHeld: false,
      latestPrice: 912.4,
      buyRange: "$820.00 – $900.00",
      position: null,
      isDemo: true,
    },
    criteriaLabel: "Quality at a fair price",
    criteriaVersion: 1,
    proposedCount: 1,
    sectionsCovered: 3,
    buyRange: "$820.00 – $900.00",
    reviewIfBelow: "$760.00",
    holdFor: "10+ years",
    evidence: [
      {
        id: "demo-cost-ev-1",
        section: "business",
        summary:
          "Membership fee revenue carries nearly 100% incremental margin and 93% US/Canada renewal.",
        tier: 1,
        tierLabel: "SEC Filing",
        codeChecked: true,
        codeCheckNote: null,
        url: "https://www.sec.gov",
      },
      {
        id: "demo-cost-ev-2",
        section: "numbers",
        summary:
          "Negative working capital cycle and >28% ROIC with minimal net leverage.",
        tier: 1,
        tierLabel: "Financials",
        codeChecked: true,
        codeCheckNote: null,
        url: "https://www.sec.gov",
      },
    ],
    evaluations: [
      {
        id: "demo-cost-eval-1",
        call: "buy",
        callLabel: "Buy",
        against: false,
        confidence: 82,
        createdAt: "2026-11-25",
        reasons: [
          "Scale-shared model continuously widens price advantage over traditional retail.",
        ],
        risks: ["Rich forward earnings multiple leaves narrow margin of safety."],
        changeMind: "Membership renewal dropping below 89%.",
        buyRangeLow: "$820.00",
        buyRangeHigh: "$900.00",
        reviewIfBelow: "$760.00",
        holdDuration: "10+ years",
        citedCount: 2,
      },
    ],
    breakdown: {
      total: 1,
      buy: 1,
      hold: 0,
      dontBuy: 0,
      against: 0,
      averageConfidence: 82,
    },
    overallVerdictLabel: "Buy",
    overallVerdictKey: "buy",
    decision: {
      id: "demo-cost-decision",
      call: "go",
      origin: "review",
      actorLabel: "Finance Committee",
      sentence:
        "93% membership renewal rate drives predictable fee income and scale pricing power.",
      reviewGo: 4,
      reviewTotal: 5,
      reasons: [
        "Membership fee increase flows directly to operating income.",
        "International warehouse runway remains underpenetrated.",
      ],
      answerAgainst:
        "Premium multiple is justified by unmatched earnings predictability and negative working capital.",
      answerDissent: null,
      changeMind: "Comparable traffic turning negative for two quarters.",
      reviews: [],
    },
  },
  {
    item: {
      id: "demo-nvda",
      symbol: "NVDA",
      name: "NVIDIA",
      bucket: "not_now",
      call: "keep",
      stage: "done",
      summary:
        "CUDA software ecosystem and Blackwell cycle sustain data-center leadership.",
      reviewGo: 5,
      reviewTotal: 5,
      origin: "monitor",
      criteriaId: null,
      isHeld: false,
      latestPrice: 138.25,
      buyRange: "$115.00 – $135.00",
      position: null,
      isDemo: true,
    },
    criteriaLabel: "Quality at a fair price",
    criteriaVersion: 1,
    proposedCount: 3,
    sectionsCovered: 5,
    buyRange: "$115.00 – $135.00",
    reviewIfBelow: "$100.00",
    holdFor: "5+ years",
    evidence: [
      {
        id: "demo-nvda-ev-1",
        section: "business",
        summary:
          "Full-stack CUDA + NVLink architecture locks in hyperscaler and enterprise AI workloads.",
        tier: 1,
        tierLabel: "SEC Filing",
        codeChecked: true,
        codeCheckNote: null,
        url: "https://www.sec.gov",
      },
    ],
    evaluations: [
      {
        id: "demo-nvda-eval-1",
        call: "buy",
        callLabel: "Buy",
        against: false,
        confidence: 88,
        createdAt: "2026-11-24",
        reasons: ["Gross margins holding >70% through next-gen architecture ramp."],
        risks: ["Hyperscaler concentration and custom ASIC competition."],
        changeMind: "Data-center gross margins compressing below 60%.",
        buyRangeLow: "$115.00",
        buyRangeHigh: "$135.00",
        reviewIfBelow: "$100.00",
        holdDuration: "5+ years",
        citedCount: 1,
      },
    ],
    breakdown: {
      total: 1,
      buy: 1,
      hold: 0,
      dontBuy: 0,
      against: 0,
      averageConfidence: 88,
    },
    overallVerdictLabel: "Buy",
    overallVerdictKey: "buy",
    decision: {
      id: "demo-nvda-decision",
      call: "keep",
      origin: "monitor",
      actorLabel: "Monitor Agent",
      sentence:
        "CUDA software ecosystem and Blackwell cycle sustain data-center leadership.",
      reviewGo: 5,
      reviewTotal: 5,
      reasons: ["Hyperscaler AI capex commitments remain intact through 2027."],
      answerAgainst: "Custom silicon complements rather than replaces general-purpose GPU clusters.",
      answerDissent: null,
      changeMind: "Major hyperscaler order cancellations.",
      reviews: [],
    },
  },
  {
    item: {
      id: "demo-v",
      symbol: "V",
      name: "Visa Inc.",
      bucket: "in_progress",
      call: null,
      stage: "evaluate",
      summary:
        "Evaluating cross-border payment volume growth and regulatory fee-cap risks.",
      reviewGo: null,
      reviewTotal: null,
      origin: null,
      criteriaId: null,
      isHeld: false,
      latestPrice: 312.8,
      buyRange: null,
      position: null,
      isDemo: true,
    },
    criteriaLabel: "Quality at a fair price",
    criteriaVersion: 1,
    proposedCount: 2,
    sectionsCovered: 3,
    buyRange: "—",
    reviewIfBelow: "—",
    holdFor: "—",
    evidence: [
      {
        id: "demo-v-ev-1",
        section: "business",
        summary:
          "Global four-party payment network generates 67% operating margins with zero credit risk.",
        tier: 1,
        tierLabel: "SEC Filing",
        codeChecked: true,
        codeCheckNote: null,
        url: "https://www.sec.gov",
      },
      {
        id: "demo-v-ev-2",
        section: "news",
        summary:
          "Reviewing DOJ antitrust scrutiny on US debit routing.",
        tier: 2,
        tierLabel: "News",
        codeChecked: false,
        codeCheckNote: null,
        url: "https://www.sec.gov",
      },
    ],
    evaluations: [],
    breakdown: {
      total: 0,
      buy: 0,
      hold: 0,
      dontBuy: 0,
      against: 0,
      averageConfidence: null,
    },
    overallVerdictLabel: "Pending",
    overallVerdictKey: "hold",
    decision: null,
  },
  {
    item: {
      id: "demo-meta",
      symbol: "META",
      name: "Meta Platforms",
      bucket: "not_now",
      call: "trim",
      stage: "done",
      summary:
        "Core ad engine remains strong, though 2026 AI capex guidance stepped up sharply.",
      reviewGo: 3,
      reviewTotal: 5,
      origin: "monitor",
      criteriaId: null,
      isHeld: false,
      latestPrice: 572.1,
      buyRange: "$510.00 – $555.00",
      position: null,
      isDemo: true,
    },
    criteriaLabel: "Quality at a fair price",
    criteriaVersion: 1,
    proposedCount: 1,
    sectionsCovered: 4,
    buyRange: "$510.00 – $555.00",
    reviewIfBelow: "$480.00",
    holdFor: "3–5 years",
    evidence: [
      {
        id: "demo-meta-ev-1",
        section: "numbers",
        summary:
          "Family of Apps operating margin above 45%, offset by $17B+ annual Reality Labs losses.",
        tier: 1,
        tierLabel: "Financials",
        codeChecked: true,
        codeCheckNote: null,
        url: "https://www.sec.gov",
      },
    ],
    evaluations: [
      {
        id: "demo-meta-eval-1",
        call: "hold",
        callLabel: "Hold",
        against: false,
        confidence: 74,
        createdAt: "2026-11-24",
        reasons: ["AI ad-ranking improvements continue to lift Reels monetization."],
        risks: ["2026 capex ramp compressing near-term free cash flow."],
        changeMind: "Capex-to-revenue normalizing below 22%.",
        buyRangeLow: "$510.00",
        buyRangeHigh: "$555.00",
        reviewIfBelow: "$480.00",
        holdDuration: "3–5 years",
        citedCount: 1,
      },
    ],
    breakdown: {
      total: 1,
      buy: 0,
      hold: 1,
      dontBuy: 0,
      against: 0,
      averageConfidence: 74,
    },
    overallVerdictLabel: "Hold",
    overallVerdictKey: "hold",
    decision: {
      id: "demo-meta-decision",
      call: "trim",
      origin: "monitor",
      actorLabel: "Monitor Agent",
      sentence:
        "Core ad engine remains strong, though 2026 AI capex guidance stepped up sharply.",
      reviewGo: 3,
      reviewTotal: 5,
      reasons: ["Trim position sizing until free cash flow conversion stabilizes."],
      answerAgainst: "Core ad ROAS still justifies infrastructure spend long term.",
      answerDissent: null,
      changeMind: "Clear FCF inflection above $50B annualized.",
      reviews: [],
    },
  },
  {
    item: {
      id: "demo-intc",
      symbol: "INTC",
      name: "Intel Corp.",
      bucket: "not_now",
      call: "no_go",
      stage: "done",
      summary:
        "Foundry turnaround requires heavy capex with negative free cash flow and share loss.",
      reviewGo: 1,
      reviewTotal: 5,
      origin: "review",
      criteriaId: null,
      isHeld: false,
      latestPrice: 24.3,
      buyRange: null,
      position: null,
      isDemo: true,
    },
    criteriaLabel: "Quality at a fair price",
    criteriaVersion: 1,
    proposedCount: 1,
    sectionsCovered: 3,
    buyRange: "—",
    reviewIfBelow: "—",
    holdFor: "—",
    evidence: [
      {
        id: "demo-intc-ev-1",
        section: "numbers",
        summary:
          "Negative trailing 12-month free cash flow and declining client/server market share.",
        tier: 1,
        tierLabel: "Financials",
        codeChecked: true,
        codeCheckNote: null,
        url: "https://www.sec.gov",
      },
    ],
    evaluations: [
      {
        id: "demo-intc-eval-1",
        call: "dont_buy",
        callLabel: "Don't buy",
        against: false,
        confidence: 89,
        createdAt: "2026-11-24",
        reasons: [
          "Fails durable profitability and low-debt quality criteria.",
        ],
        risks: ["Execution risk on 18A node and foundry customer ramp."],
        changeMind: "Sustained positive FCF and external foundry anchor wins.",
        buyRangeLow: null,
        buyRangeHigh: null,
        reviewIfBelow: null,
        holdDuration: "N/A",
        citedCount: 1,
      },
    ],
    breakdown: {
      total: 1,
      buy: 0,
      hold: 0,
      dontBuy: 1,
      against: 0,
      averageConfidence: 89,
    },
    overallVerdictLabel: "Don't buy",
    overallVerdictKey: "dont_buy",
    decision: {
      id: "demo-intc-decision",
      call: "no_go",
      origin: "review",
      actorLabel: "Finance Committee",
      sentence:
        "Foundry turnaround requires heavy capex with negative free cash flow and share loss.",
      reviewGo: 1,
      reviewTotal: 5,
      reasons: [
        "Does not meet profitability or ROIC thresholds for quality compounding.",
      ],
      answerAgainst: "Even at low book multiples, negative FCF creates value-trap risk.",
      answerDissent: null,
      changeMind: "Foundry reaching breakeven operating margin.",
      reviews: [],
    },
  },
];

export const DEMO_STOCK_ITEMS: ResearchStockItem[] = DEMO_STOCKS.map(
  (d) => d.item,
);

export function findDemoStock(symbol: string): DemoStockDetail | null {
  return DEMO_STOCKS.find((d) => d.item.symbol === symbol) ?? null;
}
