import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/layout/app-shell";
import { SidebarProvider } from "@/components/ui/sidebar";
import { getCompanySettings } from "./settings/actions";
import { ThemeProvider } from "@/components/layout/theme-provider";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  
  const companySettings = await getCompanySettings();

  return (
    <ThemeProvider>
      <SidebarProvider>
        <TooltipProvider>
          <AppShell companyName={companySettings?.companyName || "Toko Kilat"}>{children}</AppShell>
        </TooltipProvider>
      </SidebarProvider>
    </ThemeProvider>
  );
}
