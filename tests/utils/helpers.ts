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
    ...overrides,
  }
}

/**
 * Wraps each alt string in an ImageRecord and runs the given rule against
 * the resulting set. Returns the rule's findings.
 */
export function evaluateAlts(alts: (string | null)[], rule: Rule): RuleResult[] {
  const context: RuleContext = {
    url: 'https://example.com',
    images: alts.map(alt => makeImage({alt})),
  }
  return rule.evaluate(context)
}
