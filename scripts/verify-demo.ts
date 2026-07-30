import {readFile} from 'node:fs/promises'
import altTextScan from '../index.js'
import {emitFindings} from '../src/findings.js'
import {extractImageContext} from '../src/extract-image-context.js'
import {
  createAzureAugmentedJudge,
  type AzureVisionClient,
  type JudgeAltText,
  type JudgeInput,
  type JudgeVerdict,
} from '../src/judges/index.js'
import {__setJudge, altTextQuality} from '../src/rules/alt-text-quality.js'
import type {Finding} from '../src/types.js'
import {createDemoHarness} from './demo-support.js'

class DemoJudge implements JudgeAltText {
  async judge(input: JudgeInput): Promise<JudgeVerdict> {
    switch (input.alt) {
      case 'running shoes, cheap shoes, buy shoes online, best shoes 2026':
        return {
          step: 4,
          reasoning: 'This is a keyword list rather than an image description.',
          verdict: 'needs-fix',
          issue: 'keyword-stuffing',
          confidence: 1,
          suggestion: 'Blue square with the word test',
        }
      case 'A team collaborating around a table':
        return {
          step: 4,
          reasoning: 'The alt text does not match the controlled image.',
          verdict: 'needs-fix',
          issue: 'inaccurate',
          confidence: 1,
          suggestion: 'Blue square with the word test',
        }
      case 'Blue divider pattern':
        return {
          step: 4,
          reasoning: 'The visible caption already communicates its purpose.',
          verdict: 'decorative',
          issue: '',
          confidence: 1,
          suggestion: '',
        }
      case 'A blue square with the word test in white':
        return {
          step: 4,
          reasoning: 'The alt text accurately describes the controlled image.',
          verdict: 'ok',
          issue: '',
          confidence: 1,
          suggestion: '',
        }
      default:
        throw new Error(`Unexpected model demo input: ${input.alt}`)
    }
  }
}

class CapturingJudge implements JudgeAltText {
  input: JudgeInput | null = null

  async judge(input: JudgeInput): Promise<JudgeVerdict> {
    this.input = input
    return {step: 4, reasoning: 'Accurate.', verdict: 'ok', issue: '', confidence: 1, suggestion: ''}
  }
}

const mockedVision: AzureVisionClient = {
  async analyze() {
    return {
      caption: {text: 'a blue square', confidence: 0.99},
      readText: 'test',
      tags: [
        {name: 'graphic', confidence: 0.95},
        {name: 'low-confidence-noise', confidence: 0.1},
      ],
    }
  },
}

const harness = await createDemoHarness()
try {
  const fixtureUrl = await harness.open()
  const deterministicFindings: Finding[] = []
  await altTextScan({
    page: harness.page,
    addFinding: async finding => {
      deterministicFindings.push(finding)
    },
  })

  const images = await extractImageContext(harness.page)
  const modelCases = images.filter(image => image.outerHTML.includes('data-model-case='))
  __setJudge(new DemoJudge())
  const results = await altTextQuality.evaluate({url: fixtureUrl, images: modelCases})
  const mockedModelFindings: Finding[] = []
  await emitFindings(altTextQuality, results, fixtureUrl, async finding => {
    mockedModelFindings.push(finding)
  })

  const capturingJudge = new CapturingJudge()
  const azureJudge = createAzureAugmentedJudge({inner: capturingJudge, vision: mockedVision})
  await azureJudge.judge({
    imageDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    alt: 'A blue square with the word test in white',
    context: 'Controlled demo page context.',
    naturalWidth: 120,
    naturalHeight: 120,
  })
  const enrichedContext = capturingJudge.input?.context ?? ''
  const expectedAzureSignals = ['Azure CV caption: a blue square', 'Azure CV OCR: test', 'Azure CV tags: graphic']
  for (const signal of expectedAzureSignals) {
    if (!enrichedContext.includes(signal)) throw new Error(`Missing mocked Azure evidence: ${signal}`)
  }

  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as {
    version: string
  }
  console.log(
    JSON.stringify(
      {
        pluginVersion: packageJson.version,
        fixtureUrl,
        evidence: {
          deterministic: 'real plugin scan; no credentials or model calls',
          modelBacked: 'fixed fake judge; real extraction, rule mapping, remediation, and Finding shape',
          azureAugmentation: 'fixed fake Azure client; real context-enrichment decorator',
        },
        deterministicFindings,
        mockedModelFindings,
        mockedAzureSignals: expectedAzureSignals,
      },
      null,
      2,
    ),
  )
} finally {
  __setJudge(null)
  await harness.close()
}
