// Plugin entry point: loads config, extracts each image with its page context,
// runs the enabled rules, and emits findings to the accessibility scanner.

import {join} from 'node:path'
import {extractImageContext} from './src/extract-image-context.js'
import {allRules} from './src/rules/index.js'
import {emitFindings} from './src/findings.js'
import {loadConfig} from './src/config.js'
import type {PluginArgs} from './src/types.js'

export const name = 'alt-text-scan'

// Config lives in the consumer's repo at `.github/scanner-plugins/<name>/config.json`.
const configPath = join(process.cwd(), '.github', 'scanner-plugins', name, 'config.json')
const knownRuleIds = new Set(allRules.map(r => r.id))
const configPromise = loadConfig(configPath, knownRuleIds)

export default async function altTextScan({page, addFinding}: PluginArgs): Promise<void> {
  const url = page.url()

  const {ruleOverrides} = await configPromise
  const enabledRules = allRules.filter(rule => ruleOverrides.get(rule.id) ?? rule.defaultEnabled ?? true)

  // Extract images and their page context.
  let images
  try {
    images = await extractImageContext(page)
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
      // Rules may be sync or async; await both shapes uniformly.
      results = await rule.evaluate(ctx)
    } catch (err) {
      console.error(`[alt-text-scan] rule "${rule.id}" threw on ${url}:`, err)
      continue
    }
    await emitFindings(rule, results, url, addFinding)
  }
}
