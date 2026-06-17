// AzureAugmentedJudge — decorator over a JudgeAltText (typically CopilotJudge)
// that runs an Azure Computer Vision pre-pass and folds the result into the
// context handed to the inner judge.

import type {JudgeAltText, JudgeInput, JudgeVerdict} from './types.js'

// Narrowed shape of an Azure AI Vision 4.0 Image Analysis response
export type AzureVisionAnalysis = {
  caption?: {text: string; confidence: number}
  denseCaptions?: Array<{text: string; confidence: number}>
  readText?: string
  tags?: Array<{name: string; confidence: number}>
}

export interface AzureVisionClient {
  analyze(imageDataUrl: string): Promise<AzureVisionAnalysis>
}

export type AzureAugmentedJudgeConfig = {
  inner: JudgeAltText
  vision: AzureVisionClient
  // Tags below this confidence are dropped before being passed to the model.
  tagConfidenceThreshold?: number
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
      // If it fails (image too small, transient 5xx, rate-limit, etc.), degrade
      // to Copilot-only for this image
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
    const preamble =
      'Azure Computer Vision pre-analysis (supplementary signals only — treat with skepticism). ' +
      "The page's own context above and your own direct view of the image are authoritative and override these signals. " +
      'Azure can be wrong: ignore any OCR text that does not visibly appear in the image, and disregard tags that ' +
      'conflict with what you see. ' +
      'When the image is a link, button, or other functional control, these signals describe the picture itself, ' +
      "not the control's purpose — do not let them push you toward a longer or more literal description, and do not " +
      'penalize a concise alt that correctly conveys where the link goes or what the control does. ' +
      'Lean on these signals mainly to confirm fine-grained, hard-to-read details ' +
      '(exact line numbers, filenames, digits, embedded labels) that you would otherwise be unsure of:'
    return `${original}\n\n${preamble}\n${parts.join('\n')}`
  }
}

// Fallback AzureVisionClient used when azure-augmented mode is selected but no
// Azure credentials are configured.
export class NotImplementedAzureVisionClient implements AzureVisionClient {
  async analyze(_imageDataUrl: string): Promise<AzureVisionAnalysis> {
    throw new Error(
      'AzureAugmentedJudge was invoked but no Azure Vision credentials are configured. ' +
        'Set AZURE_VISION_ENDPOINT and AZURE_VISION_KEY so createJudge() auto-wires AzureVisionApiClient, ' +
        'or pass an explicit client via createJudge({mode: "azure-augmented", visionClient}).',
    )
  }
}
