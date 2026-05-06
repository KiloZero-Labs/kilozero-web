import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

// Parse the comma-separated whitelist from the environment variables
const whitelistStr = process.env.ADMIN_WHITELIST || 'kilozero.admin@gmail.com';
export const ADMIN_WHITELIST = whitelistStr.split(',').map(e => e.trim().toLowerCase());

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  callbacks: {
    authorized: ({ auth, request }) => {
      // Protect /admin/* routes: require login AND admin whitelist membership
      if (request.nextUrl.pathname.startsWith('/admin')) {
        if (!auth?.user?.email) return false; // Not logged in → redirect to login
        return ADMIN_WHITELIST.includes(auth.user.email.toLowerCase());
      }
      return true; // All other routes are public
    },
    session: ({ session, token }) => {
      if (session?.user?.email) {
        (session.user as any).isAdmin = ADMIN_WHITELIST.includes(session.user.email.toLowerCase());
      }
      return session;
    },
  },
})

