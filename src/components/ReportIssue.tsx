import { useEffect, useState } from "react";
import styles from "./ReportIssue.module.css";

const REPORT_ISSUE_EMAIL = "data@berkeleyca.gov";
const REPORT_ISSUE_SUBJECT = "Budget Explorer data issue";

// Builds a mailto URL whose body references the given page URL. URL-encoded so
// the user's mail client receives a usable draft message. The body intentionally
// avoids line breaks that some web mail clients mangle; it sticks to a single
// label + URL pair.
export function buildReportIssueMailto(pageUrl: string, email = REPORT_ISSUE_EMAIL): string {
  const body =
    pageUrl.length > 0
      ? `Reporting a data issue on: ${pageUrl}`
      : "Reporting a data issue on the Berkeley Budget Explorer.";
  const params = new URLSearchParams({
    subject: REPORT_ISSUE_SUBJECT,
    body,
  });
  return `mailto:${email}?${params.toString()}`;
}

interface ReportIssueProps {
  // Optional override for the page URL included in the mailto body. Defaults to
  // `window.location.href` once mounted. SSR / non-browser callers can pass an
  // explicit value to skip the mount-time read.
  readonly pageUrl?: string;
  // Optional class name applied to the link; defaults to the muted style.
  readonly className?: string;
}

// Small muted "Report a data issue" link. Reads `window.location.href` after
// mount so server-side rendering and the initial paint do not need a window.
// Renders a real anchor at all times so the link is keyboard-accessible from
// first paint, with the href populated as soon as the URL is known.
export function ReportIssue({ pageUrl, className }: ReportIssueProps): React.JSX.Element {
  const [href, setHref] = useState<string>(() =>
    pageUrl !== undefined ? buildReportIssueMailto(pageUrl) : "",
  );

  useEffect(() => {
    if (pageUrl !== undefined) {
      setHref(buildReportIssueMailto(pageUrl));
      return;
    }
    if (typeof window === "undefined") return;
    setHref(buildReportIssueMailto(window.location.href));
  }, [pageUrl]);

  return (
    <a
      href={href || "#"}
      className={className ?? styles.link}
      aria-label="Report a data issue by email"
      rel="noopener noreferrer"
    >
      Report a data issue
    </a>
  );
}
