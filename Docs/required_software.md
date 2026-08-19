# Required Development Software

This project supports development on Windows and macOS. The shipped game is a
static browser application and does not require players to install this
software.

## Required installation

### Node.js 24 LTS

Node.js and npm are not currently available on the inspected Windows machine's
`PATH`. Install the current Node.js 24 LTS release from the
[official Node.js download page](https://nodejs.org/en/download):

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

- Git 2.55
- Google Chrome
- Microsoft Edge
- Visual Studio Code
- Python 3.14 (not required by the baseline game toolchain)

## macOS checks

The Mac was not available for inspection. Before using it, verify:

```text
git --version
node --version
npm --version
```

If `git` is missing, install Git using the macOS prompt for Xcode Command Line
Tools or an official Git distribution. A current Safari installation is useful
for manual browser verification, while the repository's Playwright dependency
provides its own automated browser binaries.

## Not required as separate installations

PixiJS, React, Vite, Zod, image-processing libraries, test runners, and browser
automation packages are repository dependencies installed by npm. The planned
asset pipeline will use portable repository scripts and prebuilt npm packages;
ImageMagick, FFmpeg, Tiled, and platform-specific graphics tools are therefore
not baseline prerequisites.

OpenAI access or credentials may be needed by the person or agent generating
new source assets, but no OpenAI credential is required to build, test, run, or
play using committed approved assets.
