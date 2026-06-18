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
  boundingBox: BoundingBox | null
  // Intrinsic (natural) pixel dimensions of the image bitmap, independent of
  // CSS rendering. 0 when unknown (e.g. some SVGs, broken or not-yet-loaded
  // images). Used to skip images too small to be worth model-backed judging.
  naturalWidth: number
  naturalHeight: number

  inLink: {href: string} | null
  // True when the image's closest ancestor button exists. Used together with inLink for "functional image" detection.
  inButton: boolean
  // Trimmed text content of an associated <figcaption>, if it exists.
  figcaption: string | null
  // Trimmed text content of the closest enclosing block-level element.
  nearbyText: string | null
}

// Pixel position and size of an image in the page's rendered layout.
export type BoundingBox = {
  x: number
  y: number
  width: number
  height: number
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

// A rule evaluates a RuleContext and returns its findings.
export type Rule = {
  id: string
  problemUrl: string
  // Whether the rule runs when the consumer hasn't explicitly configured it.
  defaultEnabled?: boolean
  evaluate(ctx: RuleContext): RuleResult[] | Promise<RuleResult[]>
}
