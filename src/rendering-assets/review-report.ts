import type { ContentRecord } from "../content-registry/public.js";
import type { AssetCandidate, CandidateReviewRecord } from "./types.js";

const escapeHtml = (value: unknown): string => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const compareIdentity = (left: { readonly id?: string; readonly candidateId?: string; readonly version?: string; readonly candidateVersion?: string }, right: { readonly id?: string; readonly candidateId?: string; readonly version?: string; readonly candidateVersion?: string }): number =>
  `${left.id ?? left.candidateId}@${left.version ?? left.candidateVersion}`.localeCompare(
    `${right.id ?? right.candidateId}@${right.version ?? right.candidateVersion}`,
    "en",
    { sensitivity: "variant" },
  );

export const generateReviewReportHtml = (
  briefs: readonly ContentRecord[],
  candidates: readonly AssetCandidate[],
  reviews: readonly CandidateReviewRecord[],
): string => {
  const reviewByCandidate = new Map([...reviews]
    .sort((left, right) => `${left.decidedAt}\u0000${left.reviewId}`.localeCompare(`${right.decidedAt}\u0000${right.reviewId}`, "en", { sensitivity: "variant" }))
    .map((review) => [`${review.candidateId}@${review.candidateVersion}`, review]));
  const briefSections = [...briefs].sort(compareIdentity).map((brief) => {
    const data = brief.data as { semanticRole?: string; requiredViews?: readonly string[]; acceptanceChecklist?: readonly string[] };
    return `<section><h2>${escapeHtml(brief.displayName)}</h2><dl><dt>Brief</dt><dd>${escapeHtml(brief.id)}@${escapeHtml(brief.version)}</dd><dt>Semantic role</dt><dd>${escapeHtml(data.semanticRole)}</dd><dt>Required views</dt><dd>${escapeHtml(data.requiredViews?.join(", ") ?? "")}</dd></dl><h3>Acceptance checklist</h3><ul>${(data.acceptanceChecklist ?? []).map((item) => `<li><label><input type="checkbox"> ${escapeHtml(item)}</label></li>`).join("")}</ul></section>`;
  }).join("");
  const candidateSections = [...candidates].sort(compareIdentity).map((candidate) => {
    const review = reviewByCandidate.get(`${candidate.candidateId}@${candidate.candidateVersion}`);
    const previewPath = `../source/${candidate.sourcePath.slice("assets/source/".length)}`;
    return `<article><h3>${escapeHtml(candidate.candidateId)}@${escapeHtml(candidate.candidateVersion)}</h3><figure><img src="${escapeHtml(previewPath)}" alt="Candidate preview for ${escapeHtml(candidate.candidateId)}" loading="lazy"><figcaption>Unapproved source preview; pixels are not runtime truth.</figcaption></figure><p><strong>Quarantine:</strong> ${escapeHtml(candidate.quarantine)}</p><dl><dt>Source</dt><dd>${escapeHtml(candidate.sourceId)}@${escapeHtml(candidate.sourceVersion)}</dd><dt>Hash</dt><dd><code>${escapeHtml(candidate.sourceHash)}</code></dd><dt>Model</dt><dd>${escapeHtml(candidate.model.alias)}${candidate.model.snapshot === undefined ? "" : ` / ${escapeHtml(candidate.model.snapshot)}`}</dd><dt>Decision</dt><dd>${escapeHtml(review?.decision ?? "awaiting review")}</dd></dl></article>`;
  }).join("");
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Dino Park Engineer asset review</title><style>body{font:16px system-ui;max-width:72rem;margin:auto;padding:2rem;color:#18251d;background:#f5f0df}section,article{background:#fff;border:2px solid #446b51;border-radius:.5rem;margin:1rem 0;padding:1rem}dt{font-weight:700}dd{margin:0 0 .6rem}code{overflow-wrap:anywhere}.notice{border-left:.5rem solid #a5531c;padding:.75rem;background:#fff3df}</style></head><body><h1>Rendering asset review</h1><p class="notice"><strong>Human review required.</strong> Candidates remain quarantined until an exact hash-bound approval record exists. This report does not approve art.</p><h2>Briefs</h2>${briefSections}<h2>Candidate contact sheet</h2>${candidateSections || "<p>No generated candidates imported. Brief is ready for generation.</p>"}</body></html>\n`;
};
