import { AdminShell } from "@/components/admin-shell";

export default function PlannerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
