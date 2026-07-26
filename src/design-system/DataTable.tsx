import type { ReactNode } from "react";
import styles from "./DataTable.module.css";

export interface Column<T> {
  readonly key: string;
  readonly header: string;
  readonly render: (row: T) => ReactNode;
  readonly align?: "start" | "end";
}

interface DataTableProps<T> {
  readonly caption: string;
  readonly columns: readonly Column<T>[];
  readonly rows: readonly T[];
  readonly getRowKey: (row: T) => string;
}

export function DataTable<T>({
  caption,
  columns,
  rows,
  getRowKey,
}: DataTableProps<T>): React.JSX.Element {
  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable table region requires tabindex for WCAG 2.1.1 keyboard access
    <div className={styles.wrapper} tabIndex={0} role="region" aria-label={caption}>
      <table className={styles.table}>
        <caption className={styles.caption}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={col.align === "end" ? styles.end : styles.start}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowKey(row)}>
              {columns.map((col) => (
                <td key={col.key} className={col.align === "end" ? styles.end : styles.start}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
