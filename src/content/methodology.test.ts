import { describe, expect, it } from "vitest";
import { methodologySections } from "./methodology";

describe("methodology sections", () => {
  it("includes a Sources section", () => {
    expect(methodologySections.some((s) => /sources/i.test(s.title))).toBe(true);
  });

  it("includes a Comparability section", () => {
    expect(methodologySections.some((s) => /comparability/i.test(s.title))).toBe(true);
  });

  it("explicitly discloses the FY2015 Socrata stop and FY2017 schema break", () => {
    const text = methodologySections.map((s) => s.body).join("\n");
    expect(text).toContain("FY2015");
    expect(text).toContain("FY2017");
  });

  it("discloses that PDF-derived values are deferred", () => {
    const text = methodologySections.map((s) => s.body).join("\n");
    expect(text.toLowerCase()).toContain("pdf");
  });
});
