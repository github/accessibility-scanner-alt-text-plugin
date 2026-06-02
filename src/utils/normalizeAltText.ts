/**
 * Normalizes alt text for comparison: trims, lowercases, collapses internal
 * whitespace, and strips leading and trailing punctuation. Used by rules that
 * need to compare alt text against a set or against each other without being
 * tripped up by cosmetic differences.
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
