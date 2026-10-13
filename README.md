# SheetDiff

Upload two spreadsheets (bank vs books). Get **Matched / Only A / Only B** plus the dollars that don’t tie.

Stack: **Next.js 16 + Supabase (Auth/DB) + Paddle Billing + Ollama (optional AI)**.

Spreadsheet rows stay in the browser. Supabase stores accounts, plan quotas, and run metadata only.

## Quick start

1. Create a Supabase project.
2. In SQL Editor, run [`supabase/schema.sql`](./supabase/schema.sql).
3. Authentication → Providers → enable **Google**.  
   Redirect URL: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`  
   Also add site URL / redirect: `http://localhost:3000/auth/callback`
4. Copy `.env.example` → `.env.local` and fill keys.
5. Install & run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Product surface

| Route | Purpose |
| --- | --- |
| `/` | Product Hunt–style landing |
| `/pricing` | Free / Starter $9.9 / Pro $29.9 + Paddle checkout |
| `/login` | Continue with Google (+ email OTP) |
| `/login/complete` | Confirm name after first Google login |
| `/app` | Drop files → map columns → three tabs |
| `/account` | Plan, usage, portal, sign out |
| `/api/webhook` | Paddle subscription sync → Supabase |

## Plans

- **Free** — 1 lifetime run, 20-row preview, no full export  
- **Starter $9.9/mo** — 5 runs, 5k rows/side, full export, 1 saved rule set  
- **Pro $29.9/mo** — 40 runs, 25k rows/side, AI mapping via Ollama, audit export  

Platform covers LLM cost for Pro; point `OLLAMA_*` at local `qwen3:8b` for now, swap to a cloud model later.

## Paddle webhook

Point sandbox notifications to your tunnel, e.g. `https://xxxx.ngrok.io/api/webhook`.

Reuse the working flow from `E:\Workspace\PaddleIntegration`. Create SheetDiff Starter/Pro prices and put the `pri_…` IDs in `.env.local`.

## Privacy note

Matching runs entirely client-side. Only filenames, row counts, and summary stats are written to `recon_runs`.
