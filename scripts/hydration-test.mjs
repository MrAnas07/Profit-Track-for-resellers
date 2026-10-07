import { chromium } from "playwright";

const BASE = process.env.REVIEW_BASE ?? "http://localhost:3000/";
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

let found = false;
page.on("console", async (msg) => {
  if (found || msg.type() !== "error") return;
  const text = msg.text();
  if (!text.includes("hydrated")) return;
  found = true;
  const loc = msg.location();
  console.log("LOCATION:", JSON.stringify(loc));
  console.log("FULL MESSAGE:\n", text);
});

const { establishSession } = await import("./auth.mjs");
const session = await establishSession(page, context, BASE);
if (!session.ok) {
  console.log("auth failed:", session.error);
  process.exit(1);
}
await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(4000);
if (!found) console.log("no hydration error captured");

await browser.close();
