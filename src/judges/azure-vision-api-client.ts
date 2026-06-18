// Real Azure AI Vision (Image Analysis 4.0) client. Implements the
// AzureVisionClient interface that AzureAugmentedJudge depends on.

import {Buffer} from 'node:buffer'
import type {AzureVisionAnalysis, AzureVisionClient} from './azure-augmented-judge.js'
import {fetchWithRetry} from '../utils/fetch-with-retry.js'

export type AzureVisionApiClientConfig = {
  // Defaults to AZURE_VISION_ENDPOINT.
  endpoint?: string
  // Defaults to AZURE_VISION_KEY.
  key?: string
  // Image Analysis API version. Defaults to the GA version.
  apiVersion?: string
  // Comma-separated feature list. The decorator's composeContext can use any
  // subset of: caption, denseCaptions, read, tags. Note: caption and
  // denseCaptions are restricted to specific regions (East US, West US,
  // West Europe, etc.)
  features?: string
}

const DEFAULT_API_VERSION = '2024-02-01'
const DEFAULT_FEATURES = 'read,tags'

// Narrowed shape of the Image Analysis 4.0 response.
type AzureRawResponse = {
  captionResult?: {text: string; confidence: number}
  denseCaptionsResult?: {values: Array<{text: string; confidence: number}>}
  readResult?: {
    blocks?: Array<{
      lines?: Array<{text: string}>
    }>
  }
  tagsResult?: {values: Array<{name: string; confidence: number}>}
}

export class AzureVisionApiClient implements AzureVisionClient {
  private readonly endpoint: string
  private readonly key: string
  private readonly apiVersion: string
  private readonly features: string

  constructor(config: AzureVisionApiClientConfig = {}) {
    const endpoint = config.endpoint ?? process.env['AZURE_VISION_ENDPOINT']
    const key = config.key ?? process.env['AZURE_VISION_KEY']
    if (!endpoint) {
      throw new Error(
        'AzureVisionApiClient requires an endpoint. Set AZURE_VISION_ENDPOINT or pass {endpoint} to the constructor.',
      )
    }
    if (!key) {
      throw new Error('AzureVisionApiClient requires a key. Set AZURE_VISION_KEY or pass {key} to the constructor.')
    }
    this.endpoint = endpoint.replace(/\/$/, '')
    this.key = key
    this.apiVersion = config.apiVersion ?? process.env['AZURE_VISION_API_VERSION'] ?? DEFAULT_API_VERSION
    this.features = config.features ?? process.env['AZURE_VISION_FEATURES'] ?? DEFAULT_FEATURES
  }

  async analyze(imageDataUrl: string): Promise<AzureVisionAnalysis> {
    const bytes = decodeDataUrl(imageDataUrl)

    const url = new URL(`${this.endpoint}/computervision/imageanalysis:analyze`)
    url.searchParams.set('api-version', this.apiVersion)
    url.searchParams.set('features', this.features)

    const res = await fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': this.key,
        'Content-Type': 'application/octet-stream',
      },
      body: new Blob([Uint8Array.from(bytes)]),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Azure Vision request failed: ${res.status} ${res.statusText}\n${errText}`)
    }

    const raw = (await res.json()) as AzureRawResponse
    return shape(raw)
  }
}

function decodeDataUrl(dataUrl: string): Buffer {
  const match = /^data:[^;]+;base64,(.+)$/.exec(dataUrl)
  if (!match) throw new Error('AzureVisionApiClient.analyze expects a base64 data URL.')
  return Buffer.from(match[1]!, 'base64')
}

function shape(raw: AzureRawResponse): AzureVisionAnalysis {
  const out: AzureVisionAnalysis = {}
  if (raw.captionResult) out.caption = raw.captionResult
  if (raw.denseCaptionsResult?.values?.length) out.denseCaptions = raw.denseCaptionsResult.values
  if (raw.readResult?.blocks?.length) {
    const lines: string[] = []
    for (const block of raw.readResult.blocks) {
      for (const line of block.lines ?? []) lines.push(line.text)
    }
    if (lines.length) out.readText = lines.join('\n')
  }
  if (raw.tagsResult?.values?.length) out.tags = raw.tagsResult.values
  return out
}
