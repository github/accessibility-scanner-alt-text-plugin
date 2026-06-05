# Alt-Text Plugin for the Accessibility Scanner

The Alt-Text Plugin is a [plugin](https://github.com/github/accessibility-scanner/blob/main/PLUGINS.md) for the [AI-powered Accessibility Scanner](https://github.com/github/accessibility-scanner) that flags low-quality `alt` text on images. It catches the cases that axe-core's built-in `image-alt` rule does not, helping teams ship images with descriptive, screen-reader-friendly alternative text.

The plugin helps teams:

- 🖼️ Catch vague, generic, or filler `alt` text (`"image"`, `"photo"`, `"icon"`)
- 📛 Catch raw filenames being used as `alt` text (`"IMG_1234.png"`)
- 🔁 Catch runs of adjacent images that all share the same `alt` text
- 🚧 Catch boilerplate placeholder `alt` text (`"todo"`, `"tbd"`, `"fixme"`)
- ♿ Catch images missing an `alt` attribute entirely (without flagging intentional decorative `alt=""`)

> ⚠️ **Note:** This plugin is in active development alongside the a11y scanner's public preview. New rules are being added and end-to-end integration with the scanner workflow is still in progress. Always review filed issues before acting on them.

---

## [Frequently-Asked Questions (FAQ)](https://github.com/github/accessibility-scanner/blob/main/FAQ.md)

The plugin inherits the a11y scanner's general FAQ — see the link above for questions about scanning, caching, GitHub Enterprise, and more. Plugin-specific questions are answered inline below.

---

## Requirements

To use the Alt-Text Plugin, you'll need:

- **The [AI-powered Accessibility Scanner](https://github.com/github/accessibility-scanner)** wired into a GitHub Actions workflow in your repository
- **The plugin's source files** available under `./.github/scanner-plugins/alt-text-scan/` in the repository that runs the scanner workflow (see [Getting started](#getting-started))
- **Everything required to run the scanner itself** (Actions enabled, Issues enabled, a `GH_TOKEN` PAT — see the [scanner README](https://github.com/github/accessibility-scanner#requirements) for the full list)

To develop the plugin locally, you'll need:

- **Node.js** matching the `engines` field in [`package.json`](./package.json) — currently `^22.13.0 || ^24 || ^26`
- **npm** (ships with Node)

---

## Getting started

### 1. Add the plugin to your scanner repository

Following the conventions in the scanner's [PLUGINS.md](https://github.com/github/accessibility-scanner/blob/main/PLUGINS.md), each plugin lives under `./.github/scanner-plugins/<plugin-name>/` in the repository that runs the scanner workflow. Drop the plugin's `index.ts` (and any supporting files) into `./.github/scanner-plugins/alt-text-scan/`.

📚 Learn more

- [Plugin docs in the scanner repository](https://github.com/github/accessibility-scanner/blob/main/PLUGINS.md)
- [Example plugin: reflow-scan](https://github.com/github/accessibility-scanner/tree/main/.github/scanner-plugins/reflow-scan)

---

### 2. Enable the plugin in your workflow

Add `"alt-text-scan"` to the scanner action's `scans` input. If you don't already have a `scans` input, you'll also want to keep `"axe"` in the list — by default the scanner only runs Axe, and listing any value at all opts you out of the default.

```yaml
name: Accessibility Scanner
on: workflow_dispatch

jobs:
  accessibility_scanner:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6 # Required so the scanner can read your repo's scanner-plugins/ directory
      - uses: github/accessibility-scanner@v3
        with:
          urls: |
            https://example.com
          repository: REPLACE_THIS/REPLACE_THIS
          token: ${{ secrets.GH_TOKEN }}
          cache_key: REPLACE_THIS
          scans: '["axe", "alt-text-scan"]' # Add "alt-text-scan" to enable this plugin
```

> 👉 Update all `REPLACE_THIS` placeholders with your actual values. See the [scanner's Action inputs](https://github.com/github/accessibility-scanner#action-inputs) for the full list.

📚 Learn more

- [Scanner getting-started guide](https://github.com/github/accessibility-scanner#getting-started)
- [Writing workflows](https://docs.github.com/en/actions/how-tos/write-workflows)

---

### 3. Run your first scan

Trigger your scanner workflow manually or automatically based on your configuration. The plugin will run on every URL the scanner visits, extract every image that's exposed to assistive technology, and file a GitHub issue for each rule violation it finds.

📚 Learn more

- [View workflow run history](https://docs.github.com/en/actions/how-tos/monitor-workflows/view-workflow-run-history)
- [Running a workflow manually](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow#running-a-workflow)

---

## Rules

The plugin runs every extracted image through an append-only registry of rules. Each rule returns a finding when an image fails its criteria. Findings are converted to issues by the scanner.

| Rule                | ID                     | Fires when                                                                                                                                                                                                                                                                                                          | Example (flagged)                                                        |
| ------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Missing alt**     | `missing-alt-text`     | The `alt` attribute is absent (`null`) or whitespace-only (`"   "`). `alt=""` is treated as intentional decorative use and is **not** flagged.                                                                                                                                                                      | `<img src="cat.png">`<br>`<img src="cat.png" alt="   ">`                 |
| **Vague alt**       | `vague-alt-text`       | The alt text is one of a curated set of generic single words (`image`, `photo`, `icon`, `logo`, `screenshot`, `chart`, `untitled`, etc.) or short filler phrases (`an image of`, `a photo of`). Normalization is applied before matching: case-insensitive, whitespace-collapsed, surrounding punctuation stripped. | `<img alt="image">`<br>`<img alt="An image of">`<br>`<img alt="PHOTO.">` |
| **Filename as alt** | `filename-alt-text`    | The alt text ends in a common image file extension (`.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp`, `.bmp`, `.ico`).                                                                                                                                                                                              | `<img alt="IMG_1234.png">`<br>`<img alt="Screenshot 2024-04-28.jpg">`    |
| **Repeated alt**    | `repeated-alt`         | Two or more adjacent images in the rendered page share the same normalized alt text. Useful for patterns like five star icons all labeled `"3/5 stars"`.                                                                                                                                                            | Five consecutive `<img alt="3/5 stars">` elements                        |
| **Placeholder alt** | `placeholder-alt-text` | The alt text matches a known boilerplate string that signals it was never written (`todo`, `tbd`, `fixme`, `placeholder`, `alt text`, `insert alt text`, `image alt`). Normalization is applied before matching.                                                                                                    | `<img alt="TODO">`<br>`<img alt="insert alt text">`                      |

### Image extraction

Before rules run, the plugin extracts images from the page through Playwright's accessibility tree (`page.getByRole('img')`) and then narrows the result set to actual `<img>` elements. This means the following are filtered out automatically and never reach the rules:

- Non-`<img>` elements with `role="img"` (e.g. `<svg role="img">`, `<div role="img">`) — this plugin's rules only apply to HTML `<img>` tags
- Images inside `aria-hidden="true"` subtrees
- Images inside `display: none` or `visibility: hidden` subtrees
- Decorative images with `alt=""` (implicit `role="presentation"`)

### Overlap with Axe

The scanner's built-in Axe scan includes a rule called [`image-alt`](https://dequeuniversity.com/rules/axe/4.10/image-alt) that catches missing and whitespace-only `alt` attributes. If you have both `"axe"` and `"alt-text-scan"` enabled, the same image may be flagged by both. The other four rules in this plugin (vague-alt, filename-alt, repeated-alt, placeholder-alt) are unique to the plugin and don't overlap with Axe.

---

## Output

When a rule fires, the plugin emits a finding with the following shape (matching the scanner's [`Finding` type](https://github.com/github/accessibility-scanner/blob/main/.github/actions/find/src/types.d.ts)):

- `problemShort` — one-sentence description of what's wrong, including the offending alt text where applicable
- `solutionShort` — one-sentence description of how to fix it
- `problemUrl` — link to the relevant WCAG technique or W3C tutorial
- `html` — the offending `<img>` element's outer HTML

The scanner uses these fields to file or update a GitHub issue.

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

Every pull request runs `lint`, `format:check`, `typecheck`, and `test` against Node 22, 24, and 26 in CI. Workflow definitions live in [`.github/workflows/`](./.github/workflows/).

### Project layout

```
index.ts                    # Plugin entry point: exports `name` and the default scan function
src/
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
  unit/
    *.test.ts               # One file per rule
  utils/
    helpers.ts              # makeImage() and evaluateAlts() — shared across rule tests
```

### Adding a new rule

1. Create `src/rules/<rule-name>.ts` exporting a `Rule` (see [`src/types.ts`](./src/types.ts) for the shape — `id`, `problemUrl`, and `evaluate(context)`). Filenames under `src/` and `tests/` must be kebab-case; ESLint's `check-file/filename-naming-convention` rule enforces this.
2. Import the rule in [`src/rules/index.ts`](./src/rules/index.ts) and append it to `allRules`. The registry is append-only — don't reorder existing rules.
3. Add a `tests/unit/<rule-name>.test.ts` file. Use `evaluateAlts(alts, rule)` and `makeImage(overrides)` from [`tests/utils/helpers.ts`](./tests/utils/helpers.ts) for the common cases; construct an explicit `RuleContext` only when you need control over `src` or other per-image fields.
4. Run `npm run test && npm run typecheck && npm run lint` locally before opening a PR. CI will re-run them.

> [!IMPORTANT]
> Image extraction happens once per page, before any rule runs. Rules see the same filtered list of images regardless of which rules are enabled. Don't reach into the DOM from a rule — work from the `ImageRecord[]` the rule's context provides.

---

## Feedback

💬 We welcome your feedback! To submit feedback or report issues, please create an issue in this repository. For broader feedback on the a11y scanner itself, file it in the [scanner repository](https://github.com/github/accessibility-scanner/issues).

---

## License

📄 This project is licensed under the terms of the MIT open source license. Please refer to the [LICENSE](./LICENSE) file for the full terms.

## Maintainers

🔧 Maintained alongside the [AI-powered Accessibility Scanner](https://github.com/github/accessibility-scanner). See the scanner's [CODEOWNERS](https://github.com/github/accessibility-scanner/blob/main/.github/CODEOWNERS) for the responsible team.

## Support

❓ For support, please open an issue in this repository, or refer to the scanner's [SUPPORT](https://github.com/github/accessibility-scanner/blob/main/SUPPORT.md) document for guidance that applies across the project.

## Acknowledgement

✨ Built on top of [Playwright](https://playwright.dev/), [Vitest](https://vitest.dev/), and the broader open-source accessibility tooling ecosystem. Thank you to everyone contributing rules, tests, and review.
