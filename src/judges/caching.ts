// Content-hash caches for the judge layer
//
//   • createCachingJudge        — judgment cache:          hash(image, alt, context) -> verdict
//   • createCachingVisionClient — vision-extraction cache: SHA-256(image bytes)      -> Azure analysis
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

export function createCachingJudge(inner: JudgeAltText): JudgeAltText {
  const cache = new Map<string, JudgeVerdict>()
  return {
    async judge(input: JudgeInput): Promise<JudgeVerdict> {
      const key = sha256(`${hashImageBytes(input.imageDataUrl)}\u0000${input.alt}\u0000${input.context}`)
      if (cache.has(key)) return cache.get(key)!
      const verdict = await inner.judge(input)
      cache.set(key, verdict)
      return verdict
    },
  }
}

export function createCachingVisionClient(inner: AzureVisionClient): AzureVisionClient {
  const cache = new Map<string, AzureVisionAnalysis>()
  return {
    async analyze(imageDataUrl: string): Promise<AzureVisionAnalysis> {
      const key = hashImageBytes(imageDataUrl)
      if (cache.has(key)) return cache.get(key)!
      const analysis = await inner.analyze(imageDataUrl)
      cache.set(key, analysis)
      return analysis
    },
  }
}
