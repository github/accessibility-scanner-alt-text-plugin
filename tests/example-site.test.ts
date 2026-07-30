import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest'
import {chromium, type Browser, type Page} from 'playwright'
import altTextScan from '../index.js'
import {extractImageContext} from '../src/extract-image-context.js'
import type {JudgeAltText, JudgeInput, JudgeVerdict} from '../src/judges/index.js'
import {altTextQuality, __setJudge} from '../src/rules/alt-text-quality.js'
import type {Finding, RuleResult} from '../src/types.js'

const errorsPagePath = fileURLToPath(new URL('../example/site-with-errors/alt-text-errors.html', import.meta.url))
const fixtureWithDisabledRule = fileURLToPath(new URL('./fixtures/with-disabled-rule', import.meta.url))
const DATA_URL = 'data:image/png;base64,iVBORw0KGgo='
const deterministicRuleIds = [
  'missing-alt-text',
  'placeholder-alt-text',
  'filename-alt-text',
  'vague-alt-text',
  'repeated-alt-text',
] as const

class FakeJudge implements JudgeAltText {
  readonly calls: JudgeInput[] = []

  async judge(input: JudgeInput): Promise<JudgeVerdict> {
    this.calls.push(input)

    switch (input.alt) {
      case 'running shoes, cheap shoes, buy shoes online, best shoes 2026':
        return {
          step: 4,
          reasoning: 'This is a keyword list rather than an image description.',
          verdict: 'needs-fix',
          issue: 'keyword-stuffing',
          confidence: 0.99,
          suggestion: 'Blue square with the word test',
        }
      case 'A team collaborating around a table':
        return {
          step: 4,
          reasoning: 'The alt text does not match the controlled image.',
          verdict: 'needs-fix',
          issue: 'inaccurate',
          confidence: 0.99,
          suggestion: 'Blue square with the word test',
        }
      case 'Blue divider pattern':
        return {
          step: 4,
          reasoning: 'The visible caption already communicates its purpose.',
          verdict: 'decorative',
          issue: '',
          confidence: 0.99,
          suggestion: '',
        }
      case 'A blue square with the word test in white':
        return {
          step: 4,
          reasoning: 'The alt text accurately describes the controlled image.',
          verdict: 'ok',
          issue: '',
          confidence: 0.99,
          suggestion: '',
        }
      default:
        throw new Error(`Unexpected model demo input: ${input.alt}`)
    }
  }
}

// Strips the Jekyll/Liquid front matter so the raw <img> markup can be loaded
// directly into Playwright without running a Jekyll build.
function loadErrorsPageBody(): string {
  const raw = readFileSync(errorsPagePath, 'utf8')
  return raw.replace(/^---\n[\s\S]*?\n---\n/, '')
}

let browser: Browser
let page: Page

beforeAll(async () => {
  browser = await chromium.launch()
})

afterAll(async () => {
  await browser.close()
})

beforeEach(async () => {
  page = await browser.newPage()
})

afterEach(async () => {
  __setJudge(null)
  await page.close()
})

describe('example site-with-errors', () => {
  it('produces exactly one real finding for each deterministic fixture case', async () => {
    const body = loadErrorsPageBody()
    await page.setContent(`<!doctype html><html><body>${body}</body></html>`)

    const findings: Finding[] = []
    await altTextScan({
      page,
      addFinding: async finding => {
        findings.push(finding)
      },
    })

    expect(findings).toHaveLength(deterministicRuleIds.length)
    for (const ruleId of deterministicRuleIds) {
      const matching = findings.filter(finding => finding.ruleId === ruleId)
      expect(matching).toHaveLength(1)
      expect(matching[0]!.html).toContain(`data-expected-rule="${ruleId}"`)
    }
  })

  it('maps model-backed fixture cases through deterministic mocked verdicts', async () => {
    const body = loadErrorsPageBody()
    await page.setContent(`<!doctype html><html><head><title>Alt text demo</title></head><body>${body}</body></html>`)

    const images = await extractImageContext(page)
    const modelCases = images
      .filter(image => image.outerHTML.includes('data-model-case='))
      .map(image => ({...image, src: DATA_URL}))
    expect(modelCases).toHaveLength(4)

    const fakeJudge = new FakeJudge()
    __setJudge(fakeJudge)
    const results = (await altTextQuality.evaluate({
      url: 'https://example.test/alt-text-errors/',
      images: modelCases,
    })) as RuleResult[]

    expect(fakeJudge.calls).toHaveLength(4)
    expect(results).toHaveLength(3)
    expect(fakeJudge.calls.every(call => call.context.includes('Page title: "Alt text demo"'))).toBe(true)
    expect(fakeJudge.calls.every(call => call.context.includes('Nearest heading above the image'))).toBe(true)
    expect(fakeJudge.calls.every(call => call.context.includes('Adjacent figcaption'))).toBe(true)

    const keywordStuffing = results.find(result => result.image.alt?.startsWith('running shoes'))
    expect(keywordStuffing?.problemShort).toContain('keyword-stuffed')

    const inaccurate = results.find(result => result.image.alt === 'A team collaborating around a table')
    expect(inaccurate?.problemShort).toContain('inaccurate')
    expect(inaccurate?.solutionShort).toContain('Blue square with the word test')

    const decorative = results.find(result => result.image.alt === 'Blue divider pattern')
    expect(decorative?.solutionShort).toContain('alt=""')

    expect(results.some(result => result.image.alt === 'A blue square with the word test in white')).toBe(false)
  })

  it('produces no findings for an image with valid alt text', async () => {
    await page.setContent(
      `<!doctype html><html><body><img src="/assets/img/test-image.svg" alt="A blue square with the word test in white text"></body></html>`,
    )

    const findings: Finding[] = []
    await altTextScan({
      page,
      addFinding: async finding => {
        findings.push(finding)
      },
    })

    expect(findings).toHaveLength(0)
  })

  it('skips a rule disabled in the consumer config.json', async () => {
    const originalCwd = process.cwd()
    process.chdir(fixtureWithDisabledRule)
    vi.resetModules()
    try {
      const {default: altTextScanWithConfig} = await import('../index.js')

      const body = loadErrorsPageBody()
      await page.setContent(`<!doctype html><html><body>${body}</body></html>`)

      const findings: Finding[] = []
      await altTextScanWithConfig({
        page,
        addFinding: async finding => {
          findings.push(finding)
        },
      })

      const ruleIds = new Set(findings.map(f => f.ruleId))
      // The disabled rule must not fire.
      expect(ruleIds.has('missing-alt-text')).toBe(false)
      const {allRules} = await import('../src/rules/index.js')
      for (const rule of allRules) {
        if (rule.id === 'missing-alt-text') continue
        if (rule.defaultEnabled === false) continue
        expect(ruleIds).toContain(rule.id)
      }
    } finally {
      process.chdir(originalCwd)
    }
  })
})
