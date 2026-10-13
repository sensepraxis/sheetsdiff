import { NextResponse } from "next/server";
import { Resend } from "resend";
import { Webhook } from "standardwebhooks";
import {
  authEmailSubject,
  buildConfirmUrl,
  renderAuthEmailHtml,
} from "@/lib/auth/email-templates";

export const runtime = "nodejs";

type SendEmailPayload = {
  user: { email: string };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
};

/**
 * Supabase Auth → Send Email Hook.
 * Dashboard: Authentication → Hooks → Send Email → HTTPS
 * URL: https://YOUR_DOMAIN/api/auth/send-email
 *
 * Replaces default Supabase mail so messages come from your brand via Resend.
 */
export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const hookSecretRaw = process.env.SEND_EMAIL_HOOK_SECRET?.trim();
  const from =
    process.env.AUTH_EMAIL_FROM?.trim() || "SheetDiff <onboarding@resend.dev>";

  if (!apiKey || !hookSecretRaw) {
    console.error("[send-email] RESEND_API_KEY or SEND_EMAIL_HOOK_SECRET missing");
    return NextResponse.json(
      { error: { message: "Email provider not configured" } },
      { status: 500 },
    );
  }

  const payload = await request.text();
  const headers = Object.fromEntries(request.headers);
  const secret = hookSecretRaw.replace(/^v1,whsec_/, "");

  let verified: SendEmailPayload;
  try {
    const wh = new Webhook(secret);
    verified = wh.verify(payload, headers) as SendEmailPayload;
  } catch (err) {
    console.error("[send-email] webhook verify failed", err);
    return NextResponse.json(
      { error: { message: "Invalid webhook signature" } },
      { status: 401 },
    );
  }

  const { user, email_data } = verified;
  if (!user?.email || !email_data?.token_hash) {
    return NextResponse.json(
      { error: { message: "Malformed payload" } },
      { status: 400 },
    );
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ||
    email_data.site_url?.replace(/\/$/, "");
  if (!supabaseUrl) {
    return NextResponse.json(
      { error: { message: "Supabase URL missing" } },
      { status: 500 },
    );
  }

  const action = email_data.email_action_type;
  const confirmUrl = buildConfirmUrl({
    supabaseUrl,
    tokenHash: email_data.token_hash,
    emailActionType: action,
    redirectTo: email_data.redirect_to || `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/app`,
  });

  const html = renderAuthEmailHtml({
    action,
    confirmUrl,
    token: email_data.token,
  });

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: [user.email],
      subject: authEmailSubject(action),
      html,
    });
    if (error) {
      console.error("[send-email] Resend error", error);
      return NextResponse.json(
        {
          error: {
            http_code: 500,
            message: error.message,
          },
        },
        { status: 500 },
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed";
    console.error("[send-email]", message);
    return NextResponse.json(
      { error: { http_code: 500, message } },
      { status: 500 },
    );
  }

  return NextResponse.json({});
}
