import { chromium } from "playwright";

const BASE = process.env.REVIEW_BASE ?? "http://localhost:3000/";
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  locale: "en-PK",
});
const page = await context.newPage();

const { establishSession } = await import("./auth.mjs");
const session = await establishSession(page, context, BASE);
if (!session.ok) {
  console.log("auth failed:", session.error);
  process.exit(1);
}

await page.goto(BASE, { waitUntil: "networkidle" });
console.log("html class before:", await page.evaluate(() => document.documentElement.className));

await page.getByRole("button", { name: "Change theme" }).click();
const items = await page.getByRole("menuitem").allTextContents();
console.log("menu items:", JSON.stringify(items));
await page.getByRole("menuitem", { name: "Dark" }).click();
await page.waitForTimeout(600);
console.log("html class after:", await page.evaluate(() => document.documentElement.className));
console.log(
  "bg color:",
  await page.evaluate(() => getComputedStyle(document.body).backgroundColor),
);
await page.screenshot({ path: "review/theme-test.png" });

await browser.close();
