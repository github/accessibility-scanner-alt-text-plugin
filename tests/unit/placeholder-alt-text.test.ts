import {describe, it, expect} from 'vitest'
import {placeholderAltText} from '../../src/rules/placeholder-alt-text.js'
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

const placeholders = ['todo', 'tbd', 'placeholder', 'alt text', 'insert alt text', 'image alt', 'fixme']

describe('placeholder-alt-text', () => {
  for (const placeholder of placeholders) {
    it(`flags "${placeholder}" as placeholder alt text`, () => {
      expect(placeholderAltText.evaluate(makeContext(placeholder))).toHaveLength(1)
    })
  }

  it('matches case-insensitively', () => {
    expect(placeholderAltText.evaluate(makeContext('TODO'))).toHaveLength(1)
    expect(placeholderAltText.evaluate(makeContext('Placeholder'))).toHaveLength(1)
    expect(placeholderAltText.evaluate(makeContext('Insert Alt Text'))).toHaveLength(1)
  })

  it('matches with surrounding whitespace', () => {
    expect(placeholderAltText.evaluate(makeContext('  todo  '))).toHaveLength(1)
    expect(placeholderAltText.evaluate(makeContext('\tTBD\n'))).toHaveLength(1)
  })

  it('includes a solutionShort telling the engineer to replace the placeholder', () => {
    const [result] = placeholderAltText.evaluate(makeContext('todo'))
    expect(result.solutionShort).toContain('Replace the placeholder')
  })

  it('does not flag a meaningful description', () => {
    expect(placeholderAltText.evaluate(makeContext('A dog playing in the park'))).toHaveLength(0)
  })

  it('does not flag an empty string alt', () => {
    expect(placeholderAltText.evaluate(makeContext(''))).toHaveLength(0)
  })

  it('does not flag a null alt', () => {
    expect(placeholderAltText.evaluate(makeContext(null))).toHaveLength(0)
  })
})
