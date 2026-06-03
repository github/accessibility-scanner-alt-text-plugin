import type {Page} from 'playwright'
import type {ImageRecord} from './types.js'

// Returns one ImageRecord per image in the accessibility tree. getByRole('img')
// filters out anything not seen by assistive tech.
export async function extractImages(page: Page): Promise<ImageRecord[]> {
  return page.getByRole('img').evaluateAll(els =>
    els.map(el => ({
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
