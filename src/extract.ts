import type {Page} from 'playwright'
import type {ImageRecord} from './types.js'

// Scans the page object once and returns a normalized ImageRecord for each image.
export async function extractImages(page: Page): Promise<ImageRecord[]> {
  return page.locator('img').evaluateAll((els) =>
    els.map((el) => ({
      src: el.getAttribute('src'),
      alt: el.getAttribute('alt'),
      role: el.getAttribute('role'),
      ariaHidden: el.getAttribute('aria-hidden') === 'true',
      ariaLabel: el.getAttribute('aria-label'),
      ariaLabelledBy: el.getAttribute('aria-labelledby'),
      outerHTML: el.outerHTML,
    })),
  )
}