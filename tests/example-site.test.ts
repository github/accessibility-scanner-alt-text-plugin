import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest'
import {chromium, type Browser, type Page} from 'playwright'
import altTextScan from '../index.js'
import type {Finding} from '../src/types.js'

const errorsPagePath = fileURLToPath(new URL('../example/site-with-errors/alt-text-errors.html', import.meta.url))
const fixtureWithDisabledRule = fileURLToPath(new URL('./fixtures/with-disabled-rule', import.meta.url))

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
  await page.close()
})

describe('example site-with-errors', () => {
  it('produces a finding for every alt-text rule', async () => {
    const body = loadErrorsPageBody()
    await page.setContent(`<!doctype html><html><body>${body}</body></html>`)

    const findings: Finding[] = []
    await altTextScan({
      page,
      addFinding: async finding => {
        findings.push(finding)
      },
    })

    const ruleIds = new Set(findings.map(f => f.ruleId))

    const {allRules} = await import('../src/rules/index.js')
    for (const rule of allRules) {
      // Opt-in rules (defaultEnabled === false) don't run without explicit
      // configuration, so they're not expected to produce findings here.
      if (rule.defaultEnabled === false) continue
      expect(ruleIds).toContain(rule.id)
    }
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
