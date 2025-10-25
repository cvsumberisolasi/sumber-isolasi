import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/layout/app-shell";
import { SidebarProvider } from "@/components/ui/sidebar";
import { getCompanySettings, CompanySettings } from "./settings/actions";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { AppSidebar } from "@/components/layout/app-sidebar";

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
          <AppSidebar companySettings={companySettings} />
          <AppShell>{children}</AppShell>
        </TooltipProvider>
      </SidebarProvider>
    </ThemeProvider>
  );
}
