// Content-hash caches for the judge layer
//
//   • CachingJudge        — judgment cache:          hash(image, alt, context) -> verdict
//   • CachingVisionClient — vision-extraction cache: SHA-256(image bytes)      -> Azure analysis
//
// Both caches live for the lifetime of the judge instance, which is a single
// scan run (createJudge() is memoized once per process). They cut redundant,
// billable model/vision calls when the same image — or the same
// image+alt+context tuple — recurs across pages. Logos, icons, and hero images
// are the common case.

import {createHash} from 'node:crypto'
import type {AzureVisionAnalysis, AzureVisionClient} from './azure-augmented-judge.js'
import type {JudgeAltText, JudgeInput, JudgeVerdict} from './types.js'

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

// Hash just the image bytes (the base64 payload of the data URL). Two images
// with identical bytes but different alt/context share this key.
function hashImageBytes(imageDataUrl: string): string {
  const comma = imageDataUrl.indexOf(',')
  const payload = comma === -1 ? imageDataUrl : imageDataUrl.slice(comma + 1)
  return sha256(payload)
}

export class CachingJudge implements JudgeAltText {
  private readonly cache = new Map<string, JudgeVerdict>()

  constructor(private readonly inner: JudgeAltText) {}

  async judge(input: JudgeInput): Promise<JudgeVerdict> {
    const key = sha256(`${hashImageBytes(input.imageDataUrl)}\u0000${input.alt}\u0000${input.context}`)
    if (this.cache.has(key)) return this.cache.get(key)!
    const verdict = await this.inner.judge(input)
    this.cache.set(key, verdict)
    return verdict
  }
}

export class CachingVisionClient implements AzureVisionClient {
  private readonly cache = new Map<string, AzureVisionAnalysis>()

  constructor(private readonly inner: AzureVisionClient) {}

  async analyze(imageDataUrl: string): Promise<AzureVisionAnalysis> {
    const key = hashImageBytes(imageDataUrl)
    if (this.cache.has(key)) return this.cache.get(key)!
    const analysis = await this.inner.analyze(imageDataUrl)
    this.cache.set(key, analysis)
    return analysis
  }
}
