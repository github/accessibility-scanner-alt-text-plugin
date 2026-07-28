import {readFile} from 'node:fs/promises'
import altTextScan from '../index.js'
import {emitFindings} from '../src/findings.js'
import {__setJudge, altTextQuality} from '../src/rules/alt-text-quality.js'
import {extractImageContext} from '../src/extract-image-context.js'
import type {JudgeAltText, JudgeInput, JudgeVerdict} from '../src/judges/types.js'
import type {Finding} from '../src/types.js'
import {createDemoHarness} from './demo-support.js'

const keywordAlt =
  'accessibility testing, web accessibility, best accessibility scanner 2026, WCAG tools, buy accessibility software'
const wrongAlt = 'A red warning triangle marks a failed deployment.'

class DemoJudge implements JudgeAltText {
  async judge(input: JudgeInput): Promise<JudgeVerdict> {
    if (input.alt === keywordAlt) {
      return {
        step: 4,
        reasoning:
          'The alt is a search-keyword list with commercial language rather than a description of the blue test graphic.',
        verdict: 'needs-fix',
        issue: 'keyword-stuffing',
        confidence: 1,
        suggestion: 'Blue square with the word test in white.',
      }
    }
    if (input.alt === wrongAlt) {
      return {
        step: 4,
        reasoning:
          'The alt describes a red failure warning, but the image is a blue test graphic and the page identifies it as successful.',
        verdict: 'needs-fix',
        issue: 'inaccurate',
        confidence: 1,
        suggestion: 'Blue square with the word test in white.',
      }
    }
    return {
      step: 4,
      reasoning: 'The alt accurately describes the synthetic graphic.',
      verdict: 'ok',
      issue: '',
      confidence: 1,
      suggestion: '',
    }
  }
}

const harness = await createDemoHarness()
try {
  const baselineUrl = await harness.open('baseline')
  const deterministicFindings: Finding[] = []
  await altTextScan({
    page: harness.page,
    addFinding: async finding => {
      deterministicFindings.push(finding)
    },
  })

  const advancedUrl = await harness.open('advanced')
  const images = await extractImageContext(harness.page)
  __setJudge(new DemoJudge())
  const results = await altTextQuality.evaluate({url: advancedUrl, images})
  const mockedModelFindings: Finding[] = []
  await emitFindings(altTextQuality, results, advancedUrl, async finding => {
    mockedModelFindings.push(finding)
  })

  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as {
    version: string
  }
  console.log(
    JSON.stringify(
      {
        pluginVersion: packageJson.version,
        evidence: {
          deterministic: 'real plugin scan; no credentials or model calls',
          modelBacked: 'mocked judge; real extraction, rule mapping, and scanner Finding shape',
        },
        fixtureUrls: {baseline: baselineUrl, advanced: advancedUrl},
        deterministicFindings,
        mockedModelFindings,
      },
      null,
      2,
    ),
  )
} finally {
  __setJudge(null)
  await harness.close()
}
