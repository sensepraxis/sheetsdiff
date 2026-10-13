import Link from "next/link";

export default function WelcomePage() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center px-6 py-24 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight text-[var(--ink)]">
        You&apos;re in
      </h1>
      <p className="mt-3 text-[var(--muted)]">
        Payment received. Your plan unlocks as soon as Paddle confirms the
        subscription webhook.
      </p>
      <Link
        href="/app"
        className="mt-8 rounded-full bg-[var(--ink)] px-5 py-3 text-sm font-semibold text-white hover:opacity-90"
      >
        Go to SheetDiff
      </Link>
    </div>
  );
}
