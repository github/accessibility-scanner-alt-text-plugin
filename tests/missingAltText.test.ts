import {describe, it, expect} from 'vitest'
import {missingAltText} from '../src/rules/missingAltText.js'
import type {RuleContext} from '../src/types.js'

const baseImage = {
  src: 'https://example.com/image.png',
  role: null,
  ariaHidden: false,
  ariaLabel: null,
  ariaLabelledBy: null,
  outerHTML: '<img>',
}

function makeContext(alts: (string | null)[]): RuleContext {
  return {
    url: 'https://example.com',
    images: alts.map((alt, i) => ({...baseImage, alt, src: `image-${i}.png`})),
  }
}

describe('missing-alt-text', () => {
  it('flags an image with no alt attribute (alt === null)', () => {
    expect(missingAltText.evaluate(makeContext([null]))).toHaveLength(1)
  })

  it('does not flag alt="" (decorative)', () => {
    expect(missingAltText.evaluate(makeContext(['']))).toHaveLength(0)
  })

  it('does not flag descriptive alt text', () => {
    expect(missingAltText.evaluate(makeContext(['A dog playing in the park']))).toHaveLength(0)
  })

  it('flags whitespace-only alt', () => {
    expect(missingAltText.evaluate(makeContext(['   ']))).toHaveLength(1)
  })

  it('returns one result per missing-alt image and preserves order', () => {
    const results = missingAltText.evaluate(makeContext([null, 'a dog', null, '', null]))
    expect(results).toHaveLength(3)
    expect(results.map(r => r.image.src)).toEqual(['image-0.png', 'image-2.png', 'image-4.png'])
  })
})
