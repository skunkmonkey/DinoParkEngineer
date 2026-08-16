/** Canonical Park entity destination. The shell navigation callback applies
 * the configured base path; feature code must not invent a `/park` alias. */
export function parkEntityHref(entityId: string): string {
  return `/?entity=${encodeURIComponent(entityId)}`;
}
