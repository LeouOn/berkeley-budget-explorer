import { z } from "zod";

export const CentsParseErrorSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("malformed"), input: z.string() }),
  z.object({ kind: z.literal("out-of-range"), input: z.string() }),
]);
export type CentsParseError = z.infer<typeof CentsParseErrorSchema>;

export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: CentsParseError };

// Accepts an exact decimal text representation and returns the value in integer
// cents. The parser is total: every input is either a successful parse, a
// "malformed" result (non-numeric, more than two decimal places, empty, or
// whitespace), or an "out-of-range" result (magnitude exceeds
// Number.MAX_SAFE_INTEGER cents). The sign is captured from a leading "-"
// exactly once, after magnitude is computed, so negative values like "-123.45"
// return -12345 cents. Leading "+", thousands separators, scientific notation,
// and currency symbols are rejected. The "0" and "0.00" inputs both yield 0.
const Pattern = /^-?(\d+)(?:\.(\d{1,2}))?$/;
const MaxSafeCents = BigInt(Number.MAX_SAFE_INTEGER);

export function parseDollarsToCents(input: string): ParseResult<number> {
  if (typeof input !== "string") {
    return { ok: false, error: { kind: "malformed", input: String(input) } };
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: { kind: "malformed", input: trimmed } };
  }
  const match = Pattern.exec(trimmed);
  if (!match) {
    return { ok: false, error: { kind: "malformed", input: trimmed } };
  }
  const wholeDigits = match[1] ?? "";
  const fracDigits = match[2] ?? "";
  if (wholeDigits.length === 0) {
    return { ok: false, error: { kind: "malformed", input: trimmed } };
  }
  const negative = trimmed.startsWith("-");
  const wholeCents = BigInt(wholeDigits) * 100n;
  const fracCents = BigInt(`${fracDigits}00`.slice(0, 2));
  const magnitude = wholeCents + fracCents;
  if (magnitude > MaxSafeCents) {
    return { ok: false, error: { kind: "out-of-range", input: trimmed } };
  }
  const value = Number(magnitude) * (negative ? -1 : 1);
  return { ok: true, value };
}
