# Content Registry

The Content Registry is the authoritative boundary for local authored content.
It validates complete declarative packages, keeps artifact versions immutable,
and resolves only exact IDs and versions. It has no network or runtime-LLM
dependency.

Downstream packages import only `src/content-registry/public.ts`. Create a
registry with a registry schema version and content-class Zod definitions, then
call `loadPackages`. The returned registry is a new immutable snapshot; the
previous snapshot never changes.

## Identity and ordering

- Content IDs and package IDs are portable namespaced strings such as
  `park:feed-triceratops`; versions are exact portable strings.
- Exact identity is the case-sensitive `(id, version)` pair. Case-insensitive
  collisions are rejected so catalogs behave the same on Windows and macOS.
- Records are ordered lexically by ID and then version. Dependencies and tags
  must arrive in lexical order and be unique.
- Resolution orders dependencies before dependants, visiting exact dependency
  references lexically. The root remains a separate manifest field.
- History and discovery never imply "newest." Production consumers must retain
  and provide an exact version.

## Validation and failure

Every package includes `packageId`, `packageVersion`,
`registrySchemaVersion`, `requirement`, `entries`, and a canonical fingerprint.
Use `fingerprintCatalogPackage` after constructing the other fields. Fingerprints
use canonical JSON with recursively sorted object keys and a deterministic
64-bit FNV-1a digest (`fnv1a64:<hex>`); they never include timestamps or file
enumeration order.

All envelopes and class data are validated before commit. A required package
failure returns `blocked` and the original registry, so no packages in that load
partially commit. An optional package failure produces stable diagnostics while
valid independent packages can still commit. Diagnostics sort by package,
source, record, field, code, then message and identify the violated rule.

Logical provenance paths must be relative POSIX paths with no backslashes,
drive letters, empty segments, `.` segments, or `..` segments. Imported class
data must remain plain finite JSON-compatible data.

## Queries and historical behavior

`getExact` and `resolveExact` are the production resolution entry points.
Discovery is available by class, tag, exact dependency, explicit availability,
and ID history. Hidden or unavailable historical records remain exactly
resolvable. All returned records, arrays, manifests, and inspection projections
are deeply frozen.

`inspect` derives identity, class, version, schema version, display name,
author, dependency references, context cost, provenance, availability, and
readable source from the same canonical record. The registry stores readable
prose but never parses it into runtime behavior.

## Browser foundation fixture

`createContentRegistryFoundationFixture` creates an app-importable deterministic
registry containing the Containment Policy and Safe Feeding Skill at `1.0.0`,
plus the Feed the Triceratops Prompt at available `1.0.0` and hidden historical
`2.0.0`. `CONTENT_REGISTRY_FOUNDATION_REFERENCES` provides their exact pinned
references so browser surfaces do not duplicate identity strings.

`createInvalidContentRegistryFoundationPackage` returns a correctly signed
optional package with a deliberately malformed Prompt record. An inspector can
load it into the foundation registry to exercise actionable diagnostics while
proving that the valid catalog remains available. These helpers contain only
local deterministic data and are shared by browser scenarios and domain tests.

## Verification

Run `node scripts/run-tests.mjs content-registry` for focused validation,
resolution, mutation, failure-isolation, golden fingerprint, and portable-path
coverage. This package is currently headless and has no registered browser
route; browser inspection belongs to a downstream feature surface.
