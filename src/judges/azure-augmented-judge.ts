// AzureAugmentedJudge — decorator over a JudgeAltText (typically CopilotJudge)
// that runs an Azure Computer Vision pre-pass and folds the result into the
// context handed to the inner judge.
//
// The decorator class, the AzureVisionClient interface, and the context
// composition logic are all production code today. The only piece that is
// not implemented is a real AzureVisionClient — see NotImplementedAzureVisionClient
// at the bottom of this file. To enable azure-augmented mode in production:
//
//   1. npm install @azure/ai-vision-image-analysis (or your preferred SDK)
//   2. Create src/judges/azure-vision-api-client.ts implementing AzureVisionClient
//      against the SDK; shape the SDK response into AzureVisionAnalysis.
//   3. Wire it into the factory:
//        createJudge({mode: 'azure-augmented', visionClient: new AzureVisionApiClient(creds)})
//
// No other file in the codebase has to change.

import type {JudgeAltText, JudgeInput, JudgeVerdict} from './types.js'

// Narrowed shape of an Azure AI Vision 4.0 Image Analysis response — only the
// fields we actually feed into the Copilot judge.
export type AzureVisionAnalysis = {
  caption?: {text: string; confidence: number}
  denseCaptions?: Array<{text: string; confidence: number}>
  // OCR result, concatenated to a single string. Useful for images-of-text
  // (logos, screenshots, charts with embedded labels) where GPT-4o is shakier.
  readText?: string
  tags?: Array<{name: string; confidence: number}>
}

// The capability the decorator depends on. Abstracted so the SDK choice
// (Azure SDK v4 vs REST) is swappable, and so tests can mock it cheaply.
export interface AzureVisionClient {
  analyze(imageDataUrl: string): Promise<AzureVisionAnalysis>
}

export type AzureAugmentedJudgeConfig = {
  // The judge that does the actual reasoning. Typically a CopilotJudge.
  inner: JudgeAltText
  // The Azure CV client. Today this is NotImplementedAzureVisionClient by
  // default; replace with a real client to enable the mode.
  vision: AzureVisionClient
  // Tags below this confidence are dropped before being passed to the model.
  tagConfidenceThreshold?: number
  // Maximum number of tags forwarded to the inner judge.
  maxTags?: number
}

const DEFAULT_TAG_CONFIDENCE = 0.7
const DEFAULT_MAX_TAGS = 8

export class AzureAugmentedJudge implements JudgeAltText {
  private readonly inner: JudgeAltText
  private readonly vision: AzureVisionClient
  private readonly tagConfidenceThreshold: number
  private readonly maxTags: number

  constructor(config: AzureAugmentedJudgeConfig) {
    this.inner = config.inner
    this.vision = config.vision
    this.tagConfidenceThreshold = config.tagConfidenceThreshold ?? DEFAULT_TAG_CONFIDENCE
    this.maxTags = config.maxTags ?? DEFAULT_MAX_TAGS
  }

  async judge(input: JudgeInput): Promise<JudgeVerdict> {
    let analysis: AzureVisionAnalysis | null = null
    try {
      analysis = await this.vision.analyze(input.imageDataUrl)
    } catch (err) {
      // Azure CV is auxiliary grounding, not a hard dependency. If it fails
      // (image too small, transient 5xx, rate-limit, etc.), degrade gracefully
      // to Copilot-only for this image rather than failing the whole judgment.
      console.warn(
        `[alt-text-quality] Azure pre-pass failed; falling back to Copilot-only for this image. ${err instanceof Error ? err.message : String(err)}`,
      )
    }
    const enriched = analysis ? this.composeContext(input.context, analysis) : input.context
    return this.inner.judge({...input, context: enriched})
  }

  private composeContext(original: string, a: AzureVisionAnalysis): string {
    const parts: string[] = []
    if (a.caption) parts.push(`Azure CV caption: ${a.caption.text}`)
    if (a.denseCaptions?.length) {
      parts.push(`Azure CV regions: ${a.denseCaptions.map(c => c.text).join('; ')}`)
    }
    if (a.readText) parts.push(`Azure CV OCR: ${a.readText}`)
    if (a.tags?.length) {
      const top = a.tags
        .filter(t => t.confidence >= this.tagConfidenceThreshold)
        .slice(0, this.maxTags)
        .map(t => t.name)
      if (top.length) parts.push(`Azure CV tags: ${top.join(', ')}`)
    }
    if (parts.length === 0) return original
    return `${original}\n\nAzure Computer Vision pre-analysis (use as supplementary signals; the page's own context above is authoritative):\n${parts.join('\n')}`
  }
}

// Today's placeholder AzureVisionClient. Throws on use with a clear message
// pointing at the file-level setup instructions. Replace with a real SDK-backed
// client when adopting Azure.
export class NotImplementedAzureVisionClient implements AzureVisionClient {
  async analyze(_imageDataUrl: string): Promise<AzureVisionAnalysis> {
    throw new Error(
      'AzureAugmentedJudge was invoked but no real AzureVisionClient is wired. ' +
        'See src/judges/azure-augmented-judge.ts for the integration steps, then pass ' +
        'a real client via createJudge({mode: "azure-augmented", visionClient}).',
    )
  }
}
