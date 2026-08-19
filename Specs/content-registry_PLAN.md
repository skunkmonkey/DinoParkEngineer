# Plan: Content Registry

## Proposed Vertical Slices

1. **One validated Prompt version appears in a registry inspector fixture**
   - Blocked by: Application Shell #1-#4
   - Adds stable IDs, version/schema metadata, Zod boundary validation, atomic
     base package loading, and a minimal read-only inspection projection.
   - Tests: valid record, malformed fields, duplicate identity, atomic failure,
     and stable error ordering.
   - Browser proof: load the fixture and inspect exact identity and provenance;
     load an invalid package and see an actionable scoped failure.

2. **Exact dependencies resolve as a visible immutable manifest**
   - Blocked by: #1
   - Adds dependency records, deterministic topological resolution, cycles and
     conflict errors, canonical serialization, and manifest fingerprints.
   - Tests: direct/transitive dependencies, cycles, missing versions,
     fingerprint stability, and changed dependency fingerprints.
   - Browser proof: inspect a Prompt and its exact Skill/Policy dependencies.

3. **A newer version leaves historical resolution unchanged**
   - Blocked by: #2
   - Adds append-only version history, hidden historical availability, queries,
     and an exact-resolution fixture pinned before a new version is added.
   - Tests: no mutation, no floating, stable query order, exact historical
     manifest after catalog extension.
   - Browser proof: switch between version history entries and verify the
     pinned record remains unchanged.

4. **Multiple local content packages degrade independently**
   - Blocked by: #1-#3
   - Adds required and optional package semantics, compatibility validation,
     package-level diagnostics, and portable path checks.
   - Tests: optional-package failure isolation, required-package blocking,
     schema mismatch, case collision, and Windows/macOS path parity.
   - Browser proof: fail one optional fixture package and confirm the base
     catalog remains inspectable.

5. **Registry validation gate**
   - Blocked by: #1-#4
   - Adds public API documentation, architecture rules, golden fixtures, and
     complete validation integration.
   - Tests: focused suite plus full repository validation.
   - Browser proof: exact resolution, invalid content, history, optional
     failure, keyboard inspection, and text reflow.
