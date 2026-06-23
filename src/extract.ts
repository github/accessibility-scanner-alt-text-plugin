import type {Page} from 'playwright'
import type {ImageRecord} from './types.js'

// Returns one ImageRecord per HTML <img> element that is exposed in the accessibility tree.
// Using getByRole('img') filters out elements that assistive tech cannot perceive.
export async function extractImages(page: Page): Promise<ImageRecord[]> {
  return page.getByRole('img').evaluateAll(els =>
    els
      // getByRole('img') also matches SVG/div with role="img", so filter those out.
      .filter(el => el.tagName === 'IMG')
      .map(el => {
        const rect = el.getBoundingClientRect()
        const boundingBox =
          rect.width === 0 && rect.height === 0 ? null : {x: rect.x, y: rect.y, width: rect.width, height: rect.height}
        return {
          src: el.getAttribute('src'),
          alt: el.getAttribute('alt'),
          role: el.getAttribute('role'),
          ariaHidden: el.getAttribute('aria-hidden') === 'true',
          ariaLabel: el.getAttribute('aria-label'),
          ariaLabelledBy: el.getAttribute('aria-labelledby'),
          outerHTML: el.outerHTML,
          boundingBox,
        }
      }),
  )
}
