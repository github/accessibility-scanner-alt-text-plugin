import {describe, it, expect} from 'vitest'
import {filenameAltText} from '../../src/rules/filename-alt-text.js'
import type {RuleContext} from '../../src/types.js'

const baseImage = {
  src: 'https://example.com/image.png',
  role: null,
  ariaHidden: false,
  ariaLabel: null,
  ariaLabelledBy: null,
  outerHTML: '<img>',
}

function makeContext(alt: string | null): RuleContext {
  return {url: 'https://example.com', images: [{...baseImage, alt}]}
}

describe('filename-alt-text', () => {
  it('flags a .png filename as alt text', () => {
    expect(filenameAltText.evaluate(makeContext('12345.png'))).toHaveLength(1)
  })

  it('flags a screenshot filename', () => {
    expect(filenameAltText.evaluate(makeContext('Screenshot 2024-04-28.jpg'))).toHaveLength(1)
  })

  it('does not flag a meaningful description', () => {
    expect(filenameAltText.evaluate(makeContext('A dog playing in the park'))).toHaveLength(0)
  })

  it('does not flag an empty string alt', () => {
    expect(filenameAltText.evaluate(makeContext(''))).toHaveLength(0)
  })

  it('does not flag a null alt', () => {
    expect(filenameAltText.evaluate(makeContext(null))).toHaveLength(0)
  })
})
