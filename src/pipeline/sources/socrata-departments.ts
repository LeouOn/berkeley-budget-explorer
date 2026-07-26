import { slugEntityId } from "../canonical/normalize";
import type { BudgetValue, Entity, EntityType } from "../canonical/schema";
import type { SocrataRow } from "./berkeley-socrata";
import type { SourceId } from "./manifest";

const SCHEMA_VERSION = "1.0.0";
const DEPARTMENT_ENTITY_TYPE: EntityType = "department";
const DEPARTMENT_ID_PREFIX = "ent-socrata-dept";

// Departments with fewer than this many line items across the whole cohort are
// treated as noise/header artifacts (e.g. "Senior Programs" with 5 rows) and
// are excluded from the department-level rollup.
const MIN_DEPARTMENT_ROW_COUNT = 10;

export interface SocrataDepartmentArtifacts {
  readonly values: readonly BudgetValue[];
  readonly entities: readonly Entity[];
}

interface DepartmentAccumulator {
  readonly department: string;
  readonly totalByYear: Map<number, number>;
  rowCount: number;
}

export function departmentEntityId(departmentName: string): string {
  return slugEntityId(DEPARTMENT_ID_PREFIX, departmentName);
}

/**
 * Aggregates parsed Socrata operating-budget line items into department-level
 * BudgetValues. Each (department, fiscalYear) pair becomes one adopted-budget
 * value whose amount is the sum of every underlying line item for that pair.
 *
 * Pre-conditions enforced upstream by `parseSocrataRows` (the boundary parser):
 *   - `department` is a non-empty string (empty/null rows never reach here)
 *   - `approvedAmountCents` is an integer parsed via `parseDollarsToCents`
 *   - `fiscalYear` is an integer within the sealed FY2012-FY2015 cohort
 *
 * Departments with fewer than MIN_DEPARTMENT_ROW_COUNT total rows are dropped as
 * noise. Output ordering is deterministic: values by (entityId, fiscalYear) and
 * entities by id, so artifact generation is reproducible regardless of input
 * row order.
 */
export function normalizeSocrataDepartments(
  rows: readonly SocrataRow[],
  sourceId: SourceId,
): SocrataDepartmentArtifacts {
  const byDepartment = new Map<string, DepartmentAccumulator>();
  for (const row of rows) {
    const acc = byDepartment.get(row.department);
    if (acc) {
      acc.rowCount += 1;
      acc.totalByYear.set(
        row.fiscalYear,
        (acc.totalByYear.get(row.fiscalYear) ?? 0) + row.approvedAmountCents,
      );
    } else {
      byDepartment.set(row.department, {
        department: row.department,
        totalByYear: new Map([[row.fiscalYear, row.approvedAmountCents]]),
        rowCount: 1,
      });
    }
  }

  const includedDepartments = [...byDepartment.values()]
    .filter((acc) => acc.rowCount >= MIN_DEPARTMENT_ROW_COUNT)
    .sort((a, b) => a.department.localeCompare(b.department));

  const values: BudgetValue[] = [];
  const entities: Entity[] = [];
  for (const acc of includedDepartments) {
    const entityId = departmentEntityId(acc.department);
    entities.push({
      id: entityId,
      type: DEPARTMENT_ENTITY_TYPE,
      canonicalName: acc.department,
      plainDescription: `City of Berkeley ${acc.department} department adopted operating budget, aggregated from Socrata line items (FY2012-FY2015 cohort).`,
    });
    const years = [...acc.totalByYear.keys()].sort((x, y) => x - y);
    for (const fiscalYear of years) {
      values.push({
        fiscalYear,
        amountNominalCents: acc.totalByYear.get(fiscalYear) ?? 0,
        stage: "adopted",
        basis: "budgetary",
        entityId,
        entityType: DEPARTMENT_ENTITY_TYPE,
        sourceId,
        sourceLabel: `Berkeley ${acc.department} adopted budget (Socrata, FY${fiscalYear})`,
        extractionMethod: "api",
        confidence: "verified",
        schemaVersion: SCHEMA_VERSION,
      });
    }
  }

  return { values, entities };
}
