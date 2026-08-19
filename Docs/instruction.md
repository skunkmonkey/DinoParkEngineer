# Instruction implementation

`src/instruction/public.ts` is the sole public boundary for deterministic Agent
instruction behavior. Content Registry records provide exact immutable
artifact identity and readable source. The package validates bounded
machine-readable clauses separately, composes Prompt, Skill, System Prompt,
Policy, Task, tool, knowledge-selection, verification, failure, escalation,
delegation, and reporting artifact classes, and orders applicable clauses by
priority, class precedence, stable clause ID, and exact source reference.

Expressions can read only supplied structured facts through a small validated
operator vocabulary. Decision output is data-only: one tool request,
completion, wait, stop, or escalation plus applied, rejected, and conflicting
clause provenance. A tool request is forwarded through the Simulation public
contract, which remains the only authority for physical effects and evidence.

Verification filters evidence by named source, reliability, freshness, and
agreement. Retries are bounded; exhausted or degraded evidence follows the
authored stop or escalation outcome. Composition reports duplicate IDs and
conflicting outcomes without parsing readable prose or inventing a quality
ranking. Focused verification is `npm test -- instruction` plus the Foundation
Lab rendered and browser scenarios.
