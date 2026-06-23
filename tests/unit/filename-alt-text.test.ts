import {describe, it, expect} from 'vitest'
import {filenameAltText} from '../../src/rules/filename-alt-text.js'
import {evaluateAlts} from '../utils/helpers.js'

describe('filename-alt-text', () => {
  it('flags a .png filename as alt text', () => {
    expect(evaluateAlts(['12345.png'], filenameAltText)).toHaveLength(1)
  })

  it('flags a screenshot filename', () => {
    expect(evaluateAlts(['Screenshot 2024-04-28.jpg'], filenameAltText)).toHaveLength(1)
  })

  it('does not flag a meaningful description', () => {
    expect(evaluateAlts(['A dog playing in the park'], filenameAltText)).toHaveLength(0)
  })

  it('does not flag an empty string alt', () => {
    expect(evaluateAlts([''], filenameAltText)).toHaveLength(0)
  })

  it('does not flag a null alt', () => {
    expect(evaluateAlts([null], filenameAltText)).toHaveLength(0)
  })
})
