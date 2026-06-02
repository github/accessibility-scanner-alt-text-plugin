import type {Page} from 'playwright'
import type {ImageRecord} from './types.js'

// Scans the page object once and returns a normalized ImageRecord for each image.
export async function extractImages(page: Page): Promise<ImageRecord[]> {
  return page.locator('img').evaluateAll(els =>
    els
      .filter(el => {
        // aria-hidden="true" on self or ancestor removes the subtree from the a11y tree.
        if (el.closest('[aria-hidden="true"]')) return false

        // display:none isn't inherited but hides the whole subtree, so traverse all ancestors.
        for (let cur: Element | null = el; cur; cur = cur.parentElement) {
          if (getComputedStyle(cur).display === 'none') return false
        }

        // visibility is inherited, so the element's own computed value already reflects ancestor state.
        if (getComputedStyle(el).visibility === 'hidden') return false

        return true
      })
      .map(el => ({
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
