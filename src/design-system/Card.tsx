import type { ReactNode } from "react";
import styles from "./Card.module.css";

interface CardProps {
  readonly eyebrow?: string;
  readonly title: string;
  readonly body: ReactNode;
  readonly footer?: ReactNode;
}

export function Card({ eyebrow, title, body, footer }: CardProps): React.JSX.Element {
  return (
    <article className={styles.card}>
      {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
      <h2 className={styles.title}>{title}</h2>
      <div className={styles.body}>{body}</div>
      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </article>
  );
}
