# Dino Park Engineer

The Application Shell for Dino Park Engineer is a deterministic, client-first
React application running on [vinext](https://github.com/cloudflare/vinext).
The shell is intentionally domain-neutral: product features register lazy
routes and providers through `src/shell/public.ts`.

## Prerequisites

- Node.js `>=22.13.0` (Node 24 is used in CI/development)
- npm `>=10` (the committed `package-lock.json` is the source of truth)

## Quick Start

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm run test:shell
npm run build
npm test
```

`npm run validate` runs type checking, linting, shell contract tests, the
production build, and rendered HTML smoke tests in one command. The shell does
not require an LLM, account, network service, secret, backend, or external
runtime configuration after dependencies are installed.

The selected stack is TypeScript 5.9, React 19, vinext 1.0 beta, Vite 8,
ESLint 9, and Node's built-in test runner. Client routing and lazy feature
loading live in `src/shell`; no product destinations are encoded there.

## Supported Browsers

The support baseline, verified on 2026-08-15, is the current and immediately
previous stable major for each browser family:

- Chromium/Chrome 151 and 150
- Firefox 153 and 152
- Safari 26 and 18 (Safari 27 is still a beta and is not the stable baseline)

Update this rolling baseline when a new stable major ships. Release status is
tracked from the official [Chrome Releases](https://chromereleases.googleblog.com/),
[Mozilla Release Management](https://wiki.mozilla.org/Release_Management/Release_owners),
and [Safari release notes](https://developer.apple.com/documentation/safari-release-notes).

## Included Shape

- edit the root route/layout under `app/`
- add shell contracts only through `src/shell/public.ts`
- expose each downstream feature from its own `src/<feature>/public.ts`; the
  shell discovers public feature modules without a central import list
- `.openai/hosting.json` keeps Sites bindings explicitly disabled for the shell
- no database, authentication helper, API route, or backend scaffold is included

## Shell Integration

Feature modules should import only from `src/shell/public.ts` and register a
stable feature id, lazy route loaders, and explicit provider dependencies. A
module's private implementation must not be imported by the shell. Registration
diagnostics are deterministic, and an invalid optional module remains
unavailable while sibling modules continue to load.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm run typecheck`: validate shell and feature TypeScript contracts
- `npm run lint`: run ESLint and accessibility rules
- `npm run lint:architecture`: enforce public-entry-only feature imports
- `npm run test:shell`: run shell registry/router/provider/config/lifecycle tests
- `npm test`: build and verify rendered root/nested shell states
- `npm run validate`: run the complete shell validation sequence

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
