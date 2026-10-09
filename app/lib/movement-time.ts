const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export type OptionalTimeResult =
  | { valid: true; value: string | undefined }
  | { valid: false };

export function parseOptionalTime(value: unknown): OptionalTimeResult {
  if (value === undefined || value === null) {
    return { valid: true, value: undefined };
  }
  if (typeof value !== 'string') {
    return { valid: false };
  }

  const time = value.trim();
  if (!time) {
    return { valid: true, value: undefined };
  }
  if (!TIME_PATTERN.test(time)) {
    return { valid: false };
  }

  return { valid: true, value: time };
}
