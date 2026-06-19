import {Buffer} from 'node:buffer'
import {describe, it, expect} from 'vitest'
import {loadImageAsDataUrl} from '../../src/utils/load-image-data-url.js'

function decodeBase64DataUrl(dataUrl: string): {mime: string; bytes: Buffer} {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl)
  if (!match) throw new Error(`not a base64 data URL: ${dataUrl}`)
  return {mime: match[1]!, bytes: Buffer.from(match[2]!, 'base64')}
}

describe('loadImageAsDataUrl — data: URLs', () => {
  it('returns an existing base64 data URL unchanged', async () => {
    const input = 'data:image/png;base64,iVBORw0KGgo='
    expect(await loadImageAsDataUrl(input)).toBe(input)
  })

  it('normalizes a percent-encoded SVG data URL to base64', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>'
    const input = `data:image/svg+xml,${encodeURIComponent(svg)}`

    const out = await loadImageAsDataUrl(input)
    const {mime, bytes} = decodeBase64DataUrl(out)

    expect(mime).toBe('image/svg+xml')
    expect(bytes.toString('utf8')).toBe(svg)
  })

  it('normalizes a plain (non-encoded) data URL to base64', async () => {
    const input = 'data:text/plain,hello world'

    const out = await loadImageAsDataUrl(input)
    const {mime, bytes} = decodeBase64DataUrl(out)

    expect(mime).toBe('text/plain')
    expect(bytes.toString('utf8')).toBe('hello world')
  })
})
