// Public entry-point for the judge layer.

import {AzureAugmentedJudge, NotImplementedAzureVisionClient} from './azure-augmented-judge.js'
import type {AzureVisionClient} from './azure-augmented-judge.js'
import {AzureVisionApiClient} from './azure-vision-api-client.js'
import {CachingJudge, CachingVisionClient} from './caching.js'
import {CopilotJudge} from './copilot-judge.js'
import type {CopilotJudgeConfig} from './copilot-judge.js'
import type {JudgeAltText, JudgeMode} from './types.js'

export type {JudgeAltText, JudgeInput, JudgeVerdict, JudgeMode, Verdict} from './types.js'
export {CopilotJudge} from './copilot-judge.js'
export type {CopilotJudgeConfig} from './copilot-judge.js'
export {AzureAugmentedJudge, NotImplementedAzureVisionClient} from './azure-augmented-judge.js'
export type {AzureVisionClient, AzureVisionAnalysis, AzureAugmentedJudgeConfig} from './azure-augmented-judge.js'
export {AzureVisionApiClient} from './azure-vision-api-client.js'
export {CachingJudge, CachingVisionClient} from './caching.js'
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
    return new AzureVisionApiClient()
  }
  return new NotImplementedAzureVisionClient()
}

export function createJudge(opts: CreateJudgeOptions = {}): JudgeAltText {
  const mode = resolveMode(opts)
  const copilot = new CopilotJudge(opts.copilot)
  // The judgment cache (hash(image, alt, context) -> verdict) wraps the
  // outermost judge, so a hit skips everything below it — including the Azure
  // pre-pass. The vision-extraction cache (image bytes -> Azure analysis) wraps
  // just the Azure client, where two-stage mode gets most of its reuse.
  if (mode === 'copilot') return new CachingJudge(copilot)
  return new CachingJudge(
    new AzureAugmentedJudge({
      inner: copilot,
      vision: new CachingVisionClient(resolveVisionClient(opts)),
    }),
  )
}
