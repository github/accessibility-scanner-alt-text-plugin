import {describe, it, expect} from 'vitest'
import {repeatedAltText} from '../../src/rules/repeated-alt-text.js'
import type {BoundingBox} from '../../src/types.js'
import {evaluateAlts, evaluateImages, makeImage} from '../utils/helpers.js'

// Build a 24x24 icon at (x, y)
function iconAt(alt: string | null, x: number, y: number, size = 24): ReturnType<typeof makeImage> {
  const boundingBox: BoundingBox = {x, y, width: size, height: size}
  return makeImage({alt, boundingBox})
}

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

  describe('spatial distance', () => {
    // With size=24 and GAP_MULTIPLIER=3, the max edge-to-edge gap that
    // still extends a run is 72px.

    it('flags a tight horizontal row of icons (4px gap between 24px icons)', () => {
      const images = [iconAt('star', 0, 0), iconAt('star', 28, 0), iconAt('star', 56, 0), iconAt('star', 84, 0)]
      expect(evaluateImages(images, repeatedAltText)).toHaveLength(3)
    })

    it('flags a tight vertical column of icons (4px gap between 24px icons)', () => {
      const images = [iconAt('star', 0, 0), iconAt('star', 0, 28), iconAt('star', 0, 56)]
      expect(evaluateImages(images, repeatedAltText)).toHaveLength(2)
    })

    it('does not flag two images spaced far apart (gap > 3x larger dim)', () => {
      // 200px vertical gap between 24px icons = 8.3x larger dim, over threshold
      const images = [iconAt('star', 0, 0), iconAt('star', 0, 224)]
      expect(evaluateImages(images, repeatedAltText)).toHaveLength(0)
    })

    it('breaks the run when a far image follows a tight cluster', () => {
      // First 3 are close (4px apart), 4th is 200px away from the 3rd.
      const images = [iconAt('star', 0, 0), iconAt('star', 28, 0), iconAt('star', 56, 0), iconAt('star', 256, 0)]
      expect(evaluateImages(images, repeatedAltText)).toHaveLength(2)
    })

    it('starts a new run after a spatial break', () => {
      // Close pair, big gap, close pair
      const images = [iconAt('star', 0, 0), iconAt('star', 28, 0), iconAt('star', 500, 0), iconAt('star', 528, 0)]
      expect(evaluateImages(images, repeatedAltText)).toHaveLength(2)
    })

    it('treats a gap exactly at the threshold as still part of the run', () => {
      // Threshold = 3 * 24 = 72. A gap of exactly 72 shouldn't break the run.
      const images = [iconAt('star', 0, 0), iconAt('star', 96, 0), iconAt('star', 192, 0)]
      expect(evaluateImages(images, repeatedAltText)).toHaveLength(2)
    })

    it('does not break the run when an image lacks a measurable bounding box', () => {
      // Middle image has no layout box, so run extends through
      const images = [iconAt('star', 0, 0), makeImage({alt: 'star', boundingBox: null}), iconAt('star', 56, 0)]
      expect(evaluateImages(images, repeatedAltText)).toHaveLength(2)
    })

    it('groups overlapping images (gap = 0) regardless of large size', () => {
      // Two 200x200 images overlapping by 50px
      const big = (alt: string, x: number): ReturnType<typeof makeImage> => iconAt(alt, x, 0, 200)
      const images = [big('hero', 0), big('hero', 150), big('hero', 300)]
      expect(evaluateImages(images, repeatedAltText)).toHaveLength(2)
    })

    it('scales the allowed gap with image size (larger images tolerate larger gaps)', () => {
      // Two 200x200 images with 300px gap = 1.5x larger dim, which is under N=3
      const big = (alt: string, x: number): ReturnType<typeof makeImage> => iconAt(alt, x, 0, 200)
      const images = [big('hero', 0), big('hero', 500)]
      expect(evaluateImages(images, repeatedAltText)).toHaveLength(1)
    })
  })

  describe('rule metadata', () => {
    it('has the expected id', () => {
      expect(repeatedAltText.id).toBe('repeated-alt-text')
    })

    it('has a problemUrl pointing at a WCAG / W3C resource', () => {
      expect(repeatedAltText.problemUrl).toMatch(/^https:\/\/www\.w3\.org\//)
    })
  })
})
