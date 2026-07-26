import { z } from "zod";

export const DollarModeSchema = z.enum(["real", "nominal"]);
export type DollarMode = z.infer<typeof DollarModeSchema>;

export interface OverviewUrlState {
  readonly mode: DollarMode;
  readonly baseYear: number;
}

const BaseYearSchema = z.coerce.number().int().min(1990).max(2100);

export function parseOverviewUrl(search: string): OverviewUrlState {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const modeRaw = params.get("mode");
  let mode: DollarMode = "real";
  if (typeof modeRaw === "string") {
    const parsed = DollarModeSchema.safeParse(modeRaw);
    if (parsed.success) mode = parsed.data;
  }
  const baseRaw = params.get("baseYear");
  let baseYear = 2024;
  if (typeof baseRaw === "string") {
    const parsed = BaseYearSchema.safeParse(baseRaw);
    if (parsed.success) baseYear = parsed.data;
  }
  return { mode, baseYear };
}

export function serializeOverviewUrl(state: OverviewUrlState): string {
  const params = new URLSearchParams();
  params.set("mode", state.mode);
  params.set("baseYear", String(state.baseYear));
  return `?${params.toString()}`;
}
