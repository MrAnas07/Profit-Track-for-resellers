import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

// Set REVIEW_BASE to reuse an already-running server (e.g. the dev server):
//   REVIEW_BASE=http://localhost:3000/ node scripts/review-shots.mjs
const EXTERNAL_BASE = process.env.REVIEW_BASE;
const PORT = 4182;
const BASE = EXTERNAL_BASE ?? `http://localhost:${PORT}/`;
const server = EXTERNAL_BASE
  ? null
  : spawn("npx", ["next", "start", "-p", String(PORT)], {
      cwd: process.cwd(),
      shell: true,
      stdio: "ignore",
    });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let ready = false;
for (let attempt = 0; attempt < 120; attempt++) {
  try {
    const res = await fetch(new URL("manifest.webmanifest", BASE));
    if (res.ok) {
      ready = true;
      break;
    }
  } catch {
    /* retry */
  }
  await sleep(500);
}
if (!ready) {
  console.log("server failed to start");
  server?.kill();
  process.exit(1);
}

await mkdir("review", { recursive: true });
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
  browser.close();
  server?.kill();
  process.exit(1);
}

const PAGES = [
  ["dashboard", "/"],
  ["products", "/products"],
  ["suppliers", "/suppliers"],
  ["categories", "/categories"],
  ["settings", "/settings"],
];
const VIEWPORTS = [
  [375, 812],
  [768, 1024],
  [1280, 900],
];
const SHOTS = new Set([
  "dashboard-375",
  "dashboard-768",
  "dashboard-1280",
  "products-375",
  "products-1280",
  "suppliers-375",
  "categories-768",
  "settings-375",
]);

const issues = [];

for (const [w, h] of VIEWPORTS) {
  await page.setViewportSize({ width: w, height: h });
  for (const [name, route] of PAGES) {
    await page.goto(new URL(route, BASE).href, { waitUntil: "networkidle" });
    await sleep(500);
    const info = await page.evaluate(() => {
      const de = document.documentElement;
      const offenders = [];
      if (de.scrollWidth > window.innerWidth + 1) {
        for (const el of document.querySelectorAll("body *")) {
          const r = el.getBoundingClientRect();
          if (r.right > window.innerWidth + 1 && r.width > 40) {
            offenders.push(
              `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 70)}`,
            );
            if (offenders.length >= 4) break;
          }
        }
      }
      // small touch targets among interactive elements
      const small = [];
      for (const el of document.querySelectorAll("button, a[href], [role=button]")) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && (r.height < 36 || r.width < 36)) {
          small.push(
            `${el.tagName.toLowerCase()}:${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30)} ${Math.round(r.width)}x${Math.round(r.height)}`,
          );
        }
      }
      return {
        scrollWidth: de.scrollWidth,
        innerWidth: window.innerWidth,
        offenders,
        small: small.slice(0, 8),
      };
    });
    if (info.scrollWidth > info.innerWidth + 1) {
      issues.push({ viewport: w, page: name, kind: "h-overflow", ...info });
    }
    if (info.small.length > 0) {
      issues.push({ viewport: w, page: name, kind: "small-targets", small: info.small });
    }
    if (SHOTS.has(`${name}-${w}`)) {
      await page.screenshot({ path: `review/${name}-${w}.png`, fullPage: true });
    }
  }
}

// Dark mode dashboard (desktop + mobile)
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(BASE, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Change theme" }).click();
await page.getByRole("menuitem", { name: "Dark" }).click();
await sleep(400);
await page.screenshot({ path: "review/dashboard-1280-dark.png", fullPage: true });

await page.setViewportSize({ width: 375, height: 812 });
await sleep(400);
await page.screenshot({ path: "review/dashboard-375-dark.png", fullPage: true });
await page.getByRole("button", { name: "Change theme" }).click();
await page.getByRole("menuitem", { name: "Light" }).click();
await sleep(300);

// Product dialog on mobile
await page.getByRole("button", { name: "Add product" }).first().click();
await page.getByRole("dialog").waitFor();
await sleep(400);
await page.screenshot({ path: "review/dialog-375.png" });
await page.keyboard.press("Escape");
await sleep(300);

// Mobile nav sheet open
await page.getByRole("button", { name: "Open navigation" }).click();
await page.getByRole("navigation").last().waitFor();
await sleep(400);
await page.screenshot({ path: "review/sheet-375.png" });

console.log("ISSUES:");
console.log(JSON.stringify(issues, null, 2));
await writeFile("review/issues.json", JSON.stringify(issues, null, 2));
const overflowOnly = issues.filter((i) => i.kind === "h-overflow");
console.log(`overflow issues: ${overflowOnly.length}`);
console.log("screenshots written to review/");

await browser.close();
server?.kill();
