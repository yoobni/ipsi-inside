import { AdminShell } from "@/components/admin-shell";

export default function AnnouncementsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
