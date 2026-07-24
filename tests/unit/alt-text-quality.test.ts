import {describe, it, expect, afterEach, vi} from 'vitest'
import {altTextQuality, __setJudge} from '../../src/rules/alt-text-quality.js'
import type {JudgeAltText, JudgeInput, JudgeVerdict} from '../../src/judges/index.js'
import type {ImageRecord, RuleResult} from '../../src/types.js'
import {makeImage} from '../utils/helpers.js'

// A data: URL is returned unchanged by loadImageAsDataUrl, so using one as the
// image src keeps these tests fully offline.
const DATA_URL = 'data:image/png;base64,iVBORw0KGgo='

// Records every input it receives and returns whatever the responder produces,
// letting each test drive the rule with a scripted verdict (or a thrown error).
class FakeJudge implements JudgeAltText {
  readonly calls: JudgeInput[] = []
  constructor(private readonly responder: (input: JudgeInput) => JudgeVerdict) {}
  async judge(input: JudgeInput): Promise<JudgeVerdict> {
    this.calls.push(input)
    return this.responder(input)
  }
}

function verdict(overrides: Partial<JudgeVerdict> = {}): JudgeVerdict {
  return {step: 4, reasoning: 'reasoning', verdict: 'ok', issue: '', confidence: 0.9, suggestion: '', ...overrides}
}

async function run(images: ImageRecord[]): Promise<RuleResult[]> {
  return (await altTextQuality.evaluate({url: 'https://example.com', images})) as RuleResult[]
}

describe('alt-text-quality', () => {
  afterEach(() => {
    __setJudge(null)
    vi.restoreAllMocks()
  })

  it('is opt-in (disabled by default)', () => {
    expect(altTextQuality.defaultEnabled).toBe(false)
  })

  it('produces no finding for an "ok" verdict', async () => {
    __setJudge(new FakeJudge(() => verdict({verdict: 'ok'})))
    const results = await run([makeImage({src: DATA_URL, alt: 'A dog playing in the park'})])
    expect(results).toHaveLength(0)
  })

  it('maps a "needs-fix" verdict to a finding with the issue, alt, and reasoning', async () => {
    __setJudge(
      new FakeJudge(() => verdict({verdict: 'needs-fix', issue: 'redundant-prefix', reasoning: 'Drop the prefix.'})),
    )
    const results = await run([makeImage({src: DATA_URL, alt: 'Image of a dog'})])
    expect(results).toHaveLength(1)
    expect(results[0]!.problemShort).toContain('redundant-prefix')
    expect(results[0]!.problemShort).toContain('Image of a dog')
    expect(results[0]!.solutionLong).toBe('Drop the prefix.')
  })

  it('maps a "decorative" verdict to an empty-alt recommendation', async () => {
    __setJudge(new FakeJudge(() => verdict({verdict: 'decorative', reasoning: 'It is a spacer.'})))
    const results = await run([makeImage({src: DATA_URL, alt: 'horizontal spacer'})])
    expect(results).toHaveLength(1)
    expect(results[0]!.problemShort).toContain('decorative')
    expect(results[0]!.solutionShort).toContain('alt=""')
  })

  it('maps a "keyword-stuffing" needs-fix verdict to a tailored SEO-abuse finding', async () => {
    const stuffed = 'running shoes, cheap shoes, buy shoes online, best shoes 2026, nike adidas shoes'
    __setJudge(
      new FakeJudge(() =>
        verdict({step: 4, verdict: 'needs-fix', issue: 'keyword-stuffing', reasoning: 'It is a keyword list.'}),
      ),
    )
    const results = await run([makeImage({src: DATA_URL, alt: stuffed})])
    expect(results).toHaveLength(1)
    expect(results[0]!.problemShort).toContain('keyword-stuffed')
    expect(results[0]!.problemShort).toContain(stuffed)
    expect(results[0]!.solutionShort).toContain('concise description')
    expect(results[0]!.solutionLong).toBe('It is a keyword list.')
  })

  it('gives functional (step 3) keyword-stuffing findings link/button target guidance', async () => {
    __setJudge(new FakeJudge(() => verdict({step: 3, verdict: 'needs-fix', issue: 'keyword-stuffing'})))
    const results = await run([makeImage({src: DATA_URL, alt: 'buy shoes, cheap shoes, best shoes 2026'})])
    expect(results).toHaveLength(1)
    expect(results[0]!.problemShort).toContain('keyword-stuffed')
    expect(results[0]!.solutionShort).toContain('link or button target')
  })

  it('surfaces a needs-fix suggestion in the finding solutionShort', async () => {
    __setJudge(
      new FakeJudge(() =>
        verdict({verdict: 'needs-fix', issue: 'redundant-prefix', suggestion: 'Ellen Ochoa, Astronaut'}),
      ),
    )
    const results = await run([makeImage({src: DATA_URL, alt: 'Image of Ellen Ochoa, Astronaut'})])
    expect(results).toHaveLength(1)
    expect(results[0]!.solutionShort).toContain('Ellen Ochoa, Astronaut')
    expect(results[0]!.solutionShort).toContain('Consider')
  })

  it('falls back to generic advice when a needs-fix verdict has no suggestion', async () => {
    __setJudge(new FakeJudge(() => verdict({verdict: 'needs-fix', issue: 'vague', suggestion: ''})))
    const results = await run([makeImage({src: DATA_URL, alt: 'a thing'})])
    expect(results).toHaveLength(1)
    expect(results[0]!.solutionShort).toContain('Revise the alt text')
  })

  it('skips images with alt === null without calling the judge', async () => {
    const fake = new FakeJudge(() => verdict())
    __setJudge(fake)
    const results = await run([makeImage({src: DATA_URL, alt: null})])
    expect(results).toHaveLength(0)
    expect(fake.calls).toHaveLength(0)
  })

  it('skips images with no src without calling the judge', async () => {
    const fake = new FakeJudge(() => verdict({verdict: 'needs-fix'}))
    __setJudge(fake)
    const results = await run([makeImage({src: '', alt: 'a dog'})])
    expect(results).toHaveLength(0)
    expect(fake.calls).toHaveLength(0)
  })

  it('isolates per-image judge failures and keeps evaluating the rest', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fake = new FakeJudge(input => {
      if (input.alt === 'boom') throw new Error('judge failed')
      return verdict({verdict: 'needs-fix', issue: 'vague'})
    })
    __setJudge(fake)
    const results = await run([makeImage({src: DATA_URL, alt: 'boom'}), makeImage({src: DATA_URL, alt: 'a dog'})])
    expect(results).toHaveLength(1)
    expect(results[0]!.image.alt).toBe('a dog')
  })

  it('passes intrinsic image dimensions through to the judge', async () => {
    const fake = new FakeJudge(() => verdict())
    __setJudge(fake)
    await run([makeImage({src: DATA_URL, alt: 'a dog', naturalWidth: 800, naturalHeight: 600})])
    expect(fake.calls[0]!.naturalWidth).toBe(800)
    expect(fake.calls[0]!.naturalHeight).toBe(600)
  })

  it('includes page title and section heading in the judge context', async () => {
    const fake = new FakeJudge(() => verdict())
    __setJudge(fake)
    await run([
      makeImage({src: DATA_URL, alt: 'a dog', pageTitle: 'Dogs of the World', sectionHeading: 'Working Breeds'}),
    ])
    expect(fake.calls[0]!.context).toContain('Dogs of the World')
    expect(fake.calls[0]!.context).toContain('Working Breeds')
  })

  it('strips src/srcset values from the image HTML in the judge context', async () => {
    const fake = new FakeJudge(() => verdict())
    __setJudge(fake)
    await run([
      makeImage({
        src: DATA_URL,
        alt: 'a dog',
        outerHTML:
          '<img src="https://cdn.example.com/secret?sig=abc123" srcset="https://cdn.example.com/secret-2x?sig=def456 2x" alt="a dog">',
      }),
    ])
    const context = fake.calls[0]!.context
    expect(context).not.toContain('sig=abc123')
    expect(context).not.toContain('sig=def456')
    expect(context).toContain('src="(omitted)"')
    expect(context).toContain('srcset="(omitted)"')
  })

  it('redacts query/fragment from the link href in the judge context', async () => {
    const fake = new FakeJudge(() => verdict())
    __setJudge(fake)
    await run([
      makeImage({
        src: DATA_URL,
        alt: 'a dog',
        linkContext: {href: 'https://example.com/page?sig=secret123#frag'},
      }),
    ])
    const context = fake.calls[0]!.context
    expect(context).not.toContain('sig=secret123')
    expect(context).not.toContain('#frag')
    expect(context).toContain('https://example.com/page')
  })
})
