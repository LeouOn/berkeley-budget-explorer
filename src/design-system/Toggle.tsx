import styles from "./Toggle.module.css";

export interface ToggleOption<V extends string> {
  readonly value: V;
  readonly label: string;
}

interface ToggleProps<V extends string> {
  readonly legend: string;
  readonly options: readonly ToggleOption<V>[];
  readonly value: V;
  readonly onChange: (next: V) => void;
}

export function Toggle<V extends string>({
  legend,
  options,
  value,
  onChange,
}: ToggleProps<V>): React.JSX.Element {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>{legend}</legend>
      <div role="radiogroup" aria-label={legend} className={styles.group}>
        {options.map((opt) => {
          const checked = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              data-state={checked ? "on" : "off"}
              onClick={() => onChange(opt.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                  e.preventDefault();
                  const idx = options.findIndex((o) => o.value === value);
                  const next = options[(idx + 1) % options.length];
                  if (next) onChange(next.value);
                } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                  e.preventDefault();
                  const idx = options.findIndex((o) => o.value === value);
                  const prev = options[(idx - 1 + options.length) % options.length];
                  if (prev) onChange(prev.value);
                }
              }}
              className={styles.option}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
