const FRIENDLY_NAMES: Readonly<Record<string, string>> = Object.freeze({
  "dinosaur:tria": "Tria",
  "dinosaur:vera": "Vera",
  "robot:alpha": "Robot Alpha",
  "gate:alpha": "South Habitat Gate",
  "gate:beta": "North Paddock Gate",
  "location:enclosure": "Tria Habitat",
  "location:enclosure-beta": "North Paddock",
  "location:path": "Keeper Route",
  "location:service": "Robot Depot",
  "location:safe": "Visitor Arrival",
  "location:park": "Dawn Valley Park",
  "incident:opening-near-miss": "Opening-Day Near Miss",
  "incident:gate-beta": "Opening-Day Near Miss",
  "prompt:self-contained-feeding@1.0.0": "Safe Feeding Prompt v1",
  "prompt:self-contained-feeding@2.0.0": "Safe Feeding Prompt v2",
  "park:safe-feeding@1.0.0": "Safe Feeding Skill v1",
  "park:containment-policy@1.0.0": "Containment Policy v1",
  "context:maintenance-policy": "Current Gate Maintenance",
  "knowledge:gate-maintenance@1.0.0": "Gate Maintenance Knowledge v1",
  "trace:opening-feed-beta": "Opening Feeding Trace",
});

const titleCase = (value: string): string => value
  .split(/[-_]/u)
  .filter(Boolean)
  .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
  .join(" ");

/** Stable presentation projection; exact identity remains unchanged in domain state. */
export function friendlyName(identity: string): string {
  const known = FRIENDLY_NAMES[identity];
  if (known !== undefined) return known;
  const [namespace, value = identity] = identity.split(":", 2);
  if (namespace === "job") return `${titleCase(value.replace(/^schedule-/u, ""))} job`;
  return titleCase(value.replace(/@.+$/u, ""));
}

export const friendlyVersion = friendlyName;
