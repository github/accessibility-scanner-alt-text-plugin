import {readFile} from 'node:fs/promises'
import {emitFindings} from '../src/findings.js'
import {extractImageContext} from '../src/extract-image-context.js'
import {__setJudge, altTextQuality} from '../src/rules/alt-text-quality.js'
import type {Finding} from '../src/types.js'
import {createDemoHarness} from './demo-support.js'

if (!process.env['GITHUB_MODELS_TOKEN'] && !process.env['GITHUB_TOKEN']) {
  throw new Error('Set GITHUB_MODELS_TOKEN to a PAT with models:read before running the live demo.')
}

const azureConfigured = Boolean(process.env['AZURE_VISION_ENDPOINT'] && process.env['AZURE_VISION_KEY'])
const requestedMode = process.env['ALT_TEXT_JUDGE_MODE']
const judgeMode =
  requestedMode === 'copilot' || requestedMode === 'azure-augmented'
    ? requestedMode
    : azureConfigured
      ? 'azure-augmented'
      : 'copilot'

const harness = await createDemoHarness()
try {
  const url = await harness.open('advanced')
  const images = await extractImageContext(harness.page)
  __setJudge(null)
  const results = await altTextQuality.evaluate({url, images})
  const findings: Finding[] = []
  await emitFindings(altTextQuality, results, url, async finding => {
    findings.push(finding)
  })

  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as {
    version: string
  }
  console.log(
    JSON.stringify(
      {
        pluginVersion: packageJson.version,
        evidence: 'live GitHub Models evaluation of the repository synthetic fixture',
        judgeMode,
        azureCredentialsConfigured: azureConfigured,
        fixtureUrl: url,
        findings,
      },
      null,
      2,
    ),
  )
} finally {
  __setJudge(null)
  await harness.close()
}
