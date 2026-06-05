import {describe, it, expect} from 'vitest'
import {repeatedAltText} from '../../src/rules/repeated-alt-text.js'
import {evaluateAlts} from '../utils/helpers.js'

describe('repeatedAltText', () => {
  describe('flags runs at or above the minimum length', () => {
    it('flags a run of exactly 3 identical alts (2 findings)', () => {
      const results = evaluateAlts(['3/5 stars', '3/5 stars', '3/5 stars'], repeatedAltText)
      expect(results).toHaveLength(2)
    })

    it('flags a run of 5 identical alts (4 findings)', () => {
      const results = evaluateAlts(['star', 'star', 'star', 'star', 'star'], repeatedAltText)
      expect(results).toHaveLength(4)
    })

    it('does not flag the first image in the run', () => {
      const alts = ['star', 'star', 'star']
      const results = evaluateAlts(alts, repeatedAltText)

      // The first image is considered legitimate, so only the duplicates are flagged.
      expect(results.every(r => r.image.alt === 'star')).toBe(true)
      expect(results).toHaveLength(2)
    })
  })

  describe('does not flag runs below the minimum length', () => {
    it('does not flag a single image', () => {
      expect(evaluateAlts(['only one'], repeatedAltText)).toHaveLength(0)
    })

    it('does not flag an empty images array', () => {
      expect(evaluateAlts([], repeatedAltText)).toHaveLength(0)
    })
  })

  describe('normalization', () => {
    it('treats differently-cased alts as the same run', () => {
      expect(evaluateAlts(['Star', 'STAR', 'star'], repeatedAltText)).toHaveLength(2)
    })

    it('treats alts differing only in whitespace as the same run', () => {
      expect(evaluateAlts(['  star  ', 'star', 'star\t'], repeatedAltText)).toHaveLength(2)
    })

    it('treats alts differing only in trailing punctuation as the same run', () => {
      expect(evaluateAlts(['star.', 'star!', 'star...'], repeatedAltText)).toHaveLength(2)
    })

    it('treats alts differing only in leading punctuation as the same run', () => {
      expect(evaluateAlts(['"star"', '(star)', 'star'], repeatedAltText)).toHaveLength(2)
    })
  })

  describe('run breakers', () => {
    it('a different alt in the middle breaks the run', () => {
      expect(evaluateAlts(['star', 'star', 'moon', 'star', 'star'], repeatedAltText)).toHaveLength(2)
    })

    it('a null alt in the middle breaks the run', () => {
      expect(evaluateAlts(['star', 'star', null, 'star', 'star'], repeatedAltText)).toHaveLength(2)
    })

    it('an empty alt in the middle breaks the run', () => {
      expect(evaluateAlts(['star', 'star', '', 'star', 'star'], repeatedAltText)).toHaveLength(2)
    })

    it('a whitespace-only alt in the middle breaks the run', () => {
      expect(evaluateAlts(['star', 'star', '   ', 'star', 'star'], repeatedAltText)).toHaveLength(2)
    })

    it('detects two separate runs in the same array', () => {
      expect(evaluateAlts(['a', 'a', 'a', 'b', 'b', 'b'], repeatedAltText)).toHaveLength(4)
    })
  })

  describe('does not flag null / empty / whitespace-only alts', () => {
    it('does not flag a run of null alts', () => {
      expect(evaluateAlts([null, null, null, null], repeatedAltText)).toHaveLength(0)
    })

    it('does not flag a run of empty alts', () => {
      expect(evaluateAlts(['', '', '', ''], repeatedAltText)).toHaveLength(0)
    })

    it('does not flag a run of whitespace-only alts', () => {
      expect(evaluateAlts(['  ', '\t', '\n'], repeatedAltText)).toHaveLength(0)
    })
  })

  describe('output shape', () => {
    it('includes the offending image and a helpful message', () => {
      const [first] = evaluateAlts(['star', 'star', 'star'], repeatedAltText)
      expect(first).toBeDefined()
      expect(first!.image.alt).toBe('star')
      expect(first!.problemShort).toContain('repeated')
      expect(first!.problemShort).toContain('star')
      expect(first!.solutionShort).toContain('alt=""')
    })

    it('reports the run length in the problem message', () => {
      const [first] = evaluateAlts(['x', 'x', 'x', 'x', 'x'], repeatedAltText)
      expect(first!.problemShort).toContain('5')
    })
  })

  describe('rule metadata', () => {
    it('has the expected id', () => {
      expect(repeatedAltText.id).toBe('repeated-alt')
    })

    it('has a problemUrl pointing at a WCAG / W3C resource', () => {
      expect(repeatedAltText.problemUrl).toMatch(/^https:\/\/www\.w3\.org\//)
    })
  })
})
