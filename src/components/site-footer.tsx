import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-[var(--border)] bg-white/50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-8 text-sm text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>© {new Date().getFullYear()} SheetDiff. Two sheets in. Three lists out.</p>
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/terms" className="hover:text-[var(--ink)]">
            Terms of Service
          </Link>
          <Link href="/privacy" className="hover:text-[var(--ink)]">
            Privacy Notice
          </Link>
          <Link href="/refund" className="hover:text-[var(--ink)]">
            Refund Policy
          </Link>
          <a
            href="mailto:weiweiw404@gmail.com"
            className="hover:text-[var(--ink)]"
          >
            Contact
          </a>
        </nav>
      </div>
    </footer>
  );
}
