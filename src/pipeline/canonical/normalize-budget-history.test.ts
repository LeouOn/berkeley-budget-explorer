import { describe, expect, it } from "vitest";
import { COLUMN_META } from "../sources/budget-history-transcription";
import type { HistoryRecord } from "../sources/budget-history-transcription";
import {
  budgetHistoryEntityId,
  buildBudgetHistoryEntities,
  normalizeBudgetHistory,
} from "./normalize-budget-history";

const SOURCE_ID = "src-budget-history" as const;

const records: readonly HistoryRecord[] = [
  {
    kind: "expenditure",
    name: "Salaries & Benefits",
    column: "fy2022Actual",
    fiscalYear: 2022,
    stage: "actual",
    amountCents: 100000,
  },
  {
    kind: "expenditure",
    name: "Salaries & Benefits",
    column: "fy2025Adopted",
    fiscalYear: 2025,
    stage: "adopted",
    amountCents: 130000,
  },
  {
    kind: "revenue",
    name: "Secured Property Taxes",
    column: "fy2024Estimated",
    fiscalYear: 2024,
    stage: "projected",
    amountCents: 60000,
  },
];

describe("normalize-budget-history", () => {
  it("produces one entity per distinct name+kind", () => {
    const entities = buildBudgetHistoryEntities(records);
    expect(entities.length).toBe(2);
    const ids = entities.map((e) => e.id).sort();
    expect(ids).toEqual([
      "ent-bhist-exp-salaries-benefits",
      "ent-bhist-rev-secured-property-taxes",
    ]);
  });

  it("emits BudgetValues preserving stage, basis, and verified confidence", () => {
    const values = normalizeBudgetHistory(records, SOURCE_ID);
    expect(values.length).toBe(3);
    const fy2024 = values.find((v) => v.fiscalYear === 2024);
    expect(fy2024?.stage).toBe("projected");
    expect(fy2024?.basis).toBe("budgetary");
    expect(fy2024?.extractionMethod).toBe("manual-transcription");
    expect(fy2024?.confidence).toBe("verified");
    expect(fy2024?.sourceId).toBe(SOURCE_ID);
  });

  it("uses revenue-category type for revenue rows and expense-category for expenditure rows", () => {
    const values = normalizeBudgetHistory(records, SOURCE_ID);
    const rev = values.find((v) => v.entityId.startsWith("ent-bhist-rev"));
    const exp = values.find((v) => v.entityId.startsWith("ent-bhist-exp"));
    expect(rev?.entityType).toBe("revenue-category");
    expect(exp?.entityType).toBe("expense-category");
  });

  it("column meta and entity ids are stable across all six columns", () => {
    for (const meta of COLUMN_META) {
      const record: HistoryRecord = {
        kind: "revenue",
        name: "Sales Tax",
        column: meta.key,
        fiscalYear: meta.fiscalYear,
        stage: meta.stage,
        amountCents: 0,
      };
      expect(budgetHistoryEntityId(record)).toBe("ent-bhist-rev-sales-tax");
    }
  });
});
