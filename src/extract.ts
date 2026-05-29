import type {Page} from 'playwright'
import type {ImageRecord} from './types.js'

// Scans the page DOM once and returns a normalized ImageRecord per image.
// This is the only file in the plugin that talks to Playwright.
export async function extractImages(page: Page): Promise<ImageRecord[]> {
  return []
}
