import type { ReactNode } from "react";
import styles from "./PageLayout.module.css";
import { SkipLink } from "./SkipLink";

interface PageLayoutProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly intro?: ReactNode;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
}

export function PageLayout({
  eyebrow,
  title,
  intro,
  children,
  footer,
}: PageLayoutProps): React.JSX.Element {
  return (
    <>
      <SkipLink targetId="main" label="Skip to main content" />
      <header className={styles.header}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 className={styles.title}>{title}</h1>
        {intro ? <p className={styles.intro}>{intro}</p> : null}
      </header>
      <div className={styles.content}>{children}</div>
      {footer ? <footer className={styles.footer}>{footer}</footer> : null}
    </>
  );
}
