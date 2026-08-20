import { createContextFoundationFixture } from "../context/public.js";
import { createInstructionFoundationFixture } from "../instruction/public.js";
import { createEngineeringWorkbench } from "./engine.js";

export const createEngineeringWorkbenchFoundationFixture = () => {
  const instruction = createInstructionFoundationFixture();
  const context = createContextFoundationFixture();
  const workbench = createEngineeringWorkbench(instruction.selfContained);
  return { instruction, context, workbench };
};
