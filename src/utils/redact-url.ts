// Strips the query string and fragment from a URL so potentially sensitive
// values (signed-CDN tokens, session ids, user identifiers) are not forwarded
// to the model context or written to CI logs. Origin + path are preserved for
// debuggability. Inputs that don't parse as URLs are returned with anything
// after '?' or '#' dropped as a fallback.
export function redactUrl(url: string): string {
  try {
    const u = new URL(url)
    u.search = ''
    u.hash = ''
    return u.toString()
  } catch {
    return url.split(/[?#]/)[0] ?? url
  }
}
