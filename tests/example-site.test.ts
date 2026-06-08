import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it} from 'vitest'
import {chromium, type Browser, type Page} from 'playwright'
import altTextScan from '../index.js'
import type {Finding} from '../src/types.js'

const errorsPagePath = fileURLToPath(new URL('../example/site-with-errors/alt-text-errors.html', import.meta.url))

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
      expect(ruleIds).toContain(rule.id)
    }
  })
})
