import type {Rule, RuleResult} from '../types.js'

// Set of words that by themselves, are too vague to be useful alt text
const VAGUE_WORDS = new Set([
  // Generic media terms
  'image',
  'images',
  'img',
  'photo',
  'photos',
  'photograph',
  'photographs',
  'picture',
  'pictures',
  'pic',
  'pics',
  'graphic',
  'graphics',
  'visual',
  'visuals',
  'media',

  // Common UI/image labels
  'icon',
  'icons',
  'illustration',
  'illustrations',
  'banner',
  'banners',
  'thumbnail',
  'thumbnails',
  'logo',
  'logos',
  'avatar',
  'avatars',

  // Very generic descriptors
  'art',
  'artwork',
  'drawing',
  'drawings',
  'diagram',
  'diagrams',
  'chart',
  'charts',
  'graph',
  'graphs',
  'screenshot',
  'screenshots',
  'figure',
  'figures',

  // Placeholders
  'placeholder',
  'sample',
  'example',
  'test',
  'demo',
  'default',
  'untitled',

  // Contextless terms
  'this',
  'that',
  'here',
  'there',
  'above',
  'below',

  // Weak file/asset labels
  'asset',
  'assets',
  'file',
  'attachment',
  'upload',
  'uploaded',
])

const VAGUE_PHRASES = new Set([
  'an image',
  'an image of',
  'a photo',
  'a photo of',
  'a picture',
  'a picture of',
  'an icon',
  'an illustration',
  'a graphic',
  'a screenshot',
  'image of',
  'photo of',
  'picture of',
  'graphic of',
  'screenshot of',
])

/**
 * Normalizes alt text for set check by lowercasing, collapsing
 * whitespace, and stripping trailing punctuation.
 */
function normalizeAltText(alt: string): string {
  return alt
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,!?;:()[\]{}'"“”‘’]+$/g, '')
}

export const vagueAltText: Rule = {
  id: 'vague-alt',
  problemUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/non-text-content.html',
  evaluate(ctx): RuleResult[] {
    return (
      ctx.images

        // Find images whose alt text is too vague.
        .filter(img => {
          if (img.alt === null || img.alt === '') return false
          const normalizedAltText = normalizeAltText(img.alt)
          return VAGUE_WORDS.has(normalizedAltText) || VAGUE_PHRASES.has(normalizedAltText)
        })

        // Report each one with offending alt text.
        .map(image => ({
          image,
          problemShort: `alt text "${image.alt}" is too vague to describe the image`,
          solutionShort: 'replace with descriptive alt text, or use `alt=""` if the image is decorative',
        }))
    )
  },
}
