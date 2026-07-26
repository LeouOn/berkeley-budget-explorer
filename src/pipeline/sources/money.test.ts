import { describe, expect, it } from "vitest";
import { parseDollarsToCents } from "./money";

describe("parseDollarsToCents", () => {
  it("parses a positive two-decimal value", () => {
    expect(parseDollarsToCents("123.45")).toEqual({ ok: true, value: 12345 });
  });

  it("parses a positive integer", () => {
    expect(parseDollarsToCents("100")).toEqual({ ok: true, value: 10000 });
  });

  it("parses zero", () => {
    expect(parseDollarsToCents("0")).toEqual({ ok: true, value: 0 });
    expect(parseDollarsToCents("0.00")).toEqual({ ok: true, value: 0 });
  });

  it("parses a negative two-decimal value without flipping the sign", () => {
    const r = parseDollarsToCents("-123.45");
    expect(r).toEqual({ ok: true, value: -12345 });
  });

  it("parses a negative integer", () => {
    expect(parseDollarsToCents("-42")).toEqual({ ok: true, value: -4200 });
  });

  it("rejects malformed input", () => {
    const r = parseDollarsToCents("abc");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("malformed");
  });

  it("rejects empty input", () => {
    const r = parseDollarsToCents("");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("malformed");
  });

  it("rejects more than two decimal places", () => {
    const r = parseDollarsToCents("1.234");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("malformed");
  });

  it("rejects values beyond Number.MAX_SAFE_INTEGER (in cents)", () => {
    const r = parseDollarsToCents("100000000000000.00");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("out-of-range");
  });

  it("accepts the largest safe value", () => {
    const r = parseDollarsToCents("90071992547409.91");
    expect(r.ok).toBe(true);
  });
});
