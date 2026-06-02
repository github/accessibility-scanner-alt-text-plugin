import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it} from 'vitest'
import {chromium, type Browser, type Page} from 'playwright'
import {extractImages} from '../src/extract.js'

let browser: Browser
let page: Page

beforeAll(async () => {
  browser = await chromium.launch()
})

afterAll(async () => {
  await browser.close()
})

beforeEach(async () => {
  page = await browser.newPage()
})

afterEach(async () => {
  await page.close()
})

/**
 * Loads the given HTML into the page and returns the extractor's output.
 * Wraps the markup in a minimal document so callers can pass body fragments.
 */
async function extractFromHTML(html: string) {
  await page.setContent(`<!doctype html><html><body>${html}</body></html>`)
  return extractImages(page)
}

describe('extractImages', () => {
  describe('basic extraction', () => {
    it('includes a plain visible image', async () => {
      const images = await extractFromHTML(`<img src="cat.png" alt="a cat">`)
      expect(images).toHaveLength(1)
      expect(images[0]!.src).toBe('cat.png')
      expect(images[0]!.alt).toBe('a cat')
    })

    it('returns an empty array when the page has no images', async () => {
      const images = await extractFromHTML(`<p>no pictures here</p>`)
      expect(images).toHaveLength(0)
    })

    it('captures src, alt, role, aria-label, aria-labelledby, and outerHTML', async () => {
      const images = await extractFromHTML(`
        <img src="x.png" alt="x" role="presentation"
             aria-label="labeled" aria-labelledby="caption">
      `)
      expect(images).toHaveLength(1)
      const img = images[0]!
      expect(img.src).toBe('x.png')
      expect(img.alt).toBe('x')
      expect(img.role).toBe('presentation')
      expect(img.ariaLabel).toBe('labeled')
      expect(img.ariaLabelledBy).toBe('caption')
      expect(img.outerHTML).toContain('<img')
    })

    it('returns multiple images in document order', async () => {
      const images = await extractFromHTML(`
        <img src="a.png" alt="a">
        <img src="b.png" alt="b">
        <img src="c.png" alt="c">
      `)
      expect(images.map(i => i.src)).toEqual(['a.png', 'b.png', 'c.png'])
    })
  })

  describe('excludes images hidden via aria-hidden', () => {
    it('excludes an image with aria-hidden="true" on itself', async () => {
      const images = await extractFromHTML(`<img src="x.png" alt="x" aria-hidden="true">`)
      expect(images).toHaveLength(0)
    })

    it('excludes an image whose parent has aria-hidden="true"', async () => {
      const images = await extractFromHTML(`
        <div aria-hidden="true"><img src="x.png" alt="x"></div>
      `)
      expect(images).toHaveLength(0)
    })

    it('excludes an image whose distant ancestor has aria-hidden="true"', async () => {
      const images = await extractFromHTML(`
        <div aria-hidden="true">
          <section><article><img src="x.png" alt="x"></article></section>
        </div>
      `)
      expect(images).toHaveLength(0)
    })

    it('does not exclude when aria-hidden is set to "false"', async () => {
      const images = await extractFromHTML(`
        <div aria-hidden="false"><img src="x.png" alt="x"></div>
      `)
      expect(images).toHaveLength(1)
    })
  })

  describe('excludes images hidden via display:none', () => {
    it('excludes an image with inline display:none', async () => {
      const images = await extractFromHTML(`<img src="x.png" alt="x" style="display:none">`)
      expect(images).toHaveLength(0)
    })

    it('excludes an image whose ancestor has inline display:none', async () => {
      const images = await extractFromHTML(`
        <div style="display:none"><img src="x.png" alt="x"></div>
      `)
      expect(images).toHaveLength(0)
    })

    it('excludes an image hidden by a stylesheet (shows computed style is read)', async () => {
      const images = await extractFromHTML(`
        <style>.hidden { display: none; }</style>
        <div class="hidden"><img src="x.png" alt="x"></div>
      `)
      expect(images).toHaveLength(0)
    })
  })

  describe('excludes images hidden via visibility:hidden', () => {
    it('excludes an image with inline visibility:hidden', async () => {
      const images = await extractFromHTML(`<img src="x.png" alt="x" style="visibility:hidden">`)
      expect(images).toHaveLength(0)
    })

    it('excludes an image whose ancestor has visibility:hidden (inheritance)', async () => {
      const images = await extractFromHTML(`
        <div style="visibility:hidden"><img src="x.png" alt="x"></div>
      `)
      expect(images).toHaveLength(0)
    })

    it('includes an image that overrides a hidden ancestor with visibility:visible', async () => {
      // visibility is inherited but overridable
      const images = await extractFromHTML(`
        <div style="visibility:hidden">
          <img src="x.png" alt="x" style="visibility:visible">
        </div>
      `)
      expect(images).toHaveLength(1)
    })
  })
})
