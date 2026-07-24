# Alt-Text Plugin for the Accessibility Scanner

The Alt-Text Plugin is a [plugin](https://github.com/github/accessibility-scanner/blob/main/PLUGINS.md) for the [AI-powered Accessibility Scanner](https://github.com/github/accessibility-scanner) that flags low-quality `alt` text on images. It complements axe-core's built-in `image-alt` rule, helping teams ship images with descriptive, screen-reader-friendly alternative text.

Five deterministic rules run by default and help teams:

- 🖼️ Catch vague, generic, or filler `alt` text (`"image"`, `"photo"`, `"icon"`)
- 📛 Catch raw filenames used as `alt` text (`"IMG_1234.png"`)
- 🔁 Catch runs of adjacent images that share the same `alt` text
- 🚧 Catch boilerplate placeholder `alt` text (`"todo"`, `"tbd"`, `"fixme"`)
- ♿ Catch images missing an `alt` attribute entirely (without flagging intentional decorative `alt=""`)

An additional opt-in, model-backed `alt-text-quality` rule evaluates whether alt text accurately describes its image and flags SEO keyword stuffing. It is disabled by default and requires a GitHub Models token.

> ⚠️ **Note:** This plugin is in active development alongside the a11y scanner's public preview. New rules are still being added and end-to-end integration with the scanner's issue-filing workflow is still maturing. Always review filed issues before acting on them.

---

## [Frequently-Asked Questions (FAQ)](https://github.com/github/accessibility-scanner/blob/main/FAQ.md)

The plugin inherits the a11y scanner's general FAQ — see the link above for questions about scanning, caching, GitHub Enterprise, and more. Plugin-specific questions are answered inline below.

---

## Background

This plugin catches low-quality `alt` text that axe-core's built-in [`image-alt`](https://dequeuniversity.com/rules/axe/4.10/image-alt) rule cannot — vague single-word `alt`, raw filenames, runs of duplicate `alt`, and never-filled-in placeholders. The scope is intentionally narrow: deterministic, heuristic checks on `<img>` elements only. Non-`<img>` `role="img"` elements, decorative `alt=""`, and hidden subtrees are filtered out before any rule runs.

The project is under active development alongside the scanner's public preview. Roadmap and open work live in this repo's [Issues](https://github.com/github/accessibility-scanner-alt-text-plugin/issues). See [CONTRIBUTING.md](./CONTRIBUTING.md) for how to contribute, including local setup, expected checks, and PR conventions.

---

## Requirements

To use the Alt-Text Plugin, you'll need:

- **The [AI-powered Accessibility Scanner](https://github.com/github/accessibility-scanner)** (v3 or later) wired into a GitHub Actions workflow in your repository
- **Everything required to run the scanner itself** (Actions enabled, Issues enabled, a `GH_TOKEN` PAT — see the [scanner README](https://github.com/github/accessibility-scanner#requirements) for the full list)

The plugin is published to npm as [`@github/accessibility-scanner-alt-text-plugin`](https://www.npmjs.com/package/@github/accessibility-scanner-alt-text-plugin). The scanner installs it for you when running the `Find` sub-action — you don't need to copy any source into your repository or run `npm install` yourself.

To develop the plugin locally, you'll also need:

- **Node.js** matching the `engines` field in [`package.json`](./package.json) — currently `^22.13.0 || ^24 || ^26`
- **npm** (ships with Node)

---

## Getting started

### 1. Enable the plugin in your workflow

The plugin is loaded from its npm package — there's nothing to copy into your repo. Add it to the scanner action's `scans` input as an **object** with `name`, `package`, and (recommended) a pinned `version`. Keep `"axe"` in the list too, since the scanner only runs Axe by default:

```yaml
name: Accessibility Scanner
on: workflow_dispatch

jobs:
  accessibility_scanner:
    runs-on: ubuntu-latest
    steps:
      - uses: github/accessibility-scanner@v3
        with:
          urls: |
            https://example.com
          repository: REPLACE_THIS/REPLACE_THIS
          token: ${{ secrets.GH_TOKEN }}
          cache_key: REPLACE_THIS
          scans: |
            ["axe", {"name": "alt-text-scan", "package": "@github/accessibility-scanner-alt-text-plugin", "version": "1.1.0"}]
```

> 👉 Update all `REPLACE_THIS` placeholders with your actual values. See the [scanner's Action inputs](https://github.com/github/accessibility-scanner#action-inputs) for the full list, and the scanner's [PLUGINS.md](https://github.com/github/accessibility-scanner/blob/main/PLUGINS.md) for how NPM plugins are loaded.

📚 Learn more

- [Plugin docs in the scanner repository](https://github.com/github/accessibility-scanner/blob/main/PLUGINS.md)
- [Scanner getting-started guide](https://github.com/github/accessibility-scanner#getting-started)
- [Writing workflows](https://docs.github.com/en/actions/how-tos/write-workflows)

---

### 2. Run your first scan

Trigger your scanner workflow manually or on its configured schedule. The plugin runs on every URL the scanner visits, extracts each image exposed to assistive technology, and emits a finding for every rule violation. The scanner then turns those findings into GitHub issues.

📚 Learn more

- [View workflow run history](https://docs.github.com/en/actions/how-tos/monitor-workflows/view-workflow-run-history)
- [Running a workflow manually](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow#running-a-workflow)

---

## Rules

The plugin runs every extracted image through an append-only registry of rules. Each rule returns a finding when an image fails its criteria, and the scanner turns each finding into an issue.

| Rule                     | ID                     | Fires when                                                                                                                                                                                                                                                                                                            | Example (flagged)                                                        |
| ------------------------ | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Missing alt**          | `missing-alt-text`     | The `alt` attribute is absent (`null`) or whitespace-only (`"   "`). `alt=""` is treated as intentional decorative use and is **not** flagged.                                                                                                                                                                        | `<img src="cat.png">`<br>`<img src="cat.png" alt="   ">`                 |
| **Vague alt**            | `vague-alt-text`       | The alt text is one of a curated set of generic single words (`image`, `photo`, `icon`, `logo`, `screenshot`, `chart`, `untitled`, etc.) or short filler phrases (`an image of`, `a photo of`). Normalization is applied before matching: case-insensitive, whitespace-collapsed, surrounding punctuation stripped.   | `<img alt="image">`<br>`<img alt="An image of">`<br>`<img alt="PHOTO.">` |
| **Filename as alt**      | `filename-alt-text`    | The alt text ends in a common image file extension (`.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp`, `.bmp`, `.ico`).                                                                                                                                                                                                | `<img alt="IMG_1234.png">`<br>`<img alt="Screenshot 2024-04-28.jpg">`    |
| **Repeated alt**         | `repeated-alt-text`    | Two or more adjacent images on the rendered page share the same normalized alt text. Useful for patterns like five star icons all labeled `"3/5 stars"`.                                                                                                                                                              | Five consecutive `<img alt="3/5 stars">` elements                        |
| **Placeholder alt**      | `placeholder-alt-text` | The alt text matches a known boilerplate string that signals it was never written (`todo`, `tbd`, `fixme`, `placeholder`, `alt text`, `insert alt text`, `image alt`). Normalization is applied before matching.                                                                                                      | `<img alt="TODO">`<br>`<img alt="insert alt text">`                      |
| **Alt quality** (opt-in) | `alt-text-quality`     | A vision model judges the alt text against the image itself and flags inaccurate, incomplete, or keyword-stuffed text that the deterministic rules cannot catch. **Disabled by default**; requires a GitHub Models token (optionally Azure AI Vision). See [Alt-text quality](#alt-text-quality-model-backed-opt-in). | `<img src="jane-doe-ceo.jpg" alt="a person">`                            |

### Image extraction

Before rules run, the plugin extracts images from the page through Playwright's accessibility tree (`page.getByRole('img')`) and narrows the result to actual `<img>` elements. The following are filtered out automatically and never reach the rules:

- Non-`<img>` elements with `role="img"` (e.g. `<svg role="img">`, `<div role="img">`) — this plugin's rules only apply to HTML `<img>` tags
- Images inside `aria-hidden="true"` subtrees
- Images inside `display: none` or `visibility: hidden` subtrees
- Decorative images with `alt=""` (implicit `role="presentation"`)

### Overlap with Axe

The scanner's built-in Axe scan includes a rule called [`image-alt`](https://dequeuniversity.com/rules/axe/4.10/image-alt) that catches missing and whitespace-only `alt` attributes. If you have both `"axe"` and `"alt-text-scan"` enabled, the same image may be flagged by both. The other four rules in this plugin (`vague-alt-text`, `filename-alt-text`, `repeated-alt-text`, `placeholder-alt-text`) are unique to the plugin and don't overlap with Axe.

### Alt-text quality (model-backed, opt-in)

The five default rules are deterministic pattern matches and never call a model. `alt-text-quality` is a separate opt-in rule: it sends each image, its alt text, and surrounding DOM context to a vision model, which judges whether the alt text actually and sufficiently describes the image. This catches plausible-looking but wrong or incomplete alt text — for example `alt="a person"` on a photo of an individual named in surrounding text — as well as SEO keyword stuffing that lists search terms instead of describing the image.

Because it makes a per-image model call (cost and latency), it is **disabled by default**. To turn it on:

1. Enable the rule in `config.json` (see [Configuration](#configuration)):

   ```json
   {
     "rules": {
       "alt-text-quality": true
     }
   }
   ```

2. Provide a GitHub Models token as the `GITHUB_MODELS_TOKEN` environment variable (a PAT with the `models:read` scope).

Optionally, supply Azure AI Vision credentials (`AZURE_VISION_ENDPOINT` and `AZURE_VISION_KEY`) to add an OCR-and-tags pre-pass that enriches the model's context. When both are present the plugin selects this augmented mode automatically; set `ALT_TEXT_JUDGE_MODE` to `copilot` or `azure-augmented` to force a mode.

In a workflow, provide these as repository secrets at the **job** level so the scanner's sub-actions inherit them into the process that runs the plugin. GitHub disallows secret names beginning with `GITHUB_`, so store the token under a different name (e.g. `GH_MODELS_TOKEN`) and map it:

```yaml
jobs:
  accessibility_scanner:
    runs-on: ubuntu-latest
    env:
      GITHUB_MODELS_TOKEN: ${{ secrets.GH_MODELS_TOKEN }}
      AZURE_VISION_ENDPOINT: ${{ secrets.AZURE_VISION_ENDPOINT }} # optional
      AZURE_VISION_KEY: ${{ secrets.AZURE_VISION_KEY }} # optional
    steps:
      # ...as in "Enable the plugin in your workflow" above
```

---

## Output

When a rule fires, the plugin emits a finding with the following shape (matching the scanner's [`Finding` type](https://github.com/github/accessibility-scanner/blob/main/.github/actions/find/src/types.d.ts)):

- `scannerType` — always `'alt-text-scan'`; identifies which plugin produced the finding
- `ruleId` — the ID of the rule that fired (e.g. `'vague-alt-text'`)
- `url` — the page URL where the image was found
- `html` — the offending `<img>` element's outer HTML
- `problemShort` — one-sentence description of what's wrong, including the offending alt text where applicable
- `problemUrl` — link to the relevant WCAG technique or W3C tutorial
- `solutionShort` — one-sentence description of how to fix it
- `solutionLong` — optional longer explanation when one sentence isn't enough

The scanner uses these fields to file or update a GitHub issue.

---

## Configuration

To override the default enabled state of one or more rules, add a `config.json` file in your scanner repository at `.github/scanner-plugins/alt-text-scan/config.json`:

```text
.github/scanner-plugins/alt-text-scan/
└── config.json   ← optional
```

```json
{
  "rules": {
    "repeated-alt-text": false,
    "placeholder-alt-text": false
  }
}
```

- Each key under `rules` is a rule ID from the [Rules](#rules) table above; the value is `true` (run the rule) or `false` (skip it).
- Rules you don't list keep their default behavior. Every rule defaults to enabled except `alt-text-quality`, which is opt-in (see [Alt-text quality](#alt-text-quality-model-backed-opt-in)).
- Unknown rule IDs and non-boolean values are logged as warnings and ignored (typo guard).
- A missing or malformed `config.json` causes the plugin to run with all defaults.
- The plugin reads the config once at startup, not per URL.

A JSON Schema is published at [`schema/config.schema.json`](./schema/config.schema.json). Add a `$schema` line at the top of your `config.json` to get autocomplete, hover docs, and inline validation in editors that support JSON Schema (VS Code, JetBrains IDEs, etc.):

```json
{
  "$schema": "https://raw.githubusercontent.com/github/accessibility-scanner-alt-text-plugin/main/schema/config.schema.json",
  "rules": {
    "repeated-alt-text": false
  }
}
```

The `$schema` line is optional and is ignored by the plugin at runtime.

---

## Development

### Local setup

```sh
git clone https://github.com/github/accessibility-scanner-alt-text-plugin.git
cd accessibility-scanner-alt-text-plugin
npm ci
```

### Common scripts

| Script                 | What it does                                  |
| ---------------------- | --------------------------------------------- |
| `npm run test`         | Runs the Vitest unit suite once               |
| `npm run test:watch`   | Runs Vitest in watch mode                     |
| `npm run typecheck`    | Runs `tsc --noEmit` against the whole project |
| `npm run lint`         | Runs ESLint                                   |
| `npm run format`       | Rewrites files with Prettier                  |
| `npm run format:check` | Reports formatting violations without writing |

Pull requests trigger two CI workflows: [`lint.yml`](./.github/workflows/lint.yml) runs `lint` and `format:check` on Node 24, and [`test.yml`](./.github/workflows/test.yml) runs `typecheck` and `test` across Node 22, 24, and 26.

### Project layout

```text
index.ts                    # Plugin entry point: exports `name` and the default scan function
src/
  config.ts                 # Loads & validates .github/scanner-plugins/alt-text-scan/config.json
  extract.ts                # Pulls visible <img> records from a Playwright page
  findings.ts               # Translates each RuleResult into the scanner's Finding shape
  rules/
    index.ts                # Append-only rule registry
    missing-alt-text.ts
    vague-alt-text.ts
    filename-alt-text.ts
    placeholder-alt-text.ts
    repeated-alt-text.ts
  utils/
    normalize-alt-text.ts   # Lowercase, trim, collapse whitespace, strip punctuation
  types.ts                  # Rule, RuleContext, RuleResult, ImageRecord, Finding
tests/
  extract.test.ts           # Playwright-driven tests for the image extractor
  example-site.test.ts      # Runs the plugin against the example/site-with-errors fixture
  fixtures/                 # Static HTML fixtures used by the extractor tests
  unit/
    *.test.ts               # One file per rule, plus config.test.ts for the loader
  utils/
    helpers.ts              # makeImage() and evaluateAlts() — shared across rule tests
```

### Adding a new rule

1. Create `src/rules/<rule-name>.ts` exporting a `Rule` (see [`src/types.ts`](./src/types.ts) for the shape — `id`, `problemUrl`, and `evaluate(context)`). Filenames under `src/` and `tests/` must be kebab-case; ESLint's `check-file/filename-naming-convention` rule enforces this.
2. Import the rule in [`src/rules/index.ts`](./src/rules/index.ts) and append it to `allRules`. The registry is append-only — don't reorder existing rules.
3. Add a `tests/unit/<rule-name>.test.ts` file. Use `evaluateAlts(alts, rule)` and `makeImage(overrides)` from [`tests/utils/helpers.ts`](./tests/utils/helpers.ts) for the common cases; construct an explicit `RuleContext` only when you need control over `src` or other per-image fields.
4. Run `npm run test && npm run typecheck && npm run lint` locally before opening a PR. CI re-runs them.

> [!IMPORTANT]
> Image extraction happens once per page, before any rule runs, so every rule sees the same filtered list regardless of which rules are enabled. Don't reach into the DOM from a rule — work from the `ImageRecord[]` the rule's context provides.

---

## Feedback

💬 We welcome your feedback! To submit feedback or report issues, please open an issue in this repository. For broader feedback on the a11y scanner itself, file it in the [scanner repository](https://github.com/github/accessibility-scanner/issues).

---

## License

📄 This project is licensed under the terms of the MIT open source license. See the [LICENSE](./LICENSE) file for the full terms.

## Maintainers

🔧 Maintained alongside the [AI-powered Accessibility Scanner](https://github.com/github/accessibility-scanner). See [CODEOWNERS](./.github/CODEOWNERS) for the responsible team.

## Support

❓ For support, please open an issue in this repository. See [SUPPORT.md](./SUPPORT.md) for support expectations, or the scanner's [SUPPORT](https://github.com/github/accessibility-scanner/blob/main/SUPPORT.md) document for guidance that applies across the project.

## Acknowledgement

✨ Built on top of [Playwright](https://playwright.dev/), [Vitest](https://vitest.dev/), and the broader open-source accessibility tooling ecosystem. Thank you to everyone contributing rules, tests, and review.
