import { spawn } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const PORT = 4180;
const BASE = `http://localhost:${PORT}/`;

const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
  cwd: process.cwd(),
  shell: true,
  stdio: "ignore",
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const failures = [];
const check = (label, ok, extra = "") => {
  if (ok) console.log(`  PASS  ${label}`);
  else {
    console.log(`  FAIL  ${label} ${extra}`);
    failures.push(label);
  }
};

// Clerk credentials come from .env via scripts/auth.mjs (read lazily).

let serverReady = false;
for (let attempt = 0; attempt < 60; attempt++) {
  try {
    const res = await fetch(new URL("manifest.webmanifest", BASE));
    if (res.ok) {
      serverReady = true;
      break;
    }
  } catch {
    /* retry */
  }
  await sleep(500);
}

if (!serverReady) {
  console.log("server failed to start");
  server.kill();
  process.exit(1);
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1400, height: 950 },
  permissions: ["clipboard-read", "clipboard-write"],
  locale: "en-PK",
});
const page = await context.newPage();
page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));

const downloadDir = await mkdtemp(path.join(tmpdir(), "profittrack-"));

try {
  console.log("0. Auth gate + signed-in session");
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  try {
    await page.waitForURL((url) => url.pathname.includes("/sign-in"), {
      timeout: 30000,
    });
    check(
      "signed-out visitor redirected to /sign-in",
      page.url().includes("/sign-in"),
      page.url(),
    );
  } catch {
    check(
      "signed-out visitor redirected to /sign-in",
      false,
      `landed on ${page.url()}`,
    );
  }

  // Establish a real session via Clerk Agent Tasks (no interactive sign-in).
  const { establishSession } = await import("./auth.mjs");
  const session = await establishSession(page, context, BASE);
  check("agent-task login establishes session", session.ok, session.error ?? "");

  console.log("0b. Reset cloud data for a clean run");
  await page.goto(new URL("settings", BASE).href, {
    waitUntil: "domcontentloaded",
  });
  await page
    .getByRole("button", { name: "Delete all my data" })
    .waitFor({ timeout: 15000 });
  check("settings danger zone reachable", true);
  await page.getByRole("button", { name: "Delete all my data" }).click();
  await page.getByRole("button", { name: "Delete everything" }).click();
  await page.getByText("All data deleted").waitFor({ timeout: 15000 });
  check("cloud data reset for a clean run", true);

  // Migrate-local button: fresh profile has no IndexedDB data.
  await page.getByRole("button", { name: "Migrate local data to cloud" }).click();
  await page.getByRole("button", { name: "Move my data" }).click();
  await page.getByText("No local data found on this device").waitFor({
    timeout: 15000,
  });
  check("migrate local data button handles empty device", true);

  console.log("1. Dashboard first run");
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.getByText("Add your WhatsApp supplier groups first").waitFor({ timeout: 15000 });
  check("onboarding banner shown", true);
  await page.getByText("Total Investment", { exact: true }).waitFor();
  await page.getByText("Rs. 0").first().waitFor();
  check("metric cards render with zeros", true);

  console.log("2. Seeded categories");
  await page.getByRole("link", { name: "Categories" }).click();
  await page.getByRole("heading", { name: "Categories", exact: true }).waitFor();
  for (const name of ["Electronics", "Fashion", "Home", "Beauty", "Kids", "Other"]) {
    await page.getByText(name).first().waitFor();
  }
  check("6 default categories seeded", true);

  console.log("3. Supplier group CRUD");
  await page.getByRole("link", { name: "Suppliers" }).click();
  await page.getByRole("heading", { name: "Supplier Groups", exact: true }).waitFor();
  await page.getByRole("button", { name: "Add supplier group" }).first().click();
  await page.getByLabel("Group name").fill("Karachi Wholesale Hub");
  await page.getByRole("button", { name: "Add group" }).click();
  await page.getByText("Karachi Wholesale Hub added").waitFor();
  check("supplier group created", true);

  console.log("4. Product creation with price options");
  await page.getByRole("button", { name: "Add Product" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/Product name/).fill("Samsung A15 128GB");
  await dialog.getByLabel(/Details/).fill("Black, PTA approved, 1 year warranty");
  await dialog.getByLabel("Option 1 cost price").fill("42000");
  await dialog.getByLabel("Option 1 sell price").fill("47500");
  await dialog.getByText("+Rs. 5,500").first().waitFor();
  check("option 1 live profit shows Rs. 5,500", true);

  await dialog.getByRole("button", { name: "Add Option" }).click();
  await dialog.getByLabel("Option 2 name").fill("With Organizer Box");
  await dialog.getByLabel("Option 2 cost price").fill("44000");
  await dialog.getByLabel("Option 2 sell price").fill("49000");
  await dialog.getByText("+Rs. 5,000").first().waitFor();
  check("option 2 live profit shows Rs. 5,000", true);

  const optionCount = await dialog.getByLabel(/^Option \d+ sell price$/).count();
  check("two price options in form", optionCount === 2, `got ${optionCount}`);

  await dialog.getByLabel(/Quantity/).fill("2");
  await dialog.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Karachi Wholesale Hub" }).click();
  await dialog.getByRole("button", { name: "Add product" }).click();
  await page.getByText("Samsung A15 128GB added to your list").waitFor();
  check("product created with 2 price options", true);

  console.log("5. Dashboard metrics (sum across all options)");
  await page.getByRole("link", { name: "Dashboard" }).click();
  await page.getByText("Rs. 172,000").waitFor();
  check("investment = 172,000 ((42k+44k) x 2)", true);
  await page.getByText("Rs. 21,000").waitFor();
  check("expected profit = 21,000 ((5.5k+5k) x 2)", true);
  await page.getByText("Available Items", { exact: true }).waitFor();
  await page.getByText("Recent products", { exact: true }).waitFor();
  await page
    .getByText("From Rs. 47,500")
    .filter({ visible: true })
    .first()
    .waitFor();
  check("recent list shows From Rs. price", true);

  console.log("6. WhatsApp share copy (price option list)");
  await page
    .getByRole("button", { name: "Copy WhatsApp share text for Samsung A15 128GB" })
    .first()
    .click();
  await page.getByText("Copied for WhatsApp").waitFor();
  const clip = (await page.evaluate(() => navigator.clipboard.readText())).replace(
    /\r\n/g,
    "\n",
  );
  const wanted = [
    "✨ *Samsung A15 128GB*",
    "",
    "💎 Standard → *Rs. 47,500*",
    "💎 With Organizer Box → *Rs. 49,000*",
    "",
    "📝 Black, PTA approved, 1 year warranty",
  ].join("\n");
  check("clipboard matches share template", clip === wanted, JSON.stringify(clip));

  console.log("6b. Paste from WhatsApp + auto extract");
  await page.getByRole("button", { name: "Add Product" }).first().click();
  const productHost = page.getByRole("dialog");
  await productHost.getByRole("button", { name: "Paste from WhatsApp" }).click();
  const pasteDialog = page.getByRole("dialog").last();
  await pasteDialog.getByLabel("WhatsApp message").fill(
    [
      "✨ *Glow Jewellery Set*",
      "",
      "🔥 Premium quality, 3 pcs set",
      "",
      "With Same Jewellery Organizer Box Rs=950 Only",
      "Price With Normal Gift Box Rs=700 Only",
      "",
      "DM to order 🚀",
    ].join("\n"),
  );
  await pasteDialog.getByRole("button", { name: "Extract & Fill" }).click();
  await pasteDialog.getByRole("button", { name: "Extracting..." }).waitFor({
    timeout: 3000,
  });
  await page.getByText("Product details extracted successfully").waitFor();

  await productHost.getByLabel(/Product name/).waitFor();
  const pastedName = await productHost.getByLabel(/Product name/).inputValue();
  check("product name extracted", pastedName === "Glow Jewellery Set", pastedName);
  const pastedDetails = await productHost.getByLabel(/Details/).inputValue();
  check(
    "details extracted",
    pastedDetails.includes("Premium quality, 3 pcs set") &&
      pastedDetails.includes("DM to order"),
    JSON.stringify(pastedDetails),
  );
  const pastedOptions = await productHost
    .getByLabel(/^Option \d+ sell price$/)
    .count();
  check("two price options extracted", pastedOptions === 2, `got ${pastedOptions}`);
  check(
    "option 1 name + extracted cost price",
    (await productHost.getByLabel("Option 1 name").inputValue()) ===
      "With Organizer Box" &&
      (await productHost.getByLabel("Option 1 cost price").inputValue()) === "950",
  );
  check(
    "option 2 name + extracted cost price",
    (await productHost.getByLabel("Option 2 name").inputValue()) ===
      "Normal Gift Box" &&
      (await productHost.getByLabel("Option 2 cost price").inputValue()) === "700",
  );
  check(
    "sell price fields stay blank after extract",
    (await productHost.getByLabel("Option 1 sell price").inputValue()) === "" &&
      (await productHost.getByLabel("Option 2 sell price").inputValue()) === "",
  );
  const profitRowsBeforeSell = await productHost
    .getByText("Live profit", { exact: true })
    .count();
  check(
    "profit hidden until sell price entered",
    profitRowsBeforeSell === 0,
    `got ${profitRowsBeforeSell}`,
  );

  await productHost.getByLabel("Option 1 sell price").fill("1450");
  await productHost.getByText("+Rs. 500").first().waitFor();
  await productHost.getByLabel("Option 2 sell price").fill("1000");
  await productHost.getByText("+Rs. 300").first().waitFor();
  check("live profit calculates on sell price entry", true);

  await productHost.getByLabel("Option 1 sell price").fill("1600");
  await productHost.getByText("+Rs. 650").first().waitFor();
  check("cost & sell freely editable, profit recalculates", true);
  await productHost.getByLabel("Option 1 sell price").fill("1450");
  await productHost.getByText("+Rs. 500").first().waitFor();

  await productHost.getByRole("button", { name: "Pending", exact: true }).click();
  await productHost.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Karachi Wholesale Hub" }).click();
  await productHost.getByRole("button", { name: "Add product" }).click();
  await page.getByText("Glow Jewellery Set added to your list").waitFor();
  check("extracted product saved as Pending", true);

  console.log("6c. Share rebuilds original message with new sell prices");
  await page
    .getByRole("button", { name: "Copy WhatsApp share text for Glow Jewellery Set" })
    .first()
    .click();
  let clipGlow = "";
  for (let attempt = 0; attempt < 20; attempt++) {
    clipGlow = (await page.evaluate(() => navigator.clipboard.readText())).replace(
      /\r\n/g,
      "\n",
    );
    if (clipGlow.includes("Rs=1450")) break;
    await page.waitForTimeout(250);
  }
  const wantedGlow = [
    "✨ *Glow Jewellery Set*",
    "",
    "🔥 Premium quality, 3 pcs set",
    "",
    "With Same Jewellery Organizer Box Rs=1450 Only",
    "Price With Normal Gift Box Rs=1000 Only",
    "",
    "DM to order 🚀",
  ].join("\n");
  check(
    "original message reused with updated sell prices",
    clipGlow === wantedGlow,
    JSON.stringify(clipGlow),
  );

  console.log("7. Search + filters");
  await page.getByRole("link", { name: "Products" }).click();
  await page.getByRole("heading", { name: "Products", exact: true }).waitFor();
  await page.getByLabel("Global search").fill("samsung");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(700);
  await page.getByRole("cell", { name: /^Samsung A15 128GB/ }).waitFor();
  check("search by product name works", true);
  await page.getByRole("cell", { name: /From Rs\. 47,500/ }).waitFor();
  check("multi-option price shows From Rs. + more", true);
  const moreBadges = await page.getByText("+1 more").count();
  check("shows +1 more option badge", moreBadges > 0, `got ${moreBadges}`);

  await page.getByLabel("Global search").fill("karachi");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(700);
  await page.getByRole("cell", { name: /^Samsung A15 128GB/ }).waitFor();
  check("search by supplier name works", true);

  await page.getByLabel("Global search").fill("nothingmatches");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(700);
  await page.getByText("No matching products").waitFor();
  check("empty state on no results", true);

  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByRole("cell", { name: /^Samsung A15 128GB/ }).waitFor();
  check("clear filters restores list", true);

  console.log("8. Status filter chips");
  await page.getByRole("button", { name: "Sold", exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByText("No matching products").waitFor();
  check("sold filter hides available product", true);
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByRole("cell", { name: /^Samsung A15 128GB/ }).waitFor();

  console.log("9. Price history per option");
  await page.getByText("Samsung A15 128GB").first().click();
  const editDialog = page.getByRole("dialog");
  await editDialog.getByLabel("Option 1 cost price").fill("43000");
  await editDialog.getByRole("button", { name: "Save changes" }).click();
  await page.getByText("New price saved to history").waitFor();
  check("price change recorded to history", true);

  await page.getByText("Samsung A15 128GB").first().click();
  const historyDialog = page.getByRole("dialog");
  const historyEntries = await historyDialog
    .getByText(/Cost Rs\. .* · Sell Rs\./)
    .count();
  check("price history has 3 entries", historyEntries === 3, `got ${historyEntries}`);
  const namedEntry = await historyDialog
    .getByText(/With Organizer Box · Cost Rs\./)
    .count();
  check("history entry shows option name", namedEntry > 0, `got ${namedEntry}`);
  await page.keyboard.press("Escape");

  console.log("10. CSV export");
  await page.getByRole("link", { name: "Settings & Backup" }).click();
  await page.getByRole("heading", { name: "Settings & Backup", exact: true }).waitFor();
  const csvDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const csvDownload = await csvDownloadPromise;
  const csvPath = await csvDownload.path();
  const csv = await readFile(csvPath, "utf8");
  check(
    "CSV has per-option headers + product row",
    csv.includes("Name,Details,Option,Cost Price,Sell Price,Profit") &&
      csv.includes("Samsung A15 128GB") &&
      csv.includes("With Organizer Box"),
    csv.slice(0, 160),
  );

  console.log("11. JSON backup + restore");
  const jsonDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON backup" }).click();
  const jsonDownload = await jsonDownloadPromise;
  const jsonPath = await jsonDownload.path();
  const backup = JSON.parse(await readFile(jsonPath, "utf8"));
  check(
    "backup contains products + suppliers",
    backup.app === "profittrack" && backup.products.length === 2 && backup.supplierGroups.length === 1,
    JSON.stringify({ app: backup.app, products: backup.products?.length }),
  );
  const backupProduct = backup.products?.find(
    (product) => product.name === "Samsung A15 128GB",
  );
  check(
    "backup keeps both price options",
    Array.isArray(backupProduct?.priceOptions) && backupProduct.priceOptions.length === 2,
    JSON.stringify(backupProduct?.priceOptions?.map((option) => option.name)),
  );
  const backupPasted = backup.products?.find(
    (product) => product.name === "Glow Jewellery Set",
  );
  check(
    "backup keeps extracted options",
    Array.isArray(backupPasted?.priceOptions) &&
      backupPasted.priceOptions.length === 2 &&
      backupPasted.priceOptions[0].costPrice === 950 &&
      backupPasted.priceOptions[0].sellPrice === 1450,
    JSON.stringify(backupPasted?.priceOptions),
  );
  check(
    "backup keeps original WhatsApp message",
    typeof backupPasted?.originalMessage === "string" &&
      backupPasted.originalMessage.includes("Rs=950 Only"),
    JSON.stringify(backupPasted?.originalMessage),
  );

  await page.locator('input[type="file"]').setInputFiles(jsonPath);
  await page.getByText("will replace all current products").waitFor();
  await page.getByRole("button", { name: "Replace my data" }).click();
  await page.getByText("Backup restored").waitFor();
  check("restore from backup succeeds", true);

  await page.getByRole("link", { name: "Products" }).click();
  await page.getByRole("cell", { name: /^Samsung A15 128GB/ }).waitFor();
  await page.getByRole("cell", { name: /From Rs\. 47,500/ }).waitFor();
  check("restored product keeps both price options", true);

  console.log("12. Dark mode");
  await page.getByRole("button", { name: "Change theme" }).click();
  await page.getByRole("menuitem", { name: "Dark" }).click();
  await page.waitForTimeout(400);
  const isDark = await page.evaluate(() =>
    document.documentElement.classList.contains("dark"),
  );
  check("dark mode applied", isDark);
  await page.getByRole("button", { name: "Change theme" }).click();
  await page.getByRole("menuitem", { name: "Light" }).click();

  console.log("13. PWA manifest + service worker");
  const manifest = await page.evaluate(async () => {
    const res = await fetch("/manifest.webmanifest");
    return res.ok ? await res.json() : null;
  });
  check("manifest served", manifest?.name?.includes("ProfitTrack"), String(manifest?.name));
  check(
    "manifest has icons",
    Array.isArray(manifest?.icons) && manifest.icons.length === 3,
    String(manifest?.icons?.length),
  );
  await page.evaluate(() => navigator.serviceWorker.ready);
  const controlled = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
  await page.waitForTimeout(1500);
  const stillControlled = await page.evaluate(
    () => Boolean(navigator.serviceWorker.controller),
  );
  check("service worker controls the page", controlled || stillControlled);

  console.log("14. Offline mode still works");
  await context.setOffline(true);
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.getByText("Total Investment", { exact: true }).waitFor({ timeout: 15000 });
  const offlineRendered = await page.getByText("Expected Profit", { exact: true }).count();
  check("offline navigation works", offlineRendered > 0);
  await context.setOffline(false);

  console.log("15. Mobile layout + sidebar sheet");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("navigation").last().waitFor();
  await page.getByRole("link", { name: "Products" }).last().click();
  await page.getByRole("heading", { name: "Products", exact: true }).waitFor();
  check("mobile sheet navigation works", true);
  const tableVisible = await page.locator("table").isVisible().catch(() => false);
  check("table replaced by cards on mobile", !tableVisible);
} catch (error) {
  failures.push(`exception: ${error.message}`);
  await page.screenshot({ path: "smoke-failure.png", fullPage: true }).catch(() => undefined);
} finally {
  await browser.close();
  server.kill();
}

console.log("\n=================================");
if (failures.length === 0) {
  console.log("ALL CHECKS PASSED");
} else {
  console.log(`${failures.length} FAILURE(S):`);
  failures.forEach((failure) => console.log(` - ${failure}`));
  process.exitCode = 1;
}





