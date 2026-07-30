# site-with-errors

A small Jekyll site that demos the
[`accessibility-scanner-alt-text-plugin`](../../README.md). It mirrors the
`site-with-errors` fixture from
[`github/accessibility-scanner`](https://github.com/github/accessibility-scanner)
and adds a [page whose images each intentionally trip one of the plugin's
rules](alt-text-errors.html).

Use it for:

- **Manual testing** — build and serve the site, then point the scanner at it.
- **Automated testing** — the page is also asserted against by the plugin's test
  suite (see [`tests/example-site.test.ts`](../../tests/example-site.test.ts)),
  so the rules stay exercised against real markup in CI.

## Deterministic image → rule mapping

The first section of [`alt-text-errors.html`](alt-text-errors.html) exercises
each rule that runs by default in plugin v1.1.0.

| Image `alt` value            | Rule triggered         | Why it triggers                                  |
| ---------------------------- | ---------------------- | ------------------------------------------------ |
| _(no `alt` attribute)_       | `missing-alt-text`     | The `alt` attribute is absent entirely.          |
| `TODO`                       | `placeholder-alt-text` | `TODO` is known placeholder/boilerplate text.    |
| `screenshot_2024.png`        | `filename-alt-text`    | The alt text is a raw image filename.            |
| `image`                      | `vague-alt-text`       | A single generic word that describes nothing.    |
| `company logo` (×2 in a row) | `repeated-alt-text`    | Two consecutive images share identical alt text. |

These are real, credential-free plugin findings. The dedicated
[`scan-demo-site.yml`](../../.github/workflows/scan-demo-site.yml) workflow
builds this Jekyll site, serves only `/alt-text-errors/`, and runs Scanner
v3.4.1 with Axe plus the npm-published plugin v1.1.0. It uses scanner dry-run
mode and uploads `scanner-results.json`, so the workflow proves npm
installation and execution without writing issues.

## Model-backed quality cases

The second section contains four inputs for the opt-in `alt-text-quality` rule:

| Case             | Expected mocked verdict | Evidence shown                       |
| ---------------- | ----------------------- | ------------------------------------ |
| Keyword stuffing | `needs-fix`             | Tailored SEO-abuse finding           |
| Inaccurate alt   | `needs-fix`             | Finding with a suggested replacement |
| Decorative image | `decorative`            | Recommendation to use `alt=""`       |
| Accurate control | `ok`                    | No finding                           |

These outcomes are **mocked test evidence**, not live model results. The
targeted test injects fixed judge verdicts, then runs the production
`alt-text-quality` rule-to-finding mapping. This keeps the demo deterministic
and credential-free while clearly showing behavior that would otherwise
require GitHub Models and, optionally, Azure AI Vision.

The credential-free verifier prints all demo evidence as JSON:

```sh
npm run demo:verify
```

Its output separates:

- the real deterministic plugin findings,
- mocked quality verdicts using real context extraction, remediation mapping,
  and scanner finding emission, and
- mocked Azure caption, OCR, and tag signals passed through the production
  Azure context-enrichment layer.

For an optional live run, set `GITHUB_MODELS_TOKEN` to a PAT with `models:read`
and run:

```sh
npm run demo:live
```

If `AZURE_VISION_ENDPOINT` and `AZURE_VISION_KEY` are also set, the live command
automatically requests Azure-augmented mode. Set
`ALT_TEXT_JUDGE_MODE=copilot` or `ALT_TEXT_JUDGE_MODE=azure-augmented` to force
a mode. Live output is credentialed and nondeterministic; it is not part of the
required CI evidence.

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
npm ci
npx playwright install chromium
npm test -- tests/example-site.test.ts --reporter=verbose
```

The targeted test loads
[`alt-text-errors.html`](alt-text-errors.html), runs the real `alt-text-scan`
plugin against it, asserts exactly one finding for each deterministic rule,
and separately checks the four model cases through fixed fake-judge verdicts.
No model or Azure credentials are used.
