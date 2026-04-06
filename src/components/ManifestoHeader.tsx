import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle: string;
  graphic?: ReactNode;
};

export function ManifestoHeader({ title, subtitle, graphic }: Props) {
  return (
    <header className="text-center">
      {graphic}
      <h1 className="font-doc-serif text-[1.65rem] font-semibold leading-snug tracking-tight text-[var(--ink)] sm:text-3xl">
        {title}
      </h1>
      <p className="mx-auto mt-4 max-w-lg text-[0.9375rem] leading-relaxed text-[var(--ink-muted)]">
        {subtitle}
      </p>
    </header>
  );
}
