import type {Page} from 'playwright'
import type {ImageRecord} from './types.js'

// Maximum number of characters of nearby prose forwarded to model-backed rules.
const NEARBY_TEXT_MAX = 600

// Returns one ImageRecord per HTML <img> exposed in the accessibility tree, each
// bundled with its surrounding page context (link/button ancestry, figcaption,
// nearby prose, section heading, page title) so model-backed rules can reason about it.
// Using getByRole('img') filters out elements that assistive tech cannot perceive.
export async function extractImageContext(page: Page): Promise<ImageRecord[]> {
  return page.getByRole('img').evaluateAll((els, maxNearby) => {
    // Page-level topic, captured once and shared by every image record.
    const pageTitle = (document.title ?? '').replace(/\s+/g, ' ').trim() || null
    // All headings in document order, used to find each image's section.
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))

    return (
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
          const linkContext = linkEl ? {href: linkEl.getAttribute('href') ?? ''} : null

          // Closest ancestor button
          const inButton = el.closest('button, [role="button"]') !== null

          // Associated <figcaption>: image must be inside a <figure>
          let figcaption: string | null = null
          const figure = el.closest('figure')
          if (figure) {
            const cap = figure.querySelector('figcaption')
            const text = cap?.textContent?.trim()
            if (text) figcaption = text
          }

          // Nearby prose
          let nearbyText: string | null = null
          const block = el.closest('p, li, section, article, main, aside, blockquote, td, th, div')
          if (block) {
            const text = (block.textContent ?? '').replace(/\s+/g, ' ').trim()
            if (text) {
              nearbyText = text.length > maxNearby ? `${text.slice(0, maxNearby)}…` : text
            }
          }

          // Nearest heading that precedes the image in document order.
          let sectionHeading: string | null = null
          for (let i = headings.length - 1; i >= 0; i--) {
            const h = headings[i]!
            if (!(h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) continue
            const text = (h.textContent ?? '').replace(/\s+/g, ' ').trim()
            if (text) {
              sectionHeading = text
              break
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
            // Intrinsic bitmap size
            naturalWidth: (el as HTMLImageElement).naturalWidth,
            naturalHeight: (el as HTMLImageElement).naturalHeight,
            linkContext,
            inButton,
            figcaption,
            nearbyText,
            pageTitle,
            sectionHeading,
          }
        })
    )
  }, NEARBY_TEXT_MAX)
}
