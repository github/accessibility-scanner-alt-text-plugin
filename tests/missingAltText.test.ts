import {describe, it, expect} from 'vitest'
import {missingAltText} from '../src/rules/missingAltText.js'
import type {RuleContext} from '../src/types.js'
import {evaluateAlts, makeImage} from './utils/helpers.js'

describe('missing-alt-text', () => {
  it('flags an image with no alt attribute (alt === null)', () => {
    expect(evaluateAlts([null], missingAltText)).toHaveLength(1)
  })

  it('does not flag alt="" (decorative)', () => {
    expect(evaluateAlts([''], missingAltText)).toHaveLength(0)
  })

  it('does not flag descriptive alt text', () => {
    expect(evaluateAlts(['A dog playing in the park'], missingAltText)).toHaveLength(0)
  })

  it('flags whitespace-only alt', () => {
    expect(evaluateAlts(['   '], missingAltText)).toHaveLength(1)
  })

  it('returns one result per missing-alt image and preserves order', () => {
    const context: RuleContext = {
      url: 'https://example.com',
      images: [null, 'a dog', null, '', null].map((alt, i) => makeImage({alt, src: `image-${i}.png`})),
    }
    const results = missingAltText.evaluate(context)
    expect(results).toHaveLength(3)
    expect(results.map(r => r.image.src)).toEqual(['image-0.png', 'image-2.png', 'image-4.png'])
  })
})
