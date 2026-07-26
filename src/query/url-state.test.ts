import { describe, expect, it } from "vitest";
import { parseOverviewUrl, serializeOverviewUrl } from "./url-state";

describe("overview url state", () => {
  it("defaults to real / base 2024 when params are absent", () => {
    expect(parseOverviewUrl("")).toEqual({ mode: "real", baseYear: 2024 });
  });

  it("rejects unknown mode values and falls back to real", () => {
    expect(parseOverviewUrl("?mode=hyper").mode).toBe("real");
  });

  it("coerces a valid base year", () => {
    expect(parseOverviewUrl("?mode=nominal&baseYear=2022")).toEqual({
      mode: "nominal",
      baseYear: 2022,
    });
  });

  it("round-trips through serialize", () => {
    const search = serializeOverviewUrl({ mode: "nominal", baseYear: 2024 });
    expect(search).toBe("?mode=nominal&baseYear=2024");
    expect(parseOverviewUrl(search)).toEqual({ mode: "nominal", baseYear: 2024 });
  });
});
