import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
// Assuming logger can run in edge runtime (might need adjustments if fs access fails)
// If logger fails in edge, use console.log instead for middleware
// import { logToServer } from "./lib/logger"; // Comment out file logger

const secret = process.env.NEXTAUTH_SECRET;

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  // Define protected paths
  const protectedPaths = ["/profile", "/settings", "/dashboard"];

  // Check if the current path starts with any of the protected paths
  if (protectedPaths.some((p) => path.startsWith(p))) {
    // Attempt to retrieve the session token
    const token = await getToken({ req, secret });
    const sessionCookie =
      req.cookies.get("next-auth.session-token") ||
      req.cookies.get("__Secure-next-auth.session-token");

    // Log the check details using console.log for Edge compatibility
    console.log(
      `[Middleware Check] Path: ${path}, Has Cookie: ${!!sessionCookie}, Token Status: ${
        token ? "Valid" : "Invalid/Expired/Missing"
      }, UserID: ${token?.sub}`
    );

    // If no valid token is found, redirect to the home page
    if (!token) {
      const url = req.nextUrl.clone();
      url.pathname = "/"; // Set redirect target to home page
      console.warn(
        `[Middleware Redirect] Path: ${path}, Reason: No Token, Redirecting to: ${url.pathname}`
      ); // Log redirect
      return NextResponse.redirect(url);
    }
  }

  // Continue processing the request if path is not protected or token is valid
  return NextResponse.next();
}

// Configure the matcher to specify which paths the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * This ensures the middleware doesn't unnecessarily run on static assets or API routes.
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
    // Explicitly list protected paths if the negative lookahead is too complex
    // '/profile/:path*',
    // '/settings/:path*',
    // '/dashboard/:path*',
  ],
};
