import {join} from 'node:path'
import {extractImages} from './src/extract.js'
import {allRules} from './src/rules/index.js'
import {emitFindings} from './src/findings.js'
import {loadConfig} from './src/config.js'
import type {PluginArgs} from './src/types.js'

export const name = 'alt-text-scan'

// Config lives in the consumer's repo at `.github/scanner-plugins/<name>/config.json`.
// `process.cwd()` is the consumer repo root when invoked by the scanner action.
const configPath = join(process.cwd(), '.github', 'scanner-plugins', name, 'config.json')
const knownRuleIds = new Set(allRules.map(r => r.id))

// Read the config once per scanner process; the same config applies to every URL.
const configPromise = loadConfig(configPath, knownRuleIds)

export default async function altTextScan({page, addFinding}: PluginArgs): Promise<void> {
  const url = page.url()

  const {disabledRules} = await configPromise
  const enabledRules = allRules.filter(rule => !disabledRules.has(rule.id))

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
  for (const rule of enabledRules) {
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
