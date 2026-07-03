// repeated-alt-text — flags runs of adjacent images that share identical alt text,
// which usually means one caption was copied across a group of distinct images.

import type {ImageRecord, Rule, RuleResult} from '../types.js'
import {normalizeAltText} from '../utils/normalize-alt-text.js'

// Minimum number of consecutive images sharing the same alt before the run is flagged.
const MIN_RUN_LENGTH = 2

// Two adjacent images extend a "run" only if the gap between their bounding boxes is at
// most this multiple of the larger box's longest dimension.
const GAP_MULTIPLIER = 3

// Returns true when two images are far enough apart on screen that a user
// would not perceive them as part of the same repeating group. Fails open
// when either image lacks a measurable layout box: with no spatial data we
// fall back to the pre-spatial behavior rather than silently dropping a run.
function tooFarApart(a: ImageRecord, b: ImageRecord): boolean {
  if (!a.boundingBox || !b.boundingBox) return false

  const aRight = a.boundingBox.x + a.boundingBox.width
  const aBottom = a.boundingBox.y + a.boundingBox.height
  const bRight = b.boundingBox.x + b.boundingBox.width
  const bBottom = b.boundingBox.y + b.boundingBox.height

  const horizontalGap = Math.max(0, Math.max(a.boundingBox.x, b.boundingBox.x) - Math.min(aRight, bRight))
  const verticalGap = Math.max(0, Math.max(a.boundingBox.y, b.boundingBox.y) - Math.min(aBottom, bBottom))

  const gap = Math.max(horizontalGap, verticalGap)
  const largerDim = Math.max(a.boundingBox.width, a.boundingBox.height, b.boundingBox.width, b.boundingBox.height)

  return gap > GAP_MULTIPLIER * largerDim
}

export const repeatedAltText: Rule = {
  id: 'repeated-alt-text',
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

      // Detect length of consecutive alt texts
      let j = i + 1
      while (j < images.length) {
        const next = images[j]!.alt
        const nextAlt = next === null ? '' : normalizeAltText(next)
        if (nextAlt !== currAlt) break
        if (tooFarApart(images[j - 1]!, images[j]!)) break
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
