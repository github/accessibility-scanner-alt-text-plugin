import type {Page} from 'playwright'
import type {ImageRecord} from './types.js'

// Maximum number of characters of nearby prose forwarded to model-backed rules.
// Long enough to convey context, short enough to keep prompts cheap and focused.
const NEARBY_TEXT_MAX = 600

// Returns one ImageRecord per HTML <img> element that is exposed in the accessibility tree.
// Using getByRole('img') filters out elements that assistive tech cannot perceive.
export async function extractImages(page: Page): Promise<ImageRecord[]> {
  return page.getByRole('img').evaluateAll(
    (els, maxNearby) =>
      els
        // getByRole('img') also matches SVG/div with role="img", so filter those out.
        .filter(el => el.tagName === 'IMG')
        .map(el => {
          const rect = el.getBoundingClientRect()
          const boundingBox =
            rect.width === 0 && rect.height === 0
              ? null
              : {x: rect.x, y: rect.y, width: rect.width, height: rect.height}

          // Closest ancestor link with an href.
          const linkEl = el.closest('a[href]') as HTMLAnchorElement | null
          const inLink = linkEl ? {href: linkEl.getAttribute('href') ?? ''} : null

          // Closest ancestor button — either a <button> element or any
          // element with role="button".
          const inButton = el.closest('button, [role="button"]') !== null

          // Associated <figcaption>: image must be inside a <figure>; the
          // figcaption can be a sibling above or below the image.
          let figcaption: string | null = null
          const figure = el.closest('figure')
          if (figure) {
            const cap = figure.querySelector('figcaption')
            const text = cap?.textContent?.trim()
            if (text) figcaption = text
          }

          // Nearby prose: text content of the closest block-level ancestor,
          // minus the image's own subtree, truncated to keep prompts bounded.
          let nearbyText: string | null = null
          const block = el.closest('p, li, section, article, main, aside, blockquote, td, th, div')
          if (block) {
            const clone = block.cloneNode(true) as HTMLElement
            // Remove img tags from the clone so their alt text doesn't pollute
            // the prose snippet handed to the model.
            for (const innerImg of Array.from(clone.querySelectorAll('img'))) innerImg.remove()
            const text = (clone.textContent ?? '').replace(/\s+/g, ' ').trim()
            if (text) {
              nearbyText = text.length > maxNearby ? `${text.slice(0, maxNearby)}…` : text
            }
          }

          return {
            src: el.getAttribute('src'),
            alt: el.getAttribute('alt'),
            role: el.getAttribute('role'),
            ariaHidden: el.getAttribute('aria-hidden') === 'true',
            ariaLabel: el.getAttribute('aria-label'),
            ariaLabelledBy: el.getAttribute('aria-labelledby'),
            outerHTML: el.outerHTML,
            boundingBox,
            inLink,
            inButton,
            figcaption,
            nearbyText,
          }
        }),
    NEARBY_TEXT_MAX,
  )
}
