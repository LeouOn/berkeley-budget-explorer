import { useEffect, useSyncExternalStore } from "react";
import styles from "./App.module.css";
import { Compare } from "./routes/Compare";
import { Methodology } from "./routes/Methodology";
import { Overview } from "./routes/Overview";
import { Quality } from "./routes/Quality";
import { Service } from "./routes/Service";

const OVERVIEW_HASH = "#/";
const METHODOLOGY_HASH = "#/methodology";
const COMPARE_HASH = "#/compare";
const QUALITY_HASH = "#/quality";
const SERVICE_HASH_PREFIX = "#/service/";

const ROUTE_BY_SHORTCUT: Readonly<Record<string, string>> = {
  "1": OVERVIEW_HASH,
  "2": COMPARE_HASH,
  "3": QUALITY_HASH,
  "4": METHODOLOGY_HASH,
};

function subscribe(listener: () => void): () => void {
  window.addEventListener("hashchange", listener);
  return () => {
    window.removeEventListener("hashchange", listener);
  };
}

function getSnapshot(): string {
  return window.location.hash || OVERVIEW_HASH;
}

function getServerSnapshot(): string {
  return OVERVIEW_HASH;
}

function routeOf(hash: string): string {
  return hash.split("?")[0] ?? hash;
}

// Validation is deferred to <Service> so unknown keys render a not-found card.
function serviceKeyFromHash(hash: string): string | null {
  if (!hash.startsWith(SERVICE_HASH_PREFIX)) return null;
  const raw = hash.slice(SERVICE_HASH_PREFIX.length).split("?")[0] ?? "";
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  return trimmed;
}

function handleKeydown(event: KeyboardEvent): void {
  if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  const target = ROUTE_BY_SHORTCUT[event.key];
  if (!target) return;
  event.preventDefault();
  if (window.location.hash !== target) {
    window.location.hash = target;
  }
}

export function App(): React.JSX.Element {
  const hash = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const route = routeOf(hash);

  useEffect(() => {
    window.addEventListener("keydown", handleKeydown);
    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  }, []);

  const serviceKey = serviceKeyFromHash(route);
  if (serviceKey) {
    return (
      <main id="main" tabIndex={-1}>
        <Service serviceKey={serviceKey} />
        <p className={styles.kbdHint} aria-hidden="true">
          <kbd>Alt</kbd>+<kbd>1</kbd> Overview · <kbd>Alt</kbd>+<kbd>2</kbd> Compare ·{" "}
          <kbd>Alt</kbd>+<kbd>3</kbd> Quality · <kbd>Alt</kbd>+<kbd>4</kbd> Methodology
        </p>
      </main>
    );
  }

  return (
    <main id="main" tabIndex={-1}>
      {route === METHODOLOGY_HASH ? (
        <Methodology />
      ) : route === COMPARE_HASH ? (
        <Compare />
      ) : route === QUALITY_HASH ? (
        <Quality />
      ) : (
        <Overview />
      )}
      <p className={styles.kbdHint} aria-hidden="true">
        <kbd>Alt</kbd>+<kbd>1</kbd> Overview · <kbd>Alt</kbd>+<kbd>2</kbd> Compare · <kbd>Alt</kbd>+
        <kbd>3</kbd> Quality · <kbd>Alt</kbd>+<kbd>4</kbd> Methodology
      </p>
    </main>
  );
}
