import type { ReactNode } from "react";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12 sm:px-8 sm:py-16">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--ink)] sm:text-4xl">
        {title}
      </h1>
      <p className="mt-3 text-sm text-[var(--muted)]">Last updated: {updated}</p>
      <div className="prose-legal mt-10 space-y-6 text-[15px] leading-relaxed text-[var(--ink)] [&_h2]:mt-10 [&_h2]:font-[family-name:var(--font-display)] [&_h2]:text-xl [&_h2]:font-semibold [&_a]:text-[var(--accent)] [&_a]:underline [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_p]:text-[var(--muted)] [&_li]:text-[var(--muted)]">
        {children}
      </div>
    </div>
  );
}
