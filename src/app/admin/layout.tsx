import Link from "next/link";
import { FaServer, FaCogs } from "react-icons/fa";
import { auth, ADMIN_WHITELIST } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.email || !ADMIN_WHITELIST.includes(session.user.email.toLowerCase())) {
    redirect("/");
  }
  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <nav className="sidebar-nav">
          <Link href="/admin/drivers" className="sidebar-link">
            <FaServer /> Driver Management
          </Link>
          <Link href="/admin/devices" className="sidebar-link">
            <FaServer /> Hardware Weights
          </Link>
          <Link href="/admin/inference-engine" className="sidebar-link">
            <FaCogs /> Inference Engine
          </Link>
        </nav>
      </aside>
      <section className="admin-content">
        {children}
      </section>
    </div>
  );
}
