# Quarantined rendering sources

Generated or edited candidates enter this boundary only after their manifest is
validated against the exact bytes. A candidate always starts with
`quarantine: "unapproved"`; its presence here is never approval and never makes
it a runtime bundle input.

Do not store API credentials, bearer tokens, provider request headers, or local
machine paths here. Revisions use new source and candidate versions and retain
parent lineage.

The MVP revisions preserve their review trail: `mvp-source-sheet-r1.png` is
rejected for emblem-like marks, `mvp-source-sheet-r2.png` is rejected for a
baked checkerboard and missing alpha, and `mvp-source-sheet-r3.png` is the exact
approved RGBA source. All were made with the built-in OpenAI image-generation
surface. Candidate records retain available tool/model identity, prompts,
timestamps, lineage, hashes, and rights/usage. The surface exposed no model
snapshot, so none is fabricated.
