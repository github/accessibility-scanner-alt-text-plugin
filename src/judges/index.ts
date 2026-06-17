// Public entry-point for the judge layer.
//
// Consumers (the rule, the probe, tests) call createJudge() and never reference
// concrete implementations directly. Mode selection is driven by the
// ALT_TEXT_JUDGE_MODE env var unless overridden via the options argument.

import {AzureAugmentedJudge, NotImplementedAzureVisionClient} from './azure-augmented-judge.js'
import type {AzureVisionClient} from './azure-augmented-judge.js'
import {AzureVisionApiClient} from './azure-vision-api-client.js'
import {CopilotJudge} from './copilot-judge.js'
import type {CopilotJudgeConfig} from './copilot-judge.js'
import type {JudgeAltText, JudgeMode} from './types.js'

export type {JudgeAltText, JudgeInput, JudgeVerdict, JudgeMode, Verdict} from './types.js'
export {CopilotJudge} from './copilot-judge.js'
export type {CopilotJudgeConfig} from './copilot-judge.js'
export {AzureAugmentedJudge, NotImplementedAzureVisionClient} from './azure-augmented-judge.js'
export type {AzureVisionClient, AzureVisionAnalysis, AzureAugmentedJudgeConfig} from './azure-augmented-judge.js'
export {AzureVisionApiClient} from './azure-vision-api-client.js'
export type {AzureVisionApiClientConfig} from './azure-vision-api-client.js'
export {SYSTEM_PROMPT, VERDICT_SCHEMA} from './prompt.js'

export type CreateJudgeOptions = {
  // Overrides ALT_TEXT_JUDGE_MODE. Defaults to 'copilot' when neither is set.
  mode?: JudgeMode
  // Forwarded to the inner CopilotJudge.
  copilot?: CopilotJudgeConfig
  // Required for azure-augmented mode. When omitted, the factory auto-constructs
  // an AzureVisionApiClient if AZURE_VISION_ENDPOINT and AZURE_VISION_KEY are set,
  // and falls back to NotImplementedAzureVisionClient (which throws on use)
  // otherwise — so misconfiguration surfaces with a clear error on first call.
  visionClient?: AzureVisionClient
}

function resolveMode(opts: CreateJudgeOptions): JudgeMode {
  if (opts.mode) return opts.mode
  const env = process.env['ALT_TEXT_JUDGE_MODE']
  if (env === 'copilot' || env === 'azure-augmented') return env
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
  if (mode === 'copilot') return copilot
  return new AzureAugmentedJudge({
    inner: copilot,
    vision: resolveVisionClient(opts),
  })
}
