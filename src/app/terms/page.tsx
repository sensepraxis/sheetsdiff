import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service — SheetDiff",
  description: "Terms of Service for SheetDiff (sheetsdiff.com).",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="October 14, 2026">
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your access to and use
        of SheetDiff at{" "}
        <a href="https://www.sheetsdiff.com">https://www.sheetsdiff.com</a>{" "}
        (the &quot;Service&quot;), operated by SheetDiff (&quot;we&quot;,
        &quot;us&quot;, or &quot;our&quot;). By creating an account or using the
        Service, you agree to these Terms.
      </p>

      <h2>1. The Service</h2>
      <p>
        SheetDiff helps you compare two spreadsheets (CSV/Excel) and review
        matched, only-A, and only-B results. Features and limits depend on your
        plan (Free, Starter, or Pro) as described on our{" "}
        <a href="/pricing">pricing page</a>.
      </p>

      <h2>2. Accounts</h2>
      <p>
        You must provide a valid email address and keep your login credentials
        secure. You are responsible for activity under your account. We may
        suspend or terminate accounts that abuse the Service, violate these
        Terms, or create risk for other users.
      </p>

      <h2>3. Your content</h2>
      <p>
        You retain ownership of files and data you upload. You grant us a
        limited license to process that content solely to provide the Service
        (for example, running a reconciliation). You represent that you have
        the rights to upload and process the content you submit.
      </p>

      <h2>4. Acceptable use</h2>
      <ul>
        <li>Do not reverse engineer, disrupt, or overload the Service.</li>
        <li>Do not upload malware or unlawful content.</li>
        <li>Do not attempt unauthorized access to other accounts or systems.</li>
        <li>Do not use the Service in violation of applicable law.</li>
      </ul>

      <h2>5. Subscriptions and billing</h2>
      <p>
        Paid plans are billed through our payment partner, Paddle (as merchant
        of record for applicable transactions). Prices, plan limits, upgrades,
        and cancellations are described on the pricing page and in your
        account. Canceling stops future renewals; access generally continues
        until the end of the current billing period unless otherwise stated.
        Refunds are governed by our{" "}
        <a href="/refund">Refund Policy</a>.
      </p>

      <h2>6. Free plan</h2>
      <p>
        Free plan features and limits may change. We may modify or discontinue
        free access with reasonable notice where practical.
      </p>

      <h2>7. Intellectual property</h2>
      <p>
        The Service, branding, and software are owned by SheetDiff or its
        licensors. These Terms do not grant you rights to our trademarks or
        source code beyond using the Service as offered.
      </p>

      <h2>8. Disclaimer</h2>
      <p>
        The Service is provided &quot;as is&quot; and &quot;as available&quot;.
        Spreadsheet matching depends on your inputs and settings; results may
        contain errors. You are responsible for verifying outputs before making
        financial or operational decisions. To the maximum extent permitted by
        law, we disclaim warranties of merchantability, fitness for a
        particular purpose, and non-infringement.
      </p>

      <h2>9. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, SheetDiff and its suppliers
        will not be liable for indirect, incidental, special, consequential, or
        punitive damages, or for lost profits, data, or business. Our aggregate
        liability for any claim relating to the Service will not exceed the
        amounts you paid us for the Service in the three (3) months before the
        claim arose (or USD $50 if you are on a free plan).
      </p>

      <h2>10. Changes</h2>
      <p>
        We may update these Terms from time to time. Material changes will be
        posted on this page with an updated date. Continued use after changes
        become effective constitutes acceptance.
      </p>

      <h2>11. Contact</h2>
      <p>
        Questions about these Terms:{" "}
        <a href="mailto:weiweiw404@gmail.com">weiweiw404@gmail.com</a>.
      </p>
    </LegalPage>
  );
}
