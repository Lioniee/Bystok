// Table of contents for /docs. The page renders one section per entry, and the
// sidebar / phone menu link to the same ids.
export type DocPart = { title: string; sections: { id: string; title: string }[] };

export const PARTS: DocPart[] = [
  {
    title: "Part I · The story",
    sections: [
      { id: "friday-4pm", title: "Friday, 4pm" },
      { id: "meet-ada", title: "Meet Ada" },
      { id: "what-bystok-checks", title: "What Bystok checks" },
      { id: "why-it-exists", title: "Why it exists" },
      { id: "the-honest-part", title: "The honest part" },
    ],
  },
  {
    title: "Part II · How it works",
    sections: [
      { id: "overview", title: "Overview" },
      { id: "data-sources", title: "Data sources" },
      { id: "checks-and-thresholds", title: "The checks and thresholds" },
      { id: "the-verdict", title: "How the verdict is decided" },
      { id: "market-hours", title: "Market hours and the weekend gap" },
      { id: "ondo-vs-bstock", title: "Ondo vs bStock" },
      { id: "reliability", title: "Reliability" },
      { id: "wallet-connect", title: "Wallet connect" },
      { id: "planned-buy-flow", title: "Planned buy flow" },
      { id: "tech-stack", title: "Tech stack" },
      { id: "whats-next", title: "What's next" },
    ],
  },
];
