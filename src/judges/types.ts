// Shared contract for any backend that judges alt-text quality.
//
// A "judge" takes one image plus its alt text and surrounding context and
// returns a structured verdict. Implementations may call any combination of
// vision models, OCR services, or rule engines, but they must all return the
// same JudgeVerdict shape so the rule layer never branches on backend.

export type Verdict = 'ok' | 'needs-fix' | 'decorative'

// Output the model is forced to produce (matches VERDICT_SCHEMA in prompt.ts).
// Field order is the generation order; reasoning precedes verdict so the model
// thinks before it classifies.
export type JudgeVerdict = {
  step: 1 | 2 | 3 | 4
  reasoning: string
  verdict: Verdict
  issue: string
  confidence: number
}

// What the rule (or probe) hands to a judge. The image is pre-loaded as a
// data URL so the judge does not have to know about file paths or HTTP.
export type JudgeInput = {
  imageDataUrl: string
  alt: string
  context: string
}

export interface JudgeAltText {
  judge(input: JudgeInput): Promise<JudgeVerdict>
}

export type JudgeMode = 'copilot' | 'azure-augmented'
