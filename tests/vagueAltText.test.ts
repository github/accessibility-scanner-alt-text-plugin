import {describe, it, expect} from 'vitest'
import {vagueAltText} from '../src/rules/vagueAltText.js'
import type {RuleContext} from '../src/types.js'
import {evaluateAlts, makeImage} from './utils/helpers.js'

describe('vagueAltText', () => {
  describe('flags vague single-word alt text', () => {
    it.each(['image', 'photo', 'picture', 'icon', 'logo', 'chart', 'screenshot', 'untitled', 'below'])(
      'flags alt="%s"',
      alt => {
        const results = evaluateAlts([alt], vagueAltText)
        expect(results).toHaveLength(1)
        expect(results[0]).toBeDefined()
        expect(results[0]!.image.alt).toBe(alt)
      },
    )
  })

  describe('flags vague multi-word phrases', () => {
    it.each(['an image', 'an image of', 'a photo of', 'image of', 'screenshot of'])('flags alt="%s"', alt => {
      const results = evaluateAlts([alt], vagueAltText)
      expect(results).toHaveLength(1)
    })
  })

  describe('flags after normalization', () => {
    it('is case-insensitive', () => {
      expect(evaluateAlts(['Image'], vagueAltText)).toHaveLength(1)
      expect(evaluateAlts(['PHOTO'], vagueAltText)).toHaveLength(1)
      expect(evaluateAlts(['ScReEnShOt'], vagueAltText)).toHaveLength(1)
    })

    it('trims surrounding whitespace', () => {
      expect(evaluateAlts(['  image  '], vagueAltText)).toHaveLength(1)
      expect(evaluateAlts(['\timage\n'], vagueAltText)).toHaveLength(1)
    })

    it('collapses internal whitespace', () => {
      expect(evaluateAlts(['an  image'], vagueAltText)).toHaveLength(1)
      expect(evaluateAlts(['a   photo   of'], vagueAltText)).toHaveLength(1)
    })

    it('strips trailing punctuation', () => {
      expect(evaluateAlts(['image.'], vagueAltText)).toHaveLength(1)
      expect(evaluateAlts(['image .'], vagueAltText)).toHaveLength(1)
      expect(evaluateAlts(['photo!'], vagueAltText)).toHaveLength(1)
      expect(evaluateAlts(['icon...'], vagueAltText)).toHaveLength(1)
    })
  })

  describe('should not flag non-vague alt text', () => {
    it('null alt', () => {
      expect(evaluateAlts([null], vagueAltText)).toHaveLength(0)
    })

    it('empty alt', () => {
      expect(evaluateAlts([''], vagueAltText)).toHaveLength(0)
    })

    it('whitespace-only alt', () => {
      expect(evaluateAlts(['   '], vagueAltText)).toHaveLength(0)
      expect(evaluateAlts(['\t\n'], vagueAltText)).toHaveLength(0)
    })

    it('descriptive alt text', () => {
      expect(evaluateAlts(['A golden retriever wearing a red bandana'], vagueAltText)).toHaveLength(0)
      expect(evaluateAlts(['Quarterly revenue chart for 2025'], vagueAltText)).toHaveLength(0)
    })

    it('alt text that contains a vague word, but is not vague by itself', () => {
      expect(evaluateAlts(['Profile photo of Ada Lovelace'], vagueAltText)).toHaveLength(0)
      expect(evaluateAlts(['Screenshot of the GitHub home page'], vagueAltText)).toHaveLength(0)
    })

    it('placeholder words that now live in placeholder-alt-text', () => {
      expect(evaluateAlts(['todo'], vagueAltText)).toHaveLength(0)
      expect(evaluateAlts(['tbd'], vagueAltText)).toHaveLength(0)
      expect(evaluateAlts(['fixme'], vagueAltText)).toHaveLength(0)
      expect(evaluateAlts(['placeholder'], vagueAltText)).toHaveLength(0)
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
      const [result] = evaluateAlts(['image'], vagueAltText)
      expect(result).toBeDefined()
      expect(result!.problemShort).toContain('image')
    })

    it('includes a solutionShort', () => {
      const [result] = evaluateAlts(['image'], vagueAltText)
      expect(result).toBeDefined()
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
