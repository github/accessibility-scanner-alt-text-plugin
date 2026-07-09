// Structured-output schema for the alt-text-quality judge. Kept separate from
// the system prompt since it is consumed independently by the model's
// response_format (Structured Outputs strict mode).
//
// Field order in `properties` is the generation order; reasoning is generated
// before verdict to force chain-of-thought before classification, and
// suggestion is generated last so the rewrite is conditioned on the verdict.
export const VERDICT_SCHEMA = {
  name: 'alt_text_verdict',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      step: {type: 'integer', enum: [1, 2, 3, 4]},
      reasoning: {type: 'string'},
      verdict: {type: 'string', enum: ['ok', 'needs-fix', 'decorative']},
      issue: {type: 'string'},
      confidence: {type: 'number', minimum: 0, maximum: 1},
      suggestion: {type: 'string'},
    },
    required: ['step', 'reasoning', 'verdict', 'issue', 'confidence', 'suggestion'],
  },
} as const
