import type {Rule, RuleResult, RuleContext} from '../types.js'

export const missingAltText: Rule = {
  id: 'missing-alt-text',
  problemUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/non-text-content.html',
  evaluate(context: RuleContext): RuleResult[] {
    const results: RuleResult[] = []

    for (const image of context.images) {
      // alt === '' is intentional to mark an image as decorative, so only flag if alt is
      // completely missing
      if (image.alt !== null) continue

      results.push({
        image,
        problemShort: 'Image is missing an alt attribute.',
        solutionShort: 'Add an alt attribute describing the image, or alt="" if it is purely decorative.',
      })
    }

    return results
  },
}
