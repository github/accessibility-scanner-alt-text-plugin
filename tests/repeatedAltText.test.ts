import {describe, it, expect} from 'vitest'
import {repeatedAltText} from '../src/rules/repeatedAltText.js'
import type {ImageRecord, RuleContext} from '../src/types.js'

/**
 * Builds an ImageRecord with default values so each test only specifies
 * relevant fields.
 */
function makeImage(overrides: Partial<ImageRecord> = {}): ImageRecord {
  return {
    src: 'https://example.com/image.png',
    alt: null,
    role: null,
    ariaHidden: false,
    ariaLabel: null,
    ariaLabelledBy: null,
    outerHTML: '<img>',
    ...overrides,
  }
}

/**
 * Wraps each alt string in an ImageRecord and runs repeatedAltText
 * against the resulting set. Returns the rule's findings.
 */
function evaluateAlts(alts: (string | null)[]) {
  const context: RuleContext = {
    url: 'https://example.com',
    images: alts.map(alt => makeImage({alt})),
  }
  return repeatedAltText.evaluate(context)
}

describe('repeatedAltText', () => {
  describe('flags runs at or above the minimum length', () => {
    it('flags a run of exactly 3 identical alts (2 findings)', () => {
      const results = evaluateAlts(['3/5 stars', '3/5 stars', '3/5 stars'])
      expect(results).toHaveLength(2)
    })

    it('flags a run of 5 identical alts (4 findings)', () => {
      const results = evaluateAlts(['star', 'star', 'star', 'star', 'star'])
      expect(results).toHaveLength(4)
    })

    it('does not flag the first image in the run', () => {
      const alts = ['star', 'star', 'star']
      const results = evaluateAlts(alts)

      // The first image is considered legitimate, so only the duplicates are flagged.
      expect(results.every(r => r.image.alt === 'star')).toBe(true)
      expect(results).toHaveLength(2)
    })
  })

  describe('does not flag runs below the minimum length', () => {
    it('does not flag a single image', () => {
      expect(evaluateAlts(['only one'])).toHaveLength(0)
    })

    it('does not flag a run of 2 identical alts', () => {
      expect(evaluateAlts(['logo', 'logo'])).toHaveLength(0)
    })

    it('does not flag an empty images array', () => {
      expect(evaluateAlts([])).toHaveLength(0)
    })
  })

  describe('normalization', () => {
    it('treats differently-cased alts as the same run', () => {
      expect(evaluateAlts(['Star', 'STAR', 'star'])).toHaveLength(2)
    })

    it('treats alts differing only in whitespace as the same run', () => {
      expect(evaluateAlts(['  star  ', 'star', 'star\t'])).toHaveLength(2)
    })

    it('treats alts differing only in trailing punctuation as the same run', () => {
      expect(evaluateAlts(['star.', 'star!', 'star...'])).toHaveLength(2)
    })
  })

  describe('run breakers', () => {
    it('a different alt in the middle breaks the run', () => {
      expect(evaluateAlts(['star', 'star', 'moon', 'star', 'star'])).toHaveLength(0)
    })

    it('a null alt in the middle breaks the run', () => {
      expect(evaluateAlts(['star', 'star', null, 'star', 'star'])).toHaveLength(0)
    })

    it('an empty alt in the middle breaks the run', () => {
      expect(evaluateAlts(['star', 'star', '', 'star', 'star'])).toHaveLength(0)
    })

    it('a whitespace-only alt in the middle breaks the run', () => {
      expect(evaluateAlts(['star', 'star', '   ', 'star', 'star'])).toHaveLength(0)
    })

    it('detects two separate runs in the same array', () => {
      expect(evaluateAlts(['a', 'a', 'a', 'b', 'b', 'b'])).toHaveLength(4)
    })
  })

  describe('does not flag null / empty / whitespace-only alts', () => {
    it('does not flag a run of null alts', () => {
      expect(evaluateAlts([null, null, null, null])).toHaveLength(0)
    })

    it('does not flag a run of empty alts', () => {
      expect(evaluateAlts(['', '', '', ''])).toHaveLength(0)
    })

    it('does not flag a run of whitespace-only alts', () => {
      expect(evaluateAlts(['  ', '\t', '\n'])).toHaveLength(0)
    })
  })

  describe('output shape', () => {
    it('includes the offending image and a helpful message', () => {
      const [first] = evaluateAlts(['star', 'star', 'star'])
      expect(first).toBeDefined()
      expect(first!.image.alt).toBe('star')
      expect(first!.problemShort).toContain('repeated')
      expect(first!.problemShort).toContain('star')
      expect(first!.solutionShort).toContain('alt=""')
    })

    it('reports the run length in the problem message', () => {
      const [first] = evaluateAlts(['x', 'x', 'x', 'x', 'x'])
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
