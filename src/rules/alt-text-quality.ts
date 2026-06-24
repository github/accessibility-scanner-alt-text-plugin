// alt-text-quality — model-backed rule that judges whether each image's alt
// text is appropriate given the image and its surrounding page context.

import {createJudge} from '../judges/index.js'
import type {JudgeAltText, JudgeVerdict} from '../judges/index.js'
import type {Rule, RuleContext, RuleResult, ImageRecord} from '../types.js'
import {loadImageAsDataUrl} from '../utils/load-image-data-url.js'
import {redactUrl} from '../utils/redact-url.js'

// Lazily build the judge so missing tokens surface only when the rule actually
// runs
let cachedJudge: JudgeAltText | null = null
function getJudge(): JudgeAltText {
  if (!cachedJudge) cachedJudge = createJudge()
  return cachedJudge
}

// Test seam: lets a unit test inject a fake judge without touching env vars.
export function __setJudge(judge: JudgeAltText | null): void {
  cachedJudge = judge
}

// Resolve the image's src against the page URL so relative paths work.
function resolveImageUrl(src: string, pageUrl: string): string | null {
  try {
    return new URL(src, pageUrl).toString()
  } catch {
    return null
  }
}

// Build the natural-language context string handed to the judge from the
// structured fields populated by extractImages

const MAX_IMAGE_HTML = 500

// The judge already sees the image via its data URL, so the raw src/srcset add
// only token cost and risk leaking data to the model. Strip those values and cap the length.
function sanitizeImageHtml(outerHTML: string): string {
  const stripped = outerHTML
    .replace(/\s+src\s*=\s*("[^"]*"|'[^']*')/gi, ' src="(omitted)"')
    .replace(/\s+srcset\s*=\s*("[^"]*"|'[^']*')/gi, ' srcset="(omitted)"')
  return stripped.length > MAX_IMAGE_HTML ? `${stripped.slice(0, MAX_IMAGE_HTML)}…` : stripped
}

function buildContextString(image: ImageRecord, pageUrl: string): string {
  const parts: string[] = [`Page URL: ${pageUrl}`]
  if (image.pageTitle) parts.push(`Page title: ${JSON.stringify(image.pageTitle)}`)
  if (image.sectionHeading) parts.push(`Nearest heading above the image: ${JSON.stringify(image.sectionHeading)}`)
  parts.push(`Image HTML: ${sanitizeImageHtml(image.outerHTML)}`)
  if (image.inLink) parts.push(`The image is inside a link with href="${redactUrl(image.inLink.href)}".`)
  if (image.inButton) parts.push('The image is inside a button (or role="button" element).')
  if (image.figcaption) parts.push(`Adjacent figcaption: ${JSON.stringify(image.figcaption)}`)
  if (image.nearbyText) parts.push(`Surrounding body text: ${JSON.stringify(image.nearbyText)}`)
  if (image.ariaLabel) parts.push(`aria-label="${image.ariaLabel}" is present on the image.`)
  if (image.ariaLabelledBy) parts.push(`aria-labelledby="${image.ariaLabelledBy}" is present on the image.`)
  return parts.join('\n')
}

// Translate a JudgeVerdict into a RuleResult understandable by the rest of
// the plugin. "ok" verdicts produce no finding.
function verdictToResult(image: ImageRecord, verdict: JudgeVerdict): RuleResult | null {
  if (verdict.verdict === 'ok') return null

  if (verdict.verdict === 'decorative') {
    return {
      image,
      problemShort: `Alt text appears to describe a purely decorative or already-captioned image:\n"${image.alt ?? ''}"`,
      solutionShort: 'Replace the alt attribute with alt="" so assistive tech skips the image.',
      solutionLong: verdict.reasoning,
    }
  }

  // verdict.verdict === 'needs-fix'
  return {
    image,
    problemShort: `Alt text quality issue${verdict.issue ? ` (${verdict.issue})` : ''}:\n"${image.alt ?? ''}"`,
    solutionShort: 'Revise the alt text per the reviewer reasoning below.',
    solutionLong: verdict.reasoning,
  }
}

export const altTextQuality: Rule = {
  id: 'alt-text-quality',
  problemUrl: 'https://www.w3.org/WAI/tutorials/images/',
  // Opt-in. Requires GITHUB_MODELS_TOKEN and incurs per-image API cost.
  defaultEnabled: false,

  async evaluate(context: RuleContext): Promise<RuleResult[]> {
    const judge = getJudge()
    const results: RuleResult[] = []

    for (const image of context.images) {
      // Skip images we cannot fetch or whose alt is structurally absent —
      // missing-alt-text.ts handles those.
      if (!image.src) continue
      if (image.alt === null) continue

      const resolved = resolveImageUrl(image.src, context.url)
      if (!resolved) continue

      let dataUrl: string
      try {
        dataUrl = await loadImageAsDataUrl(resolved)
      } catch (err) {
        console.error(`[alt-text-quality] failed to load ${redactUrl(resolved)}:`, err)
        continue
      }

      let verdict: JudgeVerdict
      try {
        verdict = await judge.judge({
          imageDataUrl: dataUrl,
          alt: image.alt,
          context: buildContextString(image, context.url),
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
        })
      } catch (err) {
        console.error(`[alt-text-quality] judge failed for ${redactUrl(resolved)}:`, err)
        continue
      }

      const result = verdictToResult(image, verdict)
      if (result) results.push(result)
    }

    return results
  },
}
