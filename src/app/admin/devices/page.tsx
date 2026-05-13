import { auth, ADMIN_WHITELIST } from "@/lib/auth";
import { redirect } from "next/navigation";
import DevicesClient from "./DevicesClient";

export default async function AdminDevicesPage() {
  const session = await auth();
  if (!session?.user?.email || !ADMIN_WHITELIST.includes(session.user.email.toLowerCase())) {
    redirect("/");
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1>Hardware Weights Registry</h1>
        <p>OTA Synchronization Dashboard for the KiloZero Physics Engine</p>
      </header>
      <DevicesClient adminEmail={session.user.email} />
    </div>
  );
}
