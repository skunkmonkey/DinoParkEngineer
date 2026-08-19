# Required Development Software

This project supports development on Windows and macOS. The shipped game is a
static browser application and does not require players to install this
software.

## Required installation

### Node.js 24 LTS

The inspected Windows machine has Node.js 24 LTS and its bundled npm available
on `PATH`. On another development machine, install the current Node.js 24 LTS
release from the [official Node.js download page](https://nodejs.org/en/download):

- Windows: use the official x64 or ARM64 installer appropriate to the machine.
- macOS: use the official universal installer appropriate to the Mac, or an
  existing Node version manager configured to use Node.js 24 LTS.

Node.js 24 LTS satisfies the repository requirement of Node.js `>=22.13.0` and
includes a compatible npm version. Do not install npm separately.

After installation, open a new terminal and verify:

```text
node --version
npm --version
```

Then install the repository dependencies from its committed lockfile:

```text
npm install
```

## Already present on the inspected Windows machine

- Node.js 24.19.0
- npm 11.17.0
- npx 11.17.0
- Git 2.55
- Google Chrome
- Microsoft Edge
- Visual Studio Code
- Python 3.14 (not required by the baseline game toolchain)

## First implementation baseline - macOS

Verified on 2026-08-19, the inspected Apple silicon Mac has the following
compatible toolchain available on `PATH`:

- macOS 26.5.1 (arm64)
- Node.js 22.23.0
- npm 10.9.8
- npx 10.9.8
- Git 2.54.0
- Safari 26.5
- Google Chrome 151.0.7922.138
- TypeScript 7.0.2
- Vite 8.2.1

Node.js 22.23.0 and npm 10.9.8 satisfy the repository minimums. Node.js 24
LTS remains the development baseline for new installations.

The initial installed application packages are pinned in `package.json` and
`package-lock.json`: React 19.2.8, React DOM 19.2.8, PixiJS 8.19.0, React
Router DOM 7.18.2, Zod 4.4.3, TypeScript 7.0.2, Vite 8.2.1, and Vite React
plugin 6.0.5. The baseline `npm install` completed with zero reported
vulnerabilities.

On another Mac, verify:

```text
git --version
node --version
npm --version
```

If `git` is missing, install Git using the macOS prompt for Xcode Command Line
Tools or an official Git distribution. A current Safari installation is useful
for manual browser verification, while the planned browser automation
dependency will provide its own automated browser binaries.

## Not required as separate installations

PixiJS, React, Vite, Zod, image-processing libraries, test runners, and browser
automation packages are repository dependencies installed by npm. The planned
asset pipeline will use portable repository scripts and prebuilt npm packages;
ImageMagick, FFmpeg, Tiled, and platform-specific graphics tools are therefore
not baseline prerequisites.

OpenAI access or credentials may be needed by the person or agent generating
new source assets, but no OpenAI credential is required to build, test, run, or
play using committed approved assets.
