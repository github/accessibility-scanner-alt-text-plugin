// placeholder-alt-text — flags alt text left as placeholder/boilerplate (e.g. "TODO", "alt text").

import type {Rule, RuleResult, RuleContext} from '../types.js'
import {normalizeAltText} from '../utils/normalize-alt-text.js'

// Known placeholder/boilerplate strings that signal the alt text was never written.
const PLACEHOLDER_ALT_TEXT = new Set([
  // Author-facing stubs
  'todo',
  'tbd',
  'fixme',
  'placeholder',
  'alt text',
  'image alt',

  // "Fill me in" template prompts
  'insert alt text',
  'insert image',
  'insert photo',
  'image goes here',
  'photo goes here',
  'picture goes here',
  'your image here',
  'your photo here',

  // Dummy / default values
  'sample',
  'example',
  'test',
  'demo',
  'default',
  'untitled',
  'null',
  'undefined',
  'none',
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
