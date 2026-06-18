import { AdminShell } from "@/components/admin-shell";

export default function JournalsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
