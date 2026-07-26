import styles from "./DefinitionList.module.css";

export interface DefinitionItem {
  readonly term: string;
  readonly description: string;
}

interface DefinitionListProps {
  readonly items: readonly DefinitionItem[];
  readonly ariaLabel?: string;
}

export function DefinitionList({ items, ariaLabel }: DefinitionListProps): React.JSX.Element {
  return (
    <dl className={styles.list} aria-label={ariaLabel}>
      {items.map((item) => (
        <div key={item.term} className={styles.row}>
          <dt className={styles.term}>{item.term}</dt>
          <dd className={styles.description}>{item.description}</dd>
        </div>
      ))}
    </dl>
  );
}
