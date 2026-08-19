# Plan: Rendering Asset Pipeline

## Proposed Vertical Slices

1. **One asset brief validates before any image is generated**
   - Blocked by: Application Shell #1, Content Registry #1
   - Adds brief schema, shared three-quarter art-direction constraints, stable
     IDs/revisions, semantic and accessibility fields, and an MVP robot brief.
   - Tests: valid brief, missing view/anchor/variant, case collision, stable
     ordering, and Windows/macOS path handling.
   - Visible proof: render the validated brief and checklist in a generated
     HTML/contact-sheet report.

2. **OpenAI-generated robot candidates enter an unapproved provenance catalog**
   - Blocked by: #1
   - Adds candidate import, model/snapshot and prompt-revision provenance,
     references, hashes, lineage, quarantine, and secret rejection.
   - Tests: complete provenance, missing model identity, changed hash, duplicate
     candidate, and guarantee that unapproved files are not bundle inputs.
   - Visible proof: inspect candidates and provenance without exposing secrets.

3. **An approved robot compiles into a Pixi fixture scene**
   - Blocked by: #2, Application Shell #2
   - Adds explicit review records, deterministic crop/trim/padding/pivot,
     runtime metadata, one-image bundle, and PixiJS fixture loading.
   - Tests: approval binding, canonical manifest, stale output, pivot bounds,
     repeat compilation, and no runtime model imports.
   - Browser proof: display the exact asset ID at target scale with selection
     outline, keyboard-accessible semantic equivalent, and missing-asset state.

4. **A small three-quarter MVP atlas proves asset-family contracts**
   - Blocked by: #3
   - Adds briefs and approved fixtures for dinosaur, robot, gate, environment,
     visitor, cue, effect, and reward families plus deterministic atlas packing
     and animation metadata.
   - Tests: atlas overlap, frame completeness, stable anchors across state
     variants, reduced-motion variant declarations, and production placeholder
     rejection.
   - Browser proof: inspect a contact sheet and animated fixture scene at near
     and far semantic zoom.

5. **Asset revision remains historical and content-selected**
   - Blocked by: #4, Content Registry #2-#3
   - Adds derived-edit lineage, new brief/source/runtime versions, package pinning,
     orphan detection, and selective bundle output.
   - Tests: old bundle unchanged, new source approval required, exact resolution,
     and unshipped rejected/superseded candidates.
   - Browser proof: switch a fixture package between two exact robot versions.

6. **Cross-platform asset validation gate**
   - Blocked by: #1-#5
   - Adds npm commands for briefs, import, review report, compile, and validate;
     CI fixture comparison; authoring documentation; and full validation wiring.
   - Tests: focused pipeline suite plus repository validation on Windows/macOS.
   - Browser proof: generated contact sheet, fixture atlas, keyboard equivalents,
     missing media recovery, and reduced-motion presentation.
