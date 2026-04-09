import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle: string;
  /** Small line above the title (e.g. product tagline). */
  eyebrow?: string;
  graphic?: ReactNode;
};

export function ManifestoHeader({ title, subtitle, eyebrow, graphic }: Props) {
  return (
    <header className="text-center">
      {graphic}
      {eyebrow ? (
        <p className="mb-3 font-doc-mono text-[10px] uppercase tracking-[0.28em] text-[var(--ink-muted)]">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="font-doc-serif text-[1.65rem] font-semibold leading-snug tracking-tight text-[var(--ink)] sm:text-3xl">
        {title}
      </h1>
      <p className="mx-auto mt-4 max-w-lg text-[0.9375rem] leading-relaxed text-[var(--ink-muted)]">
        {subtitle}
      </p>
    </header>
  );
}
