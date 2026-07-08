// Shared contract for any backend that judges alt-text quality.

export type Verdict = 'ok' | 'needs-fix' | 'decorative'

// Output the model is forced to produce
export type JudgeVerdict = {
  step: 1 | 2 | 3 | 4
  reasoning: string
  verdict: Verdict
  issue: string
  confidence: number
}

// What the rule hands to a judge
export type JudgeInput = {
  imageDataUrl: string
  alt: string
  context: string
  // Intrinsic pixel dimensions of the image, when known (0/undefined = unknown).
  // The Azure-augmented judge uses these to skip the Azure pre-pass for images below
  // Azure's minimum size; the inner judge still runs.
  naturalWidth?: number
  naturalHeight?: number
}

export interface JudgeAltText {
  judge(input: JudgeInput): Promise<JudgeVerdict>
}

export type JudgeMode = 'copilot' | 'azure-augmented'
