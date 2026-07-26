import { Card } from "../design-system";
import type { OverviewInsight } from "../pipeline/derive/insights";
import styles from "./Overview.module.css";

interface OverviewInsightsProps {
  readonly insights: readonly OverviewInsight[];
}

function compareHref(entityIds: readonly string[]): string {
  return `#/compare?entities=${entityIds.join(",")}&start=2003&end=2024`;
}

export function OverviewInsights({ insights }: OverviewInsightsProps): React.JSX.Element | null {
  if (insights.length === 0) return null;
  return (
    <section aria-labelledby="insights-heading" className={styles.section}>
      <h2 id="insights-heading">Curated insights</h2>
      <p>
        Pre-computed at build time from the canonical values. Each card links to a deeper comparison
        when relevant.
      </p>
      <div className={styles.cardGrid}>
        {insights.map((insight) => (
          <Card
            key={insight.id}
            eyebrow="Insight"
            title={insight.title}
            body={<p>{insight.body}</p>}
            footer={
              insight.linkToCompare && insight.linkToCompare.length > 0 ? (
                <a href={compareHref(insight.linkToCompare)} className={styles.compareDeptLink}>
                  Open in Compare →
                </a>
              ) : undefined
            }
          />
        ))}
      </div>
    </section>
  );
}
