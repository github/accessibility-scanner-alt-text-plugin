// createCopilotJudge — calls a vision-capable model on GitHub Models with the
// shared SYSTEM_PROMPT and VERDICT_SCHEMA, returns a JudgeVerdict.
//
// This is the default JudgeAltText implementation. createAzureAugmentedJudge wraps
// one of these and feeds it an enriched context.

import {SYSTEM_PROMPT} from './prompt.js'
import {VERDICT_SCHEMA} from './verdict-schema.js'
import type {JudgeAltText, JudgeInput, JudgeVerdict} from './types.js'
import {fetchWithRetry} from '../utils/fetch-with-retry.js'

export type CopilotJudgeConfig = {
  // PAT with the `models:read` scope. Defaults to GITHUB_MODELS_TOKEN
  // or GITHUB_TOKEN from the environment.
  token?: string
  // Model id, e.g. "openai/gpt-4o". Defaults to PROBE_MODEL or "openai/gpt-4o".
  model?: string
  // Override for tests or self-hosted gateways.
  endpoint?: string
  apiVersion?: string
  // Sampling temperature. Defaults to 0 for deterministic verdicts.
  temperature?: number
}

const DEFAULT_ENDPOINT = 'https://models.github.ai/inference/chat/completions'
const DEFAULT_API_VERSION = '2026-03-10'
const DEFAULT_MODEL = 'openai/gpt-4o'

type ChatCompletionResponse = {
  choices?: Array<{message?: {content?: string}}>
}

export function createCopilotJudge(config: CopilotJudgeConfig = {}): JudgeAltText {
  const token = config.token ?? process.env['GITHUB_MODELS_TOKEN'] ?? process.env['GITHUB_TOKEN']
  if (!token) {
    throw new Error(
      'createCopilotJudge requires a token. Set GITHUB_MODELS_TOKEN (or GITHUB_TOKEN) ' +
        'to a PAT with the `models:read` scope, or pass {token} to the factory.',
    )
  }
  const model = config.model ?? process.env['PROBE_MODEL'] ?? DEFAULT_MODEL
  const endpoint = config.endpoint ?? DEFAULT_ENDPOINT
  const apiVersion = config.apiVersion ?? DEFAULT_API_VERSION
  const temperature = config.temperature ?? 0

  return {
    async judge(input: JudgeInput): Promise<JudgeVerdict> {
      const userText =
        `Surrounding context: ${input.context || '(none provided)'}\n` +
        `Current alt text: ${JSON.stringify(input.alt)}\n\n` +
        `Evaluate the alt text against the image and respond with the required JSON object.`

      const body = {
        model,
        messages: [
          {role: 'system', content: SYSTEM_PROMPT},
          {
            role: 'user',
            content: [
              {type: 'text', text: userText},
              {type: 'image_url', image_url: {url: input.imageDataUrl, detail: 'high'}},
            ],
          },
        ],
        response_format: {type: 'json_schema', json_schema: VERDICT_SCHEMA},
        temperature,
      }

      const res = await fetchWithRetry(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': apiVersion,
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`inference failed: ${res.status} ${res.statusText}\n${errText}`)
      }

      const json = (await res.json()) as ChatCompletionResponse
      const raw = json.choices?.[0]?.message?.content ?? ''
      try {
        return JSON.parse(raw) as JudgeVerdict
      } catch {
        throw new Error(`failed to parse model output as JSON:\n${raw}`)
      }
    },
  }
}
