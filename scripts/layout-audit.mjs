import { chromium } from "playwright";

const BASE = process.env.REVIEW_BASE ?? "http://localhost:3000/";
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  locale: "en-PK",
});
const page = await context.newPage();

const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error")
    consoleErrors.push(`[${page.url()}] ${msg.text().slice(0, 160)}`);
});
page.on("pageerror", (err) => consoleErrors.push(`[${page.url()}] ${String(err).slice(0, 160)}`));

const { establishSession } = await import("./auth.mjs");
const session = await establishSession(page, context, BASE);
if (!session.ok) {
  console.log("auth failed:", session.error);
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const ok = (name, pass, detail = "") =>
  results.push(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);

// 1. Metric grid: 4 cols desktop, 2 cols mobile
await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(600);
let cols = await page.evaluate(() => {
  const grid = document.querySelector("main .grid");
  return grid ? getComputedStyle(grid).gridTemplateColumns.split(" ").length : 0;
});
ok("metric grid 4 cols @1280", cols === 4, `cols=${cols}`);

await page.setViewportSize({ width: 375, height: 812 });
await sleep(400);
cols = await page.evaluate(() => {
  const grid = document.querySelector("main .grid");
  return grid ? getComputedStyle(grid).gridTemplateColumns.split(" ").length : 0;
});
ok("metric grid 2 cols @375", cols === 2, `cols=${cols}`);

// 2. Touch targets @375 (dashboard + products)
for (const [route, name] of [
  ["/", "dashboard"],
  ["/products", "products"],
]) {
  await page.goto(new URL(route, BASE).href, { waitUntil: "networkidle" });
  await sleep(500);
  const small = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("button, a[href]")) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && (r.height < 36 || r.width < 36)) {
        out.push(
          `${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 26)} ${Math.round(r.width)}x${Math.round(r.height)}`,
        );
      }
    }
    return out.slice(0, 10);
  });
  ok(`touch targets >=36 @375 ${name}`, small.length === 0, small.join(" | "));
}

// 3. Horizontal overflow @375 on every page
for (const route of ["/", "/products", "/suppliers", "/categories", "/settings"]) {
  await page.goto(new URL(route, BASE).href, { waitUntil: "networkidle" });
  await sleep(400);
  const { sw, iw } = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    iw: window.innerWidth,
  }));
  ok(`no h-overflow @375 ${route}`, sw <= iw + 1, `scrollWidth=${sw}`);
}

// 4. Settings grid: 2 cols @1280
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(new URL("/settings", BASE).href, { waitUntil: "networkidle" });
await sleep(500);
cols = await page.evaluate(() => {
  const grid = document.querySelector("main .grid");
  return grid ? getComputedStyle(grid).gridTemplateColumns.split(" ").length : 0;
});
ok("settings grid 2 cols @1280", cols === 2, `cols=${cols}`);

// 5. Dark mode toggle
await page.goto(BASE, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Change theme" }).click();
await page.getByRole("menuitem", { name: "Dark" }).click();
await sleep(500);
const dark = await page.evaluate(() => ({
  cls: document.documentElement.classList.contains("dark"),
  bg: getComputedStyle(document.body).backgroundColor,
}));
const darkOk = dark.cls && dark.bg !== "rgb(248, 250, 252)";
ok("dark mode applies", darkOk, `cls=${dark.cls} bg=${dark.bg}`);
await page.getByRole("button", { name: "Change theme" }).click();
await page.getByRole("menuitem", { name: "Light" }).click();
await sleep(300);

// 6. Mobile sheet: nav items >= 44px, opens/closes
await page.setViewportSize({ width: 375, height: 812 });
await sleep(300);
await page.getByRole("button", { name: "Open navigation" }).click();
const sheetInfo = await page.evaluate(() => {
  const links = [...document.querySelectorAll('[role="navigation"] a, aside a')].filter(
    (a) => a.getBoundingClientRect().height > 0,
  );
  const heights = links.map((a) => Math.round(a.getBoundingClientRect().height));
  return { count: links.length, min: Math.min(...heights, 999) };
});
ok("sheet nav items >=44px", sheetInfo.min >= 44, `min=${sheetInfo.min}`);

// 7. Product dialog @375: footer does not overlap scrollable content
await page.keyboard.press("Escape");
await sleep(300);
await page.goto(BASE, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Add product" }).first().click();
await page.getByRole("dialog").waitFor();
await sleep(500);
const overlap = await page.evaluate(() => {
  const dialog = document.querySelector('[role="dialog"]');
  if (!dialog) return "no dialog";
  const content = dialog.children[1];
  const footer = dialog.querySelector('[data-slot="dialog-footer"]');
  if (!content || !footer) return "missing nodes";
  const c = content.getBoundingClientRect();
  const f = footer.getBoundingClientRect();
  const footerInsideDialog = f.bottom <= dialog.getBoundingClientRect().bottom + 1;
  const contentScrolls = content.scrollHeight >= content.clientHeight;
  return { gap: Math.round(f.top - c.bottom), footerInsideDialog, contentScrolls };
});
ok(
  "dialog footer below content (no overlap)",
  typeof overlap === "object" && overlap.gap >= -1 && overlap.footerInsideDialog,
  JSON.stringify(overlap),
);
const dialogButtons = await page.evaluate(() => {
  const dialog = document.querySelector('[role="dialog"]');
  return [...dialog.querySelectorAll("button")]
    .filter((b) => b.getBoundingClientRect().height > 0)
    .map(
      (b) =>
        `${(b.getAttribute("aria-label") || b.textContent || "").trim().slice(0, 22)} h=${Math.round(b.getBoundingClientRect().height)}`,
    );
});
ok(
  "dialog primary buttons >=36",
  dialogButtons
    .filter((b) => !b.startsWith("h=0"))
    .every((b) => parseInt(b.split("h=")[1], 10) >= 36),
  dialogButtons.join(" | "),
);
await page.keyboard.press("Escape");

// 8. Input / select heights
await page.goto(new URL("/products", BASE).href, { waitUntil: "networkidle" });
await sleep(500);
const heights = await page.evaluate(() => {
  const input = document.querySelector('input[aria-label="Search products"]');
  const select = document.querySelector('[data-slot="select-trigger"]');
  return {
    input: input ? Math.round(input.getBoundingClientRect().height) : 0,
    select: select ? Math.round(select.getBoundingClientRect().height) : 0,
  };
});
ok("input height >=40", heights.input >= 40, `input=${heights.input}`);
ok("select height >=40", heights.select >= 40, `select=${heights.select}`);

console.log(results.join("\n"));
const fails = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - fails}/${results.length} passed`);
console.log("console errors:", consoleErrors.length ? JSON.stringify(consoleErrors, null, 1) : "none");

await browser.close();
