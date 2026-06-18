import { AdminShell } from "@/components/admin-shell";

export default function DailyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
