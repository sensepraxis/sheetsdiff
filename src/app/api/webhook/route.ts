import { NextRequest } from "next/server";
import { processEvent } from "@/lib/paddle/process-webhook";
import { getPaddleInstance, getWebhookSecret } from "@/lib/paddle/server";

export async function POST(request: NextRequest) {
  const signature = request.headers.get("paddle-signature") ?? "";
  const rawBody = await request.text();

  if (!signature || !rawBody) {
    return Response.json(
      { error: "Missing signature or body" },
      { status: 400 },
    );
  }

  try {
    const secret = getWebhookSecret();
    const paddle = getPaddleInstance();
    const eventData = await paddle.webhooks.unmarshal(
      rawBody,
      secret,
      signature,
    );

    if (eventData) {
      await processEvent(eventData);
    }

    return Response.json({ received: true });
  } catch (e) {
    console.error("Webhook error:", e);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
