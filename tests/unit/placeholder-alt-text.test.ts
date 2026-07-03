import {describe, it, expect} from 'vitest'
import {placeholderAltText} from '../../src/rules/placeholder-alt-text.js'
import {evaluateAlts} from '../utils/helpers.js'

const placeholders = [
  'todo',
  'tbd',
  'fixme',
  'placeholder',
  'alt text',
  'image alt',
  'insert alt text',
  'insert image',
  'insert photo',
  'image goes here',
  'photo goes here',
  'picture goes here',
  'your image here',
  'your photo here',
  'sample',
  'example',
  'test',
  'demo',
  'default',
  'untitled',
  'null',
  'undefined',
  'none',
]

describe('placeholder-alt-text', () => {
  for (const placeholder of placeholders) {
    it(`flags "${placeholder}" as placeholder alt text`, () => {
      expect(evaluateAlts([placeholder], placeholderAltText)).toHaveLength(1)
    })
  }

  it('matches case-insensitively', () => {
    expect(evaluateAlts(['TODO'], placeholderAltText)).toHaveLength(1)
    expect(evaluateAlts(['Placeholder'], placeholderAltText)).toHaveLength(1)
    expect(evaluateAlts(['Insert Alt Text'], placeholderAltText)).toHaveLength(1)
  })

  it('matches with surrounding whitespace', () => {
    expect(evaluateAlts(['  todo  '], placeholderAltText)).toHaveLength(1)
    expect(evaluateAlts(['\tTBD\n'], placeholderAltText)).toHaveLength(1)
  })

  it('includes a solutionShort telling the engineer to replace the placeholder', () => {
    const [result] = evaluateAlts(['todo'], placeholderAltText)
    expect(result).toBeDefined()
    expect(result!.solutionShort).toContain('Replace the placeholder')
  })

  it('does not flag a meaningful description', () => {
    expect(evaluateAlts(['A dog playing in the park'], placeholderAltText)).toHaveLength(0)
  })

  it('does not flag an empty string alt', () => {
    expect(evaluateAlts([''], placeholderAltText)).toHaveLength(0)
  })

  it('does not flag a null alt', () => {
    expect(evaluateAlts([null], placeholderAltText)).toHaveLength(0)
  })
})
