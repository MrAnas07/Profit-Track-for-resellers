import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Routes that require a signed-in user. Everything else (sign-in/sign-up,
 * Clerk callbacks, PWA assets served via the matcher below) stays public.
 */
const PROTECTED_PATHS = [
  "/",
  "/products",
  "/suppliers",
  "/categories",
  "/settings",
];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some((path) =>
    path === "/"
      ? pathname === "/"
      : pathname === path || pathname.startsWith(`${path}/`),
  );
}

export default clerkMiddleware(async (auth, request) => {
  if (isProtectedPath(request.nextUrl.pathname)) {
    // Signed-out visitors are redirected to /sign-in by Clerk.
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
