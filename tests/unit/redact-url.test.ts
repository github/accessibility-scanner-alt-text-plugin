import {describe, it, expect} from 'vitest'
import {redactUrl} from '../../src/utils/redact-url.js'

describe('redactUrl', () => {
  it('strips the query string', () => {
    expect(redactUrl('https://cdn.example.com/img.png?sig=secret123')).toBe('https://cdn.example.com/img.png')
  })
  it('strips the fragment', () => {
    expect(redactUrl('https://example.com/page#section')).toBe('https://example.com/page')
  })
  it('leaves a clean URL unchanged', () => {
    expect(redactUrl('https://example.com/img.png')).toBe('https://example.com/img.png')
  })
  it('falls back gracefully on non-URL input', () => {
    expect(redactUrl('not a url?x=1')).toBe('not a url')
  })
})
