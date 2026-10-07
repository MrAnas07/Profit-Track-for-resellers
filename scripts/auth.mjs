import { readFile } from "node:fs/promises";
import path from "node:path";

/** Read CLERK_SECRET_KEY from .env (node does not load it automatically). */
export async function clerkSecretKey() {
  try {
    const env = await readFile(path.join(process.cwd(), ".env"), "utf8");
    return env
      .match(/^CLERK_SECRET_KEY=(.+)$/m)?.[1]
      ?.trim()
      ?.replace(/^"|"$/g, "");
  } catch {
    return null;
  }
}

/**
 * Establish an authenticated Clerk session in a Playwright context using
 * Clerk Agent Tasks (no interactive sign-in, no bot-detection friction).
 * Creates a dedicated `smoke-test@profittrack.app` user on first run.
 *
 * Returns { ok: true } or { ok: false, error }.
 */
export async function establishSession(page, context, baseUrl) {
  const secretKey = await clerkSecretKey();
  if (!secretKey) {
    return { ok: false, error: "CLERK_SECRET_KEY missing in .env" };
  }

  const { createClerkClient } = await import("@clerk/backend");
  const clerk = createClerkClient({ secretKey });

  const testEmail = "smoke-test@profittrack.app";
  try {
    const list = await clerk.users.getUserList({ limit: 100 });
    // Prefer a dedicated test user; fall back to any existing user.
    // (The instance requires verify_at_sign_up, so the test user can only be
    // created through the normal sign-up flow — not the Backend API.)
    const user =
      list.data.find((entry) =>
        entry.emailAddresses.some((addr) => addr.emailAddress === testEmail),
      ) ?? list.data[0];
    if (!user) {
      return {
        ok: false,
        error: "no users in Clerk instance — sign up once manually first",
      };
    }

    const agentTask = await clerk.agentTasks.create({
      onBehalfOf: { userId: user.id },
      permissions: "*",
      agentName: "profittrack-tests",
      taskDescription: "automated test login",
      redirectUrl: baseUrl,
    });

    await page.goto(agentTask.url, { waitUntil: "domcontentloaded" });
    const origin = new URL(baseUrl).origin;
    await page.waitForURL(
      (url) => url.origin === origin && !url.pathname.startsWith("/sign"),
      { timeout: 30000 },
    );

    // The session cookie can land a tick after the redirect resolves.
    let names = [];
    for (let attempt = 0; attempt < 24; attempt++) {
      const cookies = await context.cookies(baseUrl);
      names = cookies.map((cookie) => cookie.name);
      if (names.includes("__session")) return { ok: true };
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return { ok: false, error: `no __session cookie; found: ${names.join(",")}` };
  } catch (error) {
    return { ok: false, error: String(error?.message ?? error) };
  }
}
