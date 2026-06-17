// Offline scoring harness for the alt-text-quality rule.
//
// Reads test cases from tests/fixtures/alt-quality/cases.json, sends each
// (image, alt, context) tuple through a JudgeAltText, and reports per-case
// verdicts plus overall agreement against the expected verdicts.
//
// What this script verifies: that the same prompt + schema + fetch path the
// production rule uses (CopilotJudge, AzureAugmentedJudge, …) reproduces
// expert ground truth on a curated fixture.
//
// Run:
//   GITHUB_MODELS_TOKEN=<pat-with-models:read> npm run probe
//
// Optional env:
//   PROBE_MODEL              — model id, default "openai/gpt-4o"
//   PROBE_CASES              — path to a cases.json
//   ALT_TEXT_JUDGE_MODE      — "copilot" (default) or "azure-augmented"
//   PROBE_MIN_INTERVAL_MS    — minimum ms between cases (rate-limit pacing).
//                              Set to 3500 for Azure F0's 20-calls/min ceiling.

import {readFile} from 'node:fs/promises'
import {dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

import {createJudge} from '../src/judges/index.js'
import type {Verdict} from '../src/judges/index.js'
import {loadImageAsDataUrl} from '../src/utils/load-image-data-url.js'

type ProbeCase = {
  id: string
  // Path relative to cases.json, OR an absolute path, OR an http(s) URL.
  image: string
  alt: string
  // The "page context" the production rule passes in.
  context?: string
  expected?: Verdict
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

async function main(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url))
  const casesPath = process.env['PROBE_CASES']
    ? resolve(process.cwd(), process.env['PROBE_CASES'])
    : resolve(here, '..', 'tests', 'fixtures', 'alt-quality', 'cases.json')

  const cases = JSON.parse(await readFile(casesPath, 'utf8')) as ProbeCase[]
  const baseDir = dirname(casesPath)

  const mode = process.env['ALT_TEXT_JUDGE_MODE'] ?? 'copilot'
  const model = process.env['PROBE_MODEL'] ?? 'openai/gpt-4o'
  const minIntervalMs = Number(process.env['PROBE_MIN_INTERVAL_MS'] ?? '0')

  let judge
  try {
    judge = createJudge()
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }

  console.log(`Mode:    ${mode}`)
  console.log(`Model:   ${model}`)
  console.log(`Cases:   ${casesPath}`)
  console.log(`Total:   ${cases.length}`)
  if (minIntervalMs > 0) console.log(`Pacing:  ${minIntervalMs}ms minimum between cases`)
  console.log('')

  let agreements = 0
  let withExpected = 0

  for (const c of cases) {
    const caseStart = Date.now()
    process.stdout.write(`[${c.id}] `)
    try {
      const dataUrl = await loadImageAsDataUrl(c.image, {baseDir})
      const start = Date.now()
      const verdict = await judge.judge({
        imageDataUrl: dataUrl,
        alt: c.alt,
        context: c.context ?? '',
      })
      const latencyMs = Date.now() - start

      let agreeMark = ''
      if (c.expected !== undefined) {
        withExpected++
        const agree = c.expected === verdict.verdict
        if (agree) agreements++
        agreeMark = agree ? '  ✓' : '  ✗'
      }

      console.log(`${verdict.verdict} (conf ${verdict.confidence.toFixed(2)}, ${latencyMs}ms)${agreeMark}`)
      console.log(`    alt:      ${JSON.stringify(c.alt)}`)
      if (c.expected !== undefined) console.log(`    expected: ${c.expected}`)
      if (verdict.issue) console.log(`    issue:    ${verdict.issue}`)
      console.log(`    reason:   ${verdict.reasoning}`)
      console.log('')
    } catch (err) {
      console.log('ERROR')
      console.log(`    ${err instanceof Error ? err.message : String(err)}`)
      console.log('')
    }

    // Rate-limit pacing: ensure at least minIntervalMs has elapsed since this
    // case started before moving to the next case.
    if (minIntervalMs > 0) {
      const elapsed = Date.now() - caseStart
      const remaining = minIntervalMs - elapsed
      if (remaining > 0) await sleep(remaining)
    }
  }

  if (withExpected > 0) {
    console.log(`Agreement with expected verdicts: ${agreements}/${withExpected}`)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
