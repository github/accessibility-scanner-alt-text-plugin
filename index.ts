import {extractImages} from './src/extract.js'
import {allRules} from './src/rules/index.js'
import {emitFindings} from './src/findings.js'
import type {PluginArgs} from './src/types.js'

export const name = 'alt-text-scan'

export default async function altTextScan({page, addFinding}: PluginArgs): Promise<void> {
  const url = page.url()

  // Extract images from the page. 
  let images
  try {
    images = await extractImages(page)
  } catch (err) {
    console.error(`[alt-text-scan] failed to extract images from ${url}:`, err)
    return
  }

  if (images.length === 0) return

  const ctx = {url, images}

  // Enforce checks on each image against each rule. 
  for (const rule of allRules) {
    let results
    try {
      results = rule.evaluate(ctx)
    } catch (err) {
      console.error(`[alt-text-scan] rule "${rule.id}" threw on ${url}:`, err)
      continue
    }
    await emitFindings(rule, results, url, addFinding)
  }
}
