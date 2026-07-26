import qualityData from "../artifacts/quality-report.json" with { type: "json" };
import { methodologySections } from "../content/methodology";
import { Card, DefinitionList, PageLayout } from "../design-system";
import type { QualityReport } from "../pipeline/derive/quality-report";
import type { SourceManifest } from "../pipeline/sources/manifest";
import manifestData from "../pipeline/sources/manifest.data.json" with { type: "json" };
import styles from "./Methodology.module.css";

const manifest = manifestData as SourceManifest;
const quality = qualityData as QualityReport;

export function Methodology(): React.JSX.Element {
  return (
    <PageLayout
      eyebrow="Berkeley Budget Explorer"
      title="Methodology and sources"
      intro="Every figure on this site traces back to a published source and a documented derivation step."
    >
      <section aria-labelledby="sources-heading" className={styles.section}>
        <h2 id="sources-heading">Phase 1 sources</h2>
        <ul className={styles.sourceList}>
          {manifest.sources.map((s) => (
            <li key={s.id}>
              <Card
                eyebrow={s.id}
                title={s.title}
                body={
                  <>
                    <p>{s.publisher}</p>
                    <p>
                      <a href={s.url}>{s.url}</a>
                    </p>
                    {s.notes ? <p>{s.notes}</p> : null}
                  </>
                }
                footer={`Retrieved ${s.retrievedAt} · Parser ${s.parserVersion} · Checksum ${s.checksumSha256.slice(0, 12)}…`}
              />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="release-heading" className={styles.section}>
        <h2 id="release-heading">Release status</h2>
        <DefinitionList
          ariaLabel="Latest release status"
          items={[
            { term: "Release", description: quality.releaseId },
            { term: "Generated", description: quality.generatedAt },
            { term: "Status", description: quality.status },
            { term: "Sources", description: `${quality.sourceCount} pinned` },
            { term: "Comparability notes", description: quality.comparabilityNotes.join(" · ") },
          ]}
        />
      </section>

      {methodologySections.map((section) => (
        <section key={section.title} className={styles.section}>
          <h2>{section.title}</h2>
          <p>{section.body}</p>
        </section>
      ))}

      <nav className={styles.navLinks} aria-label="Route navigation">
        <a href="#/">Overview</a>
        <span aria-hidden="true">·</span>
        <a href="#/compare">Compare budgets</a>
        <span aria-hidden="true">·</span>
        <a href="#/quality">Quality dashboard</a>
      </nav>

      <p>
        <a href="#/">Back to the Overview</a>
      </p>
    </PageLayout>
  );
}
