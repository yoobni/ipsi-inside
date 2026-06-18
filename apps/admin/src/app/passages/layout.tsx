import { AdminShell } from "@/components/admin-shell";

export default function PassagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
