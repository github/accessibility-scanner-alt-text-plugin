import type {Finding, Rule, RuleResult} from './types.js'

// Translates each RuleResult into the scanner's Finding shape and dispatches it.
export async function emitFindings(
  rule: Rule,
  results: RuleResult[],
  url: string,
  addFinding: (finding: Finding) => Promise<void>,
): Promise<void> {
  return
}
