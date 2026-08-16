<!--
Terminology: a vertical slice, or tracer bullet, is a unit of work that extends through all levels: database, logic, UI (as applicable). This is as opposed to a horizontal layer, which addresses only a single layer. The goal of vertical layers is to provide the AI and the user with a visible and testable result when the work is complete. This improves the reliability of AI's output by providing rapid feedback.
Note that while we're mentioning Stories here, we're not actually using tickets, this is just a convenient way of identifying slices within a plan.
There might be slices that are needed to describe work that doesn't extend through all levels, that's fine, but the preference should be towards vertical slices since this will result in the best quality output.
-->

# Plan: <name>

## Proposed Vertical Slices
<numbered list of vertical slices (tracer bullets)>
<!-- Example
1. Award points for lesson completion, visible on dashboard
 - Blocked by: None
 - Stories: 1, 4, 5, 6, 14, 16, 17, 18
 - Adds points events table + migration. Implements AwardPointsForLesson(), GetUserStats() (points + level), Wires into MarkLessonComplete(). Adds dashboard stats card showing points, level and progress bar. Tests for point awarding, idempotency, and level calculation.
2. Award points for quiz completion
 - Blocked by: #1
 - Stories: 2, 3
 - Implements: AwardPointsForQuiz(). Wires into quiz submission action. Tests for pass (25 pts), ace (35 pts), fail (0 pts), and idempotency.
 -->
