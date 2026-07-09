import {describe, it, expect} from 'vitest'
import {createCachingJudge, createCachingVisionClient} from '../../src/judges/caching.js'
import type {AzureVisionAnalysis, AzureVisionClient} from '../../src/judges/index.js'
import type {JudgeAltText, JudgeInput, JudgeVerdict} from '../../src/judges/index.js'

const IMG_A = 'data:image/png;base64,iVBORw0KGgoAAAA='
const IMG_B = 'data:image/png;base64,Zm9vYmFyYmF6Cg=='

function verdict(overrides: Partial<JudgeVerdict> = {}): JudgeVerdict {
  return {step: 4, reasoning: 'reasoning', verdict: 'ok', issue: '', confidence: 0.9, suggestion: '', ...overrides}
}

function input(overrides: Partial<JudgeInput> = {}): JudgeInput {
  return {imageDataUrl: IMG_A, alt: 'a dog', context: 'Page URL: https://example.com', ...overrides}
}

// Counts how many times the inner judge actually runs.
type CountingJudge = JudgeAltText & {calls: number}
function createCountingJudge(responder: (input: JudgeInput) => JudgeVerdict = () => verdict()): CountingJudge {
  const counter: CountingJudge = {
    calls: 0,
    async judge(input: JudgeInput): Promise<JudgeVerdict> {
      counter.calls++
      return responder(input)
    },
  }
  return counter
}

// Counts how many times the inner vision client actually runs.
type CountingVisionClient = AzureVisionClient & {calls: number}
function createCountingVisionClient(
  responder: () => AzureVisionAnalysis = () => ({readText: 'text'}),
): CountingVisionClient {
  const counter: CountingVisionClient = {
    calls: 0,
    async analyze(): Promise<AzureVisionAnalysis> {
      counter.calls++
      return responder()
    },
  }
  return counter
}

describe('createCachingJudge', () => {
  it('judges an identical (image, alt, context) tuple only once', async () => {
    const inner = createCountingJudge()
    const judge = createCachingJudge(inner)

    const first = await judge.judge(input())
    const second = await judge.judge(input())

    expect(inner.calls).toBe(1)
    expect(second).toEqual(first)
  })

  it('re-judges when the context differs', async () => {
    const inner = createCountingJudge()
    const judge = createCachingJudge(inner)

    await judge.judge(input({context: 'Page URL: https://a.example'}))
    await judge.judge(input({context: 'Page URL: https://b.example'}))

    expect(inner.calls).toBe(2)
  })

  it('re-judges when the alt text differs', async () => {
    const inner = createCountingJudge()
    const judge = createCachingJudge(inner)

    await judge.judge(input({alt: 'a dog'}))
    await judge.judge(input({alt: 'a cat'}))

    expect(inner.calls).toBe(2)
  })

  it('re-judges when the image bytes differ', async () => {
    const inner = createCountingJudge()
    const judge = createCachingJudge(inner)

    await judge.judge(input({imageDataUrl: IMG_A}))
    await judge.judge(input({imageDataUrl: IMG_B}))

    expect(inner.calls).toBe(2)
  })

  it('returns the cached verdict on a hit', async () => {
    const inner = createCountingJudge(() => verdict({verdict: 'needs-fix', issue: 'vague'}))
    const judge = createCachingJudge(inner)

    const hit = await judge.judge(input())
    const cached = await judge.judge(input())

    expect(cached.verdict).toBe('needs-fix')
    expect(cached).toEqual(hit)
  })

  it('does not cache a thrown error', async () => {
    let attempt = 0
    const inner = createCountingJudge(() => {
      attempt++
      if (attempt === 1) throw new Error('transient')
      return verdict()
    })
    const judge = createCachingJudge(inner)

    await expect(judge.judge(input())).rejects.toThrow('transient')
    await expect(judge.judge(input())).resolves.toEqual(verdict())
    expect(inner.calls).toBe(2)
  })
})

describe('createCachingVisionClient', () => {
  it('analyzes identical image bytes only once', async () => {
    const inner = createCountingVisionClient()
    const client = createCachingVisionClient(inner)

    const first = await client.analyze(IMG_A)
    const second = await client.analyze(IMG_A)

    expect(inner.calls).toBe(1)
    expect(second).toEqual(first)
  })

  it('re-analyzes when the image bytes differ', async () => {
    const inner = createCountingVisionClient()
    const client = createCachingVisionClient(inner)

    await client.analyze(IMG_A)
    await client.analyze(IMG_B)

    expect(inner.calls).toBe(2)
  })

  it('does not cache a thrown error', async () => {
    let attempt = 0
    const inner: AzureVisionClient = {
      async analyze(): Promise<AzureVisionAnalysis> {
        attempt++
        if (attempt === 1) throw new Error('azure down')
        return {readText: 'text'}
      },
    }
    const client = createCachingVisionClient(inner)

    await expect(client.analyze(IMG_A)).rejects.toThrow('azure down')
    await expect(client.analyze(IMG_A)).resolves.toEqual({readText: 'text'})
  })
})
