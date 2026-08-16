function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
}

export function formatGameTime(totalSeconds: number, locale = "en-US"): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const day = Math.floor(safeSeconds / 86400) + 1;
  const remainder = safeSeconds % 86400;
  const hours = Math.floor(remainder / 3600);
  const minutes = Math.floor((remainder % 3600) / 60);
  const seconds = remainder % 60;
  const twoDigits = (value: number) => String(value).padStart(2, "0");
  return `Day ${formatNumber(day, locale)} · ${twoDigits(hours)}:${twoDigits(minutes)}:${twoDigits(seconds)}`;
}

export function formatContextUnits(units: number, locale = "en-US"): string {
  const safeUnits = Math.max(0, units);
  if (safeUnits < 1000) return `${formatNumber(safeUnits, locale)} CU`;
  return `${new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(safeUnits / 1000)}k CU`;
}

export function formatCredits(credits: number, locale = "en-US"): string {
  return `${formatNumber(Math.max(0, credits), locale)} cr`;
}

export function formatStableId(value: string, maxLength = 24): string {
  if (value.length <= maxLength) return value;
  const visible = Math.max(4, maxLength - 1);
  return `${value.slice(0, visible)}…`;
}

export function formatSeverity(severity: 0 | 1 | 2 | 3 | 4): string {
  return ["Informational", "Service failure", "Safety near miss", "Containment incident", "Major emergency"][severity] ?? "Unknown severity";
}
