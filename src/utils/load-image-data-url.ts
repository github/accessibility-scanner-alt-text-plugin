// Loads an image from any of: an http(s) URL, an absolute filesystem path,
// or a path relative to a given base directory. Returns the bytes encoded as
// a data URL suitable for vision-model `image_url` fields.
//
// Used by the offline probe (where images come from cases.json paths or URLs)
// and by the production rule (where images come from the page's <img src>
// resolved against the page URL).

import {readFile} from 'node:fs/promises'
import {extname, isAbsolute, resolve} from 'node:path'

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',
}

function guessMime(p: string): string {
  return MIME_BY_EXT[extname(p).toLowerCase()] ?? 'application/octet-stream'
}

export type LoadImageOptions = {
  // Used to resolve relative filesystem paths. Ignored for URLs.
  baseDir?: string
}

export async function loadImageAsDataUrl(imageRef: string, options: LoadImageOptions = {}): Promise<string> {
  if (/^data:/i.test(imageRef)) return imageRef

  if (/^https?:\/\//i.test(imageRef)) {
    const res = await fetch(imageRef)
    if (!res.ok) throw new Error(`failed to fetch ${imageRef}: ${res.status} ${res.statusText}`)
    const buf = Buffer.from(await res.arrayBuffer())
    const mime = res.headers.get('content-type')?.split(';')[0]?.trim() || guessMime(imageRef)
    return `data:${mime};base64,${buf.toString('base64')}`
  }

  const baseDir = options.baseDir ?? process.cwd()
  const abs = isAbsolute(imageRef) ? imageRef : resolve(baseDir, imageRef)
  const buf = await readFile(abs)
  return `data:${guessMime(abs)};base64,${buf.toString('base64')}`
}
