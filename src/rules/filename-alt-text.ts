// filename-alt-text — flags alt text that is just an image filename (e.g. "hero.png").

import type {Rule, RuleResult, RuleContext} from '../types.js'

const FILENAME_PATTERN = /\.(png|jpg|jpeg|gif|svg|webp|bmp|ico)$/i

export const filenameAltText: Rule = {
  id: 'filename-alt-text',
  problemUrl: 'https://www.w3.org/WAI/tutorials/images/decision-tree/',
  evaluate(context: RuleContext): RuleResult[] {
    const results: RuleResult[] = []

    for (const image of context.images) {
      if (image.alt === null || image.alt === '') continue
      if (!FILENAME_PATTERN.test(image.alt.trim())) continue

      results.push({
        image,
        problemShort: `Image alt text appears to be a filename: "${image.alt}"`,
        solutionShort: 'Replace the filename with a meaningful description of the image content.',
      })
    }

    return results
  },
}
