/**
 * Normalizes alt text for comparison by trimming, lowercasing, collapsing internal
 * whitespace, and stripping leading and trailing punctuation. Used by rules that
 * need to compare alt text against a set.
 */
export function normalizeAltText(alt: string): string {
  return alt
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^[.,!?;:()[\]{}'"“”‘’]+/, '')
    .replace(/[.,!?;:()[\]{}'"“”‘’]+$/, '')
    .trim()
}
