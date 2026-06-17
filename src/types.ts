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

  // Surrounding context — populated by extractImages and consumed by rules
  // that need to know how the image relates to its neighbours (notably
  // alt-text-quality, which must distinguish functional images, captioned
  // images, and prose-adjacent images).

  // Closest ancestor <a href="…">. Null when the image is not in a link.
  inLink: {href: string} | null
  // True when the image's closest ancestor button (HTML <button> or
  // role="button") exists. Used together with inLink for "functional image"
  // detection.
  inButton: boolean
  // Trimmed text content of an associated <figcaption> (image inside a
  // <figure> with a sibling <figcaption>). Null when no figcaption exists.
  figcaption: string | null
  // Trimmed text content of the closest enclosing block-level element,
  // truncated for prompt size. Null when no nearby text exists.
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

// A rule evaluates a RuleContext and returns its findings. Most rules are
// pure and synchronous; rules that call out to a model or other I/O may
// return a Promise. The plugin entry awaits both shapes uniformly.
export type Rule = {
  id: string
  problemUrl: string
  // Whether the rule runs when the consumer hasn't explicitly configured it.
  defaultEnabled?: boolean
  evaluate(ctx: RuleContext): RuleResult[] | Promise<RuleResult[]>
}
