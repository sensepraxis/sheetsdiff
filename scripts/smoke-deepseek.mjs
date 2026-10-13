import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
  },
  body: JSON.stringify({
    model: env.DEEPSEEK_MODEL || "deepseek-chat",
    temperature: 0.1,
    messages: [
      {
        role: "user",
        content:
          'Reply with json only: {"mappings":[{"header":"Txn Date","role":"date","reason":"date column"}]}',
      },
    ],
  }),
});

console.log("status", res.status);
const text = await res.text();
console.log(text.slice(0, 800));
