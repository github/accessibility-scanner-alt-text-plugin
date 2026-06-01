// Shared contract for the alt-text-scan plugin.

import type {Page} from 'playwright'

// The scanner's Finding shape. Mirrors the structure of
// accessibility-scanner/.github/actions/find/src/types.d.ts
export type Finding = {
  scannerType: string
  ruleId?: string
  url: string
  html?: string
  problemShort: string
  problemUrl: string
  solutionShort: string
  solutionLong?: string
  screenshotId?: string
}

// The arguments the scanner passes to a plugin's default export.
export type PluginArgs = {
  page: Page
  addFinding: (finding: Finding) => Promise<void>
}

// Normalized representation of one <img> on the page.
export type ImageRecord = {
  src: string | null
  alt: string | null
  role: string | null
  ariaHidden: boolean
  ariaLabel: string | null
  ariaLabelledBy: string | null
  outerHTML: string
}

// Input handed to every rule's evaluate() function.
export type RuleContext = {
  url: string
  images: ImageRecord[]
}

// What a rule emits per offending image. Translated to Finding in findings.ts.
export type RuleResult = {
  image: ImageRecord
  problemShort: string
  solutionShort: string
  solutionLong?: string
}

// A rule is a pure, synchronous function over RuleContext.
export type Rule = {
  id: string
  problemUrl: string
  evaluate(ctx: RuleContext): RuleResult[]
}
