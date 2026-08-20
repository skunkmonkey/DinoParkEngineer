import React from "react";

import { ParkPlayerExperience } from "../player-experience/public.js";

/** Compatibility entry retained for the Shell's original Park route. */
export function ParkPlaceholder(): React.JSX.Element {
  return <ParkPlayerExperience />;
}

export { ParkPlayerExperience } from "../player-experience/public.js";
