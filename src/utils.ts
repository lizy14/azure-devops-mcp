// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export const apiVersion = "7.2-preview.1";
export const batchApiVersion = "5.0";
export const markdownCommentsApiVersion = "7.2-preview.4";

export function createEnumMapping<T extends Record<string, string | number>>(enumObject: T): Record<string, T[keyof T]> {
  const mapping: Record<string, T[keyof T]> = {};
  for (const [key, value] of Object.entries(enumObject)) {
    if (typeof key === "string" && typeof value === "number") {
      mapping[key.toLowerCase()] = value as T[keyof T];
    }
  }
  return mapping;
}

export function mapStringToEnum<T extends Record<string, string | number>>(value: string | undefined, enumObject: T, defaultValue?: T[keyof T]): T[keyof T] | undefined {
  if (!value) return defaultValue;
  const enumMapping = createEnumMapping(enumObject);
  return enumMapping[value.toLowerCase()] ?? defaultValue;
}

/**
 * Maps an array of strings to an array of enum values, filtering out invalid values.
 * @param values Array of string values to map
 * @param enumObject The enum object to map to
 * @returns Array of valid enum values
 */
export function mapStringArrayToEnum<T extends Record<string, string | number>>(values: string[] | undefined, enumObject: T): T[keyof T][] {
  if (!values) return [];
  return values.map((value) => mapStringToEnum(value, enumObject)).filter((v): v is T[keyof T] => v !== undefined);
}

/**
 * Converts a TypeScript numeric enum to an array of string keys for use with z.enum().
 * This ensures that enum schemas generate string values rather than numeric values.
 * @param enumObject The TypeScript enum object
 * @returns Array of string keys from the enum
 */
export function getEnumKeys<T extends Record<string, string | number>>(enumObject: T): string[] {
  return Object.keys(enumObject).filter((key) => isNaN(Number(key)));
}

/**
 * Safely converts a string enum key to its corresponding enum value.
 * Validates that the key exists in the enum before conversion.
 * @param enumObject The TypeScript enum object
 * @param key The string key to convert
 * @returns The enum value if key is valid, undefined otherwise
 */
export function safeEnumConvert<T extends Record<string, string | number>>(enumObject: T, key: string | undefined): T[keyof T] | undefined {
  if (!key) return undefined;

  const validKeys = getEnumKeys(enumObject);
  if (!validKeys.includes(key)) {
    return undefined;
  }

  return enumObject[key as keyof T];
}

/**
 * Returns the string name for a numeric enum value, or undefined if no member matches.
 * For TypeScript numeric enums this is equivalent to `enumObject[value]`, but is
 * defensive against non-number inputs (which would otherwise index by key and
 * silently return another numeric value via the reverse mapping).
 *
 * @param enumObject The TypeScript numeric enum object
 * @param value The numeric value to look up
 * @returns The enum member name, or undefined if no exact match
 */
export function enumIntToName<T extends Record<string, string | number>>(enumObject: T, value: number | undefined | null): string | undefined {
  if (typeof value !== "number") return undefined;
  const name = (enumObject as Record<number, string>)[value];
  return typeof name === "string" ? name : undefined;
}

/**
 * Decorates an object that carries a numeric enum field with a sibling string
 * label, so MCP clients (and LLMs) don't have to memorize integer enum values.
 *
 * Returns a shallow copy with `${field}` preserved and `${field}Name` added.
 * If the field is missing or doesn't match an enum member, the input is
 * returned unchanged.
 *
 * @example
 *   decodeEnumField({ status: 2 }, "status", PullRequestStatus)
 *   // => { status: 2, statusName: "Abandoned" }
 */
export function decodeEnumField<T extends object, K extends keyof T, E extends Record<string, string | number>>(obj: T, field: K, enumObject: E): T & Partial<Record<`${string & K}Name`, string>> {
  const value = obj[field] as unknown;
  const name = enumIntToName(enumObject, value as number);
  if (name === undefined) return obj as T & Partial<Record<`${string & K}Name`, string>>;
  return { ...obj, [`${String(field)}Name`]: name } as T & Partial<Record<`${string & K}Name`, string>>;
}

/**
 * Encodes `>` and `<` for Markdown formatted fields.
 *
 * @param value The text value to encode
 * @param format The format of the field ('Markdown' or 'Html')
 * @returns The encoded text, or original text if format is not Markdown
 */
export function encodeFormattedValue(value: string, format?: "Markdown" | "Html"): string {
  if (!value || format !== "Markdown") return value;
  const result = value.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return result;
}

/**
 * Detects whether a string returned from an ADO API stream is actually an error
 * response serialized as JSON (e.g. a 404 GitItemNotFoundException or
 * WikiPageNotFoundException) rather than real content.
 *
 * The ADO Node API client swallows non-2xx HTTP responses and delivers the
 * error body as a stream, so callers must check explicitly after reading.
 *
 * @returns The human-readable error message extracted from the JSON, or null if
 *          the content is not an ADO error response.
 */
export function extractAdoStreamError(content: string): string | null {
  try {
    const json = JSON.parse(content.trim());
    if (json && typeof json.typeName === "string" && typeof json.message === "string") {
      return json.message;
    }
  } catch {
    // Not JSON — not an ADO error response.
  }
  return null;
}

/**
 * Convert a Node.js ReadableStream to a string.
 * Shared utility for consistent stream handling across tools.
 */
export function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk: string) => {
      data += chunk;
    });
    stream.on("error", reject);
    stream.on("end", () => resolve(data));
  });
}
