# site-with-errors

A small Jekyll site used to exercise the
[accessibility-scanner-alt-text-plugin](../../README.md) against realistic
sample content. It mirrors the `site-with-errors` fixture from
[`github/accessibility-scanner`](https://github.com/github/accessibility-scanner)
and adds an [`alt-text-errors.html`](alt-text-errors.html) page whose images each
intentionally trip one of the plugin's rules.

Use it for:

- **Manual testing** — build and serve the site, then point the scanner at it.
- **Automated testing** — the page is also asserted against by the plugin's test
  suite (see [`tests/example-site.test.ts`](../../tests/example-site.test.ts)),
  so the rules stay exercised against real markup in CI.

## Image → rule mapping

Every image on [`alt-text-errors.html`](alt-text-errors.html) points at the same
placeholder SVG (`assets/img/test-image.svg`); only the `alt` attribute differs.

| Image `alt` value            | Rule triggered         | Why it triggers                                  |
| ---------------------------- | ---------------------- | ------------------------------------------------ |
| _(no `alt` attribute)_       | `missing-alt-text`     | The `alt` attribute is absent entirely.          |
| `TODO`                       | `placeholder-alt-text` | `TODO` is known placeholder/boilerplate text.    |
| `screenshot_2024.png`        | `filename-alt-text`    | The alt text is a raw image filename.            |
| `image`                      | `vague-alt`            | A single generic word that describes nothing.    |
| `company logo` (×2 in a row) | `repeated-alt`         | Two consecutive images share identical alt text. |

## Run it locally

The site is a standard Jekyll site served as a static build behind Rack/Puma.
It requires Ruby 3.x (Jekyll 4.4 does not support Ruby 2.x).

```sh
cd example/site-with-errors
bundle install
bundle exec jekyll build
bundle exec rackup
```

`config.ru` wraps the site in HTTP Basic Auth. Set `TEST_USERNAME` and
`TEST_PASSWORD` before starting `rackup`, otherwise every request returns `401`:

```sh
TEST_USERNAME=demo TEST_PASSWORD=demo bundle exec rackup
```

The errors page is then available at `/alt-text-errors/`.

## Scan it with the plugin

You don't need Ruby or a running server to confirm the plugin flags this page.
From the repository root:

```sh
npm install
npx playwright install chromium
npm test
```

The `example site-with-errors` test loads
[`alt-text-errors.html`](alt-text-errors.html), runs the real `alt-text-scan`
plugin against it, and asserts that every rule in the table above produces a
finding.
