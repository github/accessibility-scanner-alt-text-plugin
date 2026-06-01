import type {Finding, Rule, RuleResult} from './types.js'

// Translates each RuleResult into the scanner's Finding shape and records it.
export async function emitFindings(
  rule: Rule,
  results: RuleResult[],
  url: string,
  addFinding: (finding: Finding) => Promise<void>,
): Promise<void> {
  for (const result of results) {
    await addFinding({
      scannerType: 'alt-text-scan',
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
