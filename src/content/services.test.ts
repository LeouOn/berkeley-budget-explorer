import { describe, expect, it } from "vitest";
import { getSocrataDepartmentKeyForService, serviceTaxonomy } from "./services";

describe("service taxonomy", () => {
  it("lists at least nine resident-recognizable services", () => {
    expect(serviceTaxonomy.length).toBeGreaterThanOrEqual(9);
  });

  it("assigns a unique serviceKey to each entry", () => {
    const keys = new Set(serviceTaxonomy.map((s) => s.serviceKey));
    expect(keys.size).toBe(serviceTaxonomy.length);
  });

  it("assigns a unique non-empty socrataDepartmentKey wherever one is set", () => {
    const keys = serviceTaxonomy
      .map((s) => s.socrataDepartmentKey)
      .filter((k): k is string => k !== null);
    expect(keys.length).toBeGreaterThan(0);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((k) => /^[a-z0-9-]+$/.test(k))).toBe(true);
  });

  it("getSocrataDepartmentKeyForService returns the mapped slug for known services", () => {
    expect(getSocrataDepartmentKeyForService("svc-public-safety")).toBe("police");
    expect(getSocrataDepartmentKeyForService("svc-streets")).toBe("public-works");
    expect(getSocrataDepartmentKeyForService("svc-parks")).toBe("parks");
  });

  it("getSocrataDepartmentKeyForService returns null for unmapped or unknown services", () => {
    expect(getSocrataDepartmentKeyForService("svc-climate")).toBeNull();
    expect(getSocrataDepartmentKeyForService("svc-does-not-exist")).toBeNull();
  });
});
