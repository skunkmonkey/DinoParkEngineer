/**
 * The shell ports only carry structured-clone-compatible values.  Keeping this
 * type local to the shell prevents a port from accidentally becoming a mutable
 * object graph shared with a feature.
 */
export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  | JsonPrimitive
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) {
    return true;
  }

  switch (typeof value) {
    case "string":
    case "boolean":
      return true;
    case "number":
      return Number.isFinite(value);
    case "object":
      if (Array.isArray(value)) {
        return value.every((item) => isJsonValue(item));
      }

      return Object.entries(value).every(
        ([key, item]) => key.length > 0 && isJsonValue(item),
      );
    default:
      return false;
  }
}

/**
 * Clone and freeze at an ownership boundary.  The recursive implementation is
 * deliberately used instead of JSON serialization so that the shell does not
 * silently coerce values or drop fields while protecting a projection.
 */
export function cloneJsonValue<T extends JsonValue>(value: T): T {
  // The recursive clone preserves the JsonValue shape; the cast only restores
  // the caller's narrower readonly union after runtime validation.
  return freezeJsonValue(cloneJsonValueInternal(value)) as T;
}

function cloneJsonValueInternal(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map((item) => cloneJsonValueInternal(item));
  }

  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value)
      .sort(([left], [right]) => compareStrings(left, right))
      .map(([key, item]) => [key, cloneJsonValueInternal(item)] as const);

    return Object.fromEntries(entries);
  }

  return value;
}

export function freezeJsonValue<T extends JsonValue>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach((child) => {
      if (child !== null && typeof child === "object") {
        freezeJsonValue(child);
      }
    });
    Object.freeze(value);
  }

  return value;
}

export function cloneJsonRecord(
  values: Readonly<Record<string, JsonValue>>,
): Readonly<Record<string, JsonValue>> {
  return cloneJsonValue(values);
}

export function compareStrings(left: string, right: string): number {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}

export function normalizeIdentifier(value: string): string {
  return value.trim();
}
