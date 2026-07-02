// Loads the plugin's per-repo config file and extracts per-rule enable/disable
// overrides. Missing, unreadable, or malformed config falls back to defaults.

import {readFile} from 'node:fs/promises'

export type PluginConfig = {
  ruleOverrides: ReadonlyMap<string, boolean>
}

const emptyConfig = (): PluginConfig => ({ruleOverrides: new Map()})

export async function loadConfig(configPath: string, knownRuleIds: ReadonlySet<string>): Promise<PluginConfig> {
  let raw: string
  try {
    raw = await readFile(configPath, 'utf8')
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
      return emptyConfig()
    }
    console.warn(`[alt-text-scan] failed to read ${configPath}; running with default rule settings:`, err)
    return emptyConfig()
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    console.error(`[alt-text-scan] failed to parse ${configPath}; running with default rule settings:`, err)
    return emptyConfig()
  }

  return {ruleOverrides: collectRuleOverrides(parsed, knownRuleIds)}
}

// Pulls the boolean `rules` map out of parsed config, dropping unknown ids and
// non-boolean values so a bad config can't disable an unrelated rule.
function collectRuleOverrides(parsed: unknown, knownRuleIds: ReadonlySet<string>): Map<string, boolean> {
  const result = new Map<string, boolean>()
  if (!parsed || typeof parsed !== 'object') return result

  const rules = (parsed as {rules?: unknown}).rules
  if (!rules || typeof rules !== 'object' || Array.isArray(rules)) return result

  for (const [id, value] of Object.entries(rules as Record<string, unknown>)) {
    if (!knownRuleIds.has(id)) {
      console.warn(
        `[alt-text-scan] unknown rule id "${id}" in config; ignoring. Known ids: ${[...knownRuleIds].join(', ')}`,
      )
      continue
    }
    if (typeof value !== 'boolean') {
      console.warn(`[alt-text-scan] non-boolean value for rule "${id}" in config (got ${typeof value}); ignoring.`)
      continue
    }
    result.set(id, value)
  }
  return result
}
