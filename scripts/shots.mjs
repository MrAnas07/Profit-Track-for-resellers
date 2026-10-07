import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const PORT = 4181;
const BASE = `http://localhost:${PORT}/`;
const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
  cwd: process.cwd(),
  shell: true,
  stdio: "ignore",
});
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let ready = false;
for (let attempt = 0; attempt < 60; attempt++) {
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
  server.kill();
  process.exit(1);
}

await mkdir("shots", { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1400, height: 950 },
  locale: "en-PK",
});
const page = await context.newPage();

// Sign in first — all app routes are behind Clerk middleware now.
const { establishSession } = await import("./auth.mjs");
const session = await establishSession(page, context, BASE);
if (!session.ok) {
  console.log("auth failed:", session.error);
  server.kill();
  process.exit(1);
}

const addProduct = async ({
  name,
  details,
  cost,
  sell,
  option2,
  status,
  qty,
  supplier,
  category,
}) => {
  await page.getByRole("button", { name: "Add Product" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/Product name/).fill(name);
  await dialog.getByLabel(/Details/).fill(details);
  await dialog.getByLabel("Option 1 cost price").fill(cost);
  await dialog.getByLabel("Option 1 sell price").fill(sell);
  if (option2) {
    await dialog.getByRole("button", { name: "Add Option" }).click();
    await dialog.getByLabel("Option 2 name").fill(option2.name);
    await dialog.getByLabel("Option 2 cost price").fill(option2.cost);
    await dialog.getByLabel("Option 2 sell price").fill(option2.sell);
  }
  if (qty) await dialog.getByLabel(/Quantity/).fill(qty);
  if (status !== "Available") {
    await dialog.getByRole("button", { name: status, exact: true }).click();
  }
  if (supplier) {
    await dialog.getByRole("combobox").first().click();
    await page.getByRole("option", { name: supplier }).click();
  }
  if (category) {
    await dialog.getByRole("combobox").nth(1).click();
    await page.getByRole("option", { name: category }).click();
  }
  await dialog.getByRole("button", { name: "Add product" }).click();
  await dialog.waitFor({ state: "hidden" });
};

try {
  // Reset cloud data so screenshots always start from a clean state.
  await page.goto(new URL("settings", BASE).href, {
    waitUntil: "domcontentloaded",
  });
  await page
    .getByRole("button", { name: "Delete all my data" })
    .waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Delete all my data" }).click();
  await page.getByRole("button", { name: "Delete everything" }).click();
  await page.getByText("All data deleted").waitFor({ timeout: 15000 });

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.getByText("Add your WhatsApp supplier groups first").waitFor({ timeout: 15000 });

  await page.getByRole("link", { name: "Suppliers" }).click();
  await page.getByRole("button", { name: "Add supplier group" }).first().click();
  await page.getByLabel("Group name").fill("Karachi Wholesale Hub");
  await page.getByRole("button", { name: "Add group" }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Add supplier group" }).first().click();
  await page.getByLabel("Group name").fill("Lahore Trend Traders");
  await page.getByRole("button", { name: "Add group" }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });

  await addProduct({
    name: "Samsung A15 128GB",
    details: "Black, PTA approved, 1 year warranty",
    cost: "42000",
    sell: "47500",
    option2: { name: "With Organizer Box", cost: "44000", sell: "49000" },
    qty: "2",
    status: "Available",
    supplier: "Karachi Wholesale Hub",
    category: "Electronics",
  });
  await addProduct({
    name: "Nike Air Max 270",
    details: "Size 42, original box included",
    cost: "12500",
    sell: "15900",
    qty: "4",
    status: "Available",
    supplier: "Lahore Trend Traders",
    category: "Fashion",
  });
  await addProduct({
    name: "Dettol Handwash 200ml",
    details: "Pack of 6 bottles",
    cost: "1440",
    sell: "1800",
    qty: "6",
    status: "Pending",
    supplier: "Karachi Wholesale Hub",
    category: "Beauty",
  });
  await addProduct({
    name: "Dyson V8 Slim",
    details: "Refurbished, 6 month shop warranty",
    cost: "38000",
    sell: "44000",
    qty: "1",
    status: "Sold",
    supplier: "Lahore Trend Traders",
    category: "Home",
  });

  await page.getByRole("link", { name: "Dashboard" }).click();
  await page.getByText("Recent products").waitFor();
  const openDialogs = await page.locator("[role=dialog]:visible").count();
  const onDashboard = await page.getByRole("heading", { name: "Dashboard", exact: true }).count();
  if (openDialogs !== 0 || onDashboard !== 1) throw new Error("bad state: dialogs=${openDialogs} dashboard=${onDashboard}");
  console.log("state ok: dashboard visible, no open dialog");
  await sleep(600);
  await page.screenshot({ path: "shots/desktop-dashboard-light.png", fullPage: true });

  await page.getByRole("button", { name: "Change theme" }).click();
  await page.getByRole("menuitem", { name: "Dark" }).click();
  await sleep(500);
  await page.screenshot({ path: "shots/desktop-dashboard-dark.png", fullPage: true });

  await page.getByRole("button", { name: "Change theme" }).click();
  await page.getByRole("menuitem", { name: "Light" }).click();
  await sleep(300);

  await page.getByRole("link", { name: "Products" }).click();
  await page.getByRole("heading", { name: "Products", exact: true }).waitFor();
  await sleep(500);
  await page.screenshot({ path: "shots/desktop-products-light.png", fullPage: true });

  await page.getByRole("button", { name: /^Samsung A15 128GB/ }).click().catch(async () => {
    await page.getByText("Samsung A15 128GB").first().click();
  });
  await page.getByRole("dialog").waitFor();
  await sleep(400);
  await page.screenshot({ path: "shots/desktop-product-dialog.png" });
  await page.keyboard.press("Escape");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.getByText("Total Investment", { exact: true }).waitFor();
  await sleep(500);
  await page.screenshot({ path: "shots/mobile-dashboard.png", fullPage: true });

  await page.getByRole("button", { name: "Open navigation" }).click();
  await sleep(400);
  await page.screenshot({ path: "shots/mobile-nav.png" });
  await page.getByRole("link", { name: "Products" }).last().click();
  await page.getByRole("heading", { name: "Products", exact: true }).waitFor();
  await sleep(500);
  await page.screenshot({ path: "shots/mobile-products.png", fullPage: true });

  console.log("screenshots written to shots/");
} catch (error) {
  console.error("shot failure:", error.message);
  await page.screenshot({ path: "shots/shot-failure.png", fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}


