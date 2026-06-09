import {readFile} from 'node:fs/promises'

export type PluginConfig = {
  disabledRules: ReadonlySet<string>
}

const EMPTY_CONFIG: PluginConfig = {disabledRules: new Set()}

export async function loadConfig(configPath: string, knownRuleIds: ReadonlySet<string>): Promise<PluginConfig> {
  let raw: string
  try {
    raw = await readFile(configPath, 'utf8')
  } catch {
    return EMPTY_CONFIG
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    console.error(`[alt-text-scan] failed to parse ${configPath}; running with all rules enabled:`, err)
    return EMPTY_CONFIG
  }

  return {disabledRules: collectDisabledRules(parsed, knownRuleIds)}
}

function collectDisabledRules(parsed: unknown, knownRuleIds: ReadonlySet<string>): Set<string> {
  const result = new Set<string>()
  if (!parsed || typeof parsed !== 'object') return result

  const list = (parsed as {disabledRules?: unknown}).disabledRules
  if (!Array.isArray(list)) return result

  for (const id of list) {
    if (typeof id !== 'string') continue
    if (!knownRuleIds.has(id)) {
      console.warn(
        `[alt-text-scan] unknown rule id "${id}" in config; ignoring. Known ids: ${[...knownRuleIds].join(', ')}`,
      )
      continue
    }
    result.add(id)
  }
  return result
}
