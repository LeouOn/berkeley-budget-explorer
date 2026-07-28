import { Card } from "../design-system";
import type { OverviewInsight } from "../pipeline/derive/insights";
import styles from "./Overview.module.css";

interface OverviewInsightsProps {
  readonly insights: readonly OverviewInsight[];
}

// Insight-specific compare URLs. Each curated insight links to a precise
// comparison: growth opens across the full FY2003-FY2024 series, the adopted
// vs actual variance opens on FY2025 alone with no stage filter so both the
// adopted and actual points render together. The schema insight stays
// informational — no link.
function compareHrefForInsight(insight: OverviewInsight): string | null {
  if (!insight.linkToCompare || insight.linkToCompare.length === 0) return null;
  if (insight.id === "general-fund-adopted-vs-actual") {
    return `#/compare?entities=${insight.linkToCompare.join(",")}&start=2025&end=2025`;
  }
  return `#/compare?entities=${insight.linkToCompare.join(",")}&start=2003&end=2024`;
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
        {insights.map((insight) => {
          const href = compareHrefForInsight(insight);
          return (
            <Card
              key={insight.id}
              eyebrow="Insight"
              title={insight.title}
              body={<p>{insight.body}</p>}
              footer={
                href ? (
                  <a
                    href={href}
                    className={styles.compareDeptLink}
                    aria-label={`Compare this: ${insight.title}`}
                  >
                    Compare this →
                  </a>
                ) : (
                  <small className={styles.mutedFooter}>Informational — no comparison link.</small>
                )
              }
            />
          );
        })}
      </div>
    </section>
  );
}
