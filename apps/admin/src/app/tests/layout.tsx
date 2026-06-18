import { AdminShell } from "@/components/admin-shell";

export default function TestsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
