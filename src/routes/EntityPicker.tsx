import { useId, useState } from "react";
import type { CatalogGroup } from "../content/entity-catalog";
import { MAX_COMPARE_ENTITIES } from "../query/compare-url-state";
import styles from "./Compare.module.css";

interface EntityPickerProps {
  readonly groups: readonly CatalogGroup[];
  readonly selectedIds: readonly string[];
  readonly onToggle: (entityId: string) => void;
}

export function EntityPicker({
  groups,
  selectedIds,
  onToggle,
}: EntityPickerProps): React.JSX.Element {
  const fieldsetId = useId();
  const atCapacity = selectedIds.length >= MAX_COMPARE_ENTITIES;
  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();
  const filtered = groups
    .map((group) => {
      const entries = query
        ? group.entries.filter((e) => e.name.toLowerCase().includes(query))
        : group.entries;
      return { ...group, entries };
    })
    .filter((group) => group.entries.length > 0);

  return (
    <fieldset className={styles.pickerFieldset}>
      <legend className={styles.pickerLegend}>Available entities</legend>
      <p className={styles.pickerMeta}>
        {selectedIds.length} of {MAX_COMPARE_ENTITIES} selected.
      </p>
      <input
        type="search"
        className={styles.pickerSearch}
        placeholder="Filter entities…"
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        aria-label="Filter entities by name"
      />
      <div className={styles.pickerGroups}>
        {filtered.map((group) => {
          const groupId = `${fieldsetId}-${group.label.replace(/\s+/g, "-")}`;
          return (
            <details key={group.label} className={styles.pickerGroup} open>
              <summary id={groupId} className={styles.pickerGroupLabel}>
                {group.label} ({group.entries.length})
              </summary>
              <ul className={styles.pickerList} aria-labelledby={groupId}>
                {group.entries.map((entry) => {
                  const isSelected = selectedIds.includes(entry.entityId);
                  const disabled = !isSelected && atCapacity;
                  return (
                    <li key={entry.entityId} className={styles.pickerItem}>
                      <label className={disabled ? styles.pickerLabelDisabled : styles.pickerLabel}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={disabled}
                          onChange={() => onToggle(entry.entityId)}
                          aria-label={`${entry.name}, FY${entry.minYear}–FY${entry.maxYear}, ${entry.valueCount} values`}
                        />
                        <span className={styles.pickerItemName}>{entry.name}</span>
                        <span className={styles.pickerItemMeta}>
                          FY{entry.minYear}–FY{entry.maxYear} · {entry.valueCount} values
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </details>
          );
        })}
      </div>
    </fieldset>
  );
}
