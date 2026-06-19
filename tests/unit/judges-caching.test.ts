import {describe, it, expect} from 'vitest'
import {CachingJudge, CachingVisionClient} from '../../src/judges/caching.js'
import type {AzureVisionAnalysis, AzureVisionClient} from '../../src/judges/index.js'
import type {JudgeAltText, JudgeInput, JudgeVerdict} from '../../src/judges/index.js'

const IMG_A = 'data:image/png;base64,iVBORw0KGgoAAAA='
const IMG_B = 'data:image/png;base64,Zm9vYmFyYmF6Cg=='

function verdict(overrides: Partial<JudgeVerdict> = {}): JudgeVerdict {
  return {step: 4, reasoning: 'reasoning', verdict: 'ok', issue: '', confidence: 0.9, ...overrides}
}

function input(overrides: Partial<JudgeInput> = {}): JudgeInput {
  return {imageDataUrl: IMG_A, alt: 'a dog', context: 'Page URL: https://example.com', ...overrides}
}

// Counts how many times the inner judge actually runs.
class CountingJudge implements JudgeAltText {
  calls = 0
  constructor(private readonly responder: (input: JudgeInput) => JudgeVerdict = () => verdict()) {}
  async judge(input: JudgeInput): Promise<JudgeVerdict> {
    this.calls++
    return this.responder(input)
  }
}

// Counts how many times the inner vision client actually runs.
class CountingVisionClient implements AzureVisionClient {
  calls = 0
  constructor(private readonly responder: () => AzureVisionAnalysis = () => ({readText: 'text'})) {}
  async analyze(): Promise<AzureVisionAnalysis> {
    this.calls++
    return this.responder()
  }
}

describe('CachingJudge', () => {
  it('judges an identical (image, alt, context) tuple only once', async () => {
    const inner = new CountingJudge()
    const judge = new CachingJudge(inner)

    const first = await judge.judge(input())
    const second = await judge.judge(input())

    expect(inner.calls).toBe(1)
    expect(second).toEqual(first)
  })

  it('re-judges when the context differs', async () => {
    const inner = new CountingJudge()
    const judge = new CachingJudge(inner)

    await judge.judge(input({context: 'Page URL: https://a.example'}))
    await judge.judge(input({context: 'Page URL: https://b.example'}))

    expect(inner.calls).toBe(2)
  })

  it('re-judges when the alt text differs', async () => {
    const inner = new CountingJudge()
    const judge = new CachingJudge(inner)

    await judge.judge(input({alt: 'a dog'}))
    await judge.judge(input({alt: 'a cat'}))

    expect(inner.calls).toBe(2)
  })

  it('re-judges when the image bytes differ', async () => {
    const inner = new CountingJudge()
    const judge = new CachingJudge(inner)

    await judge.judge(input({imageDataUrl: IMG_A}))
    await judge.judge(input({imageDataUrl: IMG_B}))

    expect(inner.calls).toBe(2)
  })

  it('returns the cached verdict on a hit', async () => {
    const inner = new CountingJudge(() => verdict({verdict: 'needs-fix', issue: 'vague'}))
    const judge = new CachingJudge(inner)

    const hit = await judge.judge(input())
    const cached = await judge.judge(input())

    expect(cached.verdict).toBe('needs-fix')
    expect(cached).toEqual(hit)
  })

  it('does not cache a thrown error', async () => {
    let attempt = 0
    const inner = new CountingJudge(() => {
      attempt++
      if (attempt === 1) throw new Error('transient')
      return verdict()
    })
    const judge = new CachingJudge(inner)

    await expect(judge.judge(input())).rejects.toThrow('transient')
    await expect(judge.judge(input())).resolves.toEqual(verdict())
    expect(inner.calls).toBe(2)
  })
})

describe('CachingVisionClient', () => {
  it('analyzes identical image bytes only once', async () => {
    const inner = new CountingVisionClient()
    const client = new CachingVisionClient(inner)

    const first = await client.analyze(IMG_A)
    const second = await client.analyze(IMG_A)

    expect(inner.calls).toBe(1)
    expect(second).toEqual(first)
  })

  it('re-analyzes when the image bytes differ', async () => {
    const inner = new CountingVisionClient()
    const client = new CachingVisionClient(inner)

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
    const client = new CachingVisionClient(inner)

    await expect(client.analyze(IMG_A)).rejects.toThrow('azure down')
    await expect(client.analyze(IMG_A)).resolves.toEqual({readText: 'text'})
  })
})
