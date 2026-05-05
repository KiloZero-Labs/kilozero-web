import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { ADMIN_WHITELIST } from "./lib/auth";

export default auth((req) => {
  const isAdminRoute = req.nextUrl.pathname.startsWith("/admin");
  const isAuthorized = req.auth?.user?.email && ADMIN_WHITELIST.includes(req.auth.user.email.toLowerCase());

  if (isAdminRoute && !isAuthorized) {
    return NextResponse.redirect(new URL("/", req.url));
  }
})

export const config = {
  matcher: ["/admin/:path*"],
}
