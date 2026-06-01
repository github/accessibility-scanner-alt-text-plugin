import type {Rule, RuleResult, RuleContext} from '../types.js'

const FILENAME_PATTERN = /\.[a-z]{2,4}$/i

export const filenameAltText: Rule = {
  id: 'filename-alt-text',
  problemUrl: 'https://www.w3.org/WAI/tutorials/images/decision-tree/',
  evaluate(ctx: RuleContext): RuleResult[] {
    const results: RuleResult[] = []

    for (const image of ctx.images) {
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