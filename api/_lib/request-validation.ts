import { HttpError } from './http-errors.js';

export type JsonObject = Record<string, unknown>;

export function requireObject(value: unknown, field = 'body'): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'INVALID_PAYLOAD', `${field} must be an object`);
  }
  return value as JsonObject;
}

export function rejectUnknownKeys(
  value: JsonObject,
  allowed: readonly string[],
): void {
  const allowedSet = new Set(allowed);
  if (Object.keys(value).some((key) => !allowedSet.has(key))) {
    throw new HttpError(400, 'INVALID_PAYLOAD', 'Payload contains unsupported fields');
  }
}

export function requireString(
  value: unknown,
  field: string,
  options: { min?: number; max?: number; pattern?: RegExp } = {},
): string {
  const min = options.min ?? 1;
  const max = options.max ?? 200;
  if (typeof value !== 'string') {
    throw new HttpError(400, 'INVALID_PAYLOAD', `${field} must be a string`);
  }
  const result = value.trim();
  if (
    result.length < min ||
    result.length > max ||
    (options.pattern && !options.pattern.test(result))
  ) {
    throw new HttpError(400, 'INVALID_PAYLOAD', `${field} is invalid`);
  }
  return result;
}

export function optionalString(
  value: unknown,
  field: string,
  options: { max?: number; pattern?: RegExp } = {},
): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return requireString(value, field, { min: 1, ...options });
}

export function requireEnum<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new HttpError(400, 'INVALID_PAYLOAD', `${field} is invalid`);
  }
  return value as T;
}

export function requireInteger(
  value: unknown,
  field: string,
  min: number,
  max: number,
): number {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) {
    throw new HttpError(400, 'INVALID_PAYLOAD', `${field} is invalid`);
  }
  return value as number;
}

export function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new HttpError(400, 'INVALID_PAYLOAD', `${field} must be boolean`);
  }
  return value;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const RESOURCE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9:_-]{8,160}$/;

export function requireIsoDate(value: unknown, field = 'date'): string {
  const result = requireString(value, field, { max: 10, pattern: ISO_DATE });
  const parsed = new Date(`${result}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== result) {
    throw new HttpError(400, 'INVALID_PAYLOAD', `${field} is invalid`);
  }
  return result;
}

export function requireClockTime(value: unknown, field = 'time'): string {
  return requireString(value, field, { max: 5, pattern: CLOCK_TIME });
}

export function requireResourceId(value: unknown, field: string): string {
  return requireString(value, field, { max: 128, pattern: RESOURCE_ID });
}

export function requireIdempotencyKey(value: unknown): string {
  return requireString(value, 'idempotencyKey', {
    min: 8,
    max: 160,
    pattern: IDEMPOTENCY_KEY,
  });
}

export function requireEmail(value: unknown, field = 'email'): string {
  return requireString(value, field, {
    max: 254,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  }).toLowerCase();
}
