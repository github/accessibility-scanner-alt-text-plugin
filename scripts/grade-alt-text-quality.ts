// Offline scoring harness for the alt-text-quality rule.
//
// Reads test cases from tests/fixtures/alt-quality/cases.json, sends each
// (image, alt, context) tuple through a JudgeAltText, and reports per-case
// verdicts plus overall agreement against the expected verdicts.

//
// Run:
//   GITHUB_MODELS_TOKEN=<pat-with-models:read> npm run grade
//   (GITHUB_TOKEN is used as a fallback when GITHUB_MODELS_TOKEN is not set.)
//
// Optional env:
//   PROBE_MODEL              — model id, default "openai/gpt-4o". Must be a
//                              vision-enabled model, since every case sends an image.
//   PROBE_CASES              — path to a cases.json file
//   ALT_TEXT_JUDGE_MODE      — force "copilot" or "azure-augmented". When unset,
//                              auto-selects azure-augmented if AZURE_VISION_* are set.
//   PROBE_MIN_INTERVAL_MS    — minimum ms between cases (rate-limit pacing).
//                              Azure's F0 (free) tier allows 20 calls/min, so setting to
//                              3500 leaves space. See
//                              https://azure.microsoft.com/en-us/pricing/details/cognitive-services/computer-vision/

import {readFile} from 'node:fs/promises'
import {dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

import {createJudge} from '../src/judges/index.js'
import type {Verdict} from '../src/judges/index.js'
import {loadImageAsDataUrl} from '../src/utils/load-image-data-url.js'

type GradeCase = {
  id: string
  // Path relative to cases.json, OR an absolute path, OR an http(s) URL.
  image: string
  alt: string
  // The "page context" the production rule passes in.
  context?: string
  expected?: Verdict
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

// Decodes an image's intrinsic pixel dimensions straight from its bytes, supporting PNG, GIF, WebP and JPEG.
// This lets the grader report size (and mirror the browser's naturalWidth/naturalHeight) without a browser or
// image library. Returns {0, 0} for unrecognized or truncated data.
function intrinsicSize(buf: Buffer): {width: number; height: number} {
  const none = {width: 0, height: 0}

  // PNG: 8-byte signature, then an IHDR chunk with width@16, height@20 (BE).
  if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return {width: buf.readUInt32BE(16), height: buf.readUInt32BE(20)}
  }

  // GIF: 'GIF8', then logical-screen width@6, height@8 (little-endian).
  if (buf.length >= 10 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) {
    return {width: buf.readUInt16LE(6), height: buf.readUInt16LE(8)}
  }

  // WebP: 'RIFF'....'WEBP' followed by a VP8 / VP8L / VP8X chunk.
  if (buf.length >= 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buf.toString('ascii', 12, 16)
    if (chunk === 'VP8 ') {
      // Lossy: ...0x9d 0x01 0x2a, then 14-bit width then 14-bit height (LE).
      return {width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff}
    }
    if (chunk === 'VP8L' && buf.length >= 25) {
      // Lossless: 0x2f signature@20, then packed 14-bit (width-1), (height-1).
      const bits = buf.readUInt32LE(21)
      return {width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1}
    }
    if (chunk === 'VP8X') {
      // Extended: 24-bit (width-1)@24, 24-bit (height-1)@27 (little-endian).
      const width = (buf.readUInt8(24) | (buf.readUInt8(25) << 8) | (buf.readUInt8(26) << 16)) + 1
      const height = (buf.readUInt8(27) | (buf.readUInt8(28) << 8) | (buf.readUInt8(29) << 16)) + 1
      return {width, height}
    }
  }

  // JPEG: scan segments for a Start-Of-Frame marker carrying the dimensions.
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let off = 2
    while (off + 9 < buf.length) {
      if (buf[off] !== 0xff) {
        off++
        continue
      }
      const marker = buf.readUInt8(off + 1)
      // SOF0..SOF15 carry size, except DHT(C4), JPG(C8) and DAC(CC).
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return {height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7)}
      }
      const segLen = buf.readUInt16BE(off + 2)
      if (segLen < 2) break
      off += 2 + segLen
    }
  }

  return none
}

async function main(): Promise<void> {
  const currentDirectory = dirname(fileURLToPath(import.meta.url))
  const casesPath = process.env['PROBE_CASES']
    ? resolve(process.cwd(), process.env['PROBE_CASES'])
    : resolve(currentDirectory, '..', 'tests', 'fixtures', 'alt-quality', 'cases.json')

  let cases: GradeCase[]
  try {
    cases = JSON.parse(await readFile(casesPath, 'utf8')) as GradeCase[]
  } catch (err) {
    console.error(`Could not read or parse cases file: ${casesPath}`)
    console.error(`  ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }
  const baseDir = dirname(casesPath)

  // Mirror createJudge()'s resolution for display: explicit env wins, else
  // auto-select azure-augmented when Azure credentials are present.
  const mode =
    process.env['ALT_TEXT_JUDGE_MODE'] ||
    (process.env['AZURE_VISION_ENDPOINT'] && process.env['AZURE_VISION_KEY'] ? 'azure-augmented' : 'copilot')
  const model = process.env['PROBE_MODEL'] ?? 'openai/gpt-4o'
  const minIntervalMs = Number(process.env['PROBE_MIN_INTERVAL_MS'] ?? '0')

  let judge
  try {
    judge = createJudge()
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }

  console.log(`Mode:    ${mode}`)
  console.log(`Model:   ${model}`)
  console.log(`Cases:   ${casesPath}`)
  console.log(`Total:   ${cases.length}`)
  if (minIntervalMs > 0) console.log(`Pacing:  ${minIntervalMs}ms minimum between cases`)
  console.log('')

  let agreements = 0
  let withExpected = 0

  for (const case of cases) {
    const caseStart = Date.now()
    process.stdout.write(`[${c.id}] `)
    try {
      const dataUrl = await loadImageAsDataUrl(c.image, {baseDir})
      const bytes = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64')
      const {width: naturalWidth, height: naturalHeight} = intrinsicSize(bytes)
      const start = Date.now()
      const verdict = await judge.judge({
        imageDataUrl: dataUrl,
        alt: c.alt,
        context: c.context ?? '',
        naturalWidth,
        naturalHeight,
      })
      const latencyMs = Date.now() - start

      let agreeMark = ''
      if (c.expected !== undefined) {
        withExpected++
        const agree = c.expected === verdict.verdict
        if (agree) agreements++
        agreeMark = agree ? '  ✓' : '  ✗'
      }

      console.log(`${verdict.verdict} (conf ${verdict.confidence.toFixed(2)}, ${latencyMs}ms)${agreeMark}`)
      if (naturalWidth > 0 && naturalHeight > 0) console.log(`    size:     ${naturalWidth}×${naturalHeight}`)
      console.log(`    alt:      ${JSON.stringify(c.alt)}`)
      if (c.expected !== undefined) console.log(`    expected: ${c.expected}`)
      if (verdict.issue) console.log(`    issue:    ${verdict.issue}`)
      console.log(`    reason:   ${verdict.reasoning}`)
      console.log('')
    } catch (err) {
      console.error('ERROR')
      console.error(`    alt:      ${JSON.stringify(c.alt)}`)
      console.error(`    ${err instanceof Error ? err.message : String(err)}`)
      console.log('')
    }

    // Rate-limit pacing: ensure at least minIntervalMs has elapsed since this
    // case started before moving to the next case.
    if (minIntervalMs > 0) {
      const elapsed = Date.now() - caseStart
      const remaining = minIntervalMs - elapsed
      if (remaining > 0) await sleep(remaining)
    }
  }

  if (withExpected > 0) {
    console.log(`Agreement with expected verdicts: ${agreements}/${withExpected}`)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
