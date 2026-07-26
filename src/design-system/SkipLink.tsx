import styles from "./SkipLink.module.css";

interface SkipLinkProps {
  readonly targetId: string;
  readonly label: string;
}

export function SkipLink({ targetId, label }: SkipLinkProps): React.JSX.Element {
  return (
    <a className={styles.skip} href={`#${targetId}`}>
      {label}
    </a>
  );
}
