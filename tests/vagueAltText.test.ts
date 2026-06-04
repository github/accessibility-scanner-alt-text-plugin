import {describe, it, expect} from 'vitest'
import {vagueAltText} from '../src/rules/vagueAltText.js'
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
 * Wraps each alt string in an ImageRecord object and runs vagueAltText
 * against the resulting set. Returns the rule's findings.
 */
function evaluateAlts(alts: (string | null)[]) {
  const context: RuleContext = {
    url: 'https://example.com',
    images: alts.map(alt => makeImage({alt})),
  }
  return vagueAltText.evaluate(context)
}

describe('vagueAltText', () => {
  describe('flags vague single-word alt text', () => {
    it.each(['image', 'photo', 'picture', 'icon', 'logo', 'chart', 'screenshot', 'untitled', 'below'])(
      'flags alt="%s"',
      alt => {
        const results = evaluateAlts([alt])
        expect(results).toHaveLength(1)
        expect(results[0]!.image.alt).toBe(alt)
      },
    )
  })

  describe('flags vague multi-word phrases', () => {
    it.each(['an image', 'an image of', 'a photo of', 'image of', 'screenshot of'])('flags alt="%s"', alt => {
      const results = evaluateAlts([alt])
      expect(results).toHaveLength(1)
    })
  })

  describe('flags after normalization', () => {
    it('is case-insensitive', () => {
      expect(evaluateAlts(['Image'])).toHaveLength(1)
      expect(evaluateAlts(['PHOTO'])).toHaveLength(1)
      expect(evaluateAlts(['ScReEnShOt'])).toHaveLength(1)
    })

    it('trims surrounding whitespace', () => {
      expect(evaluateAlts(['  image  '])).toHaveLength(1)
      expect(evaluateAlts(['\timage\n'])).toHaveLength(1)
    })

    it('collapses internal whitespace', () => {
      expect(evaluateAlts(['an  image'])).toHaveLength(1)
      expect(evaluateAlts(['a   photo   of'])).toHaveLength(1)
    })

    it('strips trailing punctuation', () => {
      expect(evaluateAlts(['image.'])).toHaveLength(1)
      expect(evaluateAlts(['image .'])).toHaveLength(1)
      expect(evaluateAlts(['photo!'])).toHaveLength(1)
      expect(evaluateAlts(['icon...'])).toHaveLength(1)
    })
  })

  describe('should not flag non-vague alt text', () => {
    it('null alt', () => {
      expect(evaluateAlts([null])).toHaveLength(0)
    })

    it('empty alt', () => {
      expect(evaluateAlts([''])).toHaveLength(0)
    })

    it('whitespace-only alt', () => {
      expect(evaluateAlts(['   '])).toHaveLength(0)
      expect(evaluateAlts(['\t\n'])).toHaveLength(0)
    })

    it('descriptive alt text', () => {
      expect(evaluateAlts(['A golden retriever wearing a red bandana'])).toHaveLength(0)
      expect(evaluateAlts(['Quarterly revenue chart for 2025'])).toHaveLength(0)
    })

    it('alt text that contains a vague word, but is not vague by itself', () => {
      expect(evaluateAlts(['Profile photo of Ada Lovelace'])).toHaveLength(0)
      expect(evaluateAlts(['Screenshot of the GitHub home page'])).toHaveLength(0)
    })

    it('placeholder words that now live in placeholder-alt-text', () => {
      expect(evaluateAlts(['todo'])).toHaveLength(0)
      expect(evaluateAlts(['tbd'])).toHaveLength(0)
      expect(evaluateAlts(['fixme'])).toHaveLength(0)
      expect(evaluateAlts(['placeholder'])).toHaveLength(0)
    })
  })

  describe('output shape', () => {
    it('returns one result per offending image, and preserves the image reference', () => {
      const context: RuleContext = {
        url: 'example website',
        images: [
          makeImage({alt: 'image', src: 'a.png'}),
          makeImage({alt: 'A descriptive caption', src: 'b.png'}),
          makeImage({alt: 'photo', src: 'c.png'}),
        ],
      }
      const results = vagueAltText.evaluate(context)
      expect(results).toHaveLength(2)
      expect(results.map(r => r.image.src)).toEqual(['a.png', 'c.png'])
    })

    it('includes the offending alt text in problemShort', () => {
      const [result] = evaluateAlts(['image'])
      expect(result!.problemShort).toContain('image')
    })

    it('includes a solutionShort', () => {
      const [result] = evaluateAlts(['image'])
      expect(result!.solutionShort).toBeTruthy()
    })
  })

  describe('rule metadata', () => {
    it('has a stable id', () => {
      expect(vagueAltText.id).toBe('vague-alt')
    })

    it('points problemUrl correctly', () => {
      expect(vagueAltText.problemUrl).toContain('non-text-content')
    })
  })
})
