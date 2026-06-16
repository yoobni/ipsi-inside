import { AdminSidebar } from "@/components/admin-sidebar";
import { AdminShellTop } from "@/components/admin-shell-top";

export default function MembersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col bg-muted/30">
        <AdminShellTop />
        <main className="flex-1 p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
