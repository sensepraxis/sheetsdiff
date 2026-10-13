import Link from "next/link";
import {
  ArrowRight,
  FileSpreadsheet,
  GitCompareArrows,
  ListChecks,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 pb-24 sm:px-8">
      <section className="grid items-center gap-12 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:py-16">
        <div>
          <p className="inline-flex rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold tracking-wide text-[var(--accent)]">
            Open spreadsheet reconciliation
          </p>
          <h1 className="mt-5 max-w-xl font-[family-name:var(--font-display)] text-4xl leading-[1.08] font-semibold tracking-tight text-[var(--ink)] sm:text-5xl lg:text-[3.4rem]">
            Two sheets in. Three lists out ? matched, missing, and the{" "}
            <span className="text-[var(--gold)]">dollars that do not tie.</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg text-[var(--muted)]">
            Drop any two spreadsheets ? bank vs books, or any two exports. No
            Power Query, no bank login, source files untouched.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-5 py-3 text-sm font-semibold text-white hover:opacity-90"
            >
              Try it now
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/70 px-5 py-3 text-sm font-semibold text-[var(--ink)] hover:bg-white"
            >
              See pricing
            </Link>
          </div>
        </div>

        <div className="relative">
          <div
            className="absolute inset-6 rounded-[2rem]"
            style={{ backgroundColor: "#16352a" }}
          />
          <div className="relative rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[0_30px_80px_-40px_rgba(11,27,51,0.55)] sm:p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--ink)]">
                Today&apos;s recon snapshot
              </p>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--ok)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--ok)]" />
                LIVE
              </span>
            </div>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">Matched pairs</dt>
                <dd className="font-semibold">412</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">Only in side A</dt>
                <dd className="font-semibold">7</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">Only in side B</dt>
                <dd className="font-semibold">4</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">Delta left</dt>
                <dd className="font-semibold text-[var(--gold)]">$128.40</dd>
              </div>
            </dl>
            <div className="mt-5 rounded-2xl bg-[var(--accent-soft)] p-4 text-sm text-[var(--ink)]">
              <p className="text-xs font-semibold tracking-wide text-[var(--accent)]">
                TIP
              </p>
              <p className="mt-1 text-[var(--muted)]">
                Two side-B rows sum to a side-A difference ? review before
                export.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="pt-8">
        <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--ink)]">
          Built for month-end, not for learning PQ
        </h2>
        <p className="mt-3 max-w-2xl text-[var(--muted)]">
          From front-desk speed to ownership decisions ? upload, confirm
          columns, read three tabs.
        </p>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            {
              icon: FileSpreadsheet,
              title: "Drop two files",
              body: "CSV or Excel from any two sources. We never write back to your files.",
            },
            {
              icon: GitCompareArrows,
              title: "Hard match first",
              body: "Reference + amount, then amount + date. Same-amount collisions go to review ? never silent guesses.",
            },
            {
              icon: ListChecks,
              title: "Three lists out",
              body: "Matched / only A / only B (rename the sides), plus the few dollars that do not tie.",
            },
          ].map((item) => (
            <article
              key={item.title}
              className="rounded-3xl border border-[var(--border)] bg-white/80 p-6"
            >
              <item.icon className="h-5 w-5 text-[var(--accent)]" />
              <h3 className="mt-4 text-lg font-semibold text-[var(--ink)]">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                {item.body}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
