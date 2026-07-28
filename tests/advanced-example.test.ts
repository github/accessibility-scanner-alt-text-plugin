import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {emitFindings} from '../src/findings.js'
import {extractImageContext} from '../src/extract-image-context.js'
import type {JudgeAltText, JudgeInput, JudgeVerdict} from '../src/judges/types.js'
import {__setJudge, altTextQuality} from '../src/rules/alt-text-quality.js'
import type {Finding} from '../src/types.js'
import {createDemoHarness, type DemoHarness} from '../scripts/demo-support.js'

class FixtureJudge implements JudgeAltText {
  async judge(input: JudgeInput): Promise<JudgeVerdict> {
    if (input.alt.includes('best accessibility scanner')) {
      return {
        step: 4,
        reasoning: 'Keyword list instead of an image description.',
        verdict: 'needs-fix',
        issue: 'keyword-stuffing',
        confidence: 1,
        suggestion: 'Blue square with the word test in white.',
      }
    }
    if (input.alt.includes('red warning triangle')) {
      return {
        step: 4,
        reasoning: 'The description does not match the image.',
        verdict: 'needs-fix',
        issue: 'inaccurate',
        confidence: 1,
        suggestion: 'Blue square with the word test in white.',
      }
    }
    return {step: 4, reasoning: 'Accurate.', verdict: 'ok', issue: '', confidence: 1, suggestion: ''}
  }
}

let harness: DemoHarness

beforeAll(async () => {
  harness = await createDemoHarness()
})

afterAll(async () => {
  __setJudge(null)
  await harness.close()
})

describe('advanced example site', () => {
  it('demonstrates model-only findings and generated remediation without credentials', async () => {
    const url = await harness.open('advanced')
    const images = await extractImageContext(harness.page)
    expect(images).toHaveLength(3)

    __setJudge(new FixtureJudge())
    const results = await altTextQuality.evaluate({url, images})
    const findings: Finding[] = []
    await emitFindings(altTextQuality, results, url, async finding => {
      findings.push(finding)
    })

    expect(findings).toHaveLength(2)
    expect(findings.map(finding => finding.problemShort)).toEqual([
      expect.stringContaining('keyword-stuffed'),
      expect.stringContaining('inaccurate'),
    ])
    expect(findings.every(finding => finding.solutionShort.includes('Blue square with the word test'))).toBe(true)
  })
})
