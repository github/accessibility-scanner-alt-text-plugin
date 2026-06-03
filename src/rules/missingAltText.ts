import type {Rule, RuleResult, RuleContext} from '../types.js'

export const missingAltText: Rule = {
  id: 'missing-alt-text',
  problemUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/non-text-content.html',
  evaluate(context: RuleContext): RuleResult[] {
    const results: RuleResult[] = []

    for (const image of context.images) {
      // alt === '' is intentional to mark an image as decorative
      if (image.alt === '') continue
      // alt text has real content, so skip
      if (image.alt !== null && image.alt.trim() !== '') continue

      results.push({
        image,
        problemShort: 'Image has no usable alt text (attribute is missing or whitespace-only).',
        solutionShort: 'Add an alt attribute describing the image, or alt="" if it is purely decorative.',
      })
    }

    return results
  },
}
