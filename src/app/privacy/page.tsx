import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Notice — SheetDiff",
  description: "Privacy Notice for SheetDiff (sheetsdiff.com).",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Notice" updated="October 14, 2026">
      <p>
        This Privacy Notice explains how SheetDiff (&quot;we&quot;,
        &quot;us&quot;) collects, uses, and shares information when you use{" "}
        <a href="https://www.sheetsdiff.com">https://www.sheetsdiff.com</a>{" "}
        (the &quot;Service&quot;).
      </p>

      <h2>1. Information we collect</h2>
      <ul>
        <li>
          <strong>Account data:</strong> email address, display name, and
          authentication identifiers from our auth provider (Supabase).
        </li>
        <li>
          <strong>Billing data:</strong> subscription plan, customer and
          transaction identifiers from our payment partner Paddle. Card details
          are processed by Paddle; we do not store full card numbers.
        </li>
        <li>
          <strong>Usage data:</strong> product events such as runs used, plan
          limits, and technical logs needed to operate and secure the Service.
        </li>
        <li>
          <strong>Uploaded files:</strong> spreadsheets you upload for
          reconciliation, processed to generate results.
        </li>
      </ul>

      <h2>2. How we use information</h2>
      <ul>
        <li>Provide, maintain, and improve the Service.</li>
        <li>Authenticate users and manage accounts and subscriptions.</li>
        <li>Process payments and prevent fraud (via Paddle).</li>
        <li>Send transactional email (for example, magic-link sign-in).</li>
        <li>Monitor reliability, security, and abuse.</li>
      </ul>

      <h2>3. Processors and sharing</h2>
      <p>We use trusted service providers to operate the Service, including:</p>
      <ul>
        <li>Supabase — authentication and database.</li>
        <li>Vercel — hosting.</li>
        <li>Paddle — payments and tax handling as merchant of record where applicable.</li>
        <li>Resend — transactional email delivery.</li>
        <li>
          Optional AI providers (for example DeepSeek) when you use Pro
          features that request automated column mapping.
        </li>
      </ul>
      <p>
        We do not sell your personal information. We may disclose information if
        required by law or to protect the Service and users.
      </p>

      <h2>4. Data retention</h2>
      <p>
        We retain account and billing records for as long as your account is
        active and as needed for legal, tax, and accounting obligations.
        Uploaded spreadsheet content is processed to deliver results; we aim
        not to keep source files longer than needed for the feature you used.
        You may request account deletion by contacting us.
      </p>

      <h2>5. International transfers</h2>
      <p>
        Our providers may process data in the United States or other countries.
        By using the Service, you understand that your information may be
        transferred to and processed in these locations.
      </p>

      <h2>6. Your choices</h2>
      <ul>
        <li>Update profile details in your account where available.</li>
        <li>Cancel a paid subscription from your account billing settings.</li>
        <li>
          Request access, correction, or deletion by emailing{" "}
          <a href="mailto:weiweiw404@gmail.com">weiweiw404@gmail.com</a>.
        </li>
      </ul>

      <h2>7. Children</h2>
      <p>
        The Service is not directed to children under 16. We do not knowingly
        collect personal information from children.
      </p>

      <h2>8. Changes</h2>
      <p>
        We may update this Notice from time to time. The &quot;Last
        updated&quot; date at the top will change when we do.
      </p>

      <h2>9. Contact</h2>
      <p>
        Privacy questions:{" "}
        <a href="mailto:weiweiw404@gmail.com">weiweiw404@gmail.com</a>.
      </p>
    </LegalPage>
  );
}
