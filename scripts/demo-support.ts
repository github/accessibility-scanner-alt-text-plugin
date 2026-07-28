import {readFile} from 'node:fs/promises'
import {createServer, type Server} from 'node:http'
import {fileURLToPath} from 'node:url'
import {chromium, type Browser, type Page} from 'playwright'

const fixtureRoot = fileURLToPath(new URL('../example/site-with-errors/', import.meta.url))

const routes = new Map([
  ['/baseline', {file: 'alt-text-errors.html', contentType: 'text/html; charset=utf-8'}],
  ['/advanced', {file: 'advanced-alt-text-errors.html', contentType: 'text/html; charset=utf-8'}],
  ['/assets/img/test-image.png', {file: 'assets/img/test-image.png', contentType: 'image/png'}],
])

function stripFrontMatter(contents: Buffer): Buffer {
  const text = contents.toString('utf8')
  return Buffer.from(text.replace(/^---\n[\s\S]*?\n---\n/, ''), 'utf8')
}

async function startServer(): Promise<{server: Server; origin: string}> {
  const server = createServer(async (request, response) => {
    const route = routes.get(request.url ?? '')
    if (!route) {
      response.writeHead(404).end()
      return
    }

    try {
      const rawContents = await readFile(new URL(route.file, `file://${fixtureRoot}/`))
      const contents = route.contentType.startsWith('text/html') ? stripFrontMatter(rawContents) : rawContents
      response.writeHead(200, {'Content-Type': route.contentType})
      response.end(contents)
    } catch (error) {
      response.writeHead(500, {'Content-Type': 'text/plain; charset=utf-8'})
      response.end(error instanceof Error ? error.message : String(error))
    }
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })

  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Demo server did not bind to a TCP port.')
  return {server, origin: `http://127.0.0.1:${address.port}`}
}

export type DemoHarness = {
  page: Page
  open(route: 'baseline' | 'advanced'): Promise<string>
  close(): Promise<void>
}

export async function createDemoHarness(): Promise<DemoHarness> {
  const {server, origin} = await startServer()
  let browser: Browser
  try {
    browser = await chromium.launch()
  } catch (error) {
    server.close()
    throw error
  }
  const page = await browser.newPage()

  return {
    page,
    async open(route) {
      const url = `${origin}/${route}`
      await page.goto(url)
      return url
    },
    async close() {
      await page.close()
      await browser.close()
      await new Promise<void>((resolve, reject) => {
        server.close(error => (error ? reject(error) : resolve()))
      })
    },
  }
}
