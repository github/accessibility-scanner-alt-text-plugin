import type {Finding, Rule, RuleResult} from './types.js'
import {name} from '../index.js'

// Translates each RuleResult into the scanner's Finding shape and records it.
export async function emitFindings(
  rule: Rule,
  results: RuleResult[],
  url: string,
  addFinding: (finding: Finding) => Promise<void>,
): Promise<void> {
  for (const result of results) {
    await addFinding({
      scannerType: name,
      ruleId: rule.id,
      url,
      html: result.image.outerHTML,
      problemShort: result.problemShort,
      problemUrl: rule.problemUrl,
      solutionShort: result.solutionShort,
      solutionLong: result.solutionLong,
    })
  }
}
