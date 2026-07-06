// Public entry-point for the judge layer.

import {createAzureAugmentedJudge, createNotImplementedAzureVisionClient} from './azure-augmented-judge.js'
import type {AzureVisionClient} from './azure-augmented-judge.js'
import {createAzureVisionApiClient} from './azure-vision-api-client.js'
import {createCachingJudge, createCachingVisionClient} from './caching.js'
import {createCopilotJudge} from './copilot-judge.js'
import type {CopilotJudgeConfig} from './copilot-judge.js'
import type {JudgeAltText, JudgeMode} from './types.js'

export type {JudgeAltText, JudgeInput, JudgeVerdict, JudgeMode, Verdict} from './types.js'
export {createCopilotJudge} from './copilot-judge.js'
export type {CopilotJudgeConfig} from './copilot-judge.js'
export {createAzureAugmentedJudge, createNotImplementedAzureVisionClient} from './azure-augmented-judge.js'
export type {AzureVisionClient, AzureVisionAnalysis, AzureAugmentedJudgeConfig} from './azure-augmented-judge.js'
export {createAzureVisionApiClient} from './azure-vision-api-client.js'
export {createCachingJudge, createCachingVisionClient} from './caching.js'
export type {AzureVisionApiClientConfig} from './azure-vision-api-client.js'
export {SYSTEM_PROMPT} from './prompt.js'
export {VERDICT_SCHEMA} from './verdict-schema.js'

export type CreateJudgeOptions = {
  mode?: JudgeMode
  copilot?: CopilotJudgeConfig
  visionClient?: AzureVisionClient
}

function resolveMode(opts: CreateJudgeOptions): JudgeMode {
  if (opts.mode) return opts.mode
  const env = process.env['ALT_TEXT_JUDGE_MODE']
  if (env === 'copilot' || env === 'azure-augmented') return env
  if (process.env['AZURE_VISION_ENDPOINT'] && process.env['AZURE_VISION_KEY']) {
    return 'azure-augmented'
  }
  return 'copilot'
}

function resolveVisionClient(opts: CreateJudgeOptions): AzureVisionClient {
  if (opts.visionClient) return opts.visionClient
  if (process.env['AZURE_VISION_ENDPOINT'] && process.env['AZURE_VISION_KEY']) {
    return createAzureVisionApiClient()
  }
  return createNotImplementedAzureVisionClient()
}

export function createJudge(opts: CreateJudgeOptions = {}): JudgeAltText {
  const mode = resolveMode(opts)
  const copilot = createCopilotJudge(opts.copilot)
  // The judgment cache (hash(image, alt, context) -> verdict) wraps the
  // outermost judge, so a hit skips everything below it — including the Azure
  // pre-pass. The vision-extraction cache (image bytes -> Azure analysis) wraps
  // just the Azure client, where two-stage mode gets most of its reuse.
  if (mode === 'copilot') return createCachingJudge(copilot)
  return createCachingJudge(
    createAzureAugmentedJudge({
      inner: copilot,
      vision: createCachingVisionClient(resolveVisionClient(opts)),
    }),
  )
}
