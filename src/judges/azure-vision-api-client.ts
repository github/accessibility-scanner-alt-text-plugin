// Real Azure AI Vision (Image Analysis 4.0) client. Implements the
// AzureVisionClient interface that the Azure-augmented judge depends on.

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
  // West Europe, etc.). See the Image Analysis 4.0 docs for the full feature
  // set and region availability:
  // https://learn.microsoft.com/azure/ai-services/computer-vision/how-to/call-analyze-image-40
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

export function createAzureVisionApiClient(config: AzureVisionApiClientConfig = {}): AzureVisionClient {
  const rawEndpoint = config.endpoint ?? process.env['AZURE_VISION_ENDPOINT']
  const key = config.key ?? process.env['AZURE_VISION_KEY']
  if (!rawEndpoint) {
    throw new Error(
      'createAzureVisionApiClient requires an endpoint. Set AZURE_VISION_ENDPOINT or pass {endpoint} to the factory.',
    )
  }
  if (!key) {
    throw new Error('createAzureVisionApiClient requires a key. Set AZURE_VISION_KEY or pass {key} to the factory.')
  }
  const endpoint = rawEndpoint.replace(/\/$/, '')
  const apiVersion = config.apiVersion ?? process.env['AZURE_VISION_API_VERSION'] ?? DEFAULT_API_VERSION
  const features = config.features ?? process.env['AZURE_VISION_FEATURES'] ?? DEFAULT_FEATURES

  return {
    async analyze(imageDataUrl: string): Promise<AzureVisionAnalysis> {
      const bytes = decodeDataUrl(imageDataUrl)

      const url = new URL(`${endpoint}/computervision/imageanalysis:analyze`)
      url.searchParams.set('api-version', apiVersion)
      url.searchParams.set('features', features)

      const res = await fetchWithRetry(url, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': key,
          'Content-Type': 'application/octet-stream',
        },
        body: new Blob([Uint8Array.from(bytes)]),
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`Azure Vision request failed: ${res.status} ${res.statusText}\n${errText}`)
      }

      const raw = (await res.json()) as AzureRawResponse
      return toVisionAnalysis(raw)
    },
  }
}

function decodeDataUrl(dataUrl: string): Buffer {
  const match = /^data:[^,]*;base64,(.+)$/s.exec(dataUrl)
  if (!match) throw new Error('createAzureVisionApiClient: analyze expects a base64 data URL.')
  return Buffer.from(match[1]!, 'base64')
}

// Reduces Azure's verbose raw response to just the fields the judge consumes.
function toVisionAnalysis(raw: AzureRawResponse): AzureVisionAnalysis {
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
