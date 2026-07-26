import { describe, expect, it } from "vitest";
import { colorAtIndex, plotColors, standardPlotStyle } from "./plot-utils";

describe("plot-utils", () => {
  it("plotColors returns n distinct colors cycled from the palette", () => {
    const colors = plotColors(3);
    expect(colors).toHaveLength(3);
    expect(new Set(colors).size).toBe(3);
  });

  it("plotColors cycles when n exceeds the palette length", () => {
    const colors = plotColors(10);
    expect(colors).toHaveLength(10);
    expect(colors[0]).toBe(colors[7]);
  });

  it("plotColors returns an empty array for non-positive n", () => {
    expect(plotColors(0)).toEqual([]);
    expect(plotColors(-1)).toEqual([]);
  });

  it("colorAtIndex returns a string for any integer index", () => {
    expect(typeof colorAtIndex(0)).toBe("string");
    expect(typeof colorAtIndex(100)).toBe("string");
  });

  it("standardPlotStyle returns sensible defaults", () => {
    const style = standardPlotStyle({});
    expect(style.width).toBeGreaterThan(0);
    expect(style.height).toBeGreaterThan(0);
    expect(style.style.background).toBe("transparent");
    expect(style.style.color).toBe("var(--color-ink)");
    expect(style.style.fontSize).toBe("12px");
  });

  it("standardPlotStyle honors caller overrides", () => {
    const style = standardPlotStyle({ width: 720, height: 200, marginRight: 140 });
    expect(style.width).toBe(720);
    expect(style.height).toBe(200);
    expect(style.marginRight).toBe(140);
  });
});
