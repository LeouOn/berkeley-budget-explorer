import type { ReconciliationMismatch, ReconciliationResult } from "../reconcile/reconcile";
import { writeArtifact } from "./artifacts";

export interface QualityReportInput {
  readonly releaseId: string;
  readonly generatedAt: string;
  readonly sourceCount: number;
  readonly sourceIds: readonly string[];
  readonly normalizationCounts: {
    readonly adopted: number;
    readonly actual: number;
    readonly projected: number;
    readonly revised: number;
    readonly proposed: number;
  };
  readonly reconciliation: ReadonlyArray<{
    readonly sourceId: string;
    readonly result: ReconciliationResult;
  }>;
  readonly comparabilityNotes: readonly string[];
}

export interface QualityReconciliationEntry {
  readonly sourceId: string;
  readonly status: "passed" | "failed";
  readonly mismatches?: readonly ReconciliationMismatch[];
}

export interface QualityReport {
  readonly schemaVersion: "1.0.0";
  readonly releaseId: string;
  readonly generatedAt: string;
  readonly status: "passed" | "failed";
  readonly sourceCount: number;
  readonly sourceIds: readonly string[];
  readonly normalizationCounts: QualityReportInput["normalizationCounts"];
  readonly reconciliation: readonly QualityReconciliationEntry[];
  readonly comparabilityNotes: readonly string[];
}

export function writeQualityReport(dir: string, input: QualityReportInput): void {
  const status: "passed" | "failed" = input.reconciliation.every((r) => r.result.ok)
    ? "passed"
    : "failed";
  const reconciliation: QualityReconciliationEntry[] = input.reconciliation.map((r) => {
    if (r.result.ok) {
      return { sourceId: r.sourceId, status: "passed" as const };
    }
    return {
      sourceId: r.sourceId,
      status: "failed" as const,
      mismatches: r.result.mismatches,
    };
  });
  const report: QualityReport = {
    schemaVersion: "1.0.0",
    releaseId: input.releaseId,
    generatedAt: input.generatedAt,
    status,
    sourceCount: input.sourceCount,
    sourceIds: input.sourceIds,
    normalizationCounts: input.normalizationCounts,
    reconciliation,
    comparabilityNotes: input.comparabilityNotes,
  };
  writeArtifact(dir, "quality-report.json", report);
}
