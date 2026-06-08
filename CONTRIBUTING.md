# Contributing

[fork]: https://github.com/github/accessibility-scanner-alt-text-plugin/fork
[pr]: https://github.com/github/accessibility-scanner-alt-text-plugin/compare
[style]: https://github.com/github/accessibility-scanner-alt-text-plugin/blob/main/eslint.config.js

Hi there! We're thrilled that you'd like to contribute to this project. Your help is essential for keeping it great.

Contributions to this project are [released](https://help.github.com/articles/github-terms-of-service/#6-contributions-under-repository-license) to the public under the [project's open source license](LICENSE).

Please note that this project is released with a [Contributor Code of Conduct](CODE_OF_CONDUCT.md). By participating in this project you agree to abide by its terms.

## Prerequisites for running and testing code

These are one-time installations required to be able to test your changes locally as part of the pull request (PR) submission process.

1. Install Node.js (see `engines` in [package.json](package.json) for supported versions) [through download](https://nodejs.org/en/download) | [through Homebrew](https://formulae.brew.sh/formula/node)
1. Install dependencies: `npm install`

## Submitting a pull request

1. [Fork][fork] and clone the repository
1. Install the dependencies: `npm install`
1. Make sure the tests pass on your machine: `npm test`
1. Make sure the typechecker passes on your machine: `npm run typecheck`
1. Make sure the linter passes on your machine: `npm run lint`
1. Make sure the formatter passes on your machine: `npm run format:check`
1. Create a new branch: `git checkout -b my-branch-name`
1. Make your change, add tests, and make sure the tests, typechecker, linter, and formatter still pass
1. Push to your fork and [submit a pull request][pr]
1. Pat yourself on the back and wait for your pull request to be reviewed and merged.

Here are a few things you can do that will increase the likelihood of your pull request being accepted:

- Follow the [style guide][style].
- Write tests.
- Keep your change as focused as possible. If there are multiple changes you would like to make that are not dependent upon each other, consider submitting them as separate pull requests.
- Write a [good commit message](http://tbaggery.com/2008/04/19/a-note-about-git-commit-messages.html).

## Creating issues

When creating an issue, please provide:

- A clear and descriptive title
- Detailed steps to reproduce (for bugs)
- Expected vs. actual behavior
- Your environment details (Node.js version, OS, accessibility-scanner version, plugin configuration)
- A minimal HTML/page example that reproduces the behavior, when applicable
- Any relevant logs or screenshots

## Feature requests

While we welcome feature requests, please note that we cannot guarantee that any feature request will be implemented or prioritized. We review all suggestions and consider them as part of our ongoing development process.

## Resources

- [How to Contribute to Open Source](https://opensource.guide/how-to-contribute/)
- [Using Pull Requests](https://help.github.com/articles/about-pull-requests/)
- [GitHub Help](https://help.github.com)
