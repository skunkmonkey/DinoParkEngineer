import { z } from "zod";

export const workRequestInputSchema = z.object({
  id: z.string().min(1),
  goal: z.string().min(1),
  baseVersion: z.object({ id: z.string().min(1), version: z.string().min(1) }).strict(),
  capability: z.enum(["Prompt engineering", "Skill authoring", "Context optimization", "Eval creation", "Tool integration", "Memory architecture", "Agent design", "Orchestration"]),
  inputs: z.array(z.string().min(1)),
  quote: z.object({ id: z.string().min(1), credits: z.number().int().nonnegative(), durationTicks: z.number().int().nonnegative(), category: z.enum(["authoring", "acquisition"]) }).strict(),
  feedbackForCandidateId: z.string().min(1).optional(),
}).strict();
