export type AuthEmailAction =
  | "signup"
  | "invite"
  | "magiclink"
  | "recovery"
  | "email_change"
  | "email"
  | string;

export function authEmailSubject(action: AuthEmailAction): string {
  switch (action) {
    case "signup":
    case "invite":
    case "email":
      return "Confirm your SheetDiff email";
    case "magiclink":
      return "Your SheetDiff sign-in link";
    case "recovery":
      return "Reset your SheetDiff password";
    case "email_change":
      return "Confirm your new SheetDiff email";
    default:
      return "SheetDiff account verification";
  }
}

export function authEmailHeading(action: AuthEmailAction): string {
  switch (action) {
    case "signup":
    case "invite":
    case "email":
      return "Confirm your email";
    case "magiclink":
      return "Sign in to SheetDiff";
    case "recovery":
      return "Reset your password";
    case "email_change":
      return "Confirm your new email";
    default:
      return "Verify your account";
  }
}

export function authEmailBody(action: AuthEmailAction): string {
  switch (action) {
    case "signup":
    case "invite":
    case "email":
      return "Thanks for signing up. Confirm this email to finish creating your SheetDiff account.";
    case "magiclink":
      return "Use the button below to sign in. This link expires shortly and can only be used once.";
    case "recovery":
      return "We received a request to reset your password. Click below to choose a new one.";
    case "email_change":
      return "Confirm this address to finish updating the email on your SheetDiff account.";
    default:
      return "Click the button below to continue with SheetDiff.";
  }
}

export function authEmailCta(action: AuthEmailAction): string {
  switch (action) {
    case "magiclink":
      return "Sign in to SheetDiff";
    case "recovery":
      return "Reset password";
    case "email_change":
      return "Confirm new email";
    default:
      return "Confirm email address";
  }
}

/** Branded HTML — no Supabase footer. Colors match marketing site tokens. */
export function renderAuthEmailHtml(input: {
  action: AuthEmailAction;
  confirmUrl: string;
  token?: string;
  siteName?: string;
}): string {
  const brand = input.siteName ?? "SheetDiff";
  const heading = authEmailHeading(input.action);
  const body = authEmailBody(input.action);
  const cta = authEmailCta(input.action);
  const showOtp =
    Boolean(input.token) &&
    (input.action === "signup" ||
      input.action === "magiclink" ||
      input.action === "recovery" ||
      input.action === "email_change" ||
      input.action === "email");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${heading}</title>
</head>
<body style="margin:0;padding:0;background:#eef3fa;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#0b1b33;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef3fa;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border:1px solid rgba(11,27,51,0.10);border-radius:24px;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 8px;">
              <div style="display:inline-block;background:#e8eef8;color:#1f4b99;font-size:12px;font-weight:700;letter-spacing:0.04em;padding:6px 12px;border-radius:999px;">
                ${brand}
              </div>
              <h1 style="margin:20px 0 0;font-size:28px;line-height:1.15;font-weight:600;letter-spacing:-0.02em;color:#0b1b33;">
                ${heading}
              </h1>
              <p style="margin:14px 0 0;font-size:16px;line-height:1.55;color:#5c6b82;">
                ${body}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;">
              <a href="${input.confirmUrl}" style="display:inline-block;background:#0b1b33;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:14px 22px;border-radius:999px;">
                ${cta}
              </a>
            </td>
          </tr>
          ${
            showOtp
              ? `<tr>
            <td style="padding:0 32px 8px;">
              <p style="margin:0;font-size:13px;color:#5c6b82;">Or enter this code:</p>
              <p style="margin:8px 0 0;font-size:22px;letter-spacing:0.18em;font-weight:700;color:#0b1b33;">${input.token}</p>
            </td>
          </tr>`
              : ""
          }
          <tr>
            <td style="padding:16px 32px 28px;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#5c6b82;word-break:break-all;">
                If the button does not work, open this link:<br />
                <a href="${input.confirmUrl}" style="color:#1f4b99;">${input.confirmUrl}</a>
              </p>
              <p style="margin:16px 0 0;font-size:12px;color:#5c6b82;">
                If you did not request this, you can ignore this email.
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:20px 0 0;font-size:12px;color:#5c6b82;">
          © ${new Date().getFullYear()} ${brand}. Two sheets in. Three lists out.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildConfirmUrl(input: {
  supabaseUrl: string;
  tokenHash: string;
  emailActionType: string;
  redirectTo: string;
}): string {
  const base = input.supabaseUrl.replace(/\/$/, "");
  const params = new URLSearchParams({
    token: input.tokenHash,
    type: input.emailActionType,
    redirect_to: input.redirectTo,
  });
  return `${base}/auth/v1/verify?${params.toString()}`;
}
