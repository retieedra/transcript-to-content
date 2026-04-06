"use client";

const steps = ["Collect", "Finetune", "Export"] as const;

type Props = { active: 0 | 1 | 2 };

export function StepDots({ active }: Props) {
  return (
    <nav
      className="mb-12 flex items-center justify-center gap-1 sm:gap-3"
      aria-label="Progress"
    >
      {steps.map((label, i) => {
        const done = i < active;
        const current = i === active;
        return (
          <div key={label} className="flex items-center gap-1 sm:gap-3">
            {i > 0 ? (
              <span
                className={`hidden h-px w-8 sm:block ${done ? "bg-[var(--rule-strong)]" : "bg-[var(--rule)]"}`}
              />
            ) : null}
            <div className="flex flex-col items-center gap-1">
              <span
                className={`font-doc-mono flex h-7 w-7 items-center justify-center border text-[11px] ${
                  current
                    ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]"
                    : done
                      ? "border-[var(--rule-strong)] bg-[var(--paper-2)] text-[var(--ink)]"
                      : "border-[var(--rule)] text-[var(--ink-muted)]"
                }`}
              >
                {i + 1}
              </span>
              <span
                className={`font-doc-mono hidden text-[10px] uppercase tracking-wider sm:block ${current ? "text-[var(--ink)]" : "text-[var(--ink-muted)]"}`}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
