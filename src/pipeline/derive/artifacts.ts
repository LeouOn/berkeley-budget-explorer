import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export function writeArtifact(dir: string, fileName: string, payload: unknown): void {
  mkdirSync(dir, { recursive: true });
  const text = JSON.stringify(payload, sortKeys, 2);
  writeFileSync(resolve(dir, fileName), `${text}\n`, "utf-8");
}

function sortKeys(_key: string, value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = obj[k];
        return acc;
      }, {});
  }
  return value;
}

export interface ArtifactBundle {
  readonly release: unknown;
  readonly values: readonly unknown[];
  readonly entities: readonly unknown[];
  readonly cpi: unknown;
  readonly population: unknown;
  readonly overview: unknown;
  readonly scoPerCapita: unknown;
  readonly scoDetailedContext: unknown;
  readonly socrataCohort: unknown;
}

export function writeArtifacts(dir: string, bundle: ArtifactBundle): void {
  writeArtifact(dir, "release.json", bundle.release);
  writeArtifact(dir, "values.json", bundle.values);
  writeArtifact(dir, "entities.json", bundle.entities);
  writeArtifact(dir, "cpi.json", bundle.cpi);
  writeArtifact(dir, "population.json", bundle.population);
  writeArtifact(dir, "overview.json", bundle.overview);
  writeArtifact(dir, "sco-per-capita.json", bundle.scoPerCapita);
  writeArtifact(dir, "sco-detailed-context.json", bundle.scoDetailedContext);
  writeArtifact(dir, "socrata-cohort.json", bundle.socrataCohort);
}
