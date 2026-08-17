import AuthGuard from "@/components/AuthGuard";
import DashboardShell from "@/components/DashboardShell";

export default function PanelLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthGuard>
      <DashboardShell>{children}</DashboardShell>
    </AuthGuard>
  );
}
