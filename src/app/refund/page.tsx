import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Refund Policy — SheetDiff",
  description: "Refund Policy for SheetDiff (sheetsdiff.com).",
};

export default function RefundPage() {
  return (
    <LegalPage title="Refund Policy" updated="October 14, 2026">
      <p>
        This Refund Policy explains when refunds may be available for paid
        SheetDiff subscriptions purchased at{" "}
        <a href="https://www.sheetsdiff.com">https://www.sheetsdiff.com</a>.
        Payments are processed by Paddle, which acts as merchant of record for
        applicable transactions.
      </p>

      <h2>1. Free plan</h2>
      <p>
        The Free plan does not require payment. No refunds apply to free usage.
      </p>

      <h2>2. Subscriptions</h2>
      <p>
        Starter and Pro plans bill on a recurring basis (monthly or yearly, as
        selected at checkout). You can cancel future renewals from your account
        billing settings. After cancellation, you generally keep access until
        the end of the current paid period. Canceling does not automatically
        refund the current period that has already been paid.
      </p>

      <h2>3. When we may refund</h2>
      <p>We may issue a refund when:</p>
      <ul>
        <li>
          You were charged due to a clear billing error (for example, duplicate
          charge).
        </li>
        <li>
          The Service was unavailable for a prolonged period due to our failure,
          and you contact us promptly with details.
        </li>
        <li>
          Required by applicable consumer law in your country of residence.
        </li>
      </ul>
      <p>
        Discretionary goodwill refunds may be considered within fourteen (14)
        days of the initial paid charge for a new subscription if you have not
        made substantial use of paid features. This is not a guarantee for every
        request.
      </p>

      <h2>4. Upgrades, downgrades, and prorating</h2>
      <p>
        Plan upgrades may be prorated according to our billing integration with
        Paddle. Downgrades or cancellations scheduled for period end do not
        create an automatic refund of amounts already paid for the current
        cycle.
      </p>

      <h2>5. How to request a refund</h2>
      <p>
        Email{" "}
        <a href="mailto:weiweiw404@gmail.com">weiweiw404@gmail.com</a> with:
      </p>
      <ul>
        <li>The email on your SheetDiff account</li>
        <li>Approximate purchase date and plan (Starter / Pro)</li>
        <li>Reason for the request and any Paddle receipt if available</li>
      </ul>
      <p>
        We aim to respond within a few business days. Approved refunds are
        processed via Paddle back to the original payment method; timing depends
        on your bank or card issuer.
      </p>

      <h2>6. Chargebacks</h2>
      <p>
        Please contact us before filing a chargeback so we can help resolve the
        issue. Unresolved chargebacks may result in account suspension.
      </p>

      <h2>7. Contact</h2>
      <p>
        Billing and refund questions:{" "}
        <a href="mailto:weiweiw404@gmail.com">weiweiw404@gmail.com</a>.
      </p>
    </LegalPage>
  );
}
