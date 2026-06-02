import type {Rule, RuleResult} from '../types.js'
import {normalizeAltText} from '../utils/normalizeAltText.js'

// Minimum number of consecutive images sharing the same alt before the run is flagged.
// Two repeats could be a coincidence, but three is more likely to be an issue.
const MIN_RUN_LENGTH = 3

export const repeatedAltText: Rule = {
  id: 'repeated-alt',
  problemUrl: 'https://www.w3.org/WAI/tutorials/images/groups/',
  evaluate(context): RuleResult[] {
    const findings: RuleResult[] = []
    const {images} = context

    let i = 0
    while (i < images.length) {
      // Normalize once and don't consider empty alt texts in run length
      const start = images[i]!.alt
      const currAlt = start === null ? '' : normalizeAltText(start)
      if (currAlt === '') {
        i++
        continue
      }

      // Detect length of run
      let j = i + 1
      while (j < images.length) {
        const next = images[j]!.alt
        const nextAlt = next === null ? '' : normalizeAltText(next)
        if (nextAlt !== currAlt) break
        j++
      }

      const runLength = j - i
      if (runLength >= MIN_RUN_LENGTH) {
        // Flag every image in the run except the first
        for (let k = i + 1; k < j; k++) {
          const img = images[k]!
          findings.push({
            image: img,
            problemShort: `Alt text is repeated across ${runLength} consecutive images:\n"${img.alt}"`,
            solutionShort:
              'If these images form one visual group, describe the group once and mark repeated/decorative images with `alt=""`. Otherwise, give each image unique alt text.',
          })
        }
      }
      i = j
    }
    return findings
  },
}
