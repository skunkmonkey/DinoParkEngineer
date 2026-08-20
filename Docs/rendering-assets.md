# Rendering asset workflow

Briefs in `assets/briefs` define every semantic family and persistent DOM
equivalent. Generated pixels enter `assets/source` quarantine and bind to
complete provenance in `assets/manifests/candidates.json`. File presence never
grants approval.

## Review trail

Three immutable MVP source-sheet revisions were retained. Revision 1 was
rejected because leaf emblems resembled logos. Revision 2 removed those marks
but returned opaque RGB pixels with a baked checkerboard. Revision 3 passed the
nine briefs and was explicitly approved at exact source hash
`fnv1a64:024ee040e7625fa7`. The built-in generation surface exposed the alias
`openai-built-in-imagegen` but no snapshot, so the records do not invent one.

The approved prompt requests nine isolated south-east three-quarter sprites:
robot, herbivore, gate, environment, visitor, warning cue, dust effect, park
thumbnail, and plushie reward. It requires transparent RGBA, common upper-left
light, and no text, branding, logos, signatures, watermark, borders, captions,
or grid. The exact prompt is retained in each approved candidate record.

## Portable commands

Run `npm run assets:review-report`, `npm run assets:compile`, and `npm run
assets:validate` to rebuild the contact sheet, compile approved sources, and
enforce the production gate. `npm run assets:fixture-data` is an explicit
authoring command and is not part of build, test, run, replay, or play.

Compilation validates PNG and alpha, declares deterministic crop, trim,
padding, scale, and format operations, assigns stable atlas cells, and emits
exact provenance and presentation metadata. Validation detects missing frames,
stale hashes, duplicate and case-colliding IDs, atlas overlap, production
placeholders, and orphans. The compiler runs under explicit `darwin` and
`win32` logical inputs and compares byte-equal canonical JSON; this proves
path-independent output without claiming another OS was available.

Runtime code imports `src/rendering-assets/public.ts`, builds a base-path-aware
local URL, and resolves exact asset ID/version pairs. Generation tooling,
prompts, rejected media, and credentials remain outside `public/` and browser
imports. Development placeholders visibly name missing media, while production
validation rejects them for required assets.
