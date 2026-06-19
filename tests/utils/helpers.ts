import type {ImageRecord, Rule, RuleContext, RuleResult} from '../../src/types.js'

/**
 * Builds an ImageRecord with default values so each test only specifies
 * the fields relevant to it.
 */
export function makeImage(overrides: Partial<ImageRecord> = {}): ImageRecord {
  return {
    src: 'https://example.com/image.png',
    alt: null,
    role: null,
    ariaHidden: false,
    ariaLabel: null,
    ariaLabelledBy: null,
    outerHTML: '<img>',
    boundingBox: null,
    naturalWidth: 0,
    naturalHeight: 0,
    inLink: null,
    inButton: false,
    figcaption: null,
    nearbyText: null,
    pageTitle: null,
    sectionHeading: null,
    ...overrides,
  }
}

/**
 * Wraps each alt string in an ImageRecord and runs the given rule against
 * the resulting set. Returns the rule's findings.
 *
 * Helper is for synchronous rules only — it asserts the rule returned an
 * array, not a Promise. Async rules (e.g. alt-text-quality) provide their
 * own test scaffolding.
 */
export function evaluateAlts(alts: (string | null)[], rule: Rule): RuleResult[] {
  const context: RuleContext = {
    url: 'https://example.com',
    images: alts.map(alt => makeImage({alt})),
  }
  return runSync(rule, context)
}

/**
 * Runs the given rule against a pre-built set of ImageRecords. Use when a
 * test needs control over fields beyond `alt` (e.g. boundingBox).
 */
export function evaluateImages(images: ImageRecord[], rule: Rule): RuleResult[] {
  return runSync(rule, {url: 'https://example.com', images})
}

function runSync(rule: Rule, context: RuleContext): RuleResult[] {
  const result = rule.evaluate(context)
  if (result instanceof Promise) {
    throw new Error(
      `[test helper] rule "${rule.id}" returned a Promise; evaluateAlts/evaluateImages support sync rules only`,
    )
  }
  return result
}
