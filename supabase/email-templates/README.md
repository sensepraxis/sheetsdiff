# SheetDiff auth emails (branded)

Overseas SaaS default: mail comes from **your brand**, not `mail.app.supabase.io`.

## Recommended (works on localhost)

Use **Resend SMTP** in the Supabase Dashboard + paste these HTML templates.

1. Create a [Resend](https://resend.com) account and API key.
2. Verify your domain (e.g. `sheetdiff.com`) → send as `SheetDiff <noreply@sheetdiff.com>`.
   - For quick tests only, Resend allows `SheetDiff <onboarding@resend.dev>` to your own inbox.
3. Supabase → **Authentication → Emails → SMTP Settings**:
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: your Resend API key
   - Sender email / name: your verified address
4. Supabase → **Authentication → Email Templates**:
   - Confirm signup → paste `confirm.html`
   - Magic Link → paste `magic-link.html`
   - Subjects: `Confirm your SheetDiff email` / `Your SheetDiff sign-in link`

After SMTP is enabled, messages no longer show the default “powered by Supabase” footer (your template replaces it).

## Production option (Send Email Hook)

The app also exposes `POST /api/auth/send-email` (Resend + branded HTML in code).

1. Set in `.env.local` / hosting env:
   - `RESEND_API_KEY`
   - `AUTH_EMAIL_FROM=SheetDiff <noreply@yourdomain.com>`
   - `SEND_EMAIL_HOOK_SECRET` (from Supabase when you create the hook)
   - `NEXT_PUBLIC_SITE_URL=https://yourdomain.com`
2. Deploy the app to a **public HTTPS** URL (Supabase cannot call `localhost`).
3. Supabase → **Authentication → Hooks → Send Email** → HTTPS →  
   `https://YOUR_DOMAIN/api/auth/send-email`  
   Copy the hook secret into `SEND_EMAIL_HOOK_SECRET` as `v1,whsec_...`.

Use **either** SMTP templates **or** the Hook (not both for the same emails).
