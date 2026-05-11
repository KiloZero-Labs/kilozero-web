import Link from "next/link";
import { FaServer, FaFlask, FaProjectDiagram, FaUsers, FaCogs } from "react-icons/fa";
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
          <Link href="/admin/telemetry" className="sidebar-link">
            <FaFlask /> Beta Telemetry
          </Link>
          <Link href="/admin/everyday-telemetry" className="sidebar-link">
            <FaServer /> Weigh-in Stats
          </Link>
          <Link href="/admin/probe-workflow" className="sidebar-link">
            <FaProjectDiagram /> Probe Workflow
          </Link>
          <Link href="#" className="sidebar-link">
            <FaUsers /> Users
          </Link>
          <Link href="#" className="sidebar-link">
            <FaCogs /> Settings
          </Link>
        </nav>
      </aside>
      <section className="admin-content">
        {children}
      </section>
    </div>
  );
}
