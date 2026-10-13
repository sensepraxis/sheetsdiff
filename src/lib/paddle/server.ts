import {
  Environment,
  LogLevel,
  Paddle,
  type PaddleOptions,
} from "@paddle/paddle-node-sdk";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is unset. Set it in .env.local.`);
  }
  return value;
}

export function getPaddleEnvironment(): Environment {
  const env = requireEnv("NEXT_PUBLIC_PADDLE_ENV");
  if (env === "sandbox") return Environment.sandbox;
  if (env === "production") return Environment.production;
  throw new Error(`NEXT_PUBLIC_PADDLE_ENV invalid: "${env}".`);
}

export function getPaddleApiKey(): string {
  return requireEnv("PADDLE_API_KEY");
}

export function getWebhookSecret(): string {
  return requireEnv("PADDLE_NOTIFICATION_WEBHOOK_SECRET");
}

export function getPaddleInstance() {
  const options: PaddleOptions = {
    environment: getPaddleEnvironment(),
    logLevel: LogLevel.error,
  };
  return new Paddle(getPaddleApiKey(), options);
}
