import type {Rule, RuleResult, RuleContext} from '../types.js'
import {normalizeAltText} from './vagueAltText.js'

// Known placeholder/boilerplate strings that signal the alt text was never written.
const PLACEHOLDER_ALT_TEXT = new Set([
  'todo',
  'tbd',
  'placeholder',
  'alt text',
  'insert alt text',
  'image alt',
  'fixme',
])

export const placeholderAltText: Rule = {
  id: 'placeholder-alt-text',
  problemUrl: 'https://www.w3.org/WAI/tutorials/images/decision-tree/',
  evaluate(context: RuleContext): RuleResult[] {
    const results: RuleResult[] = []

    for (const image of context.images) {
      if (image.alt === null || image.alt === '') continue
      if (!PLACEHOLDER_ALT_TEXT.has(normalizeAltText(image.alt))) continue

      results.push({
        image,
        problemShort: `Image alt text is placeholder text: "${image.alt}"`,
        solutionShort: 'Replace the placeholder with a meaningful description of the image content.',
      })
    }

    return results
  },
}
