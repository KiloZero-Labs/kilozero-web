import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { auth, signIn, signOut } from "@/lib/auth";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "KiloZero | The Future of Seamless Tracking",
  description: "Experience absolute precision with KiloZero's seamless hardware integration platform.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="en">
      <body className={inter.className}>
        <nav className="nav">
          <Link href="/" className="nav-brand">KiloZero</Link>
          <div className="nav-links">
            {session?.user ? (
              <>
                {(session.user as any).isAdmin && (
                  <Link href="/admin/drivers" className="btn-admin">
                    App Management
                  </Link>
                )}
                <form action={async () => {
                  "use server"
                  await signOut()
                }}>
                  <button type="submit" className="btn-logout">Sign Out ({session.user.email})</button>
                </form>
              </>
            ) : (
              <form action={async () => {
                "use server"
                await signIn("google")
              }}>
                <button type="submit" className="btn-login">Sign in with Google</button>
              </form>
            )}
          </div>
        </nav>
        <main>{children}</main>
        <footer style={{ textAlign: 'center', padding: '2rem', borderTop: '1px solid #333', marginTop: 'auto' }}>
          <p style={{ color: '#888', fontSize: '0.9rem' }}>
            &copy; {new Date().getFullYear()} KiloZero Labs. All rights reserved. | <Link href="/privacy" style={{ color: '#58a6ff', textDecoration: 'none' }}>Privacy Policy</Link>
          </p>
        </footer>
      </body>
    </html>
  );
}
