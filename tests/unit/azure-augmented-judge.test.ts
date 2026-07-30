import {describe, expect, it, vi} from 'vitest'
import {
  createAzureAugmentedJudge,
  type AzureVisionClient,
  type JudgeAltText,
  type JudgeInput,
  type JudgeVerdict,
} from '../../src/judges/index.js'

class CapturingJudge implements JudgeAltText {
  readonly inputs: JudgeInput[] = []

  async judge(input: JudgeInput): Promise<JudgeVerdict> {
    this.inputs.push(input)
    return {step: 4, reasoning: 'Accurate.', verdict: 'ok', issue: '', confidence: 1, suggestion: ''}
  }
}

function input(overrides: Partial<JudgeInput> = {}): JudgeInput {
  return {
    imageDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    alt: 'A blue square with the word test',
    context: 'Original page context.',
    naturalWidth: 120,
    naturalHeight: 120,
    ...overrides,
  }
}

describe('createAzureAugmentedJudge', () => {
  it('adds mocked caption, OCR, and high-confidence tags to the model context', async () => {
    const inner = new CapturingJudge()
    const vision: AzureVisionClient = {
      async analyze() {
        return {
          caption: {text: 'a blue square', confidence: 0.99},
          denseCaptions: [{text: 'white text centered in a blue box', confidence: 0.95}],
          readText: 'test',
          tags: [
            {name: 'graphic', confidence: 0.95},
            {name: 'low-confidence-noise', confidence: 0.1},
          ],
        }
      },
    }

    const judge = createAzureAugmentedJudge({inner, vision})
    await expect(judge.judge(input())).resolves.toMatchObject({verdict: 'ok'})

    const context = inner.inputs[0]!.context
    expect(context).toContain('Original page context.')
    expect(context).toContain('Azure CV caption: a blue square')
    expect(context).toContain('Azure CV regions: white text centered in a blue box')
    expect(context).toContain('Azure CV OCR: test')
    expect(context).toContain('Azure CV tags: graphic')
    expect(context).not.toContain('low-confidence-noise')
  })

  it('falls back to the original context when the mocked Azure pre-pass fails', async () => {
    const inner = new CapturingJudge()
    const vision: AzureVisionClient = {
      async analyze() {
        throw new Error('mock Azure outage')
      },
    }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const judge = createAzureAugmentedJudge({inner, vision})
    await expect(judge.judge(input())).resolves.toMatchObject({verdict: 'ok'})

    expect(inner.inputs[0]!.context).toBe('Original page context.')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('falling back to Copilot-only'))
    warn.mockRestore()
  })
})
